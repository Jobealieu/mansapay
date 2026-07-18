import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

const queryMock = vi.fn();
const clientQueryMock = vi.fn();
const releaseMock = vi.fn();
const connectMock = vi.fn(async () => ({ query: clientQueryMock, release: releaseMock }));

vi.mock('../db/pool.js', () => ({
  pool: {
    query: (...args: unknown[]) => queryMock(...args),
    connect: () => connectMock(),
  },
}));

const redisIncrMock = vi.fn();
const redisExpireMock = vi.fn();
const redisTtlMock = vi.fn();

vi.mock('../cache/redis.js', () => ({
  ensureConnected: vi.fn().mockResolvedValue(undefined),
  redisClient: {
    incr: (...args: unknown[]) => redisIncrMock(...args),
    expire: (...args: unknown[]) => redisExpireMock(...args),
    ttl: (...args: unknown[]) => redisTtlMock(...args),
  },
}));

// Default: every login attempt is under the rate-limit thresholds.
beforeEach(() => {
  redisIncrMock.mockReset().mockResolvedValue(1);
  redisExpireMock.mockReset().mockResolvedValue(undefined);
  redisTtlMock.mockReset().mockResolvedValue(900);
});

const validBody = {
  phoneNumber: '+2207700000',
  password: 'correct-horse-battery',
  country: 'GM',
};

const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('POST /auth/register', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('registers a new user and returns 201 with the userId', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: USER_ID }] });

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/auth/register').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ userId: USER_ID });
    expect(JSON.stringify(res.body)).not.toContain('correct-horse-battery');
  });

  it('returns 409 when the phone number is already registered', async () => {
    queryMock.mockRejectedValueOnce({ code: '23505' });

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/auth/register').send(validBody);

    expect(res.status).toBe(409);
  });

  it('returns 400 for a password shorter than 8 characters', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/register')
      .send({ ...validBody, password: 'short1' });

    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a phone number that is not in E.164 format', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/register')
      .send({ ...validBody, phoneNumber: '00220700000' });

    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('logs in with correct credentials and returns tokens', async () => {
    const passwordHash = await argon2.hash(validBody.password);
    queryMock.mockResolvedValueOnce({ rows: [{ id: USER_ID, password_hash: passwordHash }] });
    queryMock.mockResolvedValueOnce({}); // refresh token insert

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/login')
      .send({ phoneNumber: validBody.phoneNumber, password: validBody.password });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
    });
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
  });

  it('returns 401 with a generic body for the wrong password', async () => {
    const passwordHash = await argon2.hash(validBody.password);
    queryMock.mockResolvedValueOnce({ rows: [{ id: USER_ID, password_hash: passwordHash }] });

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/login')
      .send({ phoneNumber: validBody.phoneNumber, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
  });

  it('returns the identical 401 body for an unknown phone number', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/login')
      .send({ phoneNumber: '+2219990000', password: 'whatever-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
  });

  it('returns 429 with Retry-After once the per-phone rate limit is exceeded', async () => {
    redisIncrMock.mockReset();
    redisIncrMock.mockResolvedValueOnce(6); // phone counter: over the limit of 5
    redisIncrMock.mockResolvedValueOnce(1); // ip counter: fine
    redisTtlMock.mockResolvedValueOnce(600);

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/login')
      .send({ phoneNumber: validBody.phoneNumber, password: validBody.password });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited' });
    expect(res.headers['retry-after']).toBe('600');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 429 once the per-IP rate limit is exceeded', async () => {
    redisIncrMock.mockReset();
    redisIncrMock.mockResolvedValueOnce(1); // phone counter: fine
    redisIncrMock.mockResolvedValueOnce(21); // ip counter: over the limit of 20
    redisTtlMock.mockResolvedValueOnce(900);

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/login')
      .send({ phoneNumber: validBody.phoneNumber, password: validBody.password });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited' });
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('POST /auth/refresh', () => {
  beforeEach(() => {
    queryMock.mockReset();
    clientQueryMock.mockReset();
    releaseMock.mockReset();
    connectMock.mockClear();
  });

  it('rotates a valid refresh token into a new session, carrying the family forward', async () => {
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60);
    const familyId = 'family-abc';
    clientQueryMock
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 'row-1', user_id: USER_ID, family_id: familyId, expires_at: futureExpiry, revoked_at: null }],
      }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce(undefined) // UPDATE revoked_at
      .mockResolvedValueOnce(undefined) // INSERT new token
      .mockResolvedValueOnce(undefined); // COMMIT

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/auth/refresh').send({ refreshToken: 'a'.repeat(64) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
    });
    expect(res.body.refreshToken).not.toBe('a'.repeat(64));
    expect(releaseMock).toHaveBeenCalled();

    const insertCall = clientQueryMock.mock.calls[3]!;
    expect(insertCall[1]).toEqual([USER_ID, expect.any(String), expect.any(Date), familyId]);
  });

  it('cascades revocation across the token family when a revoked token is replayed', async () => {
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60);
    const revokedAt = new Date(Date.now() - 1000 * 60);
    const familyId = 'family-xyz';
    clientQueryMock
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 'row-1', user_id: USER_ID, family_id: familyId, expires_at: futureExpiry, revoked_at: revokedAt }],
      }) // SELECT ... FOR UPDATE, already revoked
      .mockResolvedValueOnce(undefined) // cascade UPDATE by family_id
      .mockResolvedValueOnce(undefined); // COMMIT

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/auth/refresh').send({ refreshToken: 'b'.repeat(64) });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_refresh_token' });

    const cascadeCall = clientQueryMock.mock.calls[2]!;
    expect(cascadeCall[0]).toMatch(/UPDATE refresh_tokens SET revoked_at = now\(\) WHERE family_id/);
    expect(cascadeCall[1]).toEqual([familyId]);
  });
});

describe('POST /auth/logout', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('revokes the refresh token and returns 204', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1 });

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/auth/logout').send({ refreshToken: 'c'.repeat(64) });

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });
});

describe('GET /auth/me', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns the user profile for a valid access token', async () => {
    const { env } = await import('../config/env.js');
    const token = jwt.sign({ sub: USER_ID }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 900 });
    queryMock.mockResolvedValueOnce({
      rows: [{ id: USER_ID, phone_number: validBody.phoneNumber, country: validBody.country }],
    });

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: USER_ID, phoneNumber: validBody.phoneNumber, country: validBody.country });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('returns 401 with no token', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/auth/me');

    expect(res.status).toBe(401);
  });

  it('returns 401 with an expired token', async () => {
    const { env } = await import('../config/env.js');
    const expiredToken = jwt.sign(
      { sub: USER_ID, exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_SECRET,
      { algorithm: 'HS256' },
    );

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/auth/me').set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
