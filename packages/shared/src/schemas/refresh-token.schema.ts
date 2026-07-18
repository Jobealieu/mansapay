import { z } from 'zod';

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;
