import express, { type Express } from 'express';
import { healthRouter } from './routes/health.route.js';
import { authRouter } from './routes/auth.route.js';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(authRouter);
  return app;
}
