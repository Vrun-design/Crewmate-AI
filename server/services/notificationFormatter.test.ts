import { describe, expect, test } from 'vitest';
import { buildTaskNotification, buildToolExecutionNotification } from './notificationFormatter';
import type { AgentTask } from './orchestrator';

function createTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task_1',
    agentId: 'crewmate-product-agent',
    userId: 'user_1',
    workspaceId: 'ws_1',
    intent: 'Create a Notion summary for the checkout bug',
    status: 'completed',
    createdAt: '2026-03-11T10:00:00.000Z',
    updatedAt: '2026-03-11T10:00:10.000Z',
    steps: [],
    ...overrides,
  };
}

describe('notificationFormatter', () => {
  test('builds a rich Notion notification for live tool execution', () => {
    const notification = buildToolExecutionNotification('create_notion_page', {
      id: 'page_1',
      title: 'Checkout Bug Summary',
      url: 'https://www.notion.so/checkout-bug-summary',
    });

    expect(notification).toEqual({
      title: 'Notion page created',
      message: 'Created "Checkout Bug Summary". Open here: https://www.notion.so/checkout-bug-summary',
      type: 'success',
    });
  });

  test('builds a rich GitHub notification for completed tasks', () => {
    const notification = buildTaskNotification(createTask({
      result: {
        issueNumber: 42,
        title: 'Checkout overlap bug',
        url: 'https://github.com/acme/app/issues/42',
      },
    }));

    expect(notification).toEqual({
      title: 'GitHub issue created',
      message: 'Created "#42 Checkout overlap bug". Open here: https://github.com/acme/app/issues/42',
      type: 'success',
    });
  });
});
