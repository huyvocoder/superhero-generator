// lib/gemini-retry.ts
// Helper gọi Gemini API kèm retry khi gặp lỗi tạm thời (quá tải / rate limit)

interface RetryOptions {
  maxRetries?: number; // số lần thử lại tối đa
  baseDelayMs?: number; // delay cơ bản, tăng dần theo cấp số nhân (exponential backoff)
}

export async function fetchGeminiWithRetry(
  url: string,
  requestPayload: any,
  options: RetryOptions = {}
) {
  const { maxRetries = 2, baseDelayMs = 1000 } = options;

  let lastResponse: Response | null = null;
  let lastData: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    const data = await response.json();

    // Thành công hoặc lỗi KHÔNG phải do quá tải (vd: 400 sai payload) -> trả về ngay, không retry
    if (response.ok || (response.status !== 503 && response.status !== 429)) {
      return { response, data };
    }

    // Lỗi quá tải (503) hoặc rate limit (429) -> lưu lại, thử lại sau 1 khoảng delay
    lastResponse = response;
    lastData = data;

    if (attempt < maxRetries) {
      // Exponential backoff: lần 1 chờ 1s, lần 2 chờ 2s, lần 3 chờ 4s...
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Đã thử hết số lần cho phép mà vẫn lỗi -> trả về lỗi cuối cùng
  return { response: lastResponse!, data: lastData };
}