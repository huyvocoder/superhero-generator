// app/api/validate-image/route.ts
// Dùng Gemini (vision) để phân tích ảnh trước khi cho phép Generate:
// - Có khuôn mặt người không (chỉ chấp nhận đúng 1 khuôn mặt)
// - Ảnh có bị mờ/tối không (dùng thang mức độ thay vì true/false để tránh quá khắt khe)
// - Khuôn mặt có đủ rõ để giữ đặc điểm khi biến thành siêu anh hùng không

import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { fetchGeminiWithRetry } from '@/lib/gemini-retry';

// Giới hạn kích thước ảnh đầu vào (tính theo base64, chưa decode)
// 5MB base64 ~ tương đương khoảng 3.5-3.7MB ảnh gốc (base64 tăng ~37% dung lượng)
const MAX_BASE64_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Rate limit riêng cho validate: nới hơn generate vì đây là model nhẹ (flash-lite),
// không tốn phí bằng model gen ảnh, và người dùng có thể đổi ảnh nhiều lần trước khi ưng ý
const RATE_LIMIT = 15; // tối đa 15 lần validate
const RATE_WINDOW_MS = 60 * 1000; // trong vòng 60 giây / 1 IP

// Quyết định isValid + build reason bằng code (không để model tự suy luận),
// đảm bảo reason luôn khớp chính xác với flag thực tế đã trigger
function buildValidationResult(v: {
  hasFace: boolean;
  faceCount: number;
  blurLevel: 'none' | 'slight' | 'moderate' | 'severe';
  lightingLevel: 'good' | 'dim' | 'too_dark';
  isFaceClear: boolean;
}) {
  const reasons: string[] = [];

  // Chỉ coi là "mờ" khi ở mức moderate/severe -> tránh chặn nhầm ảnh webcam/hơi noise (slight vẫn pass)
  const isBlurry = v.blurLevel === 'moderate' || v.blurLevel === 'severe';
  const isTooDark = v.lightingLevel === 'too_dark';

  if (!v.hasFace || v.faceCount === 0) {
    reasons.push('Không phát hiện khuôn mặt nào trong ảnh.');
  } else if (v.faceCount > 1) {
    // Ràng buộc: hệ thống chỉ chấp nhận ảnh có đúng 1 khuôn mặt
    reasons.push(`Ảnh có ${v.faceCount} khuôn mặt. Vui lòng chọn ảnh chỉ có 1 người.`);
  }

  if (isBlurry) {
    reasons.push('Ảnh bị mờ khá nhiều, vui lòng chụp/chọn ảnh rõ nét hơn.');
  }

  if (isTooDark) {
    reasons.push('Ảnh quá tối, vui lòng chụp ở nơi đủ sáng.');
  }

  if (v.hasFace && v.faceCount === 1 && !v.isFaceClear) {
    reasons.push('Khuôn mặt chưa đủ rõ để giữ lại đặc điểm khi biến thành siêu anh hùng.');
  }

  const isValid =
    v.hasFace &&
    v.faceCount === 1 &&
    !isBlurry &&
    !isTooDark &&
    v.isFaceClear;

  return {
    ...v,
    isBlurry,
    isTooDark,
    isValid,
    reason: isValid ? 'Ảnh hợp lệ.' : reasons.join(' '),
  };
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // ---- Rate limit theo IP, chặn sớm trước khi tốn công đọc body/gọi Gemini ----
    const ip = getClientIp(request);
    const rl = checkRateLimit(`validate:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.allowed) {
      return Response.json(
        {
          success: false,
          error: `Bạn thao tác quá nhanh, vui lòng thử lại sau ${rl.resetInSeconds}s.`,
        },
        { status: 429 }
      );
    }

    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return Response.json(
        { success: false, error: 'Thiếu ảnh.' },
        { status: 400 }
      );
    }

    // ---- Kiểm tra kích thước ảnh trước khi gọi API tốn phí ----
    // Chuỗi base64 chỉ chứa ký tự ASCII nên length ~ số byte
    const approxSizeBytes = imageBase64.length * 0.75; // base64 -> byte thực tế (giải mã giảm ~25%)
    if (approxSizeBytes > MAX_BASE64_SIZE_BYTES) {
      return Response.json(
        {
          success: false,
          error: `Ảnh quá lớn (~${(approxSizeBytes / 1024 / 1024).toFixed(1)}MB). Vui lòng chọn ảnh dưới ${MAX_BASE64_SIZE_BYTES / 1024 / 1024}MB.`,
        },
        { status: 413 } // 413 Payload Too Large
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { success: false, error: 'Server chưa cấu hình GEMINI_API_KEY.' },
        { status: 500 }
      );
    }

    // Prompt yêu cầu Gemini phân tích ảnh, có nêu rõ ngữ cảnh (ảnh webcam/điện thoại đời thường,
    // không phải ảnh studio) để model hiệu chỉnh mức độ khắt khe hợp lý, tránh false positive
    const validationPrompt = `
        Bạn là bộ máy kiểm tra chất lượng ảnh chân dung để dùng cho việc tạo ảnh AI (giữ lại đặc điểm khuôn mặt). Đây KHÔNG phải kiểm tra ảnh chuyên nghiệp studio — ảnh chụp bằng webcam/điện thoại, hơi noise, ánh sáng phòng bình thường vẫn được chấp nhận, miễn là còn NHẬN RA RÕ các đặc điểm khuôn mặt (mắt, mũi, miệng, hình dạng khuôn mặt).

        Phân tích ảnh và trả lời CHÍNH XÁC theo định dạng JSON sau, không thêm text/markdown khác:

        {
        "hasFace": boolean,
        "faceCount": number,
        "blurLevel": "none" | "slight" | "moderate" | "severe",
        // none/slight: ảnh rõ nét hoặc hơi noise nhẹ do camera, vẫn nhận diện tốt đặc điểm khuôn mặt -> CHẤP NHẬN
        // moderate/severe: mờ đến mức khó nhận ra đường nét khuôn mặt -> TỪ CHỐI
        "lightingLevel": "good" | "dim" | "too_dark",
        // good/dim: đủ để thấy rõ mắt, mũi, miệng dù ánh sáng không hoàn hảo -> CHẤP NHẬN
        // too_dark: tối đến mức không phân biệt được đặc điểm khuôn mặt -> TỪ CHỐI
        "isFaceClear": boolean // true nếu tổng thể đặc điểm khuôn mặt (mắt, mũi, miệng, cấu trúc mặt) đủ rõ để AI giữ lại khi biến thành ảnh siêu anh hùng, KHÔNG cần ảnh chất lượng cao, chỉ cần nhận diện được
        }
    `.trim();

    const requestPayload = {
      contents: [
        {
          parts: [
            { text: validationPrompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        // Ép model trả JSON thuần, dễ parse hơn
        responseMimeType: 'application/json',
      },
    };
    const { response: geminiResponse, data: geminiData } = await fetchGeminiWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        requestPayload,
        { maxRetries: 2, baseDelayMs: 1000 } // thử lại tối đa 2 lần, delay 1s -> 2s
    );
    const latency = Date.now() - startTime;

    if (!geminiResponse.ok) {
      return Response.json(
        {
          success: false,
          error: geminiData?.error?.message || 'Lỗi không xác định khi kiểm tra ảnh.',
          httpStatus: geminiResponse.status,
          latency,
        },
        { status: geminiResponse.status }
      );
    }

    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return Response.json(
        {
          success: false,
          error: 'Gemini không trả về kết quả phân tích ảnh.',
          httpStatus: geminiResponse.status,
          latency,
        },
        { status: 502 }
      );
    }

    let rawValidation;
    try {
      // Phòng trường hợp model lỡ bọc thêm ```json ... ```
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      rawValidation = JSON.parse(cleaned);
    } catch (parseErr) {
      return Response.json(
        {
          success: false,
          error: 'Không thể phân tích kết quả trả về từ Gemini.',
          httpStatus: geminiResponse.status,
          latency,
        },
        { status: 502 }
      );
    }

    // Quyết định isValid + reason bằng code, không để model tự suy luận
    const validation = buildValidationResult(rawValidation);

    return Response.json({
      success: true,
      validation,
      httpStatus: geminiResponse.status,
      latency,
      requestPayload: { prompt: validationPrompt },
    });
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return Response.json(
      {
        success: false,
        error: error.message || 'Lỗi không xác định khi kiểm tra ảnh.',
        latency,
      },
      { status: 500 }
    );
  }
}