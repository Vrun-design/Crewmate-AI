import type { NextFunction, Request, RequestHandler, Response } from 'express';

interface RateLimitOptions {
  max: number;
  windowMs: number;
  message: string;
  keyFn?: (req: Request) => string;
}

function getClientKey(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  return Array.isArray(forwardedFor)
    ? forwardedFor[0] ?? req.ip
    : forwardedFor?.split(',')[0]?.trim() || req.ip || 'unknown';
}

export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = options.keyFn?.(req) ?? getClientKey(req);
    const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < options.windowMs);

    if (recent.length >= options.max) {
      hits.set(key, recent);
      res.status(429).json({ message: options.message });
      return;
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
