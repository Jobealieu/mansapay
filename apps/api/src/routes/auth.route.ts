import { Router, type Request, type Response } from 'express';
import { registerRequestSchema } from '@mansapay/shared';
import { registerUser, DuplicatePhoneNumberError } from '../services/auth.service.js';

export const authRouter = Router();

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
