import { Router, type Request, type Response } from 'express';
import { healthResponseSchema, type HealthResponse } from '@mansapay/shared';
import { pingDb } from '../db/pool.js';
import { pingCache } from '../cache/redis.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const [dbResult, cacheResult] = await Promise.allSettled([pingDb(), pingCache()]);

  const db: HealthResponse['db'] = dbResult.status === 'fulfilled' ? 'ok' : 'error';
  const cache: HealthResponse['cache'] = cacheResult.status === 'fulfilled' ? 'ok' : 'error';
  const status: HealthResponse['status'] = db === 'ok' && cache === 'ok' ? 'ok' : 'error';

  const body = healthResponseSchema.parse({ status, db, cache });
  res.status(status === 'ok' ? 200 : 503).json(body);
});
