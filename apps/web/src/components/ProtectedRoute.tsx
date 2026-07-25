import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Spinner } from './ui/Spinner.js';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { accessToken, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner className="h-6 w-6 text-fg-muted" />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  // TODO(auth): ProtectedRoute only checks for a token, not
  // phoneVerified. An authed-but-unverified user can deep-link past
  // verification. Add a verified-gate guard in a later pass.

  return <>{children}</>;
}
