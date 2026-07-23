import { env } from '../config/env.js';

const AT_SANDBOX_MESSAGING_URL = 'https://api.sandbox.africastalking.com/version1/messaging';
const REQUEST_TIMEOUT_MS = 5000;

export class SmsSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsSendError';
  }
}

export async function sendSms(phoneNumber: string, message: string): Promise<void> {
  if (env.SMS_DEV_MODE) {
    console.log(`[SMS_DEV_MODE] SMS to ${phoneNumber} not sent (Africa's Talking bypassed): ${message}`);
    return;
  }

  let response: Response;
  try {
    response = await fetch(AT_SANDBOX_MESSAGING_URL, {
      method: 'POST',
      headers: {
        apiKey: env.AT_API_KEY,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ username: env.AT_USERNAME, to: phoneNumber, message }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new SmsSendError('sms gateway request failed or timed out');
  }

  if (!response.ok) {
    throw new SmsSendError(`sms gateway returned status ${response.status}`);
  }
}
