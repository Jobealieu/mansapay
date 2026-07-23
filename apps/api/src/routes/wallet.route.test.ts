import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const createWalletMock = vi.fn();
const getBalanceMock = vi.fn();
const transferMock = vi.fn();

vi.mock('../services/wallet.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/wallet.service.js')>();
  return {
    ...actual,
    createWallet: (...args: unknown[]) => createWalletMock(...args),
    getBalance: (...args: unknown[]) => getBalanceMock(...args),
    transfer: (...args: unknown[]) => transferMock(...args),
  };
});

const USER_ID = '11111111-1111-1111-1111-111111111111';
const PUBLIC_KEY = 'GASENDER00000000000000000000000000000000000000000000000';

async function authHeader(): Promise<string> {
  const { env } = await import('../config/env.js');
  return `Bearer ${jwt.sign({ sub: USER_ID }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 900 })}`;
}

beforeEach(() => {
  createWalletMock.mockReset();
  getBalanceMock.mockReset();
  transferMock.mockReset();
});

describe('POST /wallet/create', () => {
  it('returns 201 with the public key when a new wallet is created', async () => {
    createWalletMock.mockResolvedValueOnce({ publicKey: PUBLIC_KEY, created: true });

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/wallet/create').set('Authorization', await authHeader());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ publicKey: PUBLIC_KEY });
    expect(JSON.stringify(res.body)).not.toMatch(/^S[A-Z2-7]{55}$/);
  });

  it('returns 200 with the existing public key when the wallet already exists (idempotent)', async () => {
    createWalletMock.mockResolvedValueOnce({ publicKey: PUBLIC_KEY, created: false });

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/wallet/create').set('Authorization', await authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: PUBLIC_KEY });
  });

  it('returns 401 without a token', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp()).post('/wallet/create');

    expect(res.status).toBe(401);
    expect(createWalletMock).not.toHaveBeenCalled();
  });
});

describe('GET /wallet/balance', () => {
  it('returns the on-chain balance for the caller wallet', async () => {
    getBalanceMock.mockResolvedValueOnce('123.4500000');

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/wallet/balance').set('Authorization', await authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ balance: '123.4500000', asset: 'XLM' });
  });

  it('returns 404 when the caller has no wallet', async () => {
    const { WalletNotFoundError } = await import('../services/wallet.service.js');
    getBalanceMock.mockRejectedValueOnce(new WalletNotFoundError());

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/wallet/balance').set('Authorization', await authHeader());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'wallet_not_found' });
  });
});

describe('POST /wallet/transfer', () => {
  it('submits a transfer and returns the transaction hash', async () => {
    transferMock.mockResolvedValueOnce({ hash: 'a-transaction-hash' });

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/wallet/transfer')
      .set('Authorization', await authHeader())
      .send({ toPhoneNumber: '+2207700001', amount: '10' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hash: 'a-transaction-hash' });
    expect(transferMock).toHaveBeenCalledWith(USER_ID, '+2207700001', '10');
  });

  it('returns 400 when the recipient has no wallet', async () => {
    const { RecipientWalletNotFoundError } = await import('../services/wallet.service.js');
    transferMock.mockRejectedValueOnce(new RecipientWalletNotFoundError());

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/wallet/transfer')
      .set('Authorization', await authHeader())
      .send({ toPhoneNumber: '+2207799999', amount: '10' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'recipient_wallet_not_found' });
  });

  it('returns 400 on insufficient balance', async () => {
    const { InsufficientBalanceError } = await import('../services/wallet.service.js');
    transferMock.mockRejectedValueOnce(new InsufficientBalanceError());

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/wallet/transfer')
      .set('Authorization', await authHeader())
      .send({ toPhoneNumber: '+2207700001', amount: '999999' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'insufficient_balance' });
  });

  it('returns 400 for a self-transfer', async () => {
    const { SelfTransferError } = await import('../services/wallet.service.js');
    transferMock.mockRejectedValueOnce(new SelfTransferError());

    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/wallet/transfer')
      .set('Authorization', await authHeader())
      .send({ toPhoneNumber: '+2207700000', amount: '10' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'self_transfer_not_allowed' });
  });

  it('returns 400 for a malformed amount without calling the service', async () => {
    const { createApp } = await import('../app.js');
    const res = await request(createApp())
      .post('/wallet/transfer')
      .set('Authorization', await authHeader())
      .send({ toPhoneNumber: '+2207700001', amount: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(transferMock).not.toHaveBeenCalled();
  });
});
