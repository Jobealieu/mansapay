import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';

const queryMock = vi.fn();

vi.mock('../db/pool.js', () => ({
  pool: {
    query: (...args: unknown[]) => queryMock(...args),
  },
}));

const redisGetMock = vi.fn();
const redisSetMock = vi.fn();
const redisDelMock = vi.fn();
const redisIncrMock = vi.fn();
const redisDecrMock = vi.fn();
const redisExpireMock = vi.fn();
const redisTtlMock = vi.fn();

vi.mock('../cache/redis.js', () => ({
  ensureConnected: vi.fn().mockResolvedValue(undefined),
  redisClient: {
    get: (...args: unknown[]) => redisGetMock(...args),
    set: (...args: unknown[]) => redisSetMock(...args),
    del: (...args: unknown[]) => redisDelMock(...args),
    incr: (...args: unknown[]) => redisIncrMock(...args),
    decr: (...args: unknown[]) => redisDecrMock(...args),
    expire: (...args: unknown[]) => redisExpireMock(...args),
    ttl: (...args: unknown[]) => redisTtlMock(...args),
  },
}));

const sendSmsMock = vi.fn();

vi.mock('../services/sms.service.js', () => ({
  sendSms: (...args: unknown[]) => sendSmsMock(...args),
}));

const USER_ID = '11111111-1111-1111-1111-111111111111';
const PHONE_NUMBER = '+2207700000';
const CODE = '123456';

function hashOf(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

async function authHeader(): Promise<string> {
  const { env } = await import('../config/env.js');
  return `Bearer ${jwt.sign({ sub: USER_ID }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 900 })}`;
}

beforeEach(() => {
  queryMock.mockReset();
  redisGetMock.mockReset();
  redisSetMock.mockReset().mockResolvedValue(undefined);
  redisDelMock.mockReset().mockResolvedValue(undefined);
  redisIncrMock.mockReset();
  redisDecrMock.mockReset().mockResolvedValue(undefined);
  redisExpireMock.mockReset().mockResolvedValue(undefined);
  redisTtlMock.mockReset().mockResolvedValue(3600);
  sendSmsMock.mockReset();
});

describe('POST /auth/verify/request', () => {
  it('generates a code, stores its hash, sends it, and logs a requested row', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: USER_ID, phone_number: PHONE_NUMBER, country: 'GM' }],
    }); // getUserById
    redisIncrMock.mockResolvedValueOnce(1); // rate limit: first request this hour
    sendSmsMock.mockResolvedValueOnce(undefined);
    queryMock.mockResolvedValueOnce({}); // INSERT phone_verifications 'requested'

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/verify/request')
      .set('Authorization', await authHeader());

    expect(res.status).toBe(204);
    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    expect(sendSmsMock.mock.calls[0]![0]).toBe(PHONE_NUMBER);

    expect(redisSetMock).toHaveBeenCalledWith(`otp:hash:${USER_ID}`, expect.any(String), { EX: 600 });
    const storedHash = redisSetMock.mock.calls[0]![1] as string;
    expect(storedHash).toHaveLength(64); // sha256 hex, never the raw 6-digit code
    expect(storedHash).not.toMatch(/^\d{6}$/);

    const insertCall = queryMock.mock.calls[1]!;
    expect(insertCall[0]).toMatch(/INSERT INTO phone_verifications/);
    expect(insertCall[1]).toEqual([USER_ID, 'requested', expect.any(String)]);
  });

  it('returns 502 and refunds the rate limit budget when the AT call times out', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: USER_ID, phone_number: PHONE_NUMBER, country: 'GM' }],
    }); // getUserById
    redisIncrMock.mockResolvedValueOnce(1); // rate limit: allowed
    sendSmsMock.mockRejectedValueOnce(new Error('The operation was aborted'));
    queryMock.mockResolvedValueOnce({}); // INSERT phone_verifications 'failed'

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/verify/request')
      .set('Authorization', await authHeader());

    expect(res.status).toBe(502);
    expect(redisDecrMock).toHaveBeenCalledWith(`ratelimit:otp:phone:${PHONE_NUMBER}`);
    expect(redisDelMock).toHaveBeenCalledWith([`otp:hash:${USER_ID}`, `otp:attempts:${USER_ID}`]);

    const insertCall = queryMock.mock.calls[1]!;
    expect(insertCall[1]).toEqual([USER_ID, 'failed', expect.any(String)]);
    expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);
  });

  it('returns 429 on the 4th request within an hour without generating a code', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: USER_ID, phone_number: PHONE_NUMBER, country: 'GM' }],
    }); // getUserById
    redisIncrMock.mockResolvedValueOnce(4); // over the limit of 3
    redisTtlMock.mockResolvedValueOnce(1800);

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/verify/request')
      .set('Authorization', await authHeader());

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited' });
    expect(res.headers['retry-after']).toBe('1800');
    expect(sendSmsMock).not.toHaveBeenCalled();
    expect(redisSetMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(1); // only the user lookup, no audit row
  });
});

