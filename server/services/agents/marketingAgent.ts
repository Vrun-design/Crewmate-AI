/**
 * Marketing Agent — Phase 12 Full Workforce
 * Campaign briefs, A/B copy, social posts, analytics interpretation
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const MARKETING_AGENT_MANIFEST = {
    id: 'crewmate-marketing-agent',
    name: 'Marketing Agent',
    department: 'Marketing',
    description: 'Campaign briefs, A/B copy variants, social posts, trend research, analytics summaries.',
    capabilities: ['campaign_briefs', 'ab_copy', 'social_posts', 'trend_research', 'analytics'],
    skills: ['web.search', 'notion.create-page', 'gmail.send', 'slack.post-message'],
    model: serverConfig.geminiResearchModel,
    emoji: '📣',
};

export async function runMarketingAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'campaign' | 'social' | 'ab_copy' | 'brief'; saveToNotion?: boolean } = {},
): Promise<{ output: string; variants?: string[]; savedToNotion: boolean }> {
    const ai = createGeminiClient();
    const { type = 'brief', saveToNotion = false } = options;

    // Research trends
    emitStep('skill_call', 'Researching trends and competitors...', { skillId: 'web.search' });
    let trendContext = '';
    try {
        const t0 = Date.now();
        const r = await runSkill('web.search', ctx, { query: `${intent} marketing trends 2025`, maxResults: 4 });
        trendContext = (r.result as { message?: string }).message ?? '';
        emitStep('skill_result', 'Trend research complete', { skillId: 'web.search', durationMs: Date.now() - t0, success: true });
    } catch {
        emitStep('skill_result', 'Trend research unavailable', { skillId: 'web.search', success: false });
    }

    const prompts: Record<string, string> = {
        campaign: `Create a full marketing campaign brief with: Objective, Target Audience, Key Messages (3), Channels, Creative Concepts (2), KPIs, Timeline`,
        social: `Write 3 social media post variants for LinkedIn, Twitter/X, and Instagram. Each platform-optimized. Include hashtags.`,
        ab_copy: `Write 3 A/B headline + body copy variants. Each variant should test a different angle (feature-led, benefit-led, urgency-led).`,
        brief: `Write a comprehensive marketing brief with: Background, Goals, Target Audience, Positioning, Messaging Hierarchy, Creative Direction`,
    };

    emitStep('generating', `Creating ${type} content...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `You are a senior marketing strategist.
Task: ${intent}
${prompts[type]}
${trendContext ? `\nMarket context:\n${trendContext.slice(0, 600)}` : ''}

Write the full output now in markdown.`,
    });

    const output = response.text ?? '';
    const variants = type === 'ab_copy'
        ? output.split(/Variant [123]:/i).filter(Boolean).map((v) => v.trim())
        : undefined;

    emitStep('skill_result', `${type} complete — ${output.split(/\s+/).length} words`, { success: true });

    let savedToNotion = false;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            await runSkill('notion.create-page', ctx, { title: intent.slice(0, 100), content: output });
            savedToNotion = true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', success: true });
        } catch {
            emitStep('skill_result', 'Notion not connected', { skillId: 'notion.create-page', success: false });
        }
    }

    emitStep('done', 'Marketing content ready', { success: true });
    return { output, variants, savedToNotion };
}

export const marketingAgentApp = express();
marketingAgentApp.use(express.json());
marketingAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(MARKETING_AGENT_MANIFEST));
