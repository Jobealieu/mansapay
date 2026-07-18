import { z } from 'zod';

const PHONE_E164_REGEX = /^\+[1-9]\d{1,14}$/;

export const phoneNumberSchema = z.string().regex(PHONE_E164_REGEX, 'Phone number must be in E.164 format');
