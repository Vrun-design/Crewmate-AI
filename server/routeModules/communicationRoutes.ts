import type { Express, Request, Response } from 'express';
import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { serverConfig } from '../config';
import { dispatchCommand, findCommandTargetByEmail, type CommandChannel } from '../services/commandIngressService';
import type { RequireAuth } from './types';
import { looksLikeCasualChat, parseChannelModeAndText, type TaskIngressMode } from '../services/channelTasking';
import { createRateLimitMiddleware } from '../services/rateLimit';

interface InboundCommandBody {
  channel?: string;
  deliverToNotion?: boolean;
  mode?: string;
  notifyInSlack?: boolean;
  senderName?: string;
  sourceRef?: string;
  text?: string;
  title?: string;
  userEmail?: string;
}

interface SlackCommandRequest extends Request {
  rawBody?: string;
}

const inboundCommandLimiter = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many inbound commands. Please retry shortly.',
});
const authenticatedCommandLimiter = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many command requests. Please slow down and retry.',
});
const inboundCommandSchema = z.object({
  channel: z.string().optional(),
  deliverToNotion: z.boolean().optional(),
  mode: z.string().optional(),
  notifyInSlack: z.boolean().optional(),
  senderName: z.string().optional(),
  sourceRef: z.string().optional(),
  text: z.string().trim().min(1),
  title: z.string().optional(),
  userEmail: z.string().email().optional(),
});

function normalizeChannel(channel: string | undefined): CommandChannel {
  if (channel === 'live_session' || channel === 'slack' || channel === 'email' || channel === 'api') {
    return channel;
  }

  return 'webhook';
}

function normalizeMode(mode: string | undefined): TaskIngressMode {
  return mode === 'track' ? 'track' : 'delegate';
}

export function registerCommunicationRoutes(app: Express, requireAuth: RequireAuth): void {
  app.post('/api/communications/commands', authenticatedCommandLimiter, async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const parsedBody = inboundCommandSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'A valid text command is required.' });
      return;
    }
    const body = parsedBody.data;
    const text = body.text.trim();

    try {
      const result = await dispatchCommand(
        { userId: user.id, workspaceId: user.workspaceId },
        {
          channel: normalizeChannel(body.channel),
          senderName: typeof body.senderName === 'string' ? body.senderName.trim() : undefined,
          sourceRef: typeof body.sourceRef === 'string' ? body.sourceRef.trim() : undefined,
        },
        {
          deliverToNotion: Boolean(body.deliverToNotion),
          mode: normalizeMode(body.mode),
          notifyInSlack: Boolean(body.notifyInSlack),
          text,
          title: typeof body.title === 'string' ? body.title.trim() : undefined,
        },
      );
      res.status(202).json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to dispatch command' });
    }
  });

  app.post('/api/communications/inbound', inboundCommandLimiter, async (req: Request, res: Response) => {
    if (!serverConfig.inboundCommandToken) {
      res.status(404).json({ message: 'Inbound communication commands are not configured' });
      return;
    }

    const token = req.header('x-crewmate-command-token')?.trim() ?? '';
    if (!token || token !== serverConfig.inboundCommandToken) {
      res.status(401).json({ message: 'Unauthorized inbound command' });
      return;
    }

    const parsedBody = inboundCommandSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'A valid inbound payload with userEmail and text is required.' });
      return;
    }
    const body = parsedBody.data;
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';
    const text = body.text.trim();

    if (!userEmail || !text) {
      res.status(400).json({ message: 'userEmail and text are required' });
      return;
    }

    const target = findCommandTargetByEmail(userEmail);
    if (!target) {
      res.status(404).json({ message: 'Target user not found' });
      return;
    }

    try {
      const result = await dispatchCommand(
        target,
        {
          channel: normalizeChannel(body.channel),
          senderName: typeof body.senderName === 'string' ? body.senderName.trim() : undefined,
          sourceRef: typeof body.sourceRef === 'string' ? body.sourceRef.trim() : undefined,
        },
        {
          deliverToNotion: Boolean(body.deliverToNotion),
          mode: normalizeMode(body.mode),
          notifyInSlack: Boolean(body.notifyInSlack),
          text,
          title: typeof body.title === 'string' ? body.title.trim() : undefined,
        },
      );
      res.status(202).json(result);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unable to dispatch inbound command' });
    }
  });

  app.post(
    '/api/slack/commands/:workspaceId',
    express.urlencoded({
      extended: true,
      verify: (req, _res, buffer) => {
        (req as SlackCommandRequest).rawBody = buffer.toString('utf8');
      },
    }),
    async (req: Request, res: Response) => {
      const workspaceId = req.params.workspaceId;
      const target = findCommandTargetByEmail(
        typeof req.body?.user_email === 'string' && req.body.user_email.trim()
          ? req.body.user_email.trim().toLowerCase()
          : '',
      );
      if (!target || target.workspaceId !== workspaceId) {
        res.status(404).send('Workspace target not found.');
        return;
      }

      if (serverConfig.slackSigningSecret) {
        const timestamp = req.header('x-slack-request-timestamp')?.trim() ?? '';
        const signature = req.header('x-slack-signature')?.trim() ?? '';
        const rawBody = (req as SlackCommandRequest).rawBody ?? '';
        const timestampSeconds = Number.parseInt(timestamp, 10);
        const base = `v0:${timestamp}:${rawBody}`;
        const expected = `v0=${crypto.createHmac('sha256', serverConfig.slackSigningSecret).update(base).digest('hex')}`;
        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expected);
        const validSignature = signatureBuffer.length === expectedBuffer.length
          && crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
        const isFreshTimestamp = Number.isFinite(timestampSeconds)
          && Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) <= 60 * 5;
        if (!timestamp || !signature || !validSignature || !isFreshTimestamp) {
          res.status(401).send('Invalid Slack signature.');
          return;
        }
      }

      const rawText = typeof req.body?.text === 'string' ? req.body.text : '';
      const parsed = parseChannelModeAndText(rawText);
      if (!parsed.text) {
        res.status(200).send('Command was empty. Use /track ... or plain text to delegate work.');
        return;
      }

      if (!parsed.explicitMode && parsed.mode === 'delegate' && looksLikeCasualChat(parsed.text)) {
        res.status(200).send('Use /do ... to start work or /track ... to save a task. Casual greetings do not create tasks here.');
        return;
      }

      res.status(200).send(parsed.mode === 'track'
        ? 'Tracking that work now in Crewmate.'
        : 'Routing that work through Crewmate now.');

      void dispatchCommand(
        target,
        {
          channel: 'slack',
          senderName: typeof req.body?.user_name === 'string' ? req.body.user_name.trim() : undefined,
          slackChannelId: typeof req.body?.channel_id === 'string' ? req.body.channel_id.trim() : undefined,
          slackThreadTs: typeof req.body?.thread_ts === 'string' ? req.body.thread_ts.trim() : undefined,
          sourceRef: typeof req.body?.trigger_id === 'string' ? req.body.trigger_id.trim() : undefined,
        },
        {
          mode: parsed.mode,
          text: parsed.text,
          title: typeof req.body?.command === 'string' && req.body.command.trim()
            ? `${req.body.command.trim()} ${parsed.text}`.trim()
            : undefined,
        },
      ).catch((error) => {
        console.error('[slack] Failed to process Slack command:', error);
      });
    },
  );
}
