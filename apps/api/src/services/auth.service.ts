import argon2 from 'argon2';
import type { LoginRequest, RegisterRequest } from '@mansapay/shared';
import { pool } from '../db/pool.js';
import { issueRefreshToken, type Session } from './session.service.js';
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from './token.service.js';

// ADR-0002: OWASP 2024 baseline argon2id parameters.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

// Real argon2id hash computed once at startup so a login attempt against an
// unknown phone number still pays the argon2.verify cost — same response
// timing whether or not the account exists.
const DUMMY_PASSWORD_HASH = await argon2.hash('mansapay-timing-safety-dummy', ARGON2_OPTIONS);

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

export async function loginUser(input: LoginRequest): Promise<Session | null> {
  const result = await pool.query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE phone_number = $1',
    [input.phoneNumber],
  );
  const user = result.rows[0];

  if (!user) {
    await argon2.verify(DUMMY_PASSWORD_HASH, input.password).catch(() => false);
    return null;
  }

  const passwordMatches = await argon2.verify(user.password_hash, input.password);
  if (!passwordMatches) {
    return null;
  }

  const { token: refreshToken } = await issueRefreshToken(user.id);
  return {
    accessToken: signAccessToken(user.id),
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export async function getUserById(
  userId: string,
): Promise<{ id: string; phoneNumber: string; country: string } | null> {
  const result = await pool.query<{ id: string; phone_number: string; country: string }>(
    'SELECT id, phone_number, country FROM users WHERE id = $1',
    [userId],
  );
  const user = result.rows[0];
  return user ? { id: user.id, phoneNumber: user.phone_number, country: user.country } : null;
}
