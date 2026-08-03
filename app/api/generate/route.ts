// app/api/generate/route.ts
// Backend logic (Serverless Function): nhận ảnh + lựa chọn nhân vật,
// gọi Gemini 2.5 Flash Image API (đã bật billing) để tạo ảnh siêu anh hùng.

import { HEROES, MYSTERY_PROMPTS } from '@/config/heroes.config';

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { imageBase64, heroId, aspectRatio } = await request.json();

    if (!imageBase64 || !heroId) {
      return Response.json(
        { success: false, error: 'Thiếu ảnh hoặc lựa chọn nhân vật.' },
        { status: 400 }
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

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      }
    );

    const geminiData = await geminiResponse.json();
    const latency = Date.now() - startTime;

    // Xử lý lỗi từ phía Gemini (rate limit, invalid key, content filter, timeout...)
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