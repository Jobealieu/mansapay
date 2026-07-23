import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '../crypto/wallet-encryption.js';

const queryMock = vi.fn();

vi.mock('../db/pool.js', () => ({
  pool: {
    query: (...args: unknown[]) => queryMock(...args),
  },
}));

const fundTestnetAccountMock = vi.fn();
const loadAccountMock = vi.fn();
const submitPaymentMock = vi.fn();
const buildSignedPaymentTransactionMock = vi.fn();

vi.mock('../services/stellar.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/stellar.service.js')>();
  return {
    ...actual,
    fundTestnetAccount: (...args: unknown[]) => fundTestnetAccountMock(...args),
    loadAccount: (...args: unknown[]) => loadAccountMock(...args),
    submitPayment: (...args: unknown[]) => submitPaymentMock(...args),
    buildSignedPaymentTransaction: (...args: unknown[]) => buildSignedPaymentTransactionMock(...args),
  };
});

const SENDER_USER_ID = '11111111-1111-1111-1111-111111111111';
const RECIPIENT_USER_ID = '22222222-2222-2222-2222-222222222222';
const SENDER_PUBLIC_KEY = 'GASENDER00000000000000000000000000000000000000000000000';
const RECIPIENT_PUBLIC_KEY = 'GARECIPIENT0000000000000000000000000000000000000000000';

beforeEach(() => {
  queryMock.mockReset();
  fundTestnetAccountMock.mockReset().mockResolvedValue(undefined);
  loadAccountMock.mockReset();
  submitPaymentMock.mockReset();
  buildSignedPaymentTransactionMock.mockReset();
});

describe('createWallet', () => {
  it('generates a keypair, funds it via friendbot, and stores it', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }); // no existing wallet
    queryMock.mockResolvedValueOnce({}); // INSERT

    const { createWallet } = await import('./wallet.service.js');
    const result = await createWallet(SENDER_USER_ID);

    expect(result.created).toBe(true);
    expect(result.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(fundTestnetAccountMock).toHaveBeenCalledWith(result.publicKey);

    const insertCall = queryMock.mock.calls[1]!;
    expect(insertCall[0]).toMatch(/INSERT INTO wallets/);
    expect(insertCall[1][0]).toBe(SENDER_USER_ID);
    expect(insertCall[1][1]).toBe(result.publicKey);
    // the raw Stellar secret (starts with 'S') must never be the stored value
    expect(insertCall[1][2]).not.toMatch(/^S[A-Z2-7]{55}$/);
  });

  it('is idempotent: returns the existing wallet without funding again', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stellar_public_key: SENDER_PUBLIC_KEY }] });

    const { createWallet } = await import('./wallet.service.js');
    const result = await createWallet(SENDER_USER_ID);

    expect(result).toEqual({ publicKey: SENDER_PUBLIC_KEY, created: false });
    expect(fundTestnetAccountMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('resolves a concurrent create race to the winning row instead of erroring', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }); // no existing wallet (this request's check)
    queryMock.mockRejectedValueOnce({ code: '23505' }); // INSERT loses the race
    queryMock.mockResolvedValueOnce({ rows: [{ stellar_public_key: SENDER_PUBLIC_KEY }] }); // re-fetch winner

    const { createWallet } = await import('./wallet.service.js');
    const result = await createWallet(SENDER_USER_ID);

    expect(result).toEqual({ publicKey: SENDER_PUBLIC_KEY, created: false });
  });
});

describe('getBalance', () => {
  it('returns the on-chain native balance for the wallet', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ stellar_public_key: SENDER_PUBLIC_KEY, encrypted_secret: 'x' }] });
    loadAccountMock.mockResolvedValueOnce({
      accountId: SENDER_PUBLIC_KEY,
      sequence: '1',
      nativeBalance: '250.0000000',
      subentryCount: 0,
    });

    const { getBalance } = await import('./wallet.service.js');
    const balance = await getBalance(SENDER_USER_ID);

    expect(balance).toBe('250.0000000');
  });

  it('throws WalletNotFoundError when the user has no wallet', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const { getBalance, WalletNotFoundError } = await import('./wallet.service.js');
    await expect(getBalance(SENDER_USER_ID)).rejects.toBeInstanceOf(WalletNotFoundError);
  });
});

