import express, { type Express } from 'express';
import { healthRouter } from './routes/health.route.js';
import { authRouter } from './routes/auth.route.js';
import { verifyRouter } from './routes/verify.route.js';
import { walletRouter } from './routes/wallet.route.js';
import { transactionRouter } from './routes/transaction.route.js';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(authRouter);
  app.use(verifyRouter);
  app.use(walletRouter);
  app.use(transactionRouter);
  return app;
}
