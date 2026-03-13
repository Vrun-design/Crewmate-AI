import { describe, expect, test } from 'vitest';
import { getDashboardPayload } from '../repositories/dashboardRepository';
import { listSessionHistory } from '../repositories/workspaceRepository';
import { clearAuthSession, getAuthUser, requestLoginCode, verifyLoginCode } from '../services/authService';
import { ingestKnowledgeMemory, searchMemoryRecords } from '../services/memoryService';
import { getUserPreferences, saveUserPreferences } from '../services/preferencesService';
import { endSession, startSession } from '../services/sessionService';

describe('production readiness smoke', () => {
  test('covers auth, preferences, sessions, memory, and dashboard', async () => {
    const email = `smoke-${Date.now()}@example.com`;
    const requestCode = requestLoginCode(email);
    const login = verifyLoginCode(email, requestCode.devCode);
    const { token, user } = login;

    expect(token.startsWith('auth_')).toBe(true);
    expect(getAuthUser(token)?.id).toBe(user.id);

    const initialPreferences = getUserPreferences(user.id);
    const updatedPreferences = saveUserPreferences(user.id, {
      ...initialPreferences,
      proactiveSuggestions: !initialPreferences.proactiveSuggestions,
    });
    expect(updatedPreferences.proactiveSuggestions).toBe(!initialPreferences.proactiveSuggestions);

    const session = startSession(user.id);
    expect(session.id.startsWith('SES-')).toBe(true);
    expect(session.status).toBe('live');

    const sessionHistory = listSessionHistory(user.id);
    expect(sessionHistory.some((entry) => entry.id === session.id)).toBe(true);

    const memoryId = ingestKnowledgeMemory({
      userId: user.id,
      workspaceId: user.workspaceId,
      title: `Smoke Memory ${Date.now()}`,
      summary: 'Smoke test memory content for release gating',
      contentText: 'Smoke test memory content for release gating',
    });
    expect(memoryId.startsWith('MEM-')).toBe(true);

    const memories = searchMemoryRecords(user.id);
    expect(memories.some((node) => node.id === memoryId)).toBe(true);

    const dashboard = getDashboardPayload(user.workspaceId, user.id);
    expect(dashboard.currentSession?.id).toBe(session.id);

    const endedSession = endSession(session.id);
    expect(endedSession?.status).toBe('ended');

    clearAuthSession(token);
    expect(getAuthUser(token)).toBeNull();
  });
});
