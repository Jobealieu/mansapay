import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('./config/env.js', () => ({
  env: {
    ALLOWED_ORIGINS: ['http://localhost:5173', 'https://mansapay-web.onrender.com'],
  },
}));

afterEach(() => {
  vi.resetModules();
});

describe('createApp - cross-cutting middleware', () => {
  it('trusts exactly one proxy hop (Render sits behind exactly one load balancer)', async () => {
    const { createApp } = await import('./app.js');
    expect(createApp().get('trust proxy')).toBe(1);
  });

  it('allows a configured origin via CORS', async () => {
    const { createApp } = await import('./app.js');
    const res = await request(createApp()).get('/__nonexistent__').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not set an allow-origin header for an unlisted origin', async () => {
    const { createApp } = await import('./app.js');
    const res = await request(createApp()).get('/__nonexistent__').set('Origin', 'https://evil.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not enable credentialed CORS (Authorization headers, not cookies)', async () => {
    const { createApp } = await import('./app.js');
    const res = await request(createApp()).get('/__nonexistent__').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
