import { Account, Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';

const HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

// Base reserve for an account with no trust lines/offers/data entries:
// (2 + subentry_count) base reserves, 0.5 XLM each on testnet.
const BASE_RESERVE_XLM = 0.5;
const MIN_ACCOUNT_RESERVES = 2;

export const server = new Horizon.Server(HORIZON_TESTNET_URL);

export function generateKeypair(): Keypair {
  return Keypair.random();
}

export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!response.ok) {
    throw new Error(`friendbot funding failed with status ${response.status}`);
  }
}

export interface AccountSnapshot {
  accountId: string;
  sequence: string;
  nativeBalance: string;
  subentryCount: number;
}

export async function loadAccount(publicKey: string): Promise<AccountSnapshot> {
  const account = await server.loadAccount(publicKey);
  const nativeLine = account.balances.find((balance) => balance.asset_type === 'native');
  return {
    accountId: account.accountId(),
    sequence: account.sequenceNumber(),
    nativeBalance: nativeLine?.balance ?? '0',
    subentryCount: account.subentry_count,
  };
}

export function availableNativeBalance(snapshot: AccountSnapshot): string {
  const minBalance = (MIN_ACCOUNT_RESERVES + snapshot.subentryCount) * BASE_RESERVE_XLM;
  const available = Math.max(Number(snapshot.nativeBalance) - minBalance, 0);
  return available.toFixed(7);
}

export interface BuildPaymentParams {
  accountId: string;
  sequence: string;
  senderSecret: string;
  destinationPublicKey: string;
  amount: string;
}

// Pure and network-free: given an account snapshot and a secret, produces a
// fully signed transaction. Kept separate from loadAccount/submitPayment so
// signing correctness can be tested without touching Horizon.
export function buildSignedPaymentTransaction(params: BuildPaymentParams): Transaction {
  const sourceKeypair = Keypair.fromSecret(params.senderSecret);
  const account = new Account(params.accountId, params.sequence);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: params.destinationPublicKey,
        asset: Asset.native(),
        amount: params.amount,
      }),
    )
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);
  return transaction;
}

export async function submitPayment(transaction: Transaction): Promise<string> {
  const result = await server.submitTransaction(transaction);
  return result.hash;
}
