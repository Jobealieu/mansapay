import { pool } from '../db/pool.js';

export type TransactionStatus = 'pending' | 'completed' | 'failed';
export type TransactionDirection = 'sent' | 'received';

interface TransactionRow {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  sender_public_key: string;
  recipient_public_key: string;
  amount: string;
  asset: string;
  status: TransactionStatus;
  stellar_tx_hash: string | null;
  failure_reason: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface TransactionView {
  id: string;
  direction: TransactionDirection;
  senderPublicKey: string;
  recipientPublicKey: string;
  amount: string;
  asset: string;
  status: TransactionStatus;
  stellarTxHash: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

const SELECT_COLUMNS = `id, sender_user_id, recipient_user_id, sender_public_key, recipient_public_key,
       amount, asset, status, stellar_tx_hash, failure_reason, created_at, completed_at`;

function toView(row: TransactionRow, callerUserId: string): TransactionView {
  return {
    id: row.id,
    direction: row.sender_user_id === callerUserId ? 'sent' : 'received',
    senderPublicKey: row.sender_public_key,
    recipientPublicKey: row.recipient_public_key,
    amount: row.amount,
    asset: row.asset,
    status: row.status,
    stellarTxHash: row.stellar_tx_hash,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface ListTransactionsParams {
  limit?: number;
  before?: string | undefined;
}

export interface ListTransactionsResult {
  transactions: TransactionView[];
  nextCursor: string | null;
}

export async function listTransactions(
  userId: string,
  params: ListTransactionsParams = {},
): Promise<ListTransactionsResult> {
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const before = params.before ? new Date(params.before) : null;

  const result = await pool.query<TransactionRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM transactions
     WHERE (sender_user_id = $1 OR recipient_user_id = $1)
       AND ($2::timestamptz IS NULL OR created_at < $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, before, limit],
  );

  const transactions = result.rows.map((row) => toView(row, userId));
  const lastRow = result.rows[result.rows.length - 1];
  const nextCursor = transactions.length === limit && lastRow ? lastRow.created_at.toISOString() : null;

  return { transactions, nextCursor };
}

export async function getTransactionById(userId: string, transactionId: string): Promise<TransactionView | null> {
  const result = await pool.query<TransactionRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM transactions
     WHERE id = $1 AND (sender_user_id = $2 OR recipient_user_id = $2)`,
    [transactionId, userId],
  );
  const row = result.rows[0];
  return row ? toView(row, userId) : null;
}
