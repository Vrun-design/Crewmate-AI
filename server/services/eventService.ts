import type { Request, Response } from 'express';

type JobUpdateEvent = {
  jobId: string;
  status: string;
};

type NotificationEvent = {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'default';
  read?: boolean;
  sourcePath?: string | null;
};

type SessionUpdateEvent = {
  sessionId: string;
};

type LiveTaskUpdateEvent = {
  sessionId: string;
  taskId: string;
  taskRunId: string;
  title: string;
  status: 'completed' | 'failed';
  summary?: string | null;
};

type EventPayloadMap = {
  job_update: JobUpdateEvent;
  notification: NotificationEvent;
  session_update: SessionUpdateEvent;
  live_task_update: LiveTaskUpdateEvent;
  session_error: {
    sessionId: string;
    reason: string;
    message: string;
    technicalDetail?: string;
  };
};

interface Client {
  id: string;
  userId: string;
  res: Response;
}

let clients: Client[] = [];

export function addSseClient(id: string, userId: string, req: Request, res: Response): void {
  clients.push({ id, userId, res });

  req.on('close', () => {
    removeSseClient(id);
  });
}

export function removeSseClient(id: string): void {
  clients = clients.filter((client) => client.id !== id);
}

export function broadcastEvent<TEvent extends keyof EventPayloadMap>(
  userId: string,
  event: TEvent,
  data: EventPayloadMap[TEvent],
): void {
  const targetClients = clients.filter((client) => client.userId === userId);

  targetClients.forEach((client) => {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}
