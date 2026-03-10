/**
 * Social Agent — Phase 12 Full Workforce
 * Tweet threads, LinkedIn posts, post calendars, trend research
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const SOCIAL_AGENT_MANIFEST = {
    id: 'crewmate-social-agent',
    name: 'Social Agent',
    department: 'Marketing',
    description: 'Tweet threads, LinkedIn posts, social media calendars, trend research, viral hooks, and engagement copy.',
    capabilities: ['twitter_threads', 'linkedin_posts', 'post_calendars', 'trend_research', 'hooks'],
    skills: ['web.search', 'notion.create-page'],
    model: serverConfig.geminiResearchModel,
    emoji: '📱',
};

export async function runSocialAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { platform?: 'twitter' | 'linkedin' | 'all' | 'calendar'; tone?: string; saveToNotion?: boolean } = {},
): Promise<{ posts: Record<string, string>; savedToNotion: boolean }> {
    const ai = createGeminiClient();
    const { platform = 'all', tone = 'authentic', saveToNotion = false } = options;

    // Research trending topics
    emitStep('skill_call', 'Checking trending topics...', { skillId: 'web.search' });
    let trendContext = '';
    try {
        const t0 = Date.now();
        const r = await runSkill('web.search', ctx, { query: `${intent} trending 2025 social media`, maxResults: 3 });
        trendContext = (r.result as { message?: string }).message ?? '';
        emitStep('skill_result', 'Trends gathered', { skillId: 'web.search', durationMs: Date.now() - t0, success: true });
    } catch {
        emitStep('skill_result', 'Trend research unavailable', { skillId: 'web.search', success: false });
    }

    emitStep('generating', `Writing ${platform === 'all' ? 'multi-platform' : platform} content...`);

    const platformPrompts: Record<string, string> = {
        twitter: `Write a compelling Twitter/X thread (6-8 tweets). 
Tweet 1: Hook that stops the scroll.
Tweets 2-7: One key insight per tweet. Short sentences. 
Tweet 8: CTA + summary.
Number each tweet (1/8, 2/8...). Under 280 chars each.`,
        linkedin: `Write a LinkedIn post that performs well:
- Open with a personal or counter-intuitive observation
- 3-4 short paragraphs
- Use line breaks liberally for whitespace
- End with a question to drive comments
- 3-5 relevant hashtags
Professional but human. 250-400 words.`,
        all: `Write posts for THREE platforms:

## Twitter Thread (6 tweets, numbered)
[tweets here]

## LinkedIn Post (250-400 words)
[post here]

## Instagram Caption (short, visual, hashtags)
[caption here]`,
        calendar: `Create a 2-week social media content calendar.
For each day: Platform | Content Type | Topic | Hook | CTA
Format as a markdown table.`,
    };

    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `You are a social media expert known for viral, authentic content.
Topic: ${intent}
Tone: ${tone}
${trendContext ? `\nTrend context:\n${trendContext.slice(0, 400)}` : ''}

${platformPrompts[platform] ?? platformPrompts.all}`,
    });

    const content = response.text ?? '';
    emitStep('skill_result', `Social content ready — ${content.split(/\s+/).length} words`, { success: true });

    // Parse into platform sections
    const posts: Record<string, string> = { all: content };
    if (platform === 'all') {
        const twitterMatch = /## Twitter Thread([\s\S]*?)(?=## |\z)/i.exec(content);
        const linkedinMatch = /## LinkedIn Post([\s\S]*?)(?=## |\z)/i.exec(content);
        const instagramMatch = /## Instagram Caption([\s\S]*?)(?=## |\z)/i.exec(content);
        if (twitterMatch) posts.twitter = twitterMatch[1].trim();
        if (linkedinMatch) posts.linkedin = linkedinMatch[1].trim();
        if (instagramMatch) posts.instagram = instagramMatch[1].trim();
    }

    let savedToNotion = false;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            await runSkill('notion.create-page', ctx, { title: `Social: ${intent.slice(0, 80)}`, content });
            savedToNotion = true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', success: true });
        } catch {
            emitStep('skill_result', 'Notion not connected', { skillId: 'notion.create-page', success: false });
        }
    }

    emitStep('done', 'Social content ready', { success: true });
    return { posts, savedToNotion };
}

export const socialAgentApp = express();
socialAgentApp.use(express.json());
socialAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(SOCIAL_AGENT_MANIFEST));
