import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { phoneNumberSchema } from '@mansapay/shared';
import { requireAuth } from '../middleware/require-auth.js';
import {
  createWallet,
  getBalance,
  transfer,
  WalletNotFoundError,
  RecipientWalletNotFoundError,
  InsufficientBalanceError,
  SelfTransferError,
} from '../services/wallet.service.js';

export const walletRouter = Router();

const transferRequestSchema = z.object({
  toPhoneNumber: phoneNumberSchema,
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,7})?$/, 'amount must be a positive decimal string with up to 7 decimal places')
    .refine((value) => Number(value) > 0, 'amount must be greater than 0'),
});

walletRouter.post('/wallet/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const { publicKey, created } = await createWallet(req.userId!);
    res.status(created ? 201 : 200).json({ publicKey });
  } catch (err) {
    console.error('wallet creation failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});

walletRouter.get('/wallet/balance', requireAuth, async (req: Request, res: Response) => {
  try {
    const balance = await getBalance(req.userId!);
    res.status(200).json({ balance, asset: 'XLM' });
  } catch (err) {
    if (err instanceof WalletNotFoundError) {
      res.status(404).json({ error: 'wallet_not_found' });
      return;
    }
    console.error('balance lookup failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});

walletRouter.post('/wallet/transfer', requireAuth, async (req: Request, res: Response) => {
  const parsed = transferRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const { hash } = await transfer(req.userId!, parsed.data.toPhoneNumber, parsed.data.amount);
    res.status(200).json({ hash });
  } catch (err) {
    if (err instanceof WalletNotFoundError) {
      res.status(400).json({ error: 'wallet_not_found' });
      return;
    }
    if (err instanceof RecipientWalletNotFoundError) {
      res.status(400).json({ error: 'recipient_wallet_not_found' });
      return;
    }
    if (err instanceof SelfTransferError) {
      res.status(400).json({ error: 'self_transfer_not_allowed' });
      return;
    }
    if (err instanceof InsufficientBalanceError) {
      res.status(400).json({ error: 'insufficient_balance' });
      return;
    }
    console.error('transfer failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});
