import { serverConfig } from '../config';
import type { ModelPreference } from '../skills/types';

type TaskType = 'live' | 'research' | 'creative' | 'general' | 'orchestration';
type Complexity = 'low' | 'high';

export function selectModel(taskType: TaskType, complexity: Complexity = 'low', textLength = 0): string {
    // Live sessions need the real-time audio model
    if (taskType === 'live') {
        return serverConfig.geminiLiveModel;
    }

    // Orchestration (multi-agent intent routing) — always use the orchestration model
    if (taskType === 'orchestration') {
        return serverConfig.geminiOrchestrationModel ?? serverConfig.geminiResearchModel;
    }

    // Creative tasks
    if (taskType === 'creative' && complexity === 'high') {
        return serverConfig.geminiCreativeModel;
    }

    // Long prompts or explicit research requests → Pro
    if (taskType === 'research' || complexity === 'high' || textLength > 500) {
        return serverConfig.geminiResearchModel;
    }

    // Default to Flash for speed and cost efficiency
    return serverConfig.geminiTextModel;
}

/**
 * Pick the right model for a skill execution based on its preferredModel field.
 * Falls back to geminiTextModel (Flash) for unspecified or 'quick' skills.
 */
export function selectModelForSkill(preferredModel?: ModelPreference): string {
    switch (preferredModel) {
        case 'research':
            return serverConfig.geminiResearchModel;
        case 'orchestration':
            return serverConfig.geminiOrchestrationModel ?? serverConfig.geminiResearchModel;
        case 'creative':
            return serverConfig.geminiCreativeModel;
        case 'quick':
        default:
            return serverConfig.geminiTextModel;
    }
}

export function determineComplexity(prompt: string): Complexity {
    const deepKeywords = ['compare', 'analyze', 'strategy', 'deep dive', 'comprehensive', 'tradeoffs', 'architecture', 'design'];
    const lowerPrompt = prompt.toLowerCase();

    if (deepKeywords.some(kw => lowerPrompt.includes(kw))) {
        return 'high';
    }

    if (prompt.split(' ').length > 200) {
        return 'high';
    }

    return 'low';
}
