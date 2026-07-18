import { ensureConnected, redisClient } from '../cache/redis.js';

const MAX_ATTEMPTS_PER_PHONE = 5;
const MAX_ATTEMPTS_PER_IP = 20;
const WINDOW_SECONDS = 15 * 60;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

async function checkAndIncrement(key: string, limit: number): Promise<RateLimitResult> {
  await ensureConnected();
  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.expire(key, WINDOW_SECONDS);
  }
  if (count <= limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const ttl = await redisClient.ttl(key);
  return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : WINDOW_SECONDS };
}

export async function checkLoginRateLimit(phoneNumber: string, ip: string): Promise<RateLimitResult> {
  const [byPhone, byIp] = await Promise.all([
    checkAndIncrement(`ratelimit:login:phone:${phoneNumber}`, MAX_ATTEMPTS_PER_PHONE),
    checkAndIncrement(`ratelimit:login:ip:${ip}`, MAX_ATTEMPTS_PER_IP),
  ]);

  if (!byPhone.allowed || !byIp.allowed) {
    return { allowed: false, retryAfterSeconds: Math.max(byPhone.retryAfterSeconds, byIp.retryAfterSeconds) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
