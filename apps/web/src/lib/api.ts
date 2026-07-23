import type { LoginRequest, RegisterRequest } from '@mansapay/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthHandlers {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onSessionExpired: () => void;
}

let authHandlers: AuthHandlers | null = null;

// AuthContext registers itself here on mount. Kept as a plain module-level
// slot (not a React dependency) so this file stays a framework-agnostic
// fetch wrapper - the "no state management library" constraint means the
// bridge back into React state has to be this simple, not a new library.
export function registerAuthHandlers(handlers: AuthHandlers): void {
  authHandlers = handlers;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth) {
    const token = authHandlers?.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const init: RequestInit = { method: options.method ?? 'GET', headers };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError(0, 'network_error');
  }

  if (response.status === 401 && options.auth && !isRetry && authHandlers) {
    const newToken = await authHandlers.refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, true);
    }
    authHandlers.onSessionExpired();
    throw new ApiError(401, 'unauthorized');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // No JSON body (e.g. some error responses) - fall through with data = null.
  }

  if (!response.ok) {
    const code =
      data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `http_${response.status}`;
    const retryAfterHeader = response.headers.get('Retry-After');
    throw new ApiError(response.status, code, retryAfterHeader ? Number(retryAfterHeader) : undefined);
  }

  return data as T;
}

export function registerUser(input: RegisterRequest): Promise<{ userId: string }> {
  return request('/auth/register', { method: 'POST', body: input });
}

export function loginUser(input: LoginRequest): Promise<Session> {
  return request('/auth/login', { method: 'POST', body: input });
}

export function refreshSession(refreshToken: string): Promise<Session> {
  return request('/auth/refresh', { method: 'POST', body: { refreshToken } });
}

export function logoutSession(refreshToken: string): Promise<void> {
  return request('/auth/logout', { method: 'POST', body: { refreshToken } });
}

export function requestOtp(): Promise<void> {
  return request('/auth/verify/request', { method: 'POST', auth: true });
}

export function confirmOtp(code: string): Promise<{ phoneVerified: true }> {
  return request('/auth/verify/confirm', { method: 'POST', auth: true, body: { code } });
}
