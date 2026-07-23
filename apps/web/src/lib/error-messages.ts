import { ApiError } from './api.js';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect phone number or password.',
  phone_number_taken: 'An account with this phone number already exists.',
  rate_limited: "You've made too many attempts. Please wait before trying again.",
  invalid_or_expired_code: 'That code is incorrect or has expired. Please try again.',
  sms_send_failed: "We couldn't send the code. Please try again in a moment.",
  unauthorized: 'Your session has expired. Please log in again.',
  invalid_refresh_token: 'Your session has expired. Please log in again.',
  validation_failed: 'Please check the highlighted fields and try again.',
  network_error: "We couldn't reach the server. Check your connection and try again.",
  internal_error: 'Something went wrong on our end. Please try again.',
};

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

// Translates backend error codes into sentences a person can act on. The
// API is never allowed to leak a raw code ('invalid_credentials', a bare
// 500, etc.) straight into the UI.
export function toHumanMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.code] ?? FALLBACK_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}
