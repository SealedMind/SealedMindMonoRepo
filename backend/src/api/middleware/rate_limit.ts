import { Request, Response, NextFunction } from "express";

/**
 * Token-bucket rate limiter, keyed by an arbitrary string the caller
 * supplies (typically the API key or wallet address).
 *
 * Defaults: 30 requests per 60 seconds per key. Override per-route via
 * `rateLimit({ capacity, refillPerSec })`.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;   // ms epoch
}

const buckets = new Map<string, Bucket>();

interface Options {
  capacity?: number;        // max tokens in the bucket
  refillPerSec?: number;    // tokens added per second
  keyFn?: (req: Request) => string | undefined;
}

const DEFAULT_KEY_FN = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.ip ?? undefined;
};

export function rateLimit(opts: Options = {}) {
  const capacity     = opts.capacity     ?? 30;
  const refillPerSec = opts.refillPerSec ?? 0.5;   // 30 / 60 sec
  const keyFn        = opts.keyFn        ?? DEFAULT_KEY_FN;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn(req);
    if (!key) {
      res.status(429).json({ error: "rate limiter could not identify caller" });
      return;
    }

    const now = Date.now();
    let b = buckets.get(key);
    if (!b) {
      b = { tokens: capacity, lastRefill: now };
      buckets.set(key, b);
    } else {
      const elapsedSec = (now - b.lastRefill) / 1000;
      b.tokens = Math.min(capacity, b.tokens + elapsedSec * refillPerSec);
      b.lastRefill = now;
    }

    if (b.tokens < 1) {
      const retryAfter = Math.ceil((1 - b.tokens) / refillPerSec);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "rate limit exceeded",
        retry_after_seconds: retryAfter,
      });
      return;
    }

    b.tokens -= 1;
    res.setHeader("X-RateLimit-Remaining", String(Math.floor(b.tokens)));
    res.setHeader("X-RateLimit-Limit", String(capacity));
    next();
  };
}
