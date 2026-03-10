import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface PersonaData {
    id: string;
    name: string;
    emoji: string;
    tagline: string;
    activeSkillPacks: string[];
    proactiveTriggers: string[];
    preferredTools: string[];
    exampleCommands: string[];
}

interface PersonasResponse {
    personas: PersonaData[];
    activePersonaId: string;
}

export function usePersonas() {
    const [personas, setPersonas] = useState<PersonaData[]>([]);
    const [activePersonaId, setActivePersonaIdState] = useState<string>('founder');
    const [isLoading, setIsLoading] = useState(true);
    const [isSwitching, setIsSwitching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPersonas = useCallback(async () => {
        try {
            const data = await api.get<PersonasResponse>('/api/personas');
            setPersonas(data.personas);
            setActivePersonaIdState(data.activePersonaId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load personas');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchPersonas();
    }, [fetchPersonas]);

    const switchPersona = useCallback(async (personaId: string) => {
        setIsSwitching(true);
        try {
            await api.put('/api/personas/active', { personaId });
            setActivePersonaIdState(personaId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to switch persona');
        } finally {
            setIsSwitching(false);
        }
    }, []);

    const activePersona = personas.find((p) => p.id === activePersonaId) ?? null;

    return {
        personas,
        activePersona,
        activePersonaId,
        isLoading,
        isSwitching,
        error,
        switchPersona,
    };
}
