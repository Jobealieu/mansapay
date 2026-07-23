import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../db/pool.js', () => ({
  pool: {
    query: (...args: unknown[]) => queryMock(...args),
  },
}));

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const TRANSACTION_ID = '33333333-3333-3333-3333-333333333333';

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TRANSACTION_ID,
    sender_user_id: USER_ID,
    recipient_user_id: OTHER_USER_ID,
    sender_public_key: 'GASENDER',
    recipient_public_key: 'GARECIPIENT',
    amount: '10.0000000',
    asset: 'XLM',
    status: 'completed',
    stellar_tx_hash: 'a-hash',
    failure_reason: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    completed_at: new Date('2026-01-01T00:00:05.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('listTransactions', () => {
  it('marks a row sent when the caller is the sender', async () => {
    queryMock.mockResolvedValueOnce({ rows: [row({ sender_user_id: USER_ID, recipient_user_id: OTHER_USER_ID })] });

    const { listTransactions } = await import('./transaction.service.js');
    const result = await listTransactions(USER_ID);

    expect(result.transactions[0]!.direction).toBe('sent');
    expect(result.transactions[0]!.amount).toBe('10.0000000');
  });

  it('marks a row received when the caller is the recipient', async () => {
    queryMock.mockResolvedValueOnce({ rows: [row({ sender_user_id: OTHER_USER_ID, recipient_user_id: USER_ID })] });

    const { listTransactions } = await import('./transaction.service.js');
    const result = await listTransactions(USER_ID);

    expect(result.transactions[0]!.direction).toBe('received');
  });

  it('queries for both sent and received rows scoped to the caller, newest first', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const { listTransactions } = await import('./transaction.service.js');
    await listTransactions(USER_ID);

    const [sql, params] = queryMock.mock.calls[0]!;
    expect(sql).toMatch(/sender_user_id = \$1 OR recipient_user_id = \$1/);
    expect(sql).toMatch(/ORDER BY created_at DESC/);
    expect(params).toEqual([USER_ID, null, 20]);
  });

  it('caps the limit at 100 and passes a before cursor through', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const { listTransactions } = await import('./transaction.service.js');
    await listTransactions(USER_ID, { limit: 500, before: '2026-01-01T00:00:00.000Z' });

    const [, params] = queryMock.mock.calls[0]!;
    expect(params[2]).toBe(100);
    expect((params[1] as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns a nextCursor when a full page comes back, and null when the page is partial', async () => {
    queryMock.mockResolvedValueOnce({ rows: [row(), row()] }); // full page of 2, limit 2

    const { listTransactions } = await import('./transaction.service.js');
    const fullPage = await listTransactions(USER_ID, { limit: 2 });
    expect(fullPage.nextCursor).toBe('2026-01-01T00:00:00.000Z');

    queryMock.mockResolvedValueOnce({ rows: [row()] }); // partial page: 1 row, limit 20
    const partialPage = await listTransactions(USER_ID, { limit: 20 });
    expect(partialPage.nextCursor).toBeNull();
  });
});

describe('getTransactionById', () => {
  it('returns the transaction when the caller is a party to it', async () => {
    queryMock.mockResolvedValueOnce({ rows: [row()] });

    const { getTransactionById } = await import('./transaction.service.js');
    const result = await getTransactionById(USER_ID, TRANSACTION_ID);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(TRANSACTION_ID);

    const [sql, params] = queryMock.mock.calls[0]!;
    expect(sql).toMatch(/sender_user_id = \$2 OR recipient_user_id = \$2/);
    expect(params).toEqual([TRANSACTION_ID, USER_ID]);
  });

  it('returns null when the transaction does not exist or the caller is not a party to it', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const { getTransactionById } = await import('./transaction.service.js');
    const result = await getTransactionById(USER_ID, TRANSACTION_ID);

    expect(result).toBeNull();
  });
});
