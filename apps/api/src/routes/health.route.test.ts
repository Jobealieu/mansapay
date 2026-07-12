import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { healthResponseSchema } from '@mansapay/shared';

vi.mock('../db/pool.js', () => ({
  pingDb: vi.fn(),
}));
vi.mock('../cache/redis.js', () => ({
  pingCache: vi.fn(),
}));

describe('GET /health', () => {
  it('returns a shape-valid ok response when db and cache are reachable', async () => {
    const { pingDb } = await import('../db/pool.js');
    const { pingCache } = await import('../cache/redis.js');
    vi.mocked(pingDb).mockResolvedValueOnce(undefined);
    vi.mocked(pingCache).mockResolvedValueOnce(undefined);

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(200);
    const parsed = healthResponseSchema.parse(res.body);
    expect(parsed).toEqual({ status: 'ok', db: 'ok', cache: 'ok' });
  });

  it('returns a shape-valid error response when a dependency is unreachable', async () => {
    const { pingDb } = await import('../db/pool.js');
    const { pingCache } = await import('../cache/redis.js');
    vi.mocked(pingDb).mockRejectedValueOnce(new Error('connection refused'));
    vi.mocked(pingCache).mockResolvedValueOnce(undefined);

    const { createApp } = await import('../app.js');
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(503);
    const parsed = healthResponseSchema.parse(res.body);
    expect(parsed).toEqual({ status: 'error', db: 'error', cache: 'ok' });
  });
});
