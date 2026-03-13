import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { serverConfig } from '../config';
import { ingestArtifactMemory } from './memoryService';
import { updateWorkspaceTask } from '../repositories/workspaceRepository';
import { getRuntimeSession } from './liveGatewayRuntimeStore';

export interface ScreenshotArtifactRecord {
  id: string;
  userId: string;
  workspaceId?: string | null;
  sessionId?: string | null;
  taskId?: string | null;
  taskRunId?: string | null;
  title?: string | null;
  caption?: string | null;
  mimeType: string;
  publicUrl: string;
  shareExpiresAt?: string | null;
  isShareRevoked?: boolean;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ScreenshotArtifactRow {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  session_id?: string | null;
  task_id?: string | null;
  task_run_id?: string | null;
  title?: string | null;
  caption?: string | null;
  mime_type: string;
  access_token: string;
  access_expires_at?: string | null;
  revoked_at?: string | null;
  public_url: string;
  width?: number | null;
  height?: number | null;
  created_at: string;
  updated_at: string;
}

function ensureStorageRoot(): void {
  fs.mkdirSync(serverConfig.artifactStoragePath, { recursive: true });
}

function sanitizeExtension(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return 'jpg';
  }
}

function mapRow(row: ScreenshotArtifactRow): ScreenshotArtifactRecord {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id ?? null,
    sessionId: row.session_id ?? null,
    taskId: row.task_id ?? null,
    taskRunId: row.task_run_id ?? null,
    title: row.title ?? null,
    caption: row.caption ?? null,
    mimeType: row.mime_type,
    publicUrl: row.public_url,
    shareExpiresAt: row.access_expires_at ?? null,
    isShareRevoked: Boolean(row.revoked_at),
    width: row.width ?? null,
    height: row.height ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildPublicUrl(artifactId: string, accessToken: string): string {
  const base = serverConfig.publicAppUrl.replace(/\/$/, '');
  return `${base}/api/artifacts/screenshots/${artifactId}/public?token=${encodeURIComponent(accessToken)}`;
}

function buildAuthenticatedUrl(artifactId: string): string {
  const base = serverConfig.publicAppUrl.replace(/\/$/, '');
  return `${base}/api/artifacts/screenshots/${artifactId}`;
}

function buildDefaultTitle(caption?: string): string {
  if (caption?.trim()) {
    return caption.trim().slice(0, 120);
  }

  return 'Live session screenshot';
}

function countArtifactsForTask(taskId: string): number {
  const row = db.prepare(`
    SELECT COUNT(*) as count
    FROM screenshot_artifacts
    WHERE task_id = ?
  `).get(taskId) as { count: number };

  return row.count;
}

export function saveScreenshotArtifact(input: {
  userId: string;
  workspaceId?: string;
  sessionId?: string;
  taskId?: string;
  taskRunId?: string;
  mimeType: string;
  data: string;
  title?: string;
  caption?: string;
  width?: number;
  height?: number;
}): ScreenshotArtifactRecord {
  ensureStorageRoot();

  const id = `SCR-${randomUUID().slice(0, 8).toUpperCase()}`;
  const extension = sanitizeExtension(input.mimeType);
  const fileName = `${id}.${extension}`;
  const absolutePath = path.join(serverConfig.artifactStoragePath, fileName);
  const now = new Date().toISOString();
  const accessToken = randomUUID();
  const accessExpiresAt = new Date(Date.now() + serverConfig.screenshotShareTtlMs).toISOString();

  fs.writeFileSync(absolutePath, Buffer.from(input.data, 'base64'));

  const publicUrl = buildPublicUrl(id, accessToken);
  const title = (input.title?.trim() || buildDefaultTitle(input.caption)).slice(0, 160);

  db.prepare(`
    INSERT INTO screenshot_artifacts (
      id, user_id, workspace_id, session_id, task_id, task_run_id, title, caption,
      mime_type, access_token, access_expires_at, revoked_at, storage_kind, storage_path, public_url, width, height, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.userId,
    input.workspaceId ?? null,
    input.sessionId ?? null,
    input.taskId ?? null,
    input.taskRunId ?? null,
    title,
    input.caption ?? null,
    input.mimeType,
    accessToken,
    accessExpiresAt,
    null,
    'local',
    absolutePath,
    publicUrl,
    input.width ?? null,
    input.height ?? null,
    now,
    now,
  );

  ingestArtifactMemory({
    userId: input.userId,
    workspaceId: input.workspaceId,
    title,
    url: buildAuthenticatedUrl(id),
    sourceType: 'integration',
    summary: input.caption ?? 'Screenshot captured from a live session.',
    metadata: {
      provider: 'Screenshot',
      artifactId: id,
      source: 'live_screen_capture',
      sessionId: input.sessionId ?? null,
      taskId: input.taskId ?? null,
      taskRunId: input.taskRunId ?? null,
      mimeType: input.mimeType,
      sharedPublicUrl: publicUrl,
      shareExpiresAt: accessExpiresAt,
      width: input.width ?? null,
      height: input.height ?? null,
    },
  });

  if (input.taskId) {
    updateWorkspaceTask(input.taskId, input.userId, { artifactCount: countArtifactsForTask(input.taskId) });
  }

  return getScreenshotArtifactForUser(id, input.userId)!;
}

export function getScreenshotArtifactForUser(artifactId: string, userId: string): ScreenshotArtifactRecord | null {
  const row = db.prepare(`
    SELECT
      id,
      user_id,
      workspace_id,
      session_id,
      task_id,
      task_run_id,
      title,
      caption,
      mime_type,
      access_token,
      access_expires_at,
      revoked_at,
      public_url,
      width,
      height,
      created_at,
      updated_at
    FROM screenshot_artifacts
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `).get(artifactId, userId) as ScreenshotArtifactRow | undefined;

  return row ? mapRow(row) : null;
}

export function getScreenshotArtifactFilePathForUser(artifactId: string, userId: string): { path: string; mimeType: string } | null {
  const row = db.prepare(`
    SELECT storage_path as path, mime_type as mimeType
    FROM screenshot_artifacts
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `).get(artifactId, userId) as { path: string; mimeType: string } | undefined;

  if (!row?.path || !fs.existsSync(row.path)) {
    return null;
  }

  return row;
}

export function getPublicScreenshotArtifactFilePath(artifactId: string, token: string): { path: string; mimeType: string } | null {
  const row = db.prepare(`
    SELECT storage_path as path, mime_type as mimeType, access_expires_at as accessExpiresAt, revoked_at as revokedAt
    FROM screenshot_artifacts
    WHERE id = ? AND access_token = ?
    LIMIT 1
  `).get(artifactId, token) as { path: string; mimeType: string; accessExpiresAt?: string | null; revokedAt?: string | null } | undefined;

  if (!row?.path || row.revokedAt || !fs.existsSync(row.path)) {
    return null;
  }

  if (row.accessExpiresAt && new Date(row.accessExpiresAt).getTime() < Date.now()) {
    return null;
  }

  return row;
}

export function revokeScreenshotArtifactShare(artifactId: string, userId: string): ScreenshotArtifactRecord | null {
  db.prepare(`
    UPDATE screenshot_artifacts
    SET revoked_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), artifactId, userId);

  return getScreenshotArtifactForUser(artifactId, userId);
}

