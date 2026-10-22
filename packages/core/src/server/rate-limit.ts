import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/** Ratelimit instances are cheap config objects — cache one per (limit, window). */
const limiters = new Map<string, Ratelimit>()

function limiterFor(limit: number, windowMs: number): Ratelimit {
  const key = `${limit}:${windowMs}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      prefix: "pindou",
      limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.round(windowMs / 1000))} s`),
    })
    limiters.set(key, limiter)
  }
  return limiter
}

/**
 * Distributed sliding-window rate limiter backed by Upstash Redis.
 *
 * Unlike an in-memory counter, the budget is shared across every serverless
 * instance (Vercel + Netlify), so concurrent requests from the same key can't
 * bypass it by hitting different cold-start instances.
 *
 * Required env vars: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
 * (create a free database at https://console.upstash.com; Vercel KV works too).
 */
export class RateLimiter {
  /**
   * Enforce a per-key request budget within a sliding window.
   *
   * Fails open: a Redis outage or missing configuration allows the request
   * rather than 500ing the route it protects.
   *
   * @param key      - The bucket key (e.g. `ip:<addr>` or `user:<id>`).
   * @param limit    - Max requests allowed in one window.
   * @param windowMs - Window length in milliseconds.
   * @returns A promise resolving to `true` when allowed, `false` when over the limit.
   */
  static async check(key: string, limit: number, windowMs: number): Promise<boolean> {
    try {
      const { success } = await limiterFor(limit, windowMs).limit(key)
      return success
    } catch {
      return true
    }
  }
}
