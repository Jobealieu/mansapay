import { z } from 'zod';
import { phoneNumberSchema } from './phone.schema.js';

export const loginRequestSchema = z.object({
  phoneNumber: phoneNumberSchema,
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
