import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface SkillSummary {
    id: string;
    name: string;
    description: string;
    version: string;
    category: string;
    personas: string[];
    requiresIntegration: string[];
    triggerPhrases: string[];
    preferredModel?: string;
}

export interface SkillRunResult {
    success: boolean;
    output?: unknown;
    message?: string;
    error?: string;
}

export function useSkills(personaId?: string) {
    const [skills, setSkills] = useState<SkillSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const url = personaId ? `/api/skills?persona=${personaId}` : '/api/skills';
        api.get<SkillSummary[]>(url)
            .then((data) => setSkills(data))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load skills'))
            .finally(() => setIsLoading(false));
    }, [personaId]);

    const runSkill = useCallback(async (
        skillId: string,
        args: Record<string, unknown>
    ): Promise<SkillRunResult> => {
        const result = await api.post<{ result: SkillRunResult }>(`/api/skills/${skillId}/run`, { args });
        return result.result;
    }, []);

    return { skills, isLoading, error, runSkill };
}
