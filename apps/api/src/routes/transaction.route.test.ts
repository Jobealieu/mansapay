import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const listTransactionsMock = vi.fn();
const getTransactionByIdMock = vi.fn();

vi.mock('../services/transaction.service.js', () => ({
  listTransactions: (...args: unknown[]) => listTransactionsMock(...args),
  getTransactionById: (...args: unknown[]) => getTransactionByIdMock(...args),
}));

const USER_ID = '11111111-1111-1111-1111-111111111111';
const TRANSACTION_ID = '33333333-3333-3333-3333-333333333333';

async function authHeader(): Promise<string> {
  const { env } = await import('../config/env.js');
  return `Bearer ${jwt.sign({ sub: USER_ID }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 900 })}`;
}

beforeEach(() => {
  listTransactionsMock.mockReset();
  getTransactionByIdMock.mockReset();
});

describe('GET /transactions', () => {
  it('returns the caller history with sent and received directions', async () => {
    listTransactionsMock.mockResolvedValueOnce({
      transactions: [
        { id: 'a', direction: 'sent', amount: '5.0000000' },
        { id: 'b', direction: 'received', amount: '2.0000000' },
      ],
      nextCursor: null,
    });

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/transactions').set('Authorization', await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.transactions[0].direction).toBe('sent');
    expect(res.body.transactions[1].direction).toBe('received');
    expect(listTransactionsMock).toHaveBeenCalledWith(USER_ID, { limit: 20 });
  });

  it('passes limit and before query params through to the service', async () => {
    listTransactionsMock.mockResolvedValueOnce({ transactions: [], nextCursor: null });

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .get('/transactions')
      .query({ limit: '5', before: '2026-01-01T00:00:00.000Z' })
      .set('Authorization', await authHeader());

    expect(res.status).toBe(200);
    expect(listTransactionsMock).toHaveBeenCalledWith(USER_ID, { limit: 5, before: '2026-01-01T00:00:00.000Z' });
  });

  it('returns 400 when limit exceeds the max of 100', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .get('/transactions')
      .query({ limit: '500' })
      .set('Authorization', await authHeader());

    expect(res.status).toBe(400);
    expect(listTransactionsMock).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/transactions');

    expect(res.status).toBe(401);
    expect(listTransactionsMock).not.toHaveBeenCalled();
  });
});

describe('GET /transactions/:id', () => {
  it('returns the transaction when the caller is a party to it', async () => {
    getTransactionByIdMock.mockResolvedValueOnce({ id: TRANSACTION_ID, direction: 'sent', amount: '5.0000000' });

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .get(`/transactions/${TRANSACTION_ID}`)
      .set('Authorization', await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(TRANSACTION_ID);
    expect(getTransactionByIdMock).toHaveBeenCalledWith(USER_ID, TRANSACTION_ID);
  });

  it("404s for another user's transaction instead of leaking it", async () => {
    getTransactionByIdMock.mockResolvedValueOnce(null);

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .get(`/transactions/${TRANSACTION_ID}`)
      .set('Authorization', await authHeader());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'transaction_not_found' });
  });

  it('returns 400 for a malformed transaction id', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .get('/transactions/not-a-uuid')
      .set('Authorization', await authHeader());

    expect(res.status).toBe(400);
    expect(getTransactionByIdMock).not.toHaveBeenCalled();
  });
});
