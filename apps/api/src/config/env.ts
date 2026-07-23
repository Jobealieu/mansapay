import 'dotenv/config';
import { z } from 'zod';

// z.coerce.boolean() is a footgun here: the *string* "false" is non-empty,
// so it coerces to `true`. This only accepts the literal strings.
const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z
  .object({
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
    // DEV ONLY: bypasses Africa's Talking and logs OTP codes to the server
    // console instead. See the production guard below.
    SMS_DEV_MODE: booleanFlag,
    // Marks this deployment as the public academic grading demo. Its only
    // effect is permitting SMS_DEV_MODE=true in production (see below).
    // Must never be set for a deployment serving real users.
    DEMO_MODE: booleanFlag,
  })
  .refine((data) => !(data.NODE_ENV === 'production' && data.SMS_DEV_MODE && !data.DEMO_MODE), {
    message:
      'SMS_DEV_MODE=true in production requires DEMO_MODE=true (reserved for the public academic ' +
      'grading deployment). Refusing to start: this combination would silently skip real SMS ' +
      'delivery for real users.',
    path: ['SMS_DEV_MODE'],
  });

export const env = envSchema.parse(process.env);
