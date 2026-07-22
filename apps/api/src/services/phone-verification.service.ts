import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { pool } from '../db/pool.js';
import { ensureConnected, redisClient } from '../cache/redis.js';
import { sendSms } from './sms.service.js';

// TODO(security): any future phone-number change must reset
// phone_verified to false and clear outstanding OTP keys. Verified
// status must never carry over to a new number.

const OTP_TTL_SECONDS = 10 * 60;
const MAX_CONFIRM_ATTEMPTS = 5;

type VerificationEvent = 'requested' | 'confirmed' | 'failed' | 'expired' | 'burned';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function hashKey(userId: string): string {
  return `otp:hash:${userId}`;
}

function attemptsKey(userId: string): string {
  return `otp:attempts:${userId}`;
}

async function logEvent(userId: string, event: VerificationEvent, ip: string): Promise<void> {
  await pool.query('INSERT INTO phone_verifications (user_id, event, ip) VALUES ($1, $2, $3)', [userId, event, ip]);
}

export class OtpSendFailedError extends Error {
  constructor() {
    super('failed to send verification code');
    this.name = 'OtpSendFailedError';
  }
}

export async function requestOtp(userId: string, phoneNumber: string, ip: string): Promise<void> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const hash = hashCode(code);

  await ensureConnected();
  await redisClient.set(hashKey(userId), hash, { EX: OTP_TTL_SECONDS });
  await redisClient.set(attemptsKey(userId), '0', { EX: OTP_TTL_SECONDS });

  try {
    await sendSms(phoneNumber, `Your MansaPay verification code is ${code}. It expires in 10 minutes.`);
  } catch {
    await redisClient.del([hashKey(userId), attemptsKey(userId)]);
    await logEvent(userId, 'failed', ip);
    throw new OtpSendFailedError();
  }

  await logEvent(userId, 'requested', ip);
}

export type ConfirmOtpResult = 'confirmed' | 'invalid';

export async function confirmOtp(userId: string, code: string, ip: string): Promise<ConfirmOtpResult> {
  await ensureConnected();
  const storedHash = await redisClient.get(hashKey(userId));

  if (!storedHash) {
    await logEvent(userId, 'expired', ip);
    return 'invalid';
  }

  const providedHash = hashCode(code);
  const matches =
    storedHash.length === providedHash.length &&
    timingSafeEqual(Buffer.from(storedHash), Buffer.from(providedHash));

  if (matches) {
    await pool.query('UPDATE users SET phone_verified = true WHERE id = $1', [userId]);
    await redisClient.del([hashKey(userId), attemptsKey(userId)]);
    await logEvent(userId, 'confirmed', ip);
    return 'confirmed';
  }

  const attempts = await redisClient.incr(attemptsKey(userId));
  if (attempts >= MAX_CONFIRM_ATTEMPTS) {
    await redisClient.del([hashKey(userId), attemptsKey(userId)]);
    await logEvent(userId, 'burned', ip);
  } else {
    await logEvent(userId, 'failed', ip);
  }
  return 'invalid';
}
