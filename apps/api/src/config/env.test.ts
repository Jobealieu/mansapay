import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// env.ts's first line is `import 'dotenv/config'`, which would otherwise
// refill process.env from the real apps/api/.env (which sets SMS_DEV_MODE=
// true for local dev) every time this test re-imports env.js, making the
// "unset" test below depend on ambient machine state. Neutralize it so
// this file's own process.env values are the only source of truth.
vi.mock('dotenv/config', () => ({}));

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://mansapay:mansapay@localhost:5433/mansapay',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
  AT_API_KEY: 'test-key',
  AT_USERNAME: 'sandbox',
  WALLET_ENCRYPTION_KEY: 'a'.repeat(64),
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...REQUIRED_ENV, NODE_ENV: 'development' };
  delete process.env.SMS_DEV_MODE;
  delete process.env.DEMO_MODE;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('env', () => {
  it('defaults SMS_DEV_MODE and DEMO_MODE to false when unset', async () => {
    const { env } = await import('./env.js');
    expect(env.SMS_DEV_MODE).toBe(false);
    expect(env.DEMO_MODE).toBe(false);
  });

  it('parses the literal string "true"', async () => {
    process.env.SMS_DEV_MODE = 'true';
    const { env } = await import('./env.js');
    expect(env.SMS_DEV_MODE).toBe(true);
  });

  it('parses the literal string "false" as false (not truthy-string coercion)', async () => {
    process.env.SMS_DEV_MODE = 'false';
    const { env } = await import('./env.js');
    expect(env.SMS_DEV_MODE).toBe(false);
  });

  it('allows SMS_DEV_MODE=true outside production regardless of DEMO_MODE', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SMS_DEV_MODE = 'true';
    process.env.DEMO_MODE = 'false';
    const { env } = await import('./env.js');
    expect(env.SMS_DEV_MODE).toBe(true);
  });

  it('refuses to start when NODE_ENV=production, SMS_DEV_MODE=true, and DEMO_MODE is unset', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMS_DEV_MODE = 'true';
    await expect(import('./env.js')).rejects.toThrow(/DEMO_MODE/);
  });

  it('refuses to start when NODE_ENV=production, SMS_DEV_MODE=true, and DEMO_MODE=false', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMS_DEV_MODE = 'true';
    process.env.DEMO_MODE = 'false';
    await expect(import('./env.js')).rejects.toThrow(/DEMO_MODE/);
  });

  it('allows NODE_ENV=production when SMS_DEV_MODE=true and DEMO_MODE=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMS_DEV_MODE = 'true';
    process.env.DEMO_MODE = 'true';
    const { env } = await import('./env.js');
    expect(env.SMS_DEV_MODE).toBe(true);
    expect(env.DEMO_MODE).toBe(true);
  });

  it('allows NODE_ENV=production when SMS_DEV_MODE=false regardless of DEMO_MODE', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMS_DEV_MODE = 'false';
    const { env } = await import('./env.js');
    expect(env.SMS_DEV_MODE).toBe(false);
  });
});
