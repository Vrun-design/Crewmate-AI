/**
 * Audit Logger — Phase 10
 *
 * Structured audit trail for all skill executions, agent task calls,
 * and sensitive operations. Writes to SQLite + stdout (JSON) for GCP
 * Cloud Logging ingestion.
 */
import { db } from '../db';
import { randomUUID } from 'node:crypto';

export type AuditEventType =
    | 'skill.run'
    | 'agent.task.start'
    | 'agent.task.complete'
    | 'agent.task.fail'
    | 'auth.login'
    | 'auth.logout'
    | 'memory.ingest'
    | 'integration.connect'
    | 'integration.disconnect'
    | 'orchestrator.route';

export interface AuditEntry {
    id: string;
    timestamp: string;
    type: AuditEventType;
    userId?: string;
    workspaceId?: string;
    resource: string;       // e.g. skill ID, agent ID
    action: string;         // human description
    metadata?: unknown;     // structured extra data
    durationMs?: number;
    status: 'success' | 'failure' | 'pending';
    errorMessage?: string;
}

// ── Schema migration (idempotent) ─────────────────────────────────────────────
try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      user_id TEXT,
      workspace_id TEXT,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata TEXT,
      duration_ms INTEGER,
      status TEXT NOT NULL,
      error_message TEXT
    )
  `);
} catch {
    // table may already exist
}

// ── Core logger ───────────────────────────────────────────────────────────────

export function auditLog(entry: Omit<AuditEntry, 'id' | 'timestamp'>): string {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const row = {
        id,
        timestamp,
        type: entry.type,
        userId: entry.userId ?? null,
        workspaceId: entry.workspaceId ?? null,
        resource: entry.resource,
        action: entry.action,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        durationMs: entry.durationMs ?? null,
        status: entry.status,
        errorMessage: entry.errorMessage ?? null,
    };

    try {
        db.prepare(`
      INSERT INTO audit_log (id, timestamp, type, user_id, workspace_id, resource, action, metadata, duration_ms, status, error_message)
      VALUES (@id, @timestamp, @type, @userId, @workspaceId, @resource, @action, @metadata, @durationMs, @status, @errorMessage)
    `).run(row);
    } catch {
        // Non-fatal: don't crash on audit write failure
    }

    // Structured log to stdout → GCP Cloud Logging picks this up automatically
    console.log(JSON.stringify({
        severity: entry.status === 'failure' ? 'WARNING' : 'INFO',
        message: `[audit] ${entry.type} ${entry.resource} → ${entry.status}`,
        ...row,
        metadata: entry.metadata,
    }));

    return id;
}

export function listAuditLog(limit = 100, userId?: string): AuditEntry[] {
    const where = userId ? 'WHERE user_id = ?' : '';
    const params = userId ? [limit, userId] : [limit];

    const rows = db.prepare(`
    SELECT id, timestamp, type, user_id as userId, workspace_id as workspaceId,
           resource, action, metadata, duration_ms as durationMs, status, error_message as errorMessage
    FROM audit_log
    ${where}
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(userId ? [userId, limit] : [limit]) as AuditEntry[];

    return rows.map((r) => ({
        ...r,
        metadata: r.metadata ? JSON.parse(r.metadata as unknown as string) : undefined,
    }));
}
