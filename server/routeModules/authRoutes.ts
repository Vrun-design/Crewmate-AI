import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { serverConfig } from '../config';
import { clearAuthSession, getAuthUser, requestLoginCode, verifyLoginCode } from '../services/authService';
import { createRateLimitMiddleware } from '../services/rateLimit';

const AUTH_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const AUTH_REQUEST_MIN_INTERVAL_MS = 30 * 1000;
const AUTH_REQUEST_MAX_ATTEMPTS = 5;
const authRequestTracker = new Map<string, number[]>();
const authVerifyLimiter = createRateLimitMiddleware({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many verification attempts. Please wait before trying again.',
});
const emailSchema = z.string().email().transform((value) => value.trim().toLowerCase());
const requestCodeSchema = z.object({ email: emailSchema });
const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/),
});

function getAuthThrottleKey(email: string, req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]?.trim() || req.ip || 'unknown';
  return `${email}:${ip}`;
}

function isAuthRequestRateLimited(key: string, now: number): boolean {
  const recentAttempts = (authRequestTracker.get(key) ?? []).filter((timestamp) => now - timestamp < AUTH_REQUEST_WINDOW_MS);

  if (recentAttempts.length >= AUTH_REQUEST_MAX_ATTEMPTS) {
    authRequestTracker.set(key, recentAttempts);
    return true;
  }

  const lastAttemptAt = recentAttempts[recentAttempts.length - 1];
  if (lastAttemptAt && now - lastAttemptAt < AUTH_REQUEST_MIN_INTERVAL_MS) {
    authRequestTracker.set(key, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  authRequestTracker.set(key, recentAttempts);
  return false;
}

export function registerAuthRoutes(app: Express): void {
  app.post('/api/auth/request-code', (req: Request, res: Response) => {
    const parsed = requestCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'A valid email is required.' });
      return;
    }

    const email = parsed.data.email;

    const now = Date.now();
    if (isAuthRequestRateLimited(getAuthThrottleKey(email, req), now)) {
      res.status(429).json({ message: 'Too many verification requests. Please wait before trying again.' });
      return;
    }

    const result = requestLoginCode(email);
    res.status(201).json(serverConfig.exposeDevAuthCode ? result : { email: result.email });
  });

  app.post('/api/auth/verify', authVerifyLimiter, (req: Request, res: Response) => {
    const parsed = verifyCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'A valid email and 6-digit code are required.' });
      return;
    }

    const { email, code } = parsed.data;

    try {
      res.json(verifyLoginCode(email, code));
    } catch (error) {
      res.status(401).json({ message: error instanceof Error ? error.message : 'Verification failed' });
    }
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const user = (req as Request & { authUser?: ReturnType<typeof getAuthUser> }).authUser ?? null;

    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    res.json(user);
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token && token.startsWith('auth_')) {
      clearAuthSession(token);
    }
    res.status(204).send();
  });
}
