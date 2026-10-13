type Bucket = { count: number; resetAt: number };

declare global {
  var __wfhRateLimitBuckets: Map<string, Bucket> | undefined;
}

const buckets = globalThis.__wfhRateLimitBuckets ?? new Map<string, Bucket>();
globalThis.__wfhRateLimitBuckets = buckets;

/** Process-local fixed-window limiter for the single-container deployment. */
export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= 10_000) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
      }
      while (buckets.size >= 10_000) {
        const oldest = buckets.keys().next().value as string | undefined;
        if (!oldest) break;
        buckets.delete(oldest);
      }
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= limit) return { allowed: false, resetAt: bucket.resetAt };
  bucket.count += 1;
  return { allowed: true, resetAt: bucket.resetAt };
}