export function getScreenshotArtifactBytesForUser(artifactId: string, userId: string): { bytes: Buffer; mimeType: string; fileName: string } | null {
  const file = getScreenshotArtifactFilePathForUser(artifactId, userId);
  if (!file) {
    return null;
  }

  return {
    bytes: fs.readFileSync(file.path),
    mimeType: file.mimeType,
    fileName: path.basename(file.path),
  };
}

export function listRecentScreenshotArtifacts(
  userId: string,
  options: { sessionId?: string | null; taskId?: string | null; limit?: number } = {},
): ScreenshotArtifactRecord[] {
  const clauses = ['user_id = ?'];
  const params: unknown[] = [userId];

  if (options.sessionId) {
    clauses.push('session_id = ?');
    params.push(options.sessionId);
  }

  if (options.taskId) {
    clauses.push('task_id = ?');
    params.push(options.taskId);
  }

  params.push(options.limit ?? 10);

  const rows = db.prepare(`
    SELECT
      id,
      user_id,
      workspace_id,
      session_id,
      task_id,
      task_run_id,
      title,
      caption,
      mime_type,
      public_url,
      width,
      height,
      created_at,
      updated_at
    FROM screenshot_artifacts
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
  `).all(...params) as ScreenshotArtifactRow[];

  return rows.map(mapRow);
}

export function resolveRecentScreenshotArtifact(
  userId: string,
  options: { artifactId?: string; sessionId?: string | null; taskId?: string | null },
): ScreenshotArtifactRecord | null {
  if (options.artifactId) {
    return getScreenshotArtifactForUser(options.artifactId, userId);
  }

  const sessionScoped = options.sessionId
    ? listRecentScreenshotArtifacts(userId, { sessionId: options.sessionId, limit: 1 })[0]
    : null;
  if (sessionScoped) {
    return sessionScoped;
  }

  const taskScoped = options.taskId
    ? listRecentScreenshotArtifacts(userId, { taskId: options.taskId, limit: 1 })[0]
    : null;
  if (taskScoped) {
    return taskScoped;
  }

  return listRecentScreenshotArtifacts(userId, { limit: 1 })[0] ?? null;
}

export function captureLatestLiveScreenshot(input: {
  userId: string;
  workspaceId?: string;
  sessionId: string;
  taskId?: string;
  taskRunId?: string;
  title?: string;
  caption?: string;
}): ScreenshotArtifactRecord {
  const runtime = getRuntimeSession(input.sessionId);
  const frame = runtime?.lastFrameData ?? null;

  if (!frame?.data || !frame.mimeType) {
    throw new Error('No live screen frame is available yet. Start screen sharing first.');
  }

  return saveScreenshotArtifact({
    userId: input.userId,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    taskId: input.taskId,
    taskRunId: input.taskRunId,
    mimeType: frame.mimeType,
    data: frame.data,
    title: input.title,
    caption: input.caption,
  });
}
