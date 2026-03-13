import { beforeEach, describe, expect, test } from 'vitest';
import { db } from '../../db';
import { createTask } from '../../services/orchestrator';
import { taskCancelSkill, taskListActiveSkill } from './task-control.skills';

describe('task control skills', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM task_runs').run();
    db.prepare('DELETE FROM tasks').run();
  });

  test('lists active tasks from the current live session', async () => {
    createTask('skill-registry', 'Live delegation: research competitors', {
      userId: 'user-1',
      workspaceId: 'ws-1',
    }, {
      routeType: 'delegated_skill',
      originType: 'live_session',
      originRef: 'session-1',
    });
    createTask('skill-registry', 'Other session work', {
      userId: 'user-1',
      workspaceId: 'ws-1',
    }, {
      routeType: 'delegated_skill',
      originType: 'live_session',
      originRef: 'session-2',
    });

    const result = await taskListActiveSkill.handler({
      userId: 'user-1',
      workspaceId: 'ws-1',
      sessionId: 'session-1',
    }, {});

    expect(result.success).toBe(true);
    expect(Array.isArray(result.output)).toBe(true);
    expect((result.output as Array<{ intent: string }>)).toHaveLength(1);
    expect((result.output as Array<{ intent: string }>)[0]?.intent).toContain('research competitors');
  });

  test('cancels the latest active task from the current live session', async () => {
    const task = createTask('skill-registry', 'Live delegation: draft meeting summary', {
      userId: 'user-1',
      workspaceId: 'ws-1',
    }, {
      routeType: 'delegated_skill',
      originType: 'live_session',
      originRef: 'session-1',
    });

    const result = await taskCancelSkill.handler({
      userId: 'user-1',
      workspaceId: 'ws-1',
      sessionId: 'session-1',
    }, {});

    expect(result.success).toBe(true);
    expect(result.message).toContain('Cancelled task');

    const row = db.prepare('SELECT status, error FROM task_runs WHERE id = ?').get(task.id) as { status: string; error: string | null };
    expect(row.status).toBe('cancelled');
    expect(row.error).toBe('Cancelled by user');
  });

  test('asks for specificity when multiple active tasks match', async () => {
    createTask('skill-registry', 'Research ACME competitors', {
      userId: 'user-1',
      workspaceId: 'ws-1',
    }, {
      routeType: 'delegated_skill',
      originType: 'live_session',
      originRef: 'session-1',
    });
    createTask('skill-registry', 'Research ACME pricing', {
      userId: 'user-1',
      workspaceId: 'ws-1',
    }, {
      routeType: 'delegated_skill',
      originType: 'live_session',
      originRef: 'session-1',
    });

    const result = await taskCancelSkill.handler({
      userId: 'user-1',
      workspaceId: 'ws-1',
      sessionId: 'session-1',
    }, { query: 'research acme', scope: 'current_session' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Multiple active tasks matched');
  });
});
