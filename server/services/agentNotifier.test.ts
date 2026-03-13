import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AgentTask } from './orchestrator';

const createNotification = vi.fn();
const postSlackMessage = vi.fn();
const broadcastEvent = vi.fn();

vi.mock('./notificationService', () => ({
  createNotification,
}));

vi.mock('./slackService', () => ({
  postSlackMessage,
}));

vi.mock('./eventService', () => ({
  broadcastEvent,
}));

vi.mock('./notificationPrefsService', () => ({
  getNotificationPrefs: vi.fn(() => ({
    notifyOnSuccess: true,
    notifyOnError: true,
    inAppEnabled: true,
  })),
}));

vi.mock('../db', () => ({
  db: {
    prepare: vi.fn(() => ({
      get: vi.fn(() => ({ workspaceId: 'WS-1' })),
    })),
  },
}));

const { notifyTaskComplete } = await import('./agentNotifier');

function createTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'RUN-1',
    taskId: 'TSK-1',
    agentId: 'skill-registry',
    routeType: 'delegated_skill',
    userId: 'USR-1',
    workspaceId: 'WS-1',
    intent: 'Create launch summary',
    status: 'completed',
    originType: 'slack',
    originRef: JSON.stringify({ channel: 'slack', channelId: 'C123', threadTs: '123.456' }),
    createdAt: '2026-03-13T10:00:00.000Z',
    updatedAt: '2026-03-13T10:00:05.000Z',
    completedAt: '2026-03-13T10:00:05.000Z',
    result: {
      title: 'Launch Summary',
      url: 'https://www.notion.so/launch-summary',
    },
    steps: [],
    ...overrides,
  };
}

describe('agentNotifier', () => {
  beforeEach(() => {
    createNotification.mockReset();
    postSlackMessage.mockReset();
    broadcastEvent.mockReset();
  });

  test('replies back to the same slack thread for slack-origin tasks', async () => {
    await notifyTaskComplete('USR-1', createTask({
      originType: 'slack',
      originRef: JSON.stringify({ channel: 'slack', channelId: 'C123', threadTs: '123.456' }),
    }));

    expect(postSlackMessage).toHaveBeenCalledWith('WS-1', expect.objectContaining({
      channelId: 'C123',
      threadTs: '123.456',
    }));
  });

  test('emits a live task update for live-origin tasks', async () => {
    await notifyTaskComplete('USR-1', createTask({
      originType: 'live_session',
      originRef: JSON.stringify({ channel: 'live_session', sessionId: 'SES-1' }),
    }));

    expect(broadcastEvent).toHaveBeenCalledWith('USR-1', 'live_task_update', expect.objectContaining({
      sessionId: 'SES-1',
      taskId: 'TSK-1',
      taskRunId: 'RUN-1',
    }));
  });
});
