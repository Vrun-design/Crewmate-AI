/**
 * Skill Registry — replaces the old mcpServer.ts Map<string, McpTool>.
 * This is the central store for all skills in Crewmate.
 * Skills registered here are:
 *   1. Exposed as Gemini Live function declarations
 *   2. Listed via GET /api/skills
 *   3. Directly callable via POST /api/skills/:id/run
 *   4. (future) Exposed via real MCP protocol server
 */
import { db } from '../db';
import type { Skill, SkillRunContext, SkillRunRecord } from './types';
import { executeWebhookSkill, executeLLMRecipeSkill } from '../services/customSkillRunner';
import { decryptJson, encryptJson } from '../services/secretVault';

// ── Custom skill DB record ────────────────────────────────────────────────────

export interface CustomSkillRecord {
    id: string;
    userId: string;
    name: string;
    description: string;
    triggerPhrases: string[];
    mode: 'webhook' | 'recipe';
    webhookUrl?: string;
    authHeader?: string;
    recipe?: string;
    inputSchema: string; // JSON string
    createdAt: string;
    updatedAt: string;
}

const skills = new Map<string, Skill>();

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS skill_runs (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    args_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    run_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS custom_skills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    trigger_phrases TEXT NOT NULL DEFAULT '[]',
    mode TEXT NOT NULL DEFAULT 'webhook',
    webhook_url TEXT,
    auth_header TEXT,
    recipe TEXT,
    input_schema TEXT NOT NULL DEFAULT '{"type":"object","properties":{"input":{"type":"string","description":"Input text"}}}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

try {
    db.exec(`ALTER TABLE custom_skills ADD COLUMN auth_header_encrypted TEXT`);
} catch { }

// ── Custom skill CRUD ─────────────────────────────────────────────────────────

export function createCustomSkill(rec: Omit<CustomSkillRecord, 'createdAt' | 'updatedAt'>): CustomSkillRecord {
    const now = new Date().toISOString();
    const encryptedAuthHeader = rec.authHeader ? encryptJson({ authHeader: rec.authHeader }) : null;
    db.prepare(`
        INSERT INTO custom_skills (id, user_id, name, description, trigger_phrases, mode, webhook_url, auth_header, auth_header_encrypted, recipe, input_schema, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        rec.id, rec.userId, rec.name, rec.description,
        JSON.stringify(rec.triggerPhrases),
        rec.mode, rec.webhookUrl ?? null, null, encryptedAuthHeader, rec.recipe ?? null,
        rec.inputSchema, now, now,
    );
    return { ...rec, createdAt: now, updatedAt: now };
}

export function listCustomSkills(userId: string): CustomSkillRecord[] {
    const rows = db.prepare('SELECT * FROM custom_skills WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Record<string, unknown>[];
    return rows.map(rowToCustomSkill);
}

export function deleteCustomSkill(id: string, userId: string): boolean {
    const result = db.prepare('DELETE FROM custom_skills WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
}

function rowToCustomSkill(row: Record<string, unknown>): CustomSkillRecord {
    let authHeader: string | undefined;
    const encryptedAuthHeader = row.auth_header_encrypted ? String(row.auth_header_encrypted) : '';
    if (encryptedAuthHeader) {
        try {
            authHeader = decryptJson(encryptedAuthHeader).authHeader;
        } catch {
            authHeader = undefined;
        }
    } else if (row.auth_header) {
        authHeader = String(row.auth_header);
    }

    return {
        id: String(row.id),
        userId: String(row.user_id),
        name: String(row.name),
        description: String(row.description),
        triggerPhrases: JSON.parse(String(row.trigger_phrases ?? '[]')) as string[],
        mode: String(row.mode) as 'webhook' | 'recipe',
        webhookUrl: row.webhook_url ? String(row.webhook_url) : undefined,
        authHeader,
        recipe: row.recipe ? String(row.recipe) : undefined,
        inputSchema: String(row.input_schema ?? '{}'),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

function customSkillRecordToSkill(rec: CustomSkillRecord): Skill {
    return {
        id: `custom.${rec.id}`,
        name: rec.name,
        description: rec.description,
        version: '1.0.0',
        category: 'productivity',
        personas: [],
        requiresIntegration: [],
        triggerPhrases: rec.triggerPhrases,
        inputSchema: {
            type: 'object',
            properties: JSON.parse(rec.inputSchema) as Record<string, { type: 'string' | 'number' | 'boolean' | 'array'; description: string }>,
        },
        handler: async (ctx: SkillRunContext, args: Record<string, unknown>) => {
            if (rec.mode === 'webhook' && rec.webhookUrl) {
                const r = await executeWebhookSkill(rec.webhookUrl, args, rec.authHeader);
                return { success: r.success, output: r.output, message: r.message };
            }
            if (rec.mode === 'recipe' && rec.recipe) {
                const r = await executeLLMRecipeSkill(rec.recipe, args, ctx);
                return { success: r.success, output: r.output, message: r.message };
            }
            return { success: false, message: 'Custom skill misconfigured' };
        },
    };
}

export function getCustomSkill(id: string, userId: string): CustomSkillRecord | null {
    const row = db.prepare('SELECT * FROM custom_skills WHERE id = ? AND user_id = ? LIMIT 1').get(id, userId) as Record<string, unknown> | undefined;
    if (!row) {
        return null;
    }
    return rowToCustomSkill(row);
}

export function getSkillForUser(id: string, userId: string): Skill | undefined {
    const builtInSkill = skills.get(id);
    if (builtInSkill) {
        return builtInSkill;
    }

    if (!id.startsWith('custom.')) {
        return undefined;
    }

    const customSkill = getCustomSkill(id.replace(/^custom\./, ''), userId);
    return customSkill ? customSkillRecordToSkill(customSkill) : undefined;
}

export function listSkillsForUser(userId: string): Skill[] {
    const customRows = listCustomSkills(userId);
    return [
        ...Array.from(skills.values()),
        ...customRows.map(customSkillRecordToSkill),
    ];
}

export function registerSkill(skill: Skill): void {
    skills.set(skill.id, skill);
}

export function getSkill(id: string): Skill | undefined {
    return skills.get(id);
}

export function listSkills(): Skill[] {
    return Array.from(skills.values());
}

export function listSkillsForPersona(personaId: string): Skill[] {
    return listSkills().filter(
        (s) => s.personas.length === 0 || s.personas.includes(personaId) || s.personas.includes('all')
    );
}

export function listSkillsForUserPersona(userId: string, personaId?: string): Skill[] {
    const availableSkills = listSkillsForUser(userId);
    if (!personaId) {
        return availableSkills;
    }

    return availableSkills.filter(
        (skill) => skill.personas.length === 0 || skill.personas.includes(personaId) || skill.personas.includes('all')
    );
}

/** Returns Gemini-compatible FunctionDeclaration objects for all skills */
export function getSkillDeclarations(options?: { liveOnly?: boolean }): Array<{
    name: string;
    description: string;
    parametersJsonSchema: Record<string, unknown>;
    behavior?: import('@google/genai').Behavior;
}> {
    return listSkills()
        .filter((skill) => !options?.liveOnly || skill.exposeInLiveSession)
        .map((skill) => ({
        name: skill.id.replace(/\./g, '_'), // Gemini requires no dots in function names
        description: skill.description,
        parametersJsonSchema: skill.inputSchema as unknown as Record<string, unknown>,
        behavior: skill.liveFunctionBehavior,
    }));
}

export async function runSkill(
    skillId: string,
    ctx: SkillRunContext,
    args: Record<string, unknown>
): Promise<SkillRunRecord> {
    const skill = getSkillForUser(skillId, ctx.userId);
    if (!skill) {
        throw new Error(`Skill not found: ${skillId}`);
    }

    const startTime = Date.now();
    let result;
    try {
        result = await skill.handler(ctx, args);
    } catch (err) {
        result = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
    const durationMs = Date.now() - startTime;

    const runRecord: SkillRunRecord = {
        skillId,
        runAt: new Date().toISOString(),
        args,
        result,
        durationMs,
    };

    // Persist run to DB
    const id = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(`
    INSERT INTO skill_runs (id, skill_id, user_id, args_json, result_json, duration_ms, run_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
        id,
        skillId,
        ctx.userId,
        JSON.stringify(args),
        JSON.stringify(result),
        durationMs,
        runRecord.runAt
    );

    // Structured audit log (Phase 10) — async, non-blocking
    void import('../services/auditLogger').then(({ auditLog }) => {
        auditLog({
            type: 'skill.run',
            userId: ctx.userId,
            workspaceId: ctx.workspaceId,
            resource: skillId,
            action: `Executed skill ${skillId}`,
            durationMs,
            status: (result as { success?: boolean }).success === false ? 'failure' : 'success',
            errorMessage: (result as { error?: string }).error,
            metadata: { skillName: skill.name, category: skill.category },
        });
    });

    return runRecord;
}

export function getSkillRunHistory(skillId: string, userId: string, limit = 10): SkillRunRecord[] {
    const rows = db.prepare(`
    SELECT * FROM skill_runs WHERE skill_id = ? AND user_id = ?
    ORDER BY run_at DESC LIMIT ?
  `).all(skillId, userId, limit) as Array<{
        skill_id: string;
        run_at: string;
        args_json: string;
        result_json: string;
        duration_ms: number;
    }>;

    return rows.map((row) => ({
        skillId: row.skill_id,
        runAt: row.run_at,
        args: JSON.parse(row.args_json) as Record<string, unknown>,
        result: JSON.parse(row.result_json) as { success: boolean; output?: unknown; error?: string },
        durationMs: row.duration_ms,
    }));
}
