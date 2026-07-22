import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { getUserById } from '../services/auth.service.js';
import { checkOtpRequestRateLimit, refundOtpRequestRateLimit } from '../services/rate-limit.service.js';
import { requestOtp, confirmOtp, OtpSendFailedError } from '../services/phone-verification.service.js';

export const verifyRouter = Router();

const confirmRequestSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'code must be a 6-digit number'),
});

// Deliberately identical for wrong / expired / burned / malformed-input so a
// client can never distinguish why a code was rejected.
const INVALID_OR_EXPIRED_CODE_RESPONSE = { error: 'invalid_or_expired_code' } as const;

verifyRouter.post('/auth/verify/request', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const ip = req.ip ?? 'unknown';

  try {
    const user = await getUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const rateLimit = await checkOtpRequestRateLimit(user.phoneNumber);
    if (!rateLimit.allowed) {
      res.status(429).set('Retry-After', String(rateLimit.retryAfterSeconds)).json({ error: 'rate_limited' });
      return;
    }

    try {
      await requestOtp(userId, user.phoneNumber, ip);
    } catch (err) {
      await refundOtpRequestRateLimit(user.phoneNumber);
      if (err instanceof OtpSendFailedError) {
        res.status(502).json({ error: 'sms_send_failed' });
        return;
      }
      throw err;
    }

    res.status(204).send();
  } catch (err) {
    console.error('otp request failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});

verifyRouter.post('/auth/verify/confirm', requireAuth, async (req: Request, res: Response) => {
  const parsed = confirmRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(INVALID_OR_EXPIRED_CODE_RESPONSE);
    return;
  }

  const userId = req.userId!;
  const ip = req.ip ?? 'unknown';

  try {
    const result = await confirmOtp(userId, parsed.data.code, ip);
    if (result === 'confirmed') {
      res.status(200).json({ phoneVerified: true });
      return;
    }
    res.status(400).json(INVALID_OR_EXPIRED_CODE_RESPONSE);
  } catch (err) {
    console.error('otp confirm failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});
