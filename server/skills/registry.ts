import { db } from '../db';
import type { Skill, SkillRunContext, SkillRunRecord } from './types';
import { ingestSkillResult } from '../services/memoryIngestor';

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

export function getSkillForUser(id: string, _userId: string): Skill | undefined {
    return skills.get(id);
}

export function listSkillsForUser(_userId: string): Skill[] {
    return Array.from(skills.values());
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

    if ((result as { success?: boolean }).success !== false) {
        ingestSkillResult({
            userId: ctx.userId,
            workspaceId: ctx.workspaceId,
            skillId,
            skillName: skill.name,
            output: (result as { output?: unknown; message?: string }).output ?? (result as { message?: string }).message ?? result,
            taskId: ctx.taskId,
            taskRunId: ctx.taskRunId,
            sessionId: ctx.sessionId,
            originType: ctx.originType,
            originRef: ctx.originRef,
        });
    }

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
