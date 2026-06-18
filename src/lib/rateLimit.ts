/**
 * Simple in-memory rate limiter for Next.js API routes.
 * Uses a sliding window approach per IP address.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Window duration in milliseconds. Default: 60000 (1 min) */
  windowMs?: number;
  /** Max requests per window. Default: 60 */
  max?: number;
  /** Custom key function. Default: IP address */
  keyFn?: (request: Request) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a request.
 * Returns whether the request is allowed and metadata.
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig = {}
): RateLimitResult {
  cleanup();

  const { windowMs = 60000, max = 60, keyFn } = config;
  const key = keyFn ? keyFn(request) : getClientIp(request);
  const now = Date.now();
  const resetAt = now + windowMs;

  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  if (existing.count >= max) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  // Increment counter
  existing.count += 1;
  return { allowed: true, remaining: max - existing.count, resetAt: existing.resetAt };
}

/**
 * Helper to extract client IP from request headers.
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}


