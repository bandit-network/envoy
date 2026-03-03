import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { redis, ensureRedis } from "../lib/redis";

interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Function to derive the rate-limit key from the request. Defaults to IP. */
  keyFn?: (c: Context) => string;
}

/**
 * Extract client IP from request headers or connection info.
 */
function getClientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

/**
 * Redis sliding-window rate limiter using sorted sets.
 *
 * Each request adds a timestamped entry to a sorted set keyed per client.
 * Expired entries are pruned on every check. If the remaining count exceeds
 * the limit the request is rejected with 429.
 */
export function createRateLimit(opts: RateLimitOptions) {
  const { limit, windowMs, keyFn } = opts;

  return createMiddleware(async (c, next) => {
    let client: typeof redis;
    try {
      client = await ensureRedis();
    } catch {
      // If Redis is down, fail open -- don't block requests
      console.warn("[rate-limit] Redis unavailable, skipping rate limit");
      await next();
      return;
    }

    const identifier = keyFn ? keyFn(c) : getClientIp(c);
    const key = `rl:${c.req.path}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Lua script: atomic prune + count + add
    const luaScript = `
      redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
      local count = redis.call('ZCARD', KEYS[1])
      if count < tonumber(ARGV[2]) then
        redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
        redis.call('PEXPIRE', KEYS[1], ARGV[5])
        return count + 1
      end
      return -1
    `;

    const memberId = `${now}:${Math.random().toString(36).slice(2, 8)}`;
    const result = await client.eval(
      luaScript,
      1,
      key,
      String(windowStart),
      String(limit),
      String(now),
      memberId,
      String(windowMs)
    ) as number;

    // Set rate limit headers
    c.header("X-RateLimit-Limit", String(limit));

    if (result === -1) {
      // Over limit
      const oldestEntry = await client.zrange(key, 0, 0, "WITHSCORES");
      const retryAfter = oldestEntry.length >= 2
        ? Math.ceil((Number(oldestEntry[1]) + windowMs - now) / 1000)
        : Math.ceil(windowMs / 1000);

      c.header("X-RateLimit-Remaining", "0");
      c.header("Retry-After", String(Math.max(retryAfter, 1)));

      return c.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later.",
          },
        },
        429
      );
    }

    c.header("X-RateLimit-Remaining", String(Math.max(limit - result, 0)));
    await next();
  });
}
