import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/**
 * Parse a Redis URL into connection options.
 * BullMQ requires maxRetriesPerRequest: null.
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
  };
}

/** Connection options for BullMQ (requires maxRetriesPerRequest: null) */
export const redisConnectionOpts = {
  ...parseRedisUrl(REDIS_URL),
  maxRetriesPerRequest: null as null,
};

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
