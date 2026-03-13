import type { Behavior } from '@google/genai';

// Skill manifest standard — the typed foundation for all skills in Crewmate

export type SkillCategory =
    | 'code'
    | 'communication'
    | 'research'
    | 'creative'
    | 'productivity'
    | 'data'
    | 'browser'
    | 'automation';

export type ModelPreference = 'quick' | 'research' | 'orchestration' | 'creative';
export type SkillExecutionMode = 'inline' | 'delegated' | 'either';
export type SkillLatencyClass = 'quick' | 'slow';
export type SkillSideEffectLevel = 'none' | 'low' | 'high';

export type JSONSchemaPropertyType =
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'array'
    | 'object';

export interface JSONSchemaProperty {
    type: JSONSchemaPropertyType;
    description: string;
    properties?: Record<string, JSONSchemaProperty>;
    items?: JSONSchemaProperty;
    enum?: string[];
    required?: string[];
    additionalProperties?: boolean;
}

export interface JSONSchema {
    type: 'object';
    description?: string;
    properties: Record<string, JSONSchemaProperty>;
    required?: string[];
    additionalProperties?: boolean;
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
    taskTitle?: string;
    sessionId?: string;
    taskId?: string;
    taskRunId?: string;
    originType?: 'app' | 'live_session' | 'command' | 'slack' | 'email' | 'system';
    originRef?: string;
}

export interface Skill {
    /** Unique dot-namespaced ID: e.g. "notion.create-page" */
    id: string;
    /** Human-readable name */
    name: string;
    /** Used in Gemini system prompt to describe capability */
    description: string;
    /** Semver */
    version: string;
    /** Category for filtering */
    category: SkillCategory;
    /** Integration IDs required: ["github"] */
    requiresIntegration: string[];
    /** Short example trigger phrases shown in UI */
    triggerPhrases: string[];
    /** JSON schema for arguments */
    inputSchema: JSONSchema;
    /** Which Gemini model tier to use */
    preferredModel?: ModelPreference;
    /** Whether this skill should run inline, be delegated, or support either path */
    executionMode?: SkillExecutionMode;
    /** Expected latency / interaction cost for runtime policy decisions */
    latencyClass?: SkillLatencyClass;
    /** Helps live mode decide whether explicit delegation is safer */
    sideEffectLevel?: SkillSideEffectLevel;
    /** Whether this skill should be exposed directly to Gemini Live function calling */
    exposeInLiveSession?: boolean;
    /** Short high-signal examples that help routing, UI, and tool choice */
    usageExamples?: string[];
    /** Brief status text for when the skill is about to start */
    invokingMessage?: string;
    /** Brief status text for when the skill completes without a custom message */
    invokedMessage?: string;
    /** Hints whether the skill is read-only */
    readOnlyHint?: boolean;
    /** Hints whether the skill can make or commit external changes */
    destructiveHint?: boolean;
    /** Hints whether the skill reaches into external/open-world systems */
    openWorldHint?: boolean;
    /** Optional structured shape for the primary result payload */
    resultSchema?: JSONSchema;
    /** Optional Live API function behavior override */
    liveFunctionBehavior?: Behavior;
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
