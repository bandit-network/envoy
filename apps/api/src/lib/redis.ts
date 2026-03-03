import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/**
 * Singleton Redis client.
 * Lazy-connects on first use. Reconnects automatically on failure.
 */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // Exponential backoff capped at 2s
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

let connected = false;

export async function ensureRedis(): Promise<Redis> {
  if (!connected) {
    await redis.connect();
    connected = true;
  }
  return redis;
}
