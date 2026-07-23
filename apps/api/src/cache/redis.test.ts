import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from 'redis';

describe('node-redis TLS behavior (generic - protects against a future redis upgrade regressing this)', () => {
  it('enables TLS for a rediss:// URL while preserving a custom reconnectStrategy', () => {
    const reconnectStrategy = (retries: number) => (retries > 3 ? false : Math.min(retries * 100, 500));
    const client = createClient({
      url: 'rediss://default:password@example.upstash.io:6379',
      socket: { reconnectStrategy },
    });

    expect(client.options?.socket).toMatchObject({ tls: true, host: 'example.upstash.io', port: 6379 });
    expect(client.options?.socket?.reconnectStrategy).toBe(reconnectStrategy);
  });

  it('does not enable TLS for a plain redis:// URL', () => {
    const client = createClient({ url: 'redis://localhost:6379', socket: { reconnectStrategy: () => false } });
    expect(client.options?.socket?.tls).toBeUndefined();
  });
});

describe('cache/redis.ts wiring', () => {
  afterEach(() => {
    vi.doUnmock('../config/env.js');
    vi.resetModules();
  });

  it('passes a rediss:// REDIS_URL through to the client with TLS enabled (Upstash)', async () => {
    vi.doMock('../config/env.js', () => ({
      env: { REDIS_URL: 'rediss://default:pw@example.upstash.io:6379' },
    }));

    const { redisClient } = await import('./redis.js');
    expect(redisClient.options?.socket?.tls).toBe(true);
  });

  it('preserves the bounded reconnect strategy from Sprint 2.5 (gives up after 3 retries)', async () => {
    vi.doMock('../config/env.js', () => ({ env: { REDIS_URL: 'redis://localhost:6379' } }));

    const { redisClient } = await import('./redis.js');
    const strategy = redisClient.options?.socket?.reconnectStrategy as (retries: number) => number | false;

    expect(strategy(0)).toBe(0);
    expect(strategy(2)).toBe(200);
    expect(strategy(4)).toBe(false);
  });
});
