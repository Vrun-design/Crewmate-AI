// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from 'vitest';

const enqueueWorkflowRunJob = vi.fn();
const orchestrate = vi.fn();

vi.mock('./delegationService', () => ({
  enqueueWorkflowRunJob,
}));

vi.mock('./orchestrator', () => ({
  orchestrate,
}));

vi.mock('./activityService', () => ({
  insertActivity: vi.fn(),
}));

const { dispatchCommand } = await import('./commandIngressService');

describe('commandIngressService', () => {
  beforeEach(() => {
    enqueueWorkflowRunJob.mockReset();
    orchestrate.mockReset();
  });

  test('starts a synchronous orchestrated task for inbound commands', async () => {
    orchestrate.mockResolvedValue({ taskId: 'agt_123' });

    const result = await dispatchCommand(
      { userId: 'USR-1', workspaceId: 'WS-1' },
      { channel: 'webhook', senderName: 'Zapier' },
      { text: 'Summarize the latest issues and post next steps.' },
    );

    expect(orchestrate).toHaveBeenCalledWith('Summarize the latest issues and post next steps.', {
      userId: 'USR-1',
      workspaceId: 'WS-1',
    });
    expect(result).toEqual({
      id: 'agt_123',
      kind: 'agent_task',
      message: 'Started an agent task from webhook.',
      mode: 'sync',
      status: 'queued',
    });
  });

  test('queues async background work with channel-aware metadata', async () => {
    enqueueWorkflowRunJob.mockReturnValue({
      id: 'JOB-1',
      title: 'Review Q2 pipeline',
      status: 'queued',
    });

    const result = await dispatchCommand(
      { userId: 'USR-1', workspaceId: 'WS-1' },
      { channel: 'telegram', senderName: 'founder@example.com', sourceRef: 'chat-123:456' },
      {
        text: 'Review the pipeline, identify blockers, and send the result later.',
        title: 'Review Q2 pipeline',
        mode: 'async',
        deliverToNotion: true,
        notifyInSlack: true,
      },
    );

    expect(enqueueWorkflowRunJob).toHaveBeenCalledWith(
      'WS-1',
      'USR-1',
      {
        title: 'Review Q2 pipeline',
        intent: 'Review the pipeline, identify blockers, and send the result later.',
        deliverToNotion: true,
        notifyInSlack: true,
      },
      {
        actor: 'founder@example.com',
        handoffSummary: 'Queued from Telegram by founder@example.com',
        originRef: 'chat-123:456',
        originType: 'telegram',
      },
    );
    expect(result).toEqual({
      id: 'JOB-1',
      kind: 'job',
      message: 'Queued background execution from Telegram.',
      mode: 'async',
      status: 'queued',
    });
  });
});
