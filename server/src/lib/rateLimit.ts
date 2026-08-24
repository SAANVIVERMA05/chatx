/**
 * In-memory rate limiter with sliding window.
 *
 * Tracks request counts per key (e.g. phone number) and rejects
 * once the limit is exceeded within the window.
 *
 * Entries are lazily cleaned up when the window expires.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  /** Max requests allowed within the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export function createRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart > config.windowMs) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Allow Node to exit even if this timer is still running
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return {
    /**
     * Check if a request for the given key is allowed.
     * Returns { allowed, remaining, retryAfterMs }.
     */
    check(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now - entry.windowStart > config.windowMs) {
        // Start a new window
        store.set(key, { count: 1, windowStart: now });
        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          retryAfterMs: 0,
        };
      }

      if (entry.count >= config.maxRequests) {
        const retryAfterMs = config.windowMs - (now - entry.windowStart);
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs,
        };
      }

      entry.count++;
      return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        retryAfterMs: 0,
      };
    },

    /** Stop the cleanup timer (call on shutdown) */
    destroy() {
      clearInterval(cleanupInterval);
      store.clear();
    },
  };
}

/**
 * OTP rate limiter: max 3 requests per phone per 10 minutes.
 */
export const otpRateLimiter = createRateLimiter({
  maxRequests: 3,
  windowMs: 10 * 60 * 1000, // 10 minutes
});
