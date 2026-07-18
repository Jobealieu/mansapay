import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { ACCESS_TOKEN_TTL_SECONDS, generateRefreshToken, hashRefreshToken, signAccessToken } from './token.service.js';

interface RefreshTokenRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function issueRefreshToken(
  userId: string,
  familyId: string = randomUUID(),
): Promise<{ token: string; expiresAt: Date }> {
  const { token, tokenHash, expiresAt } = generateRefreshToken();
  await pool.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at, family_id) VALUES ($1, $2, $3, $4)', [
    userId,
    tokenHash,
    expiresAt,
    familyId,
  ]);
  return { token, expiresAt };
}

export async function rotateRefreshToken(rawToken: string): Promise<Session | null> {
  const tokenHash = hashRefreshToken(rawToken);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query<RefreshTokenRow>(
      'SELECT id, user_id, family_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE',
      [tokenHash],
    );
    const row = result.rows[0];

    if (!row) {
      await client.query('ROLLBACK');
      return null;
    }

    if (row.revoked_at !== null) {
      // Reuse of an already-rotated token: treat the family as compromised
      // and kill every other still-active token in it.
      await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [
        row.family_id,
      ]);
      await client.query('COMMIT');
      return null;
    }

    if (row.expires_at.getTime() < Date.now()) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id]);

    const { token: refreshToken, tokenHash: newHash, expiresAt } = generateRefreshToken();
    await client.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at, family_id) VALUES ($1, $2, $3, $4)', [
      row.user_id,
      newHash,
      expiresAt,
      row.family_id,
    ]);

    await client.query('COMMIT');

    return {
      accessToken: signAccessToken(row.user_id),
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
    tokenHash,
  ]);
}
