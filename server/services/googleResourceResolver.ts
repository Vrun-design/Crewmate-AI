import { db } from '../db';
import { findDriveFileByName } from './driveService';

interface ResolveGoogleResourceIdInput {
  workspaceId: string;
  userId?: string;
  explicitId?: unknown;
  screenContext?: unknown;
  title?: unknown;
  urlPattern: RegExp;
  mimeType: string;
  label: string;
  recentCreateSkillId?: string;
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractIdFromValue(value: string, pattern: RegExp): string {
  const match = value.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function looksLikePlaceholderId(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('placeholder')
    || normalized.includes('example')
    || normalized.includes('sample')
    || normalized === 'string'
    || normalized === 'id';
}

function normalizeExplicitId(value: unknown, pattern: RegExp): string {
  const rawValue = getString(value);
  if (!rawValue || looksLikePlaceholderId(rawValue)) {
    return '';
  }

  return extractIdFromValue(rawValue, pattern) || rawValue;
}

function getScreenContextId(screenContext: unknown, pattern: RegExp): string {
  return extractIdFromValue(getString(screenContext), pattern);
}

function getRecentCreatedResourceId(userId: string, skillId: string): string {
  const rows = db.prepare(`
    SELECT result_json as resultJson, run_at as runAt
    FROM skill_runs
    WHERE user_id = ? AND skill_id = ?
    ORDER BY run_at DESC
    LIMIT 5
  `).all(userId, skillId) as Array<{ resultJson: string; runAt: string }>;

  const cutoffMs = 5 * 60 * 1000;
  const now = Date.now();

  for (const row of rows) {
    if (now - Date.parse(row.runAt) > cutoffMs) {
      continue;
    }

    try {
      const parsed = JSON.parse(row.resultJson) as { output?: { id?: unknown } };
      const id = getString(parsed.output?.id);
      if (id && !looksLikePlaceholderId(id)) {
        return id;
      }
    } catch {
      continue;
    }
  }

  return '';
}

export async function resolveGoogleResourceId(input: ResolveGoogleResourceIdInput): Promise<string> {
  const explicitId = normalizeExplicitId(input.explicitId, input.urlPattern);
  if (explicitId) {
    return explicitId;
  }

  const screenContextId = getScreenContextId(input.screenContext, input.urlPattern);
  if (screenContextId) {
    return screenContextId;
  }

  const title = getString(input.title);
  if (title) {
    const match = await findDriveFileByName(input.workspaceId, title, {
      mimeType: input.mimeType,
    });
    if (match?.id) {
      return match.id;
    }
  }

  if (input.userId && input.recentCreateSkillId) {
    const recentId = getRecentCreatedResourceId(input.userId, input.recentCreateSkillId);
    if (recentId) {
      return recentId;
    }
  }

  const titleHint = title
    ? ` or provide the exact ${input.label} title so Crewmate can look it up`
    : '';
  throw new Error(`${input.label} is required. Provide the Google ${input.label} ID from the URL, share your screen while looking at it${titleHint}.`);
}
