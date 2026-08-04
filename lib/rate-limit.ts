// lib/rate-limit.ts
// Rate limit đơn giản dùng in-memory Map (đủ dùng cho demo/intern test).
// LƯU Ý: trên serverless (Vercel) mỗi instance có bộ nhớ riêng, cold start sẽ reset counter.
// Nếu deploy production thật, nên thay bằng Redis (Upstash) để rate limit chính xác across instances.

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp hết hạn window
}

const store = new Map<string, RateLimitEntry>();

// Dọn rác định kỳ để tránh Map phình to vô hạn (mỗi 10 phút)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 10 * 60 * 1000);

/**
 * Kiểm tra + tăng counter cho 1 key (thường là `${ip}:${route}`).
 * @param key định danh duy nhất (vd: IP + tên route)
 * @param limit số request tối đa trong 1 window
 * @param windowMs độ dài window (ms)
 */
export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // Chưa có record hoặc đã hết window cũ -> tạo window mới
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetInSeconds: Math.ceil(windowMs / 1000) };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetInSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetInSeconds: Math.ceil((entry.resetAt - now) / 1000) };
}

// Lấy IP từ request (Vercel/Next.js truyền qua header x-forwarded-for)
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || 'unknown';
}