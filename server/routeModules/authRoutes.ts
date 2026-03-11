import type { Express, Request, Response } from 'express';
import { serverConfig } from '../config';
import { buildCalendarAuthUrl, exchangeCalendarCode } from '../services/calendarService';
import { clearAuthSession, getAuthUser, requestLoginCode, verifyLoginCode } from '../services/authService';
import { buildGmailAuthUrl, exchangeGmailCode } from '../services/gmailService';

const AUTH_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const AUTH_REQUEST_MIN_INTERVAL_MS = 30 * 1000;
const AUTH_REQUEST_MAX_ATTEMPTS = 5;
const authRequestTracker = new Map<string, number[]>();

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
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    const now = Date.now();
    if (isAuthRequestRateLimited(getAuthThrottleKey(email, req), now)) {
      res.status(429).json({ message: 'Too many verification requests. Please wait before trying again.' });
      return;
    }

    const result = requestLoginCode(email);
    res.status(201).json(serverConfig.exposeDevAuthCode ? result : { email: result.email });
  });

  app.post('/api/auth/verify', (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

    if (!email || !code) {
      res.status(400).json({ message: 'email and code are required' });
      return;
    }

    try {
      res.json(verifyLoginCode(email, code));
    } catch (error) {
      res.status(401).json({ message: error instanceof Error ? error.message : 'Verification failed' });
    }
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = token ? getAuthUser(token) : null;

    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    res.json(user);
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token) {
      clearAuthSession(token);
    }
    res.status(204).send();
  });

  app.get('/api/auth/gmail', (req: Request, res: Response) => {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    const user = token ? getAuthUser(token) : null;
    const workspaceId = user?.workspaceId ?? (req.query.workspaceId as string) ?? 'default';
    res.redirect(buildGmailAuthUrl(workspaceId));
  });

  app.get('/api/auth/gmail/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const workspaceId = (req.query.state as string) ?? 'default';

    if (!code) {
      res.status(400).send('Missing authorization code from Google');
      return;
    }

    try {
      await exchangeGmailCode(workspaceId, code);
      res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/integrations?connected=gmail`);
    } catch (err) {
      console.error('[Gmail OAuth] callback error:', err);
      res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/integrations?error=gmail_auth_failed`);
    }
  });

  app.get('/api/auth/calendar', (req: Request, res: Response) => {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    const user = token ? getAuthUser(token) : null;
    const workspaceId = user?.workspaceId ?? (req.query.workspaceId as string) ?? 'default';
    res.redirect(buildCalendarAuthUrl(workspaceId));
  });

  app.get('/api/auth/calendar/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const workspaceId = (req.query.state as string) ?? 'default';

    if (!code) {
      res.status(400).send('Missing authorization code from Google');
      return;
    }

    try {
      await exchangeCalendarCode(workspaceId, code);
      res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/integrations?connected=calendar`);
    } catch (err) {
      console.error('[Calendar OAuth] callback error:', err);
      res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/integrations?error=calendar_auth_failed`);
    }
  });
}
