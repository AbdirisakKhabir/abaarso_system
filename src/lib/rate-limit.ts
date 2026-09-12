import { NextRequest } from "next/server";

/**
 * Minimal in-memory fixed-window rate limiter for a single Node process.
 * Good enough to blunt brute-force/scraping/spam from a given IP on a
 * traditionally-hosted (non-serverless-per-request) deployment. Not a
 * substitute for a shared store (Redis) if this ever runs multi-instance.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

// Periodically drop expired buckets so this map can't grow unbounded.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Returns { limited: false } if the call is allowed, or
 * { limited: true, retryAfterSeconds } if `key` has exceeded `max` calls
 * within `windowMs`.
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { limited: false } | { limited: true; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return { limited: true, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { limited: false };
}
