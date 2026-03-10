/**
 * Research Agent — Phase 11 (Inline, with step streaming)
 *
 * Executes multi-step research: plan → search → synthesize → brief
 * Emits sub-step events for real-time UI transparency.
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import { selectModel, determineComplexity } from '../modelRouter';

export const RESEARCH_AGENT_MANIFEST = {
    id: 'crewmate-research-agent',
    name: 'Research Agent',
    department: 'Intelligence',
    description: 'Deep multi-step research, market analysis, technical deep-dives, executive briefs.',
    capabilities: ['web_search', 'document_analysis', 'synthesis'],
    skills: ['web.search', 'web.summarize-url', 'browser.extract'],
    model: serverConfig.geminiResearchModel,
    emoji: '🔬',
};

function getText(response: unknown): string {
    if (response && typeof response === 'object' && 'text' in response) {
        return typeof (response as { text?: unknown }).text === 'string' ? (response as { text: string }).text : '';
    }
    return '';
}

export async function runResearchAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
): Promise<{ plan: string; findings: string; brief: string }> {
    const ai = createGeminiClient();
    const complexity = determineComplexity(intent);
    const researchModel = selectModel('research', complexity, intent.length);
    const textModel = selectModel('general', 'low');

    // Step 1: Plan
    emitStep('thinking', 'Creating research plan...', { detail: intent });
    const planResponse = await ai.models.generateContent({
        model: researchModel,
        contents: `You are an orchestrator agent. Create a concise 3-step execution plan for a background research brief.\nTopic: ${intent}\nGoal: ${intent}\nAudience: team`,
    });
    const plan = getText(planResponse);
    emitStep('thinking', 'Research plan ready', { detail: plan.slice(0, 120) + '...' });

    // Step 2: Web search (if skill available)
    let searchContext = '';
    try {
        const t0 = Date.now();
        emitStep('skill_call', 'Searching the web...', { skillId: 'web.search', detail: intent });
        const searchRun = await runSkill('web.search', ctx, { query: intent, maxResults: 5 });
        const dur = Date.now() - t0;
        searchContext = (searchRun.result as { message?: string }).message ?? '';
        emitStep('skill_result', 'Search complete', { skillId: 'web.search', durationMs: dur, success: true, detail: `${searchContext.length} chars found` });
    } catch {
        emitStep('skill_result', 'Web search unavailable — using LLM knowledge', { skillId: 'web.search', success: false });
    }

    // Step 3: Synthesize findings
    emitStep('generating', 'Synthesizing findings...', { detail: 'Gemini Pro analyzing sources' });
    const findingsResponse = await ai.models.generateContent({
        model: researchModel,
        contents: `You are a research specialist. Produce a structured findings memo with key options, tradeoffs, and recommendations.\nTopic: ${intent}\nPlan:\n${plan}\n${searchContext ? `\nSearch results:\n${searchContext}` : ''}`,
    });
    const findings = getText(findingsResponse);

    // Step 4: Write executive brief
    emitStep('generating', 'Writing executive brief...', { detail: 'Condensing into summary format' });
    const briefResponse = await ai.models.generateContent({
        model: textModel,
        contents: `You are an editor. Turn the plan and findings into a concise markdown brief.\nSections: Summary, Key Findings, Recommendation, Next Actions\nGoal: ${intent}\nPlan:\n${plan}\nFindings:\n${findings}`,
    });
    const brief = getText(briefResponse);

    emitStep('done', `Research complete — ${brief.split(/\s+/).length} word brief`, { success: true });
    return { plan, findings, brief };
}

// Legacy Express app — kept for backward compat with /.well-known/agent.json
import express from 'express';
export const researchAgentApp = express();
researchAgentApp.use(express.json());
researchAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(RESEARCH_AGENT_MANIFEST));
