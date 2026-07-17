import argon2 from 'argon2';
import type { RegisterRequest } from '@mansapay/shared';
import { pool } from '../db/pool.js';

// ADR-0002: OWASP 2024 baseline argon2id parameters.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class DuplicatePhoneNumberError extends Error {
  constructor() {
    super('phone number already registered');
    this.name = 'DuplicatePhoneNumberError';
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === '23505';
}

export async function registerUser(input: RegisterRequest): Promise<{ userId: string }> {
  const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (phone_number, email, password_hash, country)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.phoneNumber, input.email ?? null, passwordHash, input.country],
    );
    return { userId: result.rows[0]!.id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicatePhoneNumberError();
    }
    throw err;
  }
}
