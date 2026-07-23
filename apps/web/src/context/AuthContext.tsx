import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LoginRequest, RegisterRequest } from '@mansapay/shared';
import {
  loginUser,
  logoutSession,
  refreshSession,
  registerAuthHandlers,
  registerUser,
  type Session,
} from '../lib/api.js';
import { useToast } from './ToastContext.js';

const REFRESH_TOKEN_STORAGE_KEY = 'mansapay.refreshToken';

/**
 * TOKEN STORAGE TRADEOFF
 *
 * Access token: kept only in React state, never persisted anywhere. It is
 * short-lived (15 min) and gone the instant the tab closes or reloads.
 *
 * Refresh token: the API returns it as a plain JSON body value (not a
 * Set-Cookie header), so an httpOnly cookie - the actually-secure option -
 * isn't available without a backend change, which is out of scope for this
 * frontend pass. Given that constraint, it goes in sessionStorage rather
 * than localStorage: both are equally readable by any JS on the page (so
 * neither defends against XSS), but sessionStorage is cleared when the tab
 * closes instead of persisting indefinitely on disk, which bounds the
 * exposure window. It still survives a page reload within the tab, which is
 * the whole point of persisting it - otherwise every refresh would force a
 * re-login for no security benefit.
 */
function getStoredRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

function setStoredRefreshToken(token: string): void {
  sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
}

function clearStoredRefreshToken(): void {
  sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

interface AuthContextValue {
  accessToken: string | null;
  isInitializing: boolean;
  login: (input: LoginRequest) => Promise<void>;
  registerAccount: (input: RegisterRequest) => Promise<{ userId: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const applySession = useCallback((session: Session) => {
    setAccessToken(session.accessToken);
    setStoredRefreshToken(session.refreshToken);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    clearStoredRefreshToken();
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const storedRefreshToken = getStoredRefreshToken();
    if (!storedRefreshToken) {
      return null;
    }
    try {
      const session = await refreshSession(storedRefreshToken);
      applySession(session);
      return session.accessToken;
    } catch {
      clearSession();
      return null;
    }
  }, [applySession, clearSession]);

  // Hydrate the session once on load from whatever refresh token survived
  // the last page reload.
  useEffect(() => {
    let cancelled = false;
    refreshAccessToken().finally(() => {
      if (!cancelled) {
        setIsInitializing(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount only - refreshAccessToken is stable
    // in practice (its own deps are stable callbacks) and re-running this
    // on every render would refresh the session repeatedly for no reason.
  }, []);

  useEffect(() => {
    registerAuthHandlers({
      getAccessToken: () => accessToken,
      refreshAccessToken,
      onSessionExpired: () => {
        clearSession();
        showToast('Your session has expired. Please log in again.', 'info');
        navigate('/login', { replace: true });
      },
    });
  }, [accessToken, refreshAccessToken, clearSession, navigate, showToast]);

  const login = useCallback(
    async (input: LoginRequest) => {
      const session = await loginUser(input);
      applySession(session);
    },
    [applySession],
  );

  const registerAccount = useCallback((input: RegisterRequest) => registerUser(input), []);

  const logout = useCallback(async () => {
    const storedRefreshToken = getStoredRefreshToken();
    clearSession();
    if (storedRefreshToken) {
      await logoutSession(storedRefreshToken).catch(() => {
        // Best-effort: the session is already cleared client-side either way.
      });
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ accessToken, isInitializing, login, registerAccount, logout }),
    [accessToken, isInitializing, login, registerAccount, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
