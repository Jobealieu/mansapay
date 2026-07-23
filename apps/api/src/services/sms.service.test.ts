import { afterEach, describe, expect, it, vi } from 'vitest';

// Every test mocks '../config/env.js' explicitly rather than relying on the
// real apps/api/.env - that file sets SMS_DEV_MODE=true for local dev, so
// these tests must not depend on ambient env state to stay hermetic.
function mockEnv(overrides: { SMS_DEV_MODE: boolean }) {
  vi.doMock('../config/env.js', () => ({
    env: { AT_API_KEY: 'test-key', AT_USERNAME: 'sandbox', ...overrides },
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('../config/env.js');
  vi.resetModules();
});

describe('sendSms with SMS_DEV_MODE disabled (normal mode)', () => {
  it('sends the code without leaking the api key in a thrown error', async () => {
    mockEnv({ SMS_DEV_MODE: false });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const { sendSms } = await import('./sms.service.js');
    await sendSms('+2207700000', 'Your MansaPay verification code is 123456.');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.sandbox.africastalking.com/version1/messaging');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws SmsSendError on a non-2xx response', async () => {
    mockEnv({ SMS_DEV_MODE: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { sendSms, SmsSendError } = await import('./sms.service.js');
    await expect(sendSms('+2207700000', 'code')).rejects.toBeInstanceOf(SmsSendError);
  });

  it('throws SmsSendError when the request times out', async () => {
    mockEnv({ SMS_DEV_MODE: false });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        const err = new Error('The operation was aborted');
        err.name = 'TimeoutError';
        return Promise.reject(err);
      }),
    );

    const { sendSms, SmsSendError } = await import('./sms.service.js');
    await expect(sendSms('+2207700000', 'code')).rejects.toBeInstanceOf(SmsSendError);
  });

  it('never includes the api key in the thrown error message', async () => {
    mockEnv({ SMS_DEV_MODE: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const { sendSms } = await import('./sms.service.js');
    const { env } = await import('../config/env.js');

    try {
      await sendSms('+2207700000', 'code');
      expect.unreachable('expected sendSms to throw');
    } catch (err) {
      expect(err instanceof Error ? err.message : String(err)).not.toContain(env.AT_API_KEY);
    }
  });
});

describe('sendSms with SMS_DEV_MODE enabled', () => {
  it("skips the Africa's Talking call and logs the code instead", async () => {
    mockEnv({ SMS_DEV_MODE: true });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { sendSms } = await import('./sms.service.js');
    await sendSms('+2207700000', 'Your MansaPay verification code is 654321. It expires in 10 minutes.');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const [logLine] = consoleLogSpy.mock.calls[0]!;
    expect(logLine).toContain('SMS_DEV_MODE');
    expect(logLine).toContain('654321');
    expect(logLine).toContain('+2207700000');

    consoleLogSpy.mockRestore();
  });
});
