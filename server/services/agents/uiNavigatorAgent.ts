import express from 'express';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import { isFeatureEnabled } from '../featureFlagService';

export const UI_NAVIGATOR_AGENT_MANIFEST = {
    id: 'crewmate-ui-navigator-agent',
    name: 'UI Navigator Agent',
    department: 'Navigation',
    description: 'Visual browser operator that interprets UI state and carries out web actions step-by-step.',
    capabilities: ['ui_navigation', 'browser_automation', 'visual_interaction', 'playwright_execution'],
    skills: ['browser.ui-navigate', 'browser.inspect-visible-ui', 'browser.click-element', 'browser.type-into'],
    model: serverConfig.geminiOrchestrationModel,
    emoji: '☸️',
};

interface UiNavigatorIntentParts {
    cleanedIntent: string;
    startUrl?: string;
}

function extractUiNavigatorIntentParts(intent: string): UiNavigatorIntentParts {
    const startUrlMatch = intent.match(/start url:\s*(https?:\/\/\S+)/i);
    const taskMatch = intent.match(/task:\s*([\s\S]+)/i);

    return {
        cleanedIntent: taskMatch?.[1]?.trim() || intent.trim(),
        startUrl: startUrlMatch?.[1]?.trim(),
    };
}

export async function runUiNavigatorAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
): Promise<unknown> {
    if (!isFeatureEnabled('uiNavigator')) {
        throw new Error('UI Navigator is disabled. Enable FEATURE_UI_NAVIGATOR to run this agent.');
    }

    const { cleanedIntent, startUrl } = extractUiNavigatorIntentParts(intent);

    emitStep('thinking', 'Analyzing browser navigation goal...', { detail: cleanedIntent });
    if (startUrl) {
        emitStep('thinking', 'Using provided start URL', { detail: startUrl });
    }

    emitStep('skill_call', 'Planning and executing browser UI steps...', { skillId: 'browser.ui-navigate' });
    const startedAt = Date.now();
    const run = await runSkill('browser.ui-navigate', ctx, {
        intent: cleanedIntent,
        startUrl,
        maxSteps: 8,
    });
    const result = run.result;
    const success = result.success !== false;

    emitStep('skill_result', success ? 'UI navigation run complete' : 'UI navigation run blocked', {
        skillId: 'browser.ui-navigate',
        durationMs: Date.now() - startedAt,
        success,
        detail: typeof result.message === 'string' ? result.message : cleanedIntent,
    });
    emitStep('done', success ? 'UI navigator task complete' : 'UI navigator task halted', { success });

    return result.output ?? result;
}

export const uiNavigatorAgentApp = express();
uiNavigatorAgentApp.use(express.json());
uiNavigatorAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(UI_NAVIGATOR_AGENT_MANIFEST));
