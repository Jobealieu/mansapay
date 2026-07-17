import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const queryMock = vi.fn();
vi.mock('../db/pool.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

const validBody = {
  phoneNumber: '+2207700000',
  password: 'correct-horse-battery',
  country: 'GM',
};

describe('POST /auth/register', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('registers a new user and returns 201 with the userId', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: '11111111-1111-1111-1111-111111111111' }] });

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/auth/register').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ userId: '11111111-1111-1111-1111-111111111111' });
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
