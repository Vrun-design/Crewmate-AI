import type {
    ModelPreference,
    Skill,
    SkillExecutionMode,
    SkillLatencyClass,
    SkillResult,
    SkillSideEffectLevel,
} from './types';

const HIGH_IMPACT_SKILL_PATTERNS = [
    '.post-',
    '.send-',
    '.create-',
    '.append-',
    '.update-',
    '.attach-',
    '.cancel',
    '.fill-',
    '.click-',
    '.type-into',
    '.press-key',
    '.ui-navigate',
    'terminal.run-command',
];

const READ_ONLY_SKILL_PATTERNS = [
    '.list',
    '.search',
    '.retrieve',
    '.extract',
    '.screenshot',
    '.inspect',
    'browser.open-url',
    'browser.scroll-page',
];

function isHighImpactSkill(skillId: string): boolean {
    return HIGH_IMPACT_SKILL_PATTERNS.some((pattern) => skillId.includes(pattern));
}

function isReadOnlySkill(skillId: string): boolean {
    return READ_ONLY_SKILL_PATTERNS.some((pattern) => skillId.includes(pattern));
}

function inferPreferredModel(skill: Skill): ModelPreference {
    if (skill.preferredModel) {
        return skill.preferredModel;
    }

    if (skill.category === 'research') {
        return 'research';
    }

    if (skill.id === 'browser.inspect-visible-ui' || skill.id === 'browser.ui-navigate') {
        return 'orchestration';
    }

    return 'quick';
}

function inferExecutionMode(skill: Skill): SkillExecutionMode {
    if (skill.executionMode) {
        return skill.executionMode;
    }

    if (skill.id.startsWith('browser.') || skill.category === 'research' || skill.category === 'automation') {
        return 'delegated';
    }

    if (skill.id.startsWith('memory.') || skill.id.startsWith('tasks.')) {
        return 'inline';
    }

    return 'either';
}

function inferLatencyClass(skill: Skill): SkillLatencyClass {
    if (skill.latencyClass) {
        return skill.latencyClass;
    }

    if (
        skill.id.startsWith('browser.')
        || skill.category === 'research'
        || skill.category === 'automation'
        || skill.id === 'terminal.run-command'
    ) {
        return 'slow';
    }

    return 'quick';
}

function inferSideEffectLevel(skill: Skill): SkillSideEffectLevel {
    if (skill.sideEffectLevel) {
        return skill.sideEffectLevel;
    }

    if (isHighImpactSkill(skill.id)) {
        return 'high';
    }

    if (isReadOnlySkill(skill.id) || skill.category === 'research') {
        return 'none';
    }

    return 'low';
}

function inferUsageExamples(skill: Skill): string[] {
    return skill.usageExamples?.filter(Boolean) ?? skill.triggerPhrases.slice(0, 3);
}

function inferInvokingMessage(skill: Skill): string {
    if (skill.invokingMessage) {
        return skill.invokingMessage;
    }

    return inferSideEffectLevel(skill) === 'high'
        ? `Preparing ${skill.name} carefully.`
        : `Starting ${skill.name}.`;
}

function inferInvokedMessage(skill: Skill): string {
    if (skill.invokedMessage) {
        return skill.invokedMessage;
    }

    return `${skill.name} completed.`;
}

function inferReadOnlyHint(skill: Skill): boolean {
    return skill.readOnlyHint ?? inferSideEffectLevel(skill) === 'none';
}

function inferDestructiveHint(skill: Skill): boolean {
    return skill.destructiveHint ?? inferSideEffectLevel(skill) === 'high';
}

function inferOpenWorldHint(skill: Skill): boolean {
    if (typeof skill.openWorldHint === 'boolean') {
        return skill.openWorldHint;
    }

    return skill.category === 'browser'
        || skill.category === 'research'
        || skill.category === 'automation'
        || skill.category === 'code'
        || skill.requiresIntegration.length > 0;
}

