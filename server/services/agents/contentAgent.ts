/**
 * Content Agent — Phase 11 (Inline, with step streaming)
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const CONTENT_AGENT_MANIFEST = {
    id: 'crewmate-content-agent',
    name: 'Content Agent',
    department: 'Marketing',
    description: 'Blog posts, social media, marketing copy, PRDs, and technical documentation.',
    capabilities: ['blog_writing', 'social_media', 'marketing_copy', 'prd_writing'],
    skills: ['notion.create-page', 'web.search'],
    model: serverConfig.geminiResearchModel,
    emoji: '✍️',
};

const CONTENT_FORMATS: Record<string, string> = {
    blog: 'Write a compelling blog post with H2 sections, engaging intro, practical examples, and a clear CTA.',
    social_linkedin: 'Write a LinkedIn post: 3-4 short punchy paragraphs, 3-5 relevant hashtags, conversational but professional.',
    social_twitter: 'Write a Twitter/X thread: 5-7 tweets, numbered, hook in first tweet, end with a CTA.',
    prd: 'Write a Product Requirements Document with: Overview, Problem Statement, User Stories, Success Metrics, Out of Scope.',
    marketing: 'Write compelling marketing copy with: headline, subheader, 3 benefit bullets, social proof, and CTA.',
    documentation: 'Write clear technical documentation with: Overview, Prerequisites, Step-by-step guide, Examples, Troubleshooting.',
};

export async function runContentAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { format?: string; audience?: string; tone?: string; saveToNotion?: boolean; researchFirst?: boolean } = {},
): Promise<{ content: string; wordCount: number; savedToNotion: boolean; notionUrl?: string }> {
    const { format = 'blog', audience = 'general', tone = 'professional', saveToNotion = false, researchFirst = false } = options;
    const ai = createGeminiClient();

    // Optional research pass
    let researchContext = '';
    if (researchFirst) {
        emitStep('skill_call', 'Researching topic first...', { skillId: 'web.search', detail: intent });
        try {
            const t0 = Date.now();
            const searchRun = await runSkill('web.search', ctx, { query: intent, maxResults: 3 });
            researchContext = `\n\nResearch findings:\n${(searchRun.result as { message?: string }).message ?? ''}`;
            emitStep('skill_result', 'Research gathered', { skillId: 'web.search', durationMs: Date.now() - t0, success: true, detail: `${researchContext.length} chars` });
        } catch {
            emitStep('skill_result', 'Research unavailable — writing from LLM knowledge', { skillId: 'web.search', success: false });
        }
    }

    const formatInstructions = CONTENT_FORMATS[format] ?? CONTENT_FORMATS.blog;
    emitStep('generating', `Writing ${format} content...`, { detail: `Audience: ${audience}, Tone: ${tone}` });

    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `You are a world-class content strategist and writer.
Audience: ${audience}
Tone: ${tone}
Task: ${intent}
${formatInstructions}${researchContext}

Write the full content now. Use markdown formatting.`,
    });

    const content = response.text ?? '';
    const wordCount = content.split(/\s+/).length;
    emitStep('skill_result', `Draft complete — ${wordCount} words`, { success: true });

    // Optional Notion save
    let savedToNotion = false;
    let notionUrl: string | undefined;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            const t0 = Date.now();
            const notionRun = await runSkill('notion.create-page', ctx, { title: intent.slice(0, 100), content });
            savedToNotion = (notionRun.result as { success?: boolean }).success === true;
            notionUrl = (notionRun.result as { url?: string }).url;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', durationMs: Date.now() - t0, success: savedToNotion, detail: notionUrl });
        } catch {
            emitStep('skill_result', 'Notion not connected — skipping save', { skillId: 'notion.create-page', success: false });
        }
    }

    emitStep('done', `Content ready — ${wordCount} words`, { success: true });
    return { content, wordCount, savedToNotion, notionUrl };
}

export const contentAgentApp = express();
contentAgentApp.use(express.json());
contentAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(CONTENT_AGENT_MANIFEST));
