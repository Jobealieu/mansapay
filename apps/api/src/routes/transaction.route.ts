import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { getTransactionById, listTransactions } from '../services/transaction.service.js';

export const transactionRouter = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  before: z.string().datetime().optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

transactionRouter.get('/transactions', requireAuth, async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await listTransactions(req.userId!, parsed.data);
    res.status(200).json(result);
  } catch (err) {
    console.error('transaction history lookup failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});

transactionRouter.get('/transactions/:id', requireAuth, async (req: Request, res: Response) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation_failed', details: parsed.error.flatten() });
    return;
  }

  try {
    const transaction = await getTransactionById(req.userId!, parsed.data.id);
    if (!transaction) {
      res.status(404).json({ error: 'transaction_not_found' });
      return;
    }
    res.status(200).json(transaction);
  } catch (err) {
    console.error('transaction lookup failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'internal_error' });
  }
});
