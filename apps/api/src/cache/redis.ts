import { createClient } from 'redis';
import { env } from '../config/env.js';

export const redisClient = createClient({ url: env.REDIS_URL });

redisClient.on('error', (err: unknown) => {
  console.error('Redis client error', err);
});

let connectPromise: Promise<unknown> | null = null;

function ensureConnected(): Promise<unknown> {
  if (redisClient.isOpen) {
    return Promise.resolve();
  }
  connectPromise ??= redisClient.connect();
  return connectPromise;
}

export async function pingCache(): Promise<void> {
  await ensureConnected();
  await redisClient.ping();
}
