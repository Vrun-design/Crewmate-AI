// @vitest-environment node

import {beforeEach, describe, expect, test} from 'vitest';

process.env.CREWMATE_DB_PATH = 'data/crewmate.test.db';

const {db} = await import('../db');
const {getSession} = await import('../repositories/sessionRepository');
const {listSessionHistory} = await import('../repositories/workspaceRepository');
const {endSession, startSession} = await import('./sessionService');
const {getDashboardPayload} = await import('../repositories/dashboardRepository');
const {requestLoginCode, verifyLoginCode} = await import('./authService');
const {createTask, getTask, listTasks: listAgentTasks} = await import('./orchestrator');
const {ingestKnowledgeMemory, searchMemoryRecords, retrieveRelevantMemories} = await import('./memoryService');

function createUser(email: string): {id: string; workspaceId: string} {
  const {devCode} = requestLoginCode(email);
  const {user} = verifyLoginCode(email, devCode);
  return {id: user.id, workspaceId: user.workspaceId};
}

function resetDatabase(): void {
  db.exec(`
    DELETE FROM auth_sessions;
    DELETE FROM auth_codes;
    DELETE FROM session_messages;
    DELETE FROM sessions;
    DELETE FROM integration_connections;
    DELETE FROM workspace_members;
    DELETE FROM workspaces;
    DELETE FROM user_preferences;
    DELETE FROM notifications;
    DELETE FROM tasks;
    DELETE FROM task_runs;
    DELETE FROM activities;
    DELETE FROM integrations;
    DELETE FROM memory_records;
    DELETE FROM screenshot_artifacts;
    DELETE FROM users;
  `);
}

