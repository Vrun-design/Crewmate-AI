import type { Express, Request, Response } from 'express';
import { serverConfig } from '../config';
import { dispatchCommand, findCommandTargetByEmail, type CommandChannel } from '../services/commandIngressService';
import type { RequireAuth } from './types';

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

function normalizeChannel(channel: string | undefined): CommandChannel {
  if (channel === 'live_session' || channel === 'slack' || channel === 'email' || channel === 'telegram' || channel === 'api') {
    return channel;
  }

  return 'webhook';
}

export function registerCommunicationRoutes(app: Express, requireAuth: RequireAuth): void {
  app.post('/api/communications/commands', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const body = req.body as InboundCommandBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      res.status(400).json({ message: 'text is required' });
      return;
    }

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
          mode: body.mode === 'async' ? 'async' : 'sync',
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

  app.post('/api/communications/inbound', async (req: Request, res: Response) => {
    if (!serverConfig.inboundCommandToken) {
      res.status(404).json({ message: 'Inbound communication commands are not configured' });
      return;
    }

    const token = req.header('x-crewmate-command-token')?.trim() ?? '';
    if (!token || token !== serverConfig.inboundCommandToken) {
      res.status(401).json({ message: 'Unauthorized inbound command' });
      return;
    }

    const body = req.body as InboundCommandBody;
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';

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
          mode: body.mode === 'async' ? 'async' : 'sync',
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
}