describe('transfer', () => {
  it('moves funds between two wallets and returns the transaction hash', async () => {
    const fakeSenderSecret = 'SFAKESECRETKEYFORTESTING0000000000000000000000000000000';
    queryMock.mockResolvedValueOnce({
      rows: [{ stellar_public_key: SENDER_PUBLIC_KEY, encrypted_secret: encryptSecret(fakeSenderSecret) }],
    }); // sender wallet
    queryMock.mockResolvedValueOnce({
      rows: [{ user_id: RECIPIENT_USER_ID, stellar_public_key: RECIPIENT_PUBLIC_KEY }],
    }); // recipient wallet

    loadAccountMock.mockResolvedValueOnce({
      accountId: SENDER_PUBLIC_KEY,
      sequence: '1',
      nativeBalance: '100.0000000',
      subentryCount: 0,
    });
    const fakeTransaction = { fake: 'transaction' };
    buildSignedPaymentTransactionMock.mockReturnValueOnce(fakeTransaction);
    submitPaymentMock.mockResolvedValueOnce('a-transaction-hash');

    const { transfer } = await import('./wallet.service.js');
    const result = await transfer(SENDER_USER_ID, '+2207700001', '10');

    expect(result).toEqual({ hash: 'a-transaction-hash' });
    expect(buildSignedPaymentTransactionMock).toHaveBeenCalledWith({
      accountId: SENDER_PUBLIC_KEY,
      sequence: '1',
      senderSecret: fakeSenderSecret,
      destinationPublicKey: RECIPIENT_PUBLIC_KEY,
      amount: '10',
    });
    expect(submitPaymentMock).toHaveBeenCalledWith(fakeTransaction);
  });

  it('throws RecipientWalletNotFoundError when the recipient has no wallet', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ stellar_public_key: SENDER_PUBLIC_KEY, encrypted_secret: 'iv:tag:cipher' }],
    }); // sender wallet
    queryMock.mockResolvedValueOnce({ rows: [] }); // recipient lookup: no wallet

    const { transfer, RecipientWalletNotFoundError } = await import('./wallet.service.js');
    await expect(transfer(SENDER_USER_ID, '+2207799999', '10')).rejects.toBeInstanceOf(RecipientWalletNotFoundError);
  });

  it('throws InsufficientBalanceError when the amount exceeds the available balance', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ stellar_public_key: SENDER_PUBLIC_KEY, encrypted_secret: 'iv:tag:cipher' }],
    });
    queryMock.mockResolvedValueOnce({
      rows: [{ user_id: RECIPIENT_USER_ID, stellar_public_key: RECIPIENT_PUBLIC_KEY }],
    });
    loadAccountMock.mockResolvedValueOnce({
      accountId: SENDER_PUBLIC_KEY,
      sequence: '1',
      nativeBalance: '5.0000000', // available after reserve: 4
      subentryCount: 0,
    });

    const { transfer, InsufficientBalanceError } = await import('./wallet.service.js');
    await expect(transfer(SENDER_USER_ID, '+2207700001', '10')).rejects.toBeInstanceOf(InsufficientBalanceError);
    expect(buildSignedPaymentTransactionMock).not.toHaveBeenCalled();
  });

  it('throws SelfTransferError when the recipient resolves to the same user', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ stellar_public_key: SENDER_PUBLIC_KEY, encrypted_secret: 'iv:tag:cipher' }],
    });
    queryMock.mockResolvedValueOnce({
      rows: [{ user_id: SENDER_USER_ID, stellar_public_key: SENDER_PUBLIC_KEY }],
    });

    const { transfer, SelfTransferError } = await import('./wallet.service.js');
    await expect(transfer(SENDER_USER_ID, '+2207700000', '10')).rejects.toBeInstanceOf(SelfTransferError);
    expect(loadAccountMock).not.toHaveBeenCalled();
  });
});
