// app/api/generate/route.ts
// Backend logic (Serverless Function): nhận ảnh + lựa chọn nhân vật,
// gọi Gemini 2.5 Flash Image API (đã bật billing) để tạo ảnh siêu anh hùng.

import { HEROES, MYSTERY_PROMPTS } from '@/config/heroes.config';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { fetchGeminiWithRetry } from '@/lib/gemini-retry';

// Giới hạn kích thước ảnh đầu vào (đồng bộ với /api/validate-image)
const MAX_BASE64_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Rate limit riêng cho generate: giới hạn CHẶT hơn validate-image vì đây là bước tốn phí
// (gọi model gen ảnh, đắt hơn nhiều so với model phân tích ảnh thường)
const RATE_LIMIT = 5; // tối đa 5 lần generate
const RATE_WINDOW_MS = 60 * 1000; // trong vòng 60 giây / 1 IP

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // ---- Rate limit theo IP, chặn sớm trước khi tốn công đọc body/gọi Gemini ----
    const ip = getClientIp(request);
    const rl = checkRateLimit(`generate:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.allowed) {
      return Response.json(
        {
          success: false,
          error: `Bạn thao tác quá nhanh, vui lòng thử lại sau ${rl.resetInSeconds}s.`,
        },
        { status: 429 } // 429 Too Many Requests
      );
    }

    const { imageBase64, heroId, aspectRatio } = await request.json();

    if (!imageBase64 || !heroId) {
      return Response.json(
        { success: false, error: 'Thiếu ảnh hoặc lựa chọn nhân vật.' },
        { status: 400 }
      );
    }

    // ---- Kiểm tra kích thước ảnh (phòng trường hợp request bỏ qua bước validate-image) ----
    const approxSizeBytes = imageBase64.length * 0.75;
    if (approxSizeBytes > MAX_BASE64_SIZE_BYTES) {
      return Response.json(
        {
          success: false,
          error: `Ảnh quá lớn (~${(approxSizeBytes / 1024 / 1024).toFixed(1)}MB). Vui lòng chọn ảnh dưới ${MAX_BASE64_SIZE_BYTES / 1024 / 1024}MB.`,
        },
        { status: 413 }
      );
    }

    // Tìm cấu hình nhân vật tương ứng
    const hero = HEROES.find((h) => h.id === heroId);
    if (!hero) {
      return Response.json(
        { success: false, error: 'Nhân vật không hợp lệ.' },
        { status: 400 }
      );
    }

    // Nếu là "Bí ẩn" -> random 1 prompt trong danh sách MYSTERY_PROMPTS
    const finalPrompt = hero.isMystery
      ? MYSTERY_PROMPTS[Math.floor(Math.random() * MYSTERY_PROMPTS.length)]
      : hero.prompt;

    // Payload gửi tới Gemini API
    const requestPayload = {
      contents: [
        {
          parts: [
            { text: finalPrompt },
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
        imageConfig: {
          aspectRatio: aspectRatio || '9:16',
        },
      },
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { success: false, error: 'Server chưa cấu hình GEMINI_API_KEY.' },
        { status: 500 }
      );
    }

    const { response: geminiResponse, data: geminiData } = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      requestPayload,
      { maxRetries: 2, baseDelayMs: 1000 } // thử lại tối đa 2 lần, delay 1s -> 2s
    );
    const latency = Date.now() - startTime;

    // Xử lý lỗi từ phía Gemini (rate limit từ Google, invalid key, content filter, timeout...)
    // Dùng thẳng message trả về từ Gemini, không cần map/dịch thủ công từng loại lỗi
    if (!geminiResponse.ok) {
      return Response.json(
        {
          success: false,
          error: geminiData?.error?.message || 'Lỗi không xác định từ Gemini API.',
          httpStatus: geminiResponse.status,
          latency,
          requestPayload: { prompt: finalPrompt, aspectRatio },
        },
        { status: geminiResponse.status }
      );
    }

    // Trích xuất ảnh base64 trả về từ response
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData || p.inline_data);
    const resultImageBase64 =
      imagePart?.inlineData?.data || imagePart?.inline_data?.data || null;

    if (!resultImageBase64) {
      return Response.json(
        {
          success: false,
          error: 'Gemini không trả về ảnh. Có thể prompt bị filter hoặc lỗi nội dung.',
          httpStatus: geminiResponse.status,
          latency,
          requestPayload: { prompt: finalPrompt, aspectRatio },
        },
        { status: 502 }
      );
    }

    return Response.json({
      success: true,
      resultImageBase64,
      heroName: hero.name,
      promptUsed: finalPrompt,
      httpStatus: geminiResponse.status,
      latency,
      requestPayload: { prompt: finalPrompt, aspectRatio },
    });
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return Response.json(
      {
        success: false,
        error: error.message || 'Lỗi không xác định khi xử lý request.',
        latency,
      },
      { status: 500 }
    );
  }
}