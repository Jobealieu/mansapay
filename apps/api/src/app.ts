import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.route.js';
import { authRouter } from './routes/auth.route.js';
import { verifyRouter } from './routes/verify.route.js';
import { walletRouter } from './routes/wallet.route.js';
import { transactionRouter } from './routes/transaction.route.js';

export function createApp(): Express {
  const app = express();

  // Render puts exactly one reverse proxy (its load balancer) in front of
  // this process. `1` means "trust the first hop's X-Forwarded-For entry
  // as req.ip" - the narrowest setting that is still correct here. `true`
  // would trust the whole chain, which would let a client spoof its own
  // X-Forwarded-For and defeat the per-IP rate limiting from Sprint 2.5.
  app.set('trust proxy', 1);

  // Frontend and API are different origins in production. We use
  // Authorization headers for auth, not cookies, so credentials (cookies/
  // HTTP auth) don't need to cross origins - hence credentials: false.
  app.use(cors({ origin: env.ALLOWED_ORIGINS, credentials: false }));

  app.use(express.json());
  app.use(healthRouter);
  app.use(authRouter);
  app.use(verifyRouter);
  app.use(walletRouter);
  app.use(transactionRouter);
  return app;
}
