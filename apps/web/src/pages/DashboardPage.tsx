import { useCallback, useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { LinkButton } from '../components/ui/LinkButton.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { useToast } from '../context/ToastContext.js';
import { ApiError, createWallet, getCurrentUser, getWalletBalance, type CurrentUser, type WalletBalance } from '../lib/api.js';
import { toHumanMessage } from '../lib/error-messages.js';
import { trimTrailingZeros } from '../lib/format.js';

function AnimatedBalance({ value }: { value: string }) {
  const shouldReduceMotion = useReducedMotion();
  const target = Number(value);
  const canAnimate = Number.isFinite(target) && !shouldReduceMotion;
  const finalDisplay = trimTrailingZeros(value);
  const [display, setDisplay] = useState(canAnimate ? '0.00' : finalDisplay);

  useEffect(() => {
    if (!canAnimate) {
      setDisplay(finalDisplay);
      return;
    }
    const controls = animate(0, target, {
      duration: 1.1,
      ease: 'easeOut',
      onUpdate: (current) => setDisplay(current.toFixed(2)),
      onComplete: () => setDisplay(finalDisplay),
    });
    return () => controls.stop();
    // Only the raw value should restart the tween - target/finalDisplay/canAnimate all derive from it.
  }, [value]);

  return <span>{display}</span>;
}

// hasWallet is three-valued: null means "don't know yet" - either still
// loading, or the balance fetch failed for a reason other than "no
// wallet," which the UI renders as a retry state rather than the
// create-wallet empty state.
type WalletState = { hasWallet: true; balance: WalletBalance } | { hasWallet: false } | { hasWallet: null };

export function DashboardPage() {
  const { showToast } = useToast();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [walletState, setWalletState] = useState<WalletState>({ hasWallet: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  const refreshBalance = useCallback(async () => {
    try {
      const balance = await getWalletBalance();
      setWalletState({ hasWallet: true, balance });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'wallet_not_found') {
        setWalletState({ hasWallet: false });
        return;
      }
      setWalletState({ hasWallet: null });
      showToast(toHumanMessage(err));
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const [userResult, balanceResult] = await Promise.allSettled([getCurrentUser(), getWalletBalance()]);
      if (cancelled) return;

      if (userResult.status === 'fulfilled') {
        setUser(userResult.value);
      } else {
        showToast(toHumanMessage(userResult.reason));
      }

      if (balanceResult.status === 'fulfilled') {
        setWalletState({ hasWallet: true, balance: balanceResult.value });
      } else if (balanceResult.reason instanceof ApiError && balanceResult.reason.code === 'wallet_not_found') {
        setWalletState({ hasWallet: false });
      } else {
        setWalletState({ hasWallet: null });
        showToast(toHumanMessage(balanceResult.reason));
      }

      setIsLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  async function handleCreateWallet() {
    setIsCreatingWallet(true);
    try {
      await createWallet();
      await refreshBalance();
    } catch (err) {
      showToast(toHumanMessage(err));
    } finally {
      setIsCreatingWallet(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-12 w-48" />
          <Skeleton className="mt-2 h-4 w-16" />
        </Card>
        <div className="flex gap-3">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 flex-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        {walletState.hasWallet === false ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-sm text-fg-muted">You don&apos;t have a wallet yet. Create one to start sending and receiving XLM.</p>
            <Button onClick={() => void handleCreateWallet()} isLoading={isCreatingWallet}>
              Create wallet
            </Button>
          </div>
        ) : walletState.hasWallet === true ? (
          <>
            <p className="text-sm text-fg-muted">Your balance</p>
            <p className="mt-2 flex items-baseline gap-2 text-4xl font-bold tracking-tight text-fg sm:text-5xl">
              <AnimatedBalance value={walletState.balance.balance} />
              <span className="text-lg font-semibold text-fg-muted">{walletState.balance.asset}</span>
            </p>
            {user && <p className="mt-3 text-sm text-fg-muted">Signed in as {user.phoneNumber}</p>}
          </>
        ) : (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-sm text-danger">We couldn&apos;t load your balance.</p>
            <Button variant="secondary" onClick={() => void refreshBalance()}>
              Try again
            </Button>
          </div>
        )}
      </Card>

      {walletState.hasWallet === true && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <LinkButton to="/send" fullWidth>
            Send money
          </LinkButton>
          <LinkButton to="/history" variant="secondary" fullWidth>
            View history
          </LinkButton>
        </div>
      )}
    </div>
  );
}
