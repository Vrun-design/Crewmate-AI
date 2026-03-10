import type { Express, Request, Response } from 'express';
import { buildCalendarAuthUrl, exchangeCalendarCode } from '../services/calendarService';
import { clearAuthSession, getAuthUser, requestLoginCode, verifyLoginCode } from '../services/authService';
import { buildGmailAuthUrl, exchangeGmailCode } from '../services/gmailService';

export function registerAuthRoutes(app: Express): void {
  app.post('/api/auth/request-code', (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    res.status(201).json(requestLoginCode(email));
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
