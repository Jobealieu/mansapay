import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  AT_API_KEY: z.string().min(1, 'AT_API_KEY is required'),
  AT_USERNAME: z.string().min(1, 'AT_USERNAME is required'),
  WALLET_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'WALLET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),
});

export const env = envSchema.parse(process.env);
