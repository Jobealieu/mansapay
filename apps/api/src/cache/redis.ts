import { createClient } from 'redis';
import { env } from '../config/env.js';

export const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    // Bound reconnection so a downed Redis fails fast (callers like the
    // login rate limiter fail-closed and need connect() to reject quickly,
    // not retry forever) while still recovering once Redis comes back.
    reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(retries * 100, 500)),
  },
});

redisClient.on('error', (err: unknown) => {
  console.error('Redis client error', err);
});

let connectPromise: Promise<unknown> | null = null;

export function ensureConnected(): Promise<unknown> {
  if (redisClient.isOpen) {
    return Promise.resolve();
  }
  if (!connectPromise) {
    connectPromise = redisClient.connect().catch((err: unknown) => {
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

export async function pingCache(): Promise<void> {
  await ensureConnected();
  await redisClient.ping();
}
