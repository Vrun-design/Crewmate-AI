/**
 * Content Agent — World-Class Multi-Platform Content Strategist
 *
 * Multi-step pipeline:
 *   1. Trend research (web)
 *   2. Audience analysis + format strategy
 *   3. Multi-format content creation (blog + all social adaptations)
 *   4. SEO optimization pass
 *   5. Save to connected tools (Notion + Google Docs)
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
    description: 'Expert content strategist for multi-platform campaigns — blog posts, social media, video scripts, whitepapers, SEO, editorial calendars, brand storytelling, and conversion copy.',
    capabilities: ['editorial_calendars', 'blog_posts', 'social_media', 'video_scripts', 'seo_optimization', 'brand_storytelling', 'conversion_copy', 'content_repurposing'],
    skills: ['notion.create-page', 'web.search', 'google.docs-create-document'],
    model: serverConfig.geminiResearchModel,
    emoji: '✍️',
};

const CONTENT_EXPERT_SYSTEM_PROMPT = `You are a world-class content strategist and senior content creator with 15+ years of experience across B2B SaaS, consumer brands, and media companies. You've built content engines that generated millions in pipeline and hundreds of thousands of organic followers.

Your philosophy:
- Every piece of content must serve a specific business goal (awareness, conversion, retention, or SEO)
- You obsess over the HOOK — the first sentence is more important than the entire body
- Audience-first always: speak their language, address their pain, give them something they can use TODAY
- Every content piece gets adapted for distribution — create once, repurpose everywhere

Your writing is:
- Concrete over vague: use specific numbers, examples, and case studies
- Scannable: short paragraphs, subheadings at least every 200 words, bullets when listing 3+ items
- Voice-consistent: match the brand's tone exactly — not generically "professional"
- SEO-aware: weave primary and secondary keywords naturally, never stuffed

Output standards:
- Blog posts: 800-2000 words with H2/H3 structure, meta description, and primary CTA at the end
- LinkedIn posts: Hook (1 line), 4-5 punchy paragraphs of max 2 lines each, 3-5 hashtags, question CTA
- Twitter threads: 7-10 tweets, numbered (1/10), hook tweet stops the scroll, final tweet has CTA
- Video scripts: Title card, hook (0-15s), main content with B-roll notes, CTA (last 15s)
- Whitepapers: Executive summary, problem depth, solution framework, evidence, actionable framework, conclusion
- Email sequences: Subject + preview text + body for each email, plain text friendly`;

const CONTENT_FORMATS: Record<string, string> = {
    blog: `Create a high-performing blog post. Structure:
## [Compelling title with primary keyword]
**Meta description (155 chars max):** [...]
**Target keyword:** [...]

[Engaging intro — hook with a statistic or provocative question, 100-150 words]

## [H2 section 1]
[Content with specific examples and data]

## [H2 section 2]
[Content]

## [H2 section 3]
[Content]

## Takeaways
[3-5 actionable bullet points]

**[Strong CTA with clear next step]**`,

    social_linkedin: `Write a high-performing LinkedIn post:
- Open with a POWERFUL 1-liner hook (no "I'm excited to share" — start with a truth or bold statement)
- Use maximum 2 sentences per paragraph — whitespace is your friend
- Include 1 specific example or data point that makes people stop scrolling
- End with a question that invites comments
- 3-5 hashtags (mix of high-volume and niche)

Format: Write the full post ready to publish.`,

    social_twitter: `Write a Twitter/X thread optimized for engagement:
- Tweet 1: The hook — a truth, stat, or bold claim. "X things I wish I knew about [topic]:"
- Tweets 2-9: One insight per tweet. Short sentences. ONE idea per tweet max.
- Tweet 10: Summary + CTA ("Save this thread" or "Follow for more on [topic]")
- Every tweet must be able to stand alone
- Max 280 characters per tweet
- Number each tweet (1/10, 2/10...)`,

    video_script: `Write a compelling video script:
**TITLE CARD:** [...]
**HOOK (0-15s):** [Attention-grabbing opening — question, bold claim, or shocking stat. Speaks directly to pain point]
**[B-ROLL NOTE: ...]**
**MAIN CONTENT (15s-80% of video):** [Teach the main value in clear sections, each with a transition]
**[Each section has a B-ROLL NOTE]**
**CTA (last 15s):** [Clear next step — subscribe, visit URL, comment]
**[END CARD NOTE: ...]**
Word count: appropriate for [target duration]`,

    whitepaper: `Write a comprehensive whitepaper:
## Executive Summary (150 words max)
## The Problem: [Title]
[Deep dive into the pain — data, stories, cost of inaction]
## Why Existing Approaches Fall Short
[Competitive landscape and current solution gaps]
## A Better Framework: [Solution Name]
[Detailed solution with supporting evidence]
## Implementation Guide
[Step-by-step practical framework]
## Case Study / Evidence
[Specific example or data]
## Conclusion & Next Steps
[CTA and contact]`,

    email_sequence: `Write a 3-email nurture sequence:

**Email 1 — The Hook**
Subject: [Curiosity or benefit-driven, <50 chars]
Preview: [Complements subject, <90 chars]
Body: [Problem acknowledgment → single insight → CTA to consume content]

**Email 2 — The Value**
Subject: [Specific value claim]
Preview: [...]
Body: [Deeper insight → proof → next step]

**Email 3 — The Ask**
Subject: [Direct or urgency-driven]
Preview: [...]
Body: [Value recap → clear offer → CTA]`,

    prd: `Write a Product Requirements Document:
## Overview & Problem Statement
## Target User Personas
## Proposed Solution
## User Stories
As a [persona], I want [action] so that [benefit].
**Acceptance Criteria:**
- [ ] ...
## Success Metrics (KPIs)
## Technical Considerations
## Design Requirements
## Out of Scope
## Timeline`,

    documentation: `Write clear, developer-friendly documentation:
## Overview
[What this is and why it matters]
## Prerequisites
[What you need before starting]
## Quick Start
[Get running in under 5 minutes]
## Step-by-Step Guide
[Numbered steps with code blocks where relevant]
## Configuration Reference
[All options and parameters]
## Examples
[Real-world usage examples]
## Troubleshooting
[Most common issues and fixes]`,

    marketing: `Write conversion-focused marketing copy:
**HEADLINE:** [Biggest benefit, addresses specific pain, <10 words]
**SUBHEADLINE:** [Expands on headline, adds specificity]
**BENEFITS (3 bullets):**
- ✅ [Specific outcome 1]
- ✅ [Specific outcome 2]
- ✅ [Specific outcome 3]
**SOCIAL PROOF LINE:** [Quote, stat, or logo reference]
**CTA:** [Action verb + what they get + urgency if real]
**Objection handling (2-3 sentences):** [Address the #1 reason they'd say no]`,
};

export async function runContentAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: {
        format?: string;
        audience?: string;
        tone?: string;
        saveToNotion?: boolean;
        researchFirst?: boolean;
    } = {},
): Promise<{ content: string; wordCount: number; savedToNotion: boolean; notionUrl?: string; repurposed?: Record<string, string> }> {
    const {
        format = 'blog',
        audience = 'business professionals',
        tone = 'expert and engaging',
        saveToNotion = true,
        researchFirst = true,
    } = options;
    const ai = createGeminiClient();

    // Step 1: Strategic planning
    emitStep('thinking', 'Developing content strategy...', { detail: `Format: ${format} | Audience: ${audience}` });
    const strategyResponse = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${CONTENT_EXPERT_SYSTEM_PROMPT}

You are planning a content piece. Briefly (3-5 bullets) define:
- Primary audience pain point this addresses
- The ONE most valuable insight/hook
- Primary keyword/angle for this format
- Tone and voice notes
- Key data points or examples to include

Content request: "${intent}"
Format: ${format}
Audience: ${audience}`,
    });
    const strategy = strategyResponse.text ?? '';
    emitStep('thinking', 'Strategy set — researching market context...', { detail: strategy.slice(0, 100) });

    // Step 2: Research
    let researchContext = '';
    if (researchFirst) {
        try {
            emitStep('skill_call', 'Researching current trends and data...', { skillId: 'web.search' });
            const t0 = Date.now();
            const searchRun = await runSkill('web.search', ctx, { query: `${intent} data statistics trends 2025`, maxResults: 5 });
            researchContext = `\n\nCurrent market research and data:\n${(searchRun.result as { message?: string }).message ?? ''}`;
            emitStep('skill_result', 'Research complete — enriching content with real data', {
                skillId: 'web.search',
                durationMs: Date.now() - t0,
                success: true,
                detail: `${researchContext.length} chars of context`,
            });
        } catch {
            emitStep('skill_result', 'Research unavailable — writing from expertise', { skillId: 'web.search', success: false });
        }
    }

    // Step 3: Main content generation
    const formatInstructions = CONTENT_FORMATS[format] ?? CONTENT_FORMATS.blog;
    emitStep('generating', `Crafting ${format.replace('_', ' ')} content...`, { detail: `Tone: ${tone}` });

    const contentResponse = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${CONTENT_EXPERT_SYSTEM_PROMPT}

Audience: ${audience}
Tone: ${tone}
Strategic context:
${strategy}
${researchContext}

REQUEST: ${intent}

${formatInstructions}

Write the COMPLETE, PUBLICATION-READY piece now. No placeholders. If writing about a product/company, infer plausible details from context. Use real data from research when available.`,
    });

    const content = contentResponse.text ?? '';
    const wordCount = content.split(/\s+/).length;
    emitStep('skill_result', `Content complete — ${wordCount} words`, { success: true, detail: `${format} format` });

    // Step 4: Repurpose into social snippets (always — this is what makes it powerful)
    let repurposed: Record<string, string> = {};
    if (format === 'blog' || format === 'whitepaper') {
        emitStep('generating', 'Repurposing into social media assets...', { detail: 'Twitter thread + LinkedIn snippet' });
        try {
            const repurposeResponse = await ai.models.generateContent({
                model: serverConfig.geminiResearchModel,
                contents: `${CONTENT_EXPERT_SYSTEM_PROMPT}

Based on this content, create two repurposed social pieces:

## TWITTER THREAD (5-7 tweets, numbered)
[Extract the most surprising / valuable insight and build a thread around it]

## LINKEDIN SNIPPET (150-200 words)
[Opening hook + key insight + link CTA]

Source content:
${content.slice(0, 2000)}`,
            });
            const repurposeText = repurposeResponse.text ?? '';
            const twitterMatch = /## TWITTER THREAD([^#]*)/i.exec(repurposeText);
            const linkedinMatch = /## LINKEDIN SNIPPET([^#]*)/i.exec(repurposeText);
            if (twitterMatch) repurposed.twitter = twitterMatch[1].trim();
            if (linkedinMatch) repurposed.linkedin = linkedinMatch[1].trim();
            if (repurposed.twitter || repurposed.linkedin) {
                emitStep('skill_result', 'Social repurposing complete', { success: true });
            }
        } catch { /* non-critical */ }
    }

    // Step 5: Save to Notion (and attempt Google Docs)
    let savedToNotion = false;
    let notionUrl: string | undefined;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            const t0 = Date.now();
            const fullContent = repurposed.twitter || repurposed.linkedin
                ? `${content}\n\n---\n\n## Twitter Thread\n${repurposed.twitter ?? ''}\n\n## LinkedIn Post\n${repurposed.linkedin ?? ''}`
                : content;
            const notionRun = await runSkill('notion.create-page', ctx, {
                title: intent.slice(0, 100),
                content: fullContent,
            });
            savedToNotion = (notionRun.result as { success?: boolean }).success === true;
            notionUrl = (notionRun.result as { output?: { url?: string } }).output?.url;
            emitStep('skill_result', 'Saved to Notion', {
                skillId: 'notion.create-page',
                durationMs: Date.now() - t0,
                success: savedToNotion,
                detail: notionUrl,
            });
        } catch {
            emitStep('skill_result', 'Notion not connected — content ready in output', { skillId: 'notion.create-page', success: false });
        }
    }

    emitStep('done', `Content ready — ${wordCount} words${repurposed.twitter ? ' + social repurposing' : ''}${savedToNotion ? ' + saved to Notion' : ''}`, { success: true });
    return { content, wordCount, savedToNotion, notionUrl, repurposed };
}

export const contentAgentApp = express();
contentAgentApp.use(express.json());
contentAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(CONTENT_AGENT_MANIFEST));
