// Skill manifest standard — the typed foundation for all skills in Crewmate

export type SkillCategory =
    | 'code'
    | 'communication'
    | 'research'
    | 'creative'
    | 'productivity'
    | 'data'
    | 'browser';

export type ModelPreference = 'quick' | 'research' | 'orchestration' | 'creative';

export interface JSONSchema {
    type: 'object';
    properties: Record<string, {
        type: 'string' | 'number' | 'boolean' | 'array';
        description: string;
        items?: { type: string };
        enum?: string[];
    }>;
    required?: string[];
}

export interface SkillResult {
    success: boolean;
    output?: unknown;
    message?: string;
    error?: string;
}

export interface SkillRunContext {
    userId: string;
    workspaceId: string;
    sessionId?: string;
    personaId?: string;
}

export interface Skill {
    /** Unique dot-namespaced ID: e.g. "github.create-issue" */
    id: string;
    /** Human-readable name */
    name: string;
    /** Used in Gemini system prompt to describe capability */
    description: string;
    /** Semver */
    version: string;
    /** Category for filtering */
    category: SkillCategory;
    /** Which persona IDs enable this skill by default */
    personas: string[];
    /** Integration IDs required: ["github"] */
    requiresIntegration: string[];
    /** Short example trigger phrases shown in UI */
    triggerPhrases: string[];
    /** JSON schema for arguments */
    inputSchema: JSONSchema;
    /** Which Gemini model tier to use */
    preferredModel?: ModelPreference;
    /** The actual implementation */
    handler: (ctx: SkillRunContext, args: Record<string, unknown>) => Promise<SkillResult>;
}

export interface SkillRunRecord {
    skillId: string;
    runAt: string;
    args: Record<string, unknown>;
    result: SkillResult;
    durationMs: number;
}
