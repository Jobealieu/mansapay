import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { LinkButton } from '../components/ui/LinkButton.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { useToast } from '../context/ToastContext.js';
import { listTransactions, type Transaction, type TransactionStatus } from '../lib/api.js';
import { toHumanMessage } from '../lib/error-messages.js';
import { formatDate, stellarExplorerTxUrl, trimTrailingZeros, truncatePublicKey } from '../lib/format.js';

const PAGE_SIZE = 20;

const STATUS_CLASSES: Record<TransactionStatus, string> = {
  completed: 'text-success',
  failed: 'text-danger',
  pending: 'text-accent-gold',
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  completed: 'Completed',
  failed: 'Failed',
  pending: 'Pending',
};

function SentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M6 18L18 6M18 6H9M18 6v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceivedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M18 6L6 18M6 18h9M6 18v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isSent = tx.direction === 'sent';
  const counterpartyKey = isSent ? tx.recipientPublicKey : tx.senderPublicKey;
  const amountDisplay = `${isSent ? '-' : '+'}${trimTrailingZeros(tx.amount)} ${tx.asset}`;

  const content = (
    <div className="flex items-center gap-3 py-3.5">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isSent ? 'bg-surface-2 text-fg-muted' : 'bg-success-bg text-success'
        }`}
      >
        {isSent ? <SentIcon /> : <ReceivedIcon />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fg">{isSent ? 'Sent' : 'Received'}</p>
        <p className="truncate text-xs text-fg-muted">{truncatePublicKey(counterpartyKey)}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <p className={`text-sm font-semibold ${isSent ? 'text-fg' : 'text-success'}`}>{amountDisplay}</p>
        <p className="text-xs text-fg-muted">{formatDate(tx.createdAt)}</p>
        <p className={`text-xs font-medium ${STATUS_CLASSES[tx.status]}`}>{STATUS_LABELS[tx.status]}</p>
      </div>
    </div>
  );

  if (tx.stellarTxHash) {
    return (
      <a
        href={stellarExplorerTxUrl(tx.stellarTxHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="block border-b border-border transition-colors duration-150 last:border-0 hover:bg-overlay/[0.03]"
        aria-label={`${isSent ? 'Sent' : 'Received'} ${trimTrailingZeros(tx.amount)} ${tx.asset}, view on Stellar Explorer`}
      >
        {content}
      </a>
    );
  }

  return <div className="border-b border-border last:border-0">{content}</div>;
}

export function TransactionHistoryPage() {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const page = await listTransactions({ limit: PAGE_SIZE });
      setTransactions(page.transactions);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setLoadFailed(true);
      showToast(toHumanMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadFirstPage();
    // Runs once on mount - loadFirstPage is stable via useCallback, and
    // there's no other trigger for re-fetching the first page.
  }, []);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const page = await listTransactions({ limit: PAGE_SIZE, before: nextCursor });
      setTransactions((current) => [...current, ...page.transactions]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      showToast(toHumanMessage(err));
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-fg">Transaction history</h1>

      {isLoading ? (
        <Card>
          <div className="flex flex-col">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-center gap-3 border-b border-border py-3.5 last:border-0">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </Card>
      ) : loadFailed && transactions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-danger">We couldn&apos;t load your transaction history.</p>
            <Button variant="secondary" onClick={() => void loadFirstPage()}>
              Try again
            </Button>
          </div>
        </Card>
      ) : transactions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-sm text-fg-muted">No transactions yet.</p>
            <LinkButton to="/send">Send your first payment</LinkButton>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-0 sm:p-0">
            <div className="px-4 sm:px-6">
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          </Card>
          {nextCursor && (
            <Button variant="secondary" onClick={() => void handleLoadMore()} isLoading={isLoadingMore}>
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
