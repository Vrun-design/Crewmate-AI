// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from 'vitest';

const orchestrate = vi.fn();
const createWorkspaceTask = vi.fn();

vi.mock('./orchestrator', () => ({
  orchestrate,
}));

vi.mock('../repositories/workspaceRepository', () => ({
  createWorkspaceTask,
}));

vi.mock('./activityService', () => ({
  insertActivity: vi.fn(),
}));

const { dispatchCommand } = await import('./commandIngressService');

describe('commandIngressService', () => {
  beforeEach(() => {
    orchestrate.mockReset();
    createWorkspaceTask.mockReset();
  });

  test('delegates inbound commands into the shared task runtime by default', async () => {
    orchestrate.mockResolvedValue({ taskId: 'agt_123' });

    const result = await dispatchCommand(
      { userId: 'USR-1', workspaceId: 'WS-1' },
      { channel: 'webhook', senderName: 'Zapier' },
      { text: 'Summarize the latest issues and post next steps.' },
    );

    expect(orchestrate).toHaveBeenCalledWith('Summarize the latest issues and post next steps.', {
      userId: 'USR-1',
      workspaceId: 'WS-1',
      originType: 'system',
      originRef: JSON.stringify({
        channel: 'webhook',
        sourceRef: null,
      }),
      taskTitle: 'Summarize the latest issues and post next steps.',
    });
    expect(result).toEqual({
      id: 'agt_123',
      kind: 'agent_task',
      message: 'Task started from webhook.',
      mode: 'delegate',
      status: 'queued',
    });
  });

  test('queues delegated tasks with channel-aware Slack metadata', async () => {
    orchestrate.mockResolvedValue({ taskId: 'agt_async_1' });

    const result = await dispatchCommand(
      { userId: 'USR-1', workspaceId: 'WS-1' },
      {
        channel: 'slack',
        senderName: 'founder@example.com',
        slackChannelId: 'C123',
        slackThreadTs: '123.456',
      },
      {
        text: 'Review the pipeline, identify blockers, and send the result later.',
        title: 'Review Q2 pipeline',
        mode: 'delegate',
        deliverToNotion: true,
        notifyInSlack: true,
      },
    );

    expect(orchestrate).toHaveBeenCalledWith('Review the pipeline, identify blockers, and send the result later.', {
      userId: 'USR-1',
      workspaceId: 'WS-1',
      originRef: JSON.stringify({
        channel: 'slack',
        channelId: 'C123',
        threadTs: '123.456',
        userName: 'founder@example.com',
      }),
      originType: 'slack',
      taskTitle: 'Review Q2 pipeline',
    });
    expect(result).toEqual({
      id: 'agt_async_1',
      kind: 'agent_task',
      message: 'Task started from Slack.',
      mode: 'delegate',
      status: 'queued',
    });
  });

  test('creates a tracked task without orchestration when mode is track', async () => {
    createWorkspaceTask.mockReturnValue({ id: 'TSK-1' });

    const result = await dispatchCommand(
      { userId: 'USR-1', workspaceId: 'WS-1' },
      { channel: 'slack', senderName: 'founder', slackChannelId: 'C123', slackThreadTs: '123.456' },
      { text: 'Capture the launch blockers', mode: 'track' },
    );

    expect(orchestrate).not.toHaveBeenCalled();
    expect(createWorkspaceTask).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'TSK-1',
      kind: 'task',
      message: 'Task tracked from Slack.',
      mode: 'track',
      status: 'pending',
    });
  });
});
