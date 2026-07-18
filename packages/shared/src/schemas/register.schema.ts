import { z } from 'zod';
import { phoneNumberSchema } from './phone.schema.js';

const COUNTRY_ALPHA2_REGEX = /^[A-Z]{2}$/;

export const registerRequestSchema = z.object({
  phoneNumber: phoneNumberSchema,
  email: z.string().email().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  country: z.string().regex(COUNTRY_ALPHA2_REGEX, 'Country must be an ISO 3166-1 alpha-2 code'),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