describe('POST /auth/verify/confirm', () => {
  it('flips phone_verified on a correct code and logs a confirmed row', async () => {
    redisGetMock.mockResolvedValueOnce(hashOf(CODE));
    queryMock.mockResolvedValueOnce({}); // UPDATE users
    queryMock.mockResolvedValueOnce({}); // INSERT 'confirmed'

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/verify/confirm')
      .set('Authorization', await authHeader())
      .send({ code: CODE });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ phoneVerified: true });

    expect(queryMock.mock.calls[0]![0]).toMatch(/UPDATE users SET phone_verified = true/);
    expect(queryMock.mock.calls[0]![1]).toEqual([USER_ID]);
    expect(redisDelMock).toHaveBeenCalledWith([`otp:hash:${USER_ID}`, `otp:attempts:${USER_ID}`]);

    const insertCall = queryMock.mock.calls[1]!;
    expect(insertCall[1]).toEqual([USER_ID, 'confirmed', expect.any(String)]);
  });

  it('returns 400 and logs a failed row for a wrong code', async () => {
    redisGetMock.mockResolvedValueOnce(hashOf('999999'));
    redisIncrMock.mockResolvedValueOnce(1); // 1st bad attempt
    queryMock.mockResolvedValueOnce({}); // INSERT 'failed'

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/verify/confirm')
      .set('Authorization', await authHeader())
      .send({ code: CODE });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_or_expired_code' });
    expect(queryMock.mock.calls[0]![1]).toEqual([USER_ID, 'failed', expect.any(String)]);
  });

  it('returns the identical 400 body and logs expired for an absent/expired code', async () => {
    redisGetMock.mockResolvedValueOnce(null);
    queryMock.mockResolvedValueOnce({}); // INSERT 'expired'

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/verify/confirm')
      .set('Authorization', await authHeader())
      .send({ code: CODE });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_or_expired_code' });
    expect(redisIncrMock).not.toHaveBeenCalled();
    expect(queryMock.mock.calls[0]![1]).toEqual([USER_ID, 'expired', expect.any(String)]);
  });

  it('burns the code on the 5th failed attempt and logs burned', async () => {
    redisGetMock.mockResolvedValueOnce(hashOf('999999'));
    redisIncrMock.mockResolvedValueOnce(5); // 5th bad attempt
    queryMock.mockResolvedValueOnce({}); // INSERT 'burned'

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/auth/verify/confirm')
      .set('Authorization', await authHeader())
      .send({ code: CODE });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_or_expired_code' });
    expect(redisDelMock).toHaveBeenCalledWith([`otp:hash:${USER_ID}`, `otp:attempts:${USER_ID}`]);
    expect(queryMock.mock.calls[0]![1]).toEqual([USER_ID, 'burned', expect.any(String)]);
  });
});