describe('sessionService', () => {
  beforeEach(() => {
    resetDatabase();
  });

  test('starts a local session with transcript entries', () => {
    const session = startSession();

    expect(session.status).toBe('live');
    expect(session.provider).toBe('local');
    expect(session.transcript).toHaveLength(2);
    expect(session.id).toMatch(/^SES-[0-9a-f-]{36}$/);

    const stored = getSession(session.id);
    expect(stored?.transcript).toHaveLength(2);
  });

  test('ends an active local session and preserves transcript', () => {
    const session = startSession();
    const ended = endSession(session.id);

    expect(ended?.status).toBe('ended');
    expect(ended?.provider).toBe('local');
    expect(ended?.transcript).toHaveLength(2);
  });

  test('starting a user session only closes that user’s active session', () => {
    const alpha = createUser('alpha@example.com');
    const beta = createUser('beta@example.com');

    const alphaSession = startSession(alpha.id);
    const betaSession = startSession(beta.id);
    const nextAlphaSession = startSession(alpha.id);

    expect(getSession(alphaSession.id)?.status).toBe('ended');
    expect(getSession(betaSession.id)?.status).toBe('live');
    expect(getSession(nextAlphaSession.id)?.status).toBe('live');
  });

  test('generates unique UUID-based session identifiers', () => {
    const sessionIds = new Set([
      startSession().id,
      startSession().id,
      startSession().id,
    ]);

    expect(sessionIds.size).toBe(3);
    for (const sessionId of sessionIds) {
      expect(sessionId).toMatch(/^SES-[0-9a-f-]{36}$/);
    }
  });

  test('dashboard payload only returns the current user session and records', () => {
    const alpha = createUser('alpha@example.com');
    const beta = createUser('beta@example.com');

    db.prepare(`
      INSERT INTO tasks (id, user_id, title, status, time, tool_name, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('TSK-A', alpha.id, 'Alpha task', 'completed', 'Today', 'ClickUp', 'High');
    db.prepare(`
      INSERT INTO tasks (id, user_id, title, status, time, tool_name, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('TSK-B', beta.id, 'Beta task', 'completed', 'Today', 'Slack', 'High');
    db.prepare(`
      INSERT INTO activities (id, user_id, title, description, time, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('ACT-A', alpha.id, 'Alpha activity', 'Scoped to alpha', 'Today', 'action');
    db.prepare(`
      INSERT INTO activities (id, user_id, title, description, time, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('ACT-B', beta.id, 'Beta activity', 'Scoped to beta', 'Today', 'action');

    startSession(beta.id);
    const alphaSession = startSession(alpha.id);

    const alphaDashboard = getDashboardPayload(alpha.workspaceId, alpha.id);
    const betaDashboard = getDashboardPayload(beta.workspaceId, beta.id);

    expect(alphaDashboard.tasks.map((task) => task.id)).toContain('TSK-A');
    expect(alphaDashboard.tasks.map((task) => task.id)).not.toContain('TSK-B');
    expect(alphaDashboard.activities.map((activity) => activity.id)).toContain('ACT-A');
    expect(alphaDashboard.activities.map((activity) => activity.id)).not.toContain('ACT-B');
    expect(alphaDashboard.currentSession?.id).toBe(alphaSession.id);
    expect(betaDashboard.currentSession?.id).not.toBe(alphaSession.id);
  });

  test('session history only includes the requested user sessions', () => {
    const alpha = createUser('alpha@example.com');
    const beta = createUser('beta@example.com');

    const alphaSession = startSession(alpha.id);
    const betaSession = startSession(beta.id);

    const alphaHistory = listSessionHistory(alpha.id);
    const betaHistory = listSessionHistory(beta.id);

    expect(alphaHistory.map((session) => session.id)).toContain(alphaSession.id);
    expect(alphaHistory.map((session) => session.id)).not.toContain(betaSession.id);
    expect(betaHistory.map((session) => session.id)).toContain(betaSession.id);
    expect(betaHistory.map((session) => session.id)).not.toContain(alphaSession.id);
  });

  test('memory reads and retrieval stay scoped to the owning user', async () => {
    const alpha = createUser('alpha@example.com');
    const beta = createUser('beta@example.com');

    ingestKnowledgeMemory({
      userId: alpha.id,
      workspaceId: alpha.workspaceId,
      title: 'Alpha launch notes',
      summary: 'Launch notes for alpha workspace',
      contentText: 'Launch notes for alpha workspace',
    });
    ingestKnowledgeMemory({
      userId: beta.id,
      workspaceId: beta.workspaceId,
      title: 'Beta launch notes',
      summary: 'Launch notes for beta workspace',
      contentText: 'Launch notes for beta workspace',
    });

    const alphaNodes = searchMemoryRecords(alpha.id);
    const betaNodes = searchMemoryRecords(beta.id);
    const alphaMatches = await retrieveRelevantMemories(alpha.id, 'launch notes', 10);
    const betaMatches = await retrieveRelevantMemories(beta.id, 'launch notes', 10);

    expect(alphaNodes.map((node) => node.title)).toContain('Alpha launch notes');
    expect(alphaNodes.map((node) => node.title)).not.toContain('Beta launch notes');
    expect(betaNodes.map((node) => node.title)).toContain('Beta launch notes');
    expect(betaNodes.map((node) => node.title)).not.toContain('Alpha launch notes');
    expect(alphaMatches).toContain('Alpha launch notes');
    expect(alphaMatches).not.toContain('Beta launch notes');
    expect(betaMatches).toContain('Beta launch notes');
    expect(betaMatches).not.toContain('Alpha launch notes');
  });

  test('agent task reads stay scoped to the owning user', () => {
    const alpha = createUser('alpha@example.com');
    const beta = createUser('beta@example.com');

    const alphaTask = createTask('crewmate-research-agent', 'Alpha task', { userId: alpha.id, workspaceId: alpha.workspaceId });
    const betaTask = createTask('crewmate-research-agent', 'Beta task', { userId: beta.id, workspaceId: beta.workspaceId });

    expect(listAgentTasks(alpha.id).map((task) => task.id)).toContain(alphaTask.id);
    expect(listAgentTasks(alpha.id).map((task) => task.id)).not.toContain(betaTask.id);
    expect(getTask(alphaTask.id, alpha.id)?.id).toBe(alphaTask.id);
    expect(getTask(betaTask.id, alpha.id)).toBeNull();
  });
});
