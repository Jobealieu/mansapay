import { z } from 'zod';

const PHONE_E164_REGEX = /^\+[1-9]\d{1,14}$/;
const COUNTRY_ALPHA2_REGEX = /^[A-Z]{2}$/;

export const registerRequestSchema = z.object({
  phoneNumber: z.string().regex(PHONE_E164_REGEX, 'Phone number must be in E.164 format'),
  email: z.string().email().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  country: z.string().regex(COUNTRY_ALPHA2_REGEX, 'Country must be an ISO 3166-1 alpha-2 code'),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
