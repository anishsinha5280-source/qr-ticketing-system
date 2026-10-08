/**
 * Tiny in-memory fixed-window rate limiter (the Next.js equivalent of what
 * `express-rate-limit` provides for an Express backend).
 *
 * State is kept on `globalThis` so it survives hot-reloads in development.
 * For multi-instance deployments swap the store for Redis — the interface
 * stays identical.
 */

import { env } from "@/lib/env";

type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as typeof globalThis & {
  __etsRateLimitStore?: Map<string, Bucket>;
};

const store: Map<string, Bucket> =
  globalStore.__etsRateLimitStore ?? new Map<string, Bucket>();

if (!globalStore.__etsRateLimitStore) {
  globalStore.__etsRateLimitStore = store;
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  if (!env.rateLimitEnabled) {
    return { success: true, limit, remaining: limit, resetAt: Date.now() + windowMs };
  }

  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    prune(now);
    return { success: true, limit, remaining: limit - 1, resetAt };
  }

  bucket.count += 1;
  const success = bucket.count <= limit;
  return {
    success,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/** Keep the map from growing without bound. */
function prune(now: number) {
  if (store.size < 2000) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

/** Presets used by the API routes. */
export const LIMITS = {
  /** Login / logout / session lookups — strict, stops credential stuffing. */
  auth: { limit: 20, windowMs: 60_000 },
  /** Account sign-ups. */
  signup: { limit: 60, windowMs: 60_000 },
  /** Event registrations by a signed-in student. */
  register: { limit: 60, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  verify: { limit: 240, windowMs: 60_000 },
  read: { limit: 300, windowMs: 60_000 },
} as const;
