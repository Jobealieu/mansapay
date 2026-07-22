import { ensureConnected, redisClient } from '../cache/redis.js';

const MAX_ATTEMPTS_PER_PHONE = 5;
const MAX_ATTEMPTS_PER_IP = 20;
const LOGIN_WINDOW_SECONDS = 15 * 60;

const OTP_REQUEST_LIMIT_PER_PHONE = 3;
const OTP_REQUEST_WINDOW_SECONDS = 60 * 60;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

async function checkAndIncrement(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  await ensureConnected();
  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.expire(key, windowSeconds);
  }
  if (count <= limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const ttl = await redisClient.ttl(key);
  return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
}

export async function checkLoginRateLimit(phoneNumber: string, ip: string): Promise<RateLimitResult> {
  const [byPhone, byIp] = await Promise.all([
    checkAndIncrement(`ratelimit:login:phone:${phoneNumber}`, MAX_ATTEMPTS_PER_PHONE, LOGIN_WINDOW_SECONDS),
    checkAndIncrement(`ratelimit:login:ip:${ip}`, MAX_ATTEMPTS_PER_IP, LOGIN_WINDOW_SECONDS),
  ]);

  if (!byPhone.allowed || !byIp.allowed) {
    return { allowed: false, retryAfterSeconds: Math.max(byPhone.retryAfterSeconds, byIp.retryAfterSeconds) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function checkOtpRequestRateLimit(phoneNumber: string): Promise<RateLimitResult> {
  return checkAndIncrement(`ratelimit:otp:phone:${phoneNumber}`, OTP_REQUEST_LIMIT_PER_PHONE, OTP_REQUEST_WINDOW_SECONDS);
}

// Called when a code was never actually delivered (send failure/timeout) so
// the failed attempt doesn't count against the caller's request budget.
export async function refundOtpRequestRateLimit(phoneNumber: string): Promise<void> {
  await ensureConnected();
  await redisClient.decr(`ratelimit:otp:phone:${phoneNumber}`);
}
