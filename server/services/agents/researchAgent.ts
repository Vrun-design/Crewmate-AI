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
import { isFeatureEnabled } from '../featureFlagService';

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

interface ResearchSource {
    title: string;
    url: string;
    snippet: string;
}

interface ResearchSearchResult {
    groundingMode: 'grounded' | 'limited';
    searchContext: string;
    sources: ResearchSource[];
    fallbackReason?: string;
}

function getSourceValue(source: Record<string, unknown>, key: string): string {
    const value = source[key];
    return typeof value === 'string' ? value : '';
}

function normalizeResearchSources(output: unknown): ResearchSource[] {
    if (!Array.isArray(output)) {
        return [];
    }

    return output
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            const source = item as Record<string, unknown>;
            const url = getSourceValue(source, 'url') || getSourceValue(source, 'href');
            if (!url) {
                return null;
            }

            return {
                title: getSourceValue(source, 'title') || 'Untitled source',
                url,
                snippet: getSourceValue(source, 'content') || getSourceValue(source, 'body'),
            };
        })
        .filter((source): source is ResearchSource => source !== null);
}

function formatResearchSources(sources: ResearchSource[]): string {
    return sources
        .map((source, index) => `${index + 1}. ${source.title}\nURL: ${source.url}\nSnippet: ${source.snippet || 'No snippet available.'}`)
        .join('\n\n');
}

async function buildResearchSearchResult(intent: string, ctx: SkillRunContext, emitStep: EmitStep): Promise<ResearchSearchResult> {
    const groundedResearchEnabled = isFeatureEnabled('researchGrounding');

    try {
        const startedAt = Date.now();
        emitStep('skill_call', 'Searching the web...', { skillId: 'web.search', detail: intent });
        const searchRun = await runSkill('web.search', ctx, { query: intent, maxResults: 5 });
        const durationMs = Date.now() - startedAt;
        const sources = normalizeResearchSources(searchRun.result.output);
        const searchMessage = typeof searchRun.result.message === 'string' ? searchRun.result.message : '';
        const success = searchRun.result.success !== false && sources.length > 0;

        emitStep('skill_result', success ? 'Search complete' : 'Search returned limited evidence', {
            skillId: 'web.search',
            durationMs,
            success,
            detail: success ? `${sources.length} sources retrieved` : searchRun.result.error ?? 'No usable sources returned',
        });

        if (!groundedResearchEnabled) {
            return {
                groundingMode: 'limited',
                searchContext: searchMessage,
                sources,
                fallbackReason: success ? undefined : 'Search returned no usable sources.',
            };
        }

        if (!success) {
            return {
                groundingMode: 'limited',
                searchContext: '',
                sources: [],
                fallbackReason: searchRun.result.error ?? 'Search returned no usable sources.',
            };
        }

        return {
            groundingMode: 'grounded',
            searchContext: formatResearchSources(sources),
            sources,
        };
    } catch {
        emitStep('skill_result', 'Web search unavailable — continuing with limited evidence', {
            skillId: 'web.search',
            success: false,
        });

        return {
            groundingMode: 'limited',
            searchContext: '',
            sources: [],
            fallbackReason: 'Web search unavailable.',
        };
    }
}

export async function runResearchAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
): Promise<{ plan: string; findings: string; brief: string; sources: ResearchSource[]; grounded: boolean }> {
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
    const searchResult = await buildResearchSearchResult(intent, ctx, emitStep);
    const evidenceInstructions = searchResult.groundingMode === 'grounded'
        ? `Use only the supplied evidence. Cite sources inline by title when making claims. If the evidence is incomplete, say so explicitly.\n\nEvidence:\n${searchResult.searchContext}`
        : `External evidence is limited for this run. Be explicit about uncertainty, avoid unsupported claims, and clearly label any recommendation as provisional.${searchResult.fallbackReason ? `\nReason: ${searchResult.fallbackReason}` : ''}`;

    // Step 3: Synthesize findings
    emitStep('generating', 'Synthesizing findings...', {
        detail: searchResult.groundingMode === 'grounded' ? 'Gemini Pro analyzing retrieved sources' : 'Gemini Pro working with limited evidence safeguards',
    });
    const findingsResponse = await ai.models.generateContent({
        model: researchModel,
        contents: `You are a research specialist. Produce a structured findings memo with key options, tradeoffs, and recommendations.\nTopic: ${intent}\nPlan:\n${plan}\n\n${evidenceInstructions}`,
    });
    const findings = getText(findingsResponse);

    // Step 4: Write executive brief
    emitStep('generating', 'Writing executive brief...', { detail: 'Condensing into summary format' });
    const briefResponse = await ai.models.generateContent({
        model: textModel,
        contents: `You are an editor. Turn the plan and findings into a concise markdown brief.\nSections: Summary, Key Findings, Recommendation, Next Actions${searchResult.groundingMode === 'grounded' ? ', Sources' : ', Evidence Gaps'}\nGoal: ${intent}\nPlan:\n${plan}\nFindings:\n${findings}${searchResult.groundingMode === 'grounded' ? `\nSources:\n${formatResearchSources(searchResult.sources)}` : `\nEvidence gaps:\n${searchResult.fallbackReason ?? 'No external sources were retrieved for this run.'}`}`,
    });
    const brief = getText(briefResponse);

    emitStep('done', `Research complete — ${brief.split(/\s+/).length} word brief`, { success: true });
    return {
        plan,
        findings,
        brief,
        sources: searchResult.sources,
        grounded: searchResult.groundingMode === 'grounded',
    };
}

// Legacy Express app — kept for backward compat with /.well-known/agent.json
import express from 'express';
export const researchAgentApp = express();
researchAgentApp.use(express.json());
researchAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(RESEARCH_AGENT_MANIFEST));
