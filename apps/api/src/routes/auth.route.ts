import { Router, type Request, type Response } from 'express';
import { loginRequestSchema, refreshTokenRequestSchema, registerRequestSchema } from '@mansapay/shared';
import { registerUser, loginUser, getUserById, DuplicatePhoneNumberError } from '../services/auth.service.js';
import { rotateRefreshToken, revokeRefreshToken } from '../services/session.service.js';
import { checkLoginRateLimit } from '../services/rate-limit.service.js';
import { requireAuth } from '../middleware/require-auth.js';

export const authRouter = Router();

const INVALID_CREDENTIALS_RESPONSE = { error: 'invalid_credentials' } as const;
const INVALID_REFRESH_TOKEN_RESPONSE = { error: 'invalid_refresh_token' } as const;

authRouter.post('/auth/register', async (req: Request, res: Response) => {
  const parsed = registerRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const { userId } = await registerUser(parsed.data);
    res.status(201).json({ userId });
  } catch (err) {
    if (err instanceof DuplicatePhoneNumberError) {
      res.status(409).json({ error: 'phone_number_taken' });
      return;
    }
    console.error('registration failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});

authRouter.post('/auth/login', async (req: Request, res: Response) => {
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_failed', details: parsed.error.flatten() });
    return;
  }

  try {
    // DECISION(availability): fail-closed - Redis outage blocks login.
    // Acceptable now (Redis co-located with API, shared fate). Revisit
    // when Redis is a separate network dependency in production:
    // candidate then is fail-open + error-level alert.
    const rateLimit = await checkLoginRateLimit(parsed.data.phoneNumber, req.ip ?? 'unknown');
    if (!rateLimit.allowed) {
      res.status(429).set('Retry-After', String(rateLimit.retryAfterSeconds)).json({ error: 'rate_limited' });
      return;
    }

    const session = await loginUser(parsed.data);
    if (!session) {
      res.status(401).json(INVALID_CREDENTIALS_RESPONSE);
      return;
    }
    res.status(200).json(session);
  } catch (err) {
    console.error('login failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});

authRouter.post('/auth/refresh', async (req: Request, res: Response) => {
  const parsed = refreshTokenRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const session = await rotateRefreshToken(parsed.data.refreshToken);
    if (!session) {
      res.status(401).json(INVALID_REFRESH_TOKEN_RESPONSE);
      return;
    }
    res.status(200).json(session);
  } catch (err) {
    console.error('token refresh failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});

authRouter.post('/auth/logout', async (req: Request, res: Response) => {
  const parsed = refreshTokenRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_failed', details: parsed.error.flatten() });
    return;
  }

  try {
    await revokeRefreshToken(parsed.data.refreshToken);
    res.status(204).send();
  } catch (err) {
    console.error('logout failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});

authRouter.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  const user = await getUserById(req.userId!);
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  res.status(200).json({ userId: user.id, phoneNumber: user.phoneNumber, country: user.country });
});