export function hydrateSkillManifest(skill: Skill): Skill {
    return {
        ...skill,
        preferredModel: inferPreferredModel(skill),
        executionMode: inferExecutionMode(skill),
        latencyClass: inferLatencyClass(skill),
        sideEffectLevel: inferSideEffectLevel(skill),
        exposeInLiveSession: skill.exposeInLiveSession ?? false,
        usageExamples: inferUsageExamples(skill),
        invokingMessage: inferInvokingMessage(skill),
        invokedMessage: inferInvokedMessage(skill),
        readOnlyHint: inferReadOnlyHint(skill),
        destructiveHint: inferDestructiveHint(skill),
        openWorldHint: inferOpenWorldHint(skill),
    };
}

export function buildSkillDeclarationDescription(skill: Skill): string {
    const integrations = skill.requiresIntegration.length > 0
        ? ` Requires integration: ${skill.requiresIntegration.join(', ')}.`
        : '';
    const examples = skill.usageExamples && skill.usageExamples.length > 0
        ? ` Example requests: ${skill.usageExamples.map((example) => `"${example}"`).join('; ')}.`
        : '';
    const safetyHints = [
        skill.readOnlyHint ? 'Read-only.' : null,
        skill.destructiveHint ? 'Can change external state.' : null,
        skill.openWorldHint ? 'May use external systems or the open web.' : null,
    ].filter(Boolean).join(' ');

    return `${skill.description}${integrations}${examples}${safetyHints ? ` ${safetyHints}` : ''}`.trim();
}

export function formatSkillForRouting(skill: Skill): string {
    const integrations = skill.requiresIntegration.length > 0
        ? `requires=${skill.requiresIntegration.join(',')}`
        : 'requires=none';
    const examples = skill.usageExamples && skill.usageExamples.length > 0
        ? `examples=${skill.usageExamples.join(' | ')}`
        : 'examples=none';
    const safety = [
        `mode=${skill.executionMode}`,
        `latency=${skill.latencyClass}`,
        `sideEffect=${skill.sideEffectLevel}`,
        `live=${skill.exposeInLiveSession ? 'yes' : 'no'}`,
    ].join(', ');

    return `${skill.id}: ${skill.description}\n  ${integrations} | ${safety}\n  ${examples}`;
}

export function serializeSkillSummary(skill: Skill): Record<string, unknown> {
    return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        category: skill.category,
        requiresIntegration: skill.requiresIntegration,
        triggerPhrases: skill.triggerPhrases,
        preferredModel: skill.preferredModel,
        executionMode: skill.executionMode,
        latencyClass: skill.latencyClass,
        sideEffectLevel: skill.sideEffectLevel,
        exposeInLiveSession: skill.exposeInLiveSession,
        usageExamples: skill.usageExamples,
        invokingMessage: skill.invokingMessage,
        invokedMessage: skill.invokedMessage,
        readOnlyHint: skill.readOnlyHint,
        destructiveHint: skill.destructiveHint,
        openWorldHint: skill.openWorldHint,
    };
}

export function parseObjectArgument(value: unknown, label: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    throw new Error(`${label} must be an object.`);
}

export function parseStringMapArgument(value: unknown, label: string): Record<string, string> {
    const record = parseObjectArgument(value, label);
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, String(item ?? '')]));
}

export function parseStringMatrixArgument(value: unknown, label: string): string[][] {
    if (!Array.isArray(value)) {
        throw new Error(`${label} must be a 2D array.`);
    }

    return value.map((row) => Array.isArray(row)
        ? row.map((cell) => String(cell ?? ''))
        : [String(row ?? '')]);
}

export function requireExplicitApproval(args: Record<string, unknown>, action: string): void {
    if (args.approved !== true) {
        throw new Error(`${action} requires explicit approval. Re-run this skill with approved=true after confirming the details.`);
    }
}

export function createSuccessResult(output: unknown, message: string): SkillResult {
    return {
        success: true,
        output,
        message,
    };
}

export function createFailureResult(message: string, error?: string): SkillResult {
    return {
        success: false,
        message,
        error,
    };
}
