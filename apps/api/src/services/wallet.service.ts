import { pool } from '../db/pool.js';
import { decryptSecret, encryptSecret } from '../crypto/wallet-encryption.js';
import * as stellar from './stellar.service.js';

// TODO(security): if a user's phone number (and therefore identity binding)
// ever changes, wallet ownership must be re-verified before any transfer
// touches it. Not applicable yet - phone numbers are immutable post-registration.

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === '23505';
}

export class WalletNotFoundError extends Error {
  constructor() {
    super('wallet not found');
    this.name = 'WalletNotFoundError';
  }
}

export class RecipientWalletNotFoundError extends Error {
  constructor() {
    super('recipient has no wallet');
    this.name = 'RecipientWalletNotFoundError';
  }
}

export class InsufficientBalanceError extends Error {
  constructor() {
    super('insufficient balance');
    this.name = 'InsufficientBalanceError';
  }
}

export class SelfTransferError extends Error {
  constructor() {
    super('cannot transfer to your own wallet');
    this.name = 'SelfTransferError';
  }
}

interface WalletRow {
  id: string;
  stellar_public_key: string;
  encrypted_secret: string;
}

async function findWalletByUserId(userId: string): Promise<WalletRow | null> {
  const result = await pool.query<WalletRow>(
    'SELECT id, stellar_public_key, encrypted_secret FROM wallets WHERE user_id = $1',
    [userId],
  );
  return result.rows[0] ?? null;
}

export interface CreateWalletResult {
  publicKey: string;
  created: boolean;
}

export async function createWallet(userId: string): Promise<CreateWalletResult> {
  const existing = await findWalletByUserId(userId);
  if (existing) {
    return { publicKey: existing.stellar_public_key, created: false };
  }

  const keypair = stellar.generateKeypair();
  await stellar.fundTestnetAccount(keypair.publicKey());
  const encryptedSecret = encryptSecret(keypair.secret());

  try {
    await pool.query('INSERT INTO wallets (user_id, stellar_public_key, encrypted_secret) VALUES ($1, $2, $3)', [
      userId,
      keypair.publicKey(),
      encryptedSecret,
    ]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Concurrent create for the same user: another request already won.
      const row = await findWalletByUserId(userId);
      return { publicKey: row!.stellar_public_key, created: false };
    }
    throw err;
  }

  return { publicKey: keypair.publicKey(), created: true };
}

export async function getBalance(userId: string): Promise<string> {
  const wallet = await findWalletByUserId(userId);
  if (!wallet) {
    throw new WalletNotFoundError();
  }
  const account = await stellar.loadAccount(wallet.stellar_public_key);
  return account.nativeBalance;
}

export interface TransferResult {
  hash: string;
}

export async function transfer(fromUserId: string, toPhoneNumber: string, amount: string): Promise<TransferResult> {
  const senderWallet = await findWalletByUserId(fromUserId);
  if (!senderWallet) {
    throw new WalletNotFoundError();
  }

  const recipientResult = await pool.query<{ user_id: string; stellar_public_key: string }>(
    `SELECT w.user_id, w.stellar_public_key
     FROM wallets w
     JOIN users u ON u.id = w.user_id
     WHERE u.phone_number = $1`,
    [toPhoneNumber],
  );
  const recipientWallet = recipientResult.rows[0];
  if (!recipientWallet) {
    throw new RecipientWalletNotFoundError();
  }

  if (recipientWallet.user_id === fromUserId || recipientWallet.stellar_public_key === senderWallet.stellar_public_key) {
    throw new SelfTransferError();
  }

  const account = await stellar.loadAccount(senderWallet.stellar_public_key);
  const available = stellar.availableNativeBalance(account);
  if (Number(amount) > Number(available)) {
    throw new InsufficientBalanceError();
  }

  const senderSecret = decryptSecret(senderWallet.encrypted_secret);
  const transaction = stellar.buildSignedPaymentTransaction({
    accountId: account.accountId,
    sequence: account.sequence,
    senderSecret,
    destinationPublicKey: recipientWallet.stellar_public_key,
    amount,
  });

  const hash = await stellar.submitPayment(transaction);
  return { hash };
}
