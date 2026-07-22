import { afterEach, describe, expect, it, vi } from 'vitest';

describe('sendSms', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('sends the code without leaking the api key in a thrown error', async () => {
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { sendSms, SmsSendError } = await import('./sms.service.js');
    await expect(sendSms('+2207700000', 'code')).rejects.toBeInstanceOf(SmsSendError);
  });

  it('throws SmsSendError when the request times out', async () => {
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
