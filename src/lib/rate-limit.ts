/**
 * Minimal in-memory fixed-window rate limiter, keyed by a string (typically the
 * client IP). Suitable for per-instance protection against accidental abuse of
 * expensive endpoints (e.g. `/api/transform`); it is not a distributed limiter
 * — behind multiple serverless instances each enforces its own budget.
 */
const windows = new Map<string, { count: number; resetAt: number }>()

/**
 * Enforce a per-key request budget within a sliding fixed window.
 *
 * @param key        - The bucket key (e.g. `ip:<addr>`).
 * @param limit      - Max requests allowed in one window.
 * @param windowMs   - Window length in milliseconds.
 * @returns `true` when the request is allowed, `false` when over the limit.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = windows.get(key)

  if (!bucket || bucket.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}

/** Opportunistically drop expired buckets to bound memory growth. */
export function sweepRateLimitBuckets(now = Date.now()) {
  for (const [key, bucket] of windows) {
    if (bucket.resetAt <= now) windows.delete(key)
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(() => sweepRateLimitBuckets(), 60_000).unref?.()
}
