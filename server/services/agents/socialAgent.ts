/**
 * Social Agent — World-Class Social Media Strategist
 *
 * Multi-step pipeline:
 *   1. Trend research (web)
 *   2. Multi-platform content generation
 *   3. Content calendar if requested
 *   4. Save to Notion
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import { maybeSaveAgentOutputToWorkspace, type WorkspaceOutputTarget } from './agentWorkspaceOutput';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const SOCIAL_AGENT_MANIFEST = {
    id: 'crewmate-social-agent',
    name: 'Social Agent',
    department: 'Marketing',
    description: 'Expert social media strategist — viral Twitter/X threads, LinkedIn thought leadership, Instagram campaigns, content calendars, trend research, engagement strategy, and founder brand building.',
    capabilities: ['twitter_threads', 'linkedin_posts', 'instagram_content', 'content_calendars', 'trend_research', 'founder_brand', 'engagement_strategy'],
    skills: ['web.search', 'notion.create-page'],
    model: serverConfig.geminiResearchModel,
    emoji: '📱',
};

const SOCIAL_EXPERT_SYSTEM_PROMPT = `You are a world-class social media strategist with 12+ years building audiences for founders, startups, and consumer brands. You've grown brand accounts from 0 to 500K+ followers and built personal brands for founders that drove millions in revenue.

Your content philosophy:
- Format is the strategy: different platforms reward fundamentally different content styles — never cross-post without adapting
- The hook is everything: 90% of social content fails in the first line
- Specific beats vague, every time: "We grew from $1K to $100K MRR in 8 months" > "We grew fast"
- Teach before you sell: give value 80% of the time; promote 20% of the time
- Consistency > virality: show up reliably for a niche audience rather than chasing broad viral moments

Platform expertise:
**Twitter/X:** Short-form authority. Threads that teach. Takes that spark conversation. Real data.
- Hook tweet: bold claim, surprising stat, or hot take that makes people stop
- Thread structure: 7-10 tweets, one insight per tweet, numbered
- Engagement: End with a question or ask for retweets

**LinkedIn:** Professional storytelling. Career lessons. Business insights. Founder perspective.
- Hook: first line visible before "see more" — make it impossible not to click
- Format: 2-line paragraphs with space between — whitespace is crucial
- Engagement: question at the end, genuine tone, 3-5 hashtags

**Instagram:** Visual storytelling. Captions that complement images. Community building.
- Caption: hook first line, story in the middle, CTA at end
- Hashtags: 10-20 relevant ones, mix of sizes

**Founder brand building:** Thought leadership + personal story + industry expertise = premium positioning

Output quality: write ready-to-publish content, not drafts. No placeholders.`;

export async function runSocialAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { platform?: 'twitter' | 'linkedin' | 'all' | 'calendar' | 'instagram' | 'founder'; tone?: string; saveToNotion?: boolean; outputTarget?: WorkspaceOutputTarget } = {},
): Promise<{ posts: Record<string, string>; savedToNotion: boolean; workspaceUrl?: string }> {
    const ai = createGeminiClient();
    const { platform = 'all', tone = 'authentic and direct', saveToNotion = true, outputTarget } = options;

    emitStep('thinking', `Planning ${platform} content strategy...`, { detail: intent.slice(0, 80) });

    // Trend research — always
    emitStep('skill_call', 'Checking trending topics and viral content patterns...', { skillId: 'web.search' });
    let trendContext = '';
    try {
        const t0 = Date.now();
        const r = await runSkill('web.search', ctx, {
            query: `${intent} viral content trending social media 2025`,
            maxResults: 4,
        });
        trendContext = (r.result as { message?: string }).message ?? '';
        emitStep('skill_result', 'Trends and viral patterns gathered', {
            skillId: 'web.search',
            durationMs: Date.now() - t0,
            success: true,
        });
    } catch {
        emitStep('skill_result', 'Trend research unavailable — working from expertise', { skillId: 'web.search', success: false });
    }

    const platformPrompts: Record<string, string> = {
        twitter: `Write a high-performing Twitter/X thread:

**Thread Hook (Tweet 1/N):**
[Make this STOP the scroll — bold claim, surprising stat, or hot take]
[Must work as a standalone tweet too]

**Tweet 2/N:** [First insight — specific, not obvious]
**Tweet 3/N:** [Second insight — deeper]
**Tweet 4/N:** [Example or data point]
**Tweet 5/N:** [Counterintuitive point or nuance]
**Tweet 6/N:** [Practical application]
**Tweet 7/N:** [Biggest mistake people make]
**Tweet 8/N:** [Recap + summary tweet]
**Tweet 9/N (Final):** [CTA + prompt for retweet/reply]
"If you found this valuable, retweet tweet 1 to help others. Follow me for more on [topic]."

*Requirements:*
- Each tweet ≤ 280 characters
- Number each tweet (1/9, 2/9...)
- Every tweet can stand alone
- Use specific numbers, not vague claims
- No "🧵" emoji (it's overused)`,

        linkedin: `Write 3 high-performing LinkedIn posts for different content types:

## Post 1: Personal Story / Founder Lesson
[Hook — first line visible BEFORE "see more" — controversial, specific, counter-intuitive]

[Space between every 2 sentences]

[Paragraph 2 — develop the story with specific details]

[Paragraph 3 — the insight or lesson]

[Paragraph 4 — broader application for the reader]

[Closing question to drive comments]

[3-5 hashtags]

---

## Post 2: Tactical Framework / How-To
[Hook: "Here's the [specific framework] I used to [specific outcome]:"]

[Teach the framework in numbered list or short paragraphs]

[Add 1 specific example or case study]

["Save this for later."]

[3-5 hashtags]

---

## Post 3: Industry Insight / Thought Leadership
[Hook: bold opinion or underrated insight about the industry]

[3 supporting arguments or data points]

[What this means for the reader]

[Invite disagreement or discussion]

[3-5 hashtags]`,

        instagram: `Write Instagram content with strategic captions:

## Post 1: Value / Educational
**Visual direction:** [What the image/graphic should show — specific, not "relevant image"]
**Caption:**
[Hook: 1 powerful first line — all caps or bold statement works well]

[Develop the value: 3-5 short actionable points]

[CTA: "Save this" / "Tag someone who needs this" / "Comment [word] for [resource]"]

[Hashtags: #[high volume] #[mid volume] #[niche] — 15-20 total]

---

## Post 2: Story / Behind-the-Scenes
**Visual direction:** [...]
**Caption:**
[Personal, vulnerable opening]
[Story with specific details — make it feel real]
[Lesson or takeaway]
[CTA: question to invite comments]
[Hashtags]

---

## Story Sequence (5 slides)
| Slide | Content | Interactive element |
|-------|---------|-------------------|
| 1 | [Hook/question] | Poll |
| 2 | [Context] | — |
| 3 | [Key insight] | Slider ("How much do you agree?") |
| 4 | [Application] | — |
| 5 | [CTA] | Link sticker |`,

        founder: `Build a founder personal brand content strategy + posts:

## Founder Brand Positioning
**Your unique angle:** [What makes your perspective different from others in this space]
**Core content pillars:**
1. [Pillar 1 — e.g., Building in public / lessons from your journey]
2. [Pillar 2 — e.g., Industry expertise / contrarian takes]
3. [Pillar 3 — e.g., Team & culture / behind the scenes]

---

## Twitter Thread — Building in Public
[Thread about a specific milestone, challenge, or lesson with real numbers and specifics]

---

## LinkedIn Story Post
[Vulnerable, specific story from the founder journey with a universal lesson at the end]

---

## Content Calendar (2 weeks)
| Day | Platform | Type | Topic |
|-----|----------|------|-------|
| Mon | LinkedIn | Story | [...] |
| Tue | Twitter | Thread | [...] |
| Wed | LinkedIn | Insight | [...] |
| Thu | Twitter | Take | [...] |
| Fri | LinkedIn | Teach | [...] |
[Repeat for week 2]

---

## Engagement Strategy
- Reply to comments within 2 hours of posting (first 2 hours matter most)
- Proactively comment on 5 posts in your niche before you post
- [Platform-specific engagement hacks]`,

        calendar: `Create a 4-week social media content calendar:

## Social Media Content Calendar — [Month]

### Content Pillars
1. **[Pillar 1]** — [What type of content, what audience need it serves]
2. **[Pillar 2]** — [...]
3. **[Pillar 3]** — [...]

### Week 1
| Day | Platform | Format | Hook/Topic | Goal | Status |
|-----|----------|--------|-----------|------|--------|
| Mon | LinkedIn | Story | [Hook] | Awareness | Draft |
| Tue | Twitter | Thread | [Topic] | Engagement | Draft |
| Wed | Instagram | Educational graphic | [Topic] | Save/share | Draft |
| Thu | LinkedIn | Industry insight | [Hook] | Authority | Draft |
| Fri | Twitter | Hot take | [Topic] | Replies | Draft |

[Repeat for Weeks 2-4 with different topics but same structure]

### Monthly KPIs
| Metric | Target | Track via |
|--------|--------|-----------|
| Total impressions | [...] | Native analytics |
| Engagement rate | >[3]% | Native analytics |
| New followers | [...] | Native analytics |
| Profile visits | [...] | Native analytics |

### Hashtag Strategy
| Category | Hashtags |
|----------|----------|
| Brand | #[...] |
| Niche (high relevance) | #[...] |
| Industry (mid-volume) | #[...] |
| Trending (opportunistic) | Monitor weekly |`,

        all: `Write a complete multi-platform social campaign:

## Twitter/X Thread
[7-9 tweets, numbered, hook stops the scroll, ends with CTA]

---

## LinkedIn Post
[Hook + punchy paragraphs + engagement question + 3-5 hashtags]

---

## Instagram Caption
[Hook + story + CTA + 15 hashtags]

---

## Platform-Specific Adaptations
| Platform | What changed and why |
|----------|---------------------|
| Twitter | [Shorter, punchier, thread format] |
| LinkedIn | [Professional tone, whitespace, career angle] |
| Instagram | [Visual hook, CTA for save, hashtag strategy] |`,
    };

    emitStep('generating', `Creating ${platform} content...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${SOCIAL_EXPERT_SYSTEM_PROMPT}

Topic/Request: ${intent}
Tone: ${tone}
${trendContext ? `\nCurrent trends and viral patterns:\n${trendContext.slice(0, 600)}` : ''}

${platformPrompts[platform] ?? platformPrompts.all}

Write COMPLETE, PUBLICATION-READY content. No placeholders. Make the hook impossible to scroll past. Use specific numbers and concrete examples where relevant. Match the platform conventions exactly.`,
    });

    const content = response.text ?? '';
    emitStep('skill_result', `Social content ready — ${content.split(/\s+/).length} words`, { success: true });

    // Parse platform sections
    const posts: Record<string, string> = { all: content };
    if (platform === 'all') {
        const twitterMatch = /## Twitter[^\n]*\n([\s\S]*?)(?=\n---|\n## |$)/i.exec(content);
        const linkedinMatch = /## LinkedIn[^\n]*\n([\s\S]*?)(?=\n---|\n## |$)/i.exec(content);
        const instagramMatch = /## Instagram[^\n]*\n([\s\S]*?)(?=\n---|\n## |$)/i.exec(content);
        if (twitterMatch) posts.twitter = twitterMatch[1].trim();
        if (linkedinMatch) posts.linkedin = linkedinMatch[1].trim();
        if (instagramMatch) posts.instagram = instagramMatch[1].trim();
    }

    let savedToNotion = false;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            const t0 = Date.now();
            const notionRun = await runSkill('notion.create-page', ctx, {
                title: `Social — ${platform.toUpperCase()}: ${intent.slice(0, 70)}`,
                content,
            });
            savedToNotion = (notionRun.result as { success?: boolean }).success === true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', durationMs: Date.now() - t0, success: savedToNotion });
        } catch {
            emitStep('skill_result', 'Notion not connected — output ready', { skillId: 'notion.create-page', success: false });
        }
    }

    const workspaceUrl = await maybeSaveAgentOutputToWorkspace(content, intent, outputTarget, ctx, emitStep);
    emitStep('done', `Social content complete — ${Object.keys(posts).filter(k => k !== 'all').length || 1} platform(s)${savedToNotion ? ' — saved to Notion' : ''}${workspaceUrl ? ' — exported' : ''}`, { success: true });
    return { posts, savedToNotion, workspaceUrl };
}

export const socialAgentApp = express();
socialAgentApp.use(express.json());
socialAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(SOCIAL_AGENT_MANIFEST));
