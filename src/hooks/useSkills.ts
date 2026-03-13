import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface SkillSummary {
    id: string;
    name: string;
    description: string;
    version: string;
    category: string;
    requiresIntegration: string[];
    triggerPhrases: string[];
    preferredModel?: string;
    executionMode?: string;
    latencyClass?: string;
    sideEffectLevel?: string;
    exposeInLiveSession?: boolean;
    usageExamples?: string[];
    invokingMessage?: string;
    invokedMessage?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    openWorldHint?: boolean;
}

export interface SkillRunResult {
    success: boolean;
    output?: unknown;
    message?: string;
    error?: string;
}

export interface SkillRunRecord {
    skillId: string;
    runAt: string;
    args: Record<string, unknown>;
    result: SkillRunResult;
    durationMs: number;
}

export function useSkills() {
    const [skills, setSkills] = useState<SkillSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<SkillSummary[]>('/api/skills')
            .then((data) => setSkills(data))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load skills'))
            .finally(() => setIsLoading(false));
    }, []);

    const runSkill = useCallback(async (
        skillId: string,
        args: Record<string, unknown>
    ): Promise<SkillRunRecord> => {
        return api.post<SkillRunRecord>(`/api/skills/${skillId}/run`, { args });
    }, []);

    return { skills, isLoading, error, runSkill };
}
