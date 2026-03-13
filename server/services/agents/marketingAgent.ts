/**
 * Marketing Agent — World-Class Growth & Campaign Strategist
 *
 * Multi-step pipeline:
 *   1. Competitive & trend intelligence (web research)
 *   2. Audience & positioning analysis
 *   3. Full campaign or copy generation
 *   4. A/B variant creation
 *   5. Save to Notion
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
    description: 'Expert growth and campaign strategist — GTM plans, campaign briefs, ICP development, positioning, A/B copy, demand gen strategy, and market intelligence.',
    capabilities: ['gtm_strategy', 'campaign_briefs', 'ab_copy', 'icp_development', 'positioning', 'demand_gen', 'market_intelligence'],
    skills: ['web.search', 'notion.create-page', 'slack.post-message'],
    model: serverConfig.geminiResearchModel,
    emoji: '📣',
};

const MARKETING_EXPERT_SYSTEM_PROMPT = `You are a world-class marketing strategist with 15+ years building growth engines for top-tier B2B SaaS, consumer brands, and venture-backed startups. You've run campaigns that generated $50M+ in pipeline and built global brands from zero.

Your approach:
- Always start with the customer: deeply understand their pain, language, and decision process before writing a single word
- Strategy before tactics: define the why and who before the what and how
- Every campaign has one clear primary objective and one primary metric to optimizing toward
- Test relentlessly: every major campaign should have at least 2 headline variants and 2 CTA variants
- Distribution eats creation: even the best content fails without a clear distribution strategy

Your frameworks:
- ICP: Firmographics + technographics + psychographics + trigger events
- Positioning: For [target customer] who [need], [product] is [category] that [key benefit] unlike [alternative]
- Campaign brief: One objective, one ICP segment, one core message, one channel mix, one KPI
- A/B testing: Feature-led vs benefit-led vs urgency-led vs social-proof-led variants

Output standards:
- Campaigns: Full brief with creative concepts, channel strategy, copy examples, and success metrics
- ICP docs: Named personas with quotes, pain hierarchy, trigger events, and objection map
- Positioning: One-liner + extended narrative + competitive differentiation
- A/B copy: Minimum 3 variants testing different angles with rationale for each`;

export async function runMarketingAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'campaign' | 'social' | 'ab_copy' | 'brief' | 'gtm' | 'icp' | 'positioning'; saveToNotion?: boolean } = {},
): Promise<{ output: string; variants?: string[]; savedToNotion: boolean }> {
    const ai = createGeminiClient();
    const { type = 'brief', saveToNotion = true } = options;

    emitStep('thinking', 'Analyzing marketing challenge...', { detail: `${type} for: ${intent.slice(0, 80)}` });

    // Step 1: Competitive & trend intelligence
    emitStep('skill_call', 'Researching market landscape and competitors...', { skillId: 'web.search' });
    let marketContext = '';
    try {
        const t0 = Date.now();
        const competitiveQuery = type === 'positioning'
            ? `${intent} competitive landscape market alternatives 2025`
            : type === 'icp'
            ? `${intent} customer persona pain points buyer journey`
            : `${intent} marketing strategy best practices case studies 2025`;
        const r = await runSkill('web.search', ctx, { query: competitiveQuery, maxResults: 5 });
        marketContext = (r.result as { message?: string }).message ?? '';
        emitStep('skill_result', 'Market intelligence gathered', {
            skillId: 'web.search',
            durationMs: Date.now() - t0,
            success: true,
            detail: `${marketContext.length} chars of competitive context`,
        });
    } catch {
        emitStep('skill_result', 'Market research unavailable — working from expertise', { skillId: 'web.search', success: false });
    }

    // Step 2: Strategy framing
    emitStep('thinking', 'Developing strategic framework...', { detail: `${type} strategy` });
    const framingResponse = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${MARKETING_EXPERT_SYSTEM_PROMPT}

Before creating the deliverable, briefly define (2-3 bullets each):
- Target customer segment and their #1 pain point
- Core message / value proposition we need to land
- Primary channel and distribution strategy
- Key differentiator vs alternatives
- The ONE metric this effort must move

Request: "${intent}"
Type: ${type}
${marketContext ? `\nMarket context:\n${marketContext.slice(0, 800)}` : ''}`,
    });
    const framing = framingResponse.text ?? '';
    emitStep('thinking', 'Framework set — generating marketing assets...', { detail: framing.slice(0, 120) });

    // Step 3: Main deliverable
    const prompts: Record<string, string> = {
        campaign: `Create a COMPLETE marketing campaign brief:

## Campaign Overview
**Name:** [Memorable campaign name]
**Primary Objective:** [One clear goal: awareness / pipeline / activation / retention]
**Target Segment:** [Specific ICP description]
**Core Message:** [The ONE thing they must remember]
**Timeline:** [Campaign duration]

## Audience Intelligence
- Pain hierarchy (top 3 pains, ranked by intensity)
- Trigger events that make them ready to buy
- Key objections to address

## Creative Strategy
**Master Headline Options (3 variants):**
1. Feature-led: [...]
2. Benefit-led: [...]
3. Social-proof-led: [...]

**Visual Direction:** [Theme, mood, imagery style]
**Brand Voice Notes:** [Tone, vocabulary, things to avoid]

## Channel Mix & Tactics
| Channel | Tactic | Message Angle | Budget % | KPI |
|---------|--------|---------------|----------|-----|
| Paid Social | [...] | [...] | [...] | [...] |
| Content / SEO | [...] | [...] | [...] | [...] |
| Email | [...] | [...] | [...] | [...] |
| Events/PR | [...] | [...] | [...] | [...] |

## Copy Examples
**LinkedIn Ad:** [Full ad copy with headline + body + CTA]
**Email Subject Lines (5 options):** [...]
**Landing Page Headline + Subhead:** [...]

## Success Metrics
| Metric | Baseline | Target | Timeline |
|--------|----------|--------|----------|
| [...] | [...] | [...] | [...] |`,

        gtm: `Create a comprehensive Go-To-Market (GTM) strategy:

## Market Opportunity
- Market size (TAM / SAM / SOM)
- Key trends driving timing
- Competitive landscape snapshot

## ICP Definition
- Firmographics (company size, industry, geography)
- Trigger events (what makes them ready NOW)
- Buyer committee (champion, economic buyer, blocker)

## Positioning Statement
"For [target customer] who [need], [product] is the [category] that [key benefit]. Unlike [alternative], we [key differentiator]."

## Messaging Architecture
| Persona | Primary Pain | Key Message | Proof Point |
|---------|-------------|-------------|-------------|
| [...] | [...] | [...] | [...] |

## Channel Strategy (prioritized)
1. **[Channel 1]** — [Why this channel, how to win here]
2. **[Channel 2]** — [...]
3. **[Channel 3]** — [...]

## Launch Sequence
- Week 1-2: [Foundation]
- Week 3-4: [Launch]
- Month 2+: [Scale]

## KPIs & Milestones
[Success metrics by time horizon]`,

        icp: `Create a detailed Ideal Customer Profile (ICP) document:

## ICP Summary
[One paragraph defining the perfect customer]

## Firmographics
- Company size: [Employees, ARR range]
- Industries: [Primary + secondary]
- Geography: [...]
- Tech stack signals: [Tools they use that indicate fit]
- Growth stage: [...]

## Psychographics & Behavioral Signals
- Goals they're focused on this quarter
- Fears that keep them up at night
- How they measure success
- How they consume content and make decisions

## Named Persona: [Give them a name]
**Title:** | **Age:** | **Background:**
> "[A direct quote they might say about their biggest problem]"

**A day in their life:**
[Short narrative of their work situation]

**Pain Hierarchy:**
1. [Biggest pain — emotional + business impact]
2. [Second pain]
3. [Third pain]

**Trigger Events** (what makes them buy NOW):
- [Event 1]
- [Event 2]

**Objection Map:**
| Objection | Root Fear | Response |
|-----------|-----------|----------|
| [...] | [...] | [...] |

## Negative ICP (who NOT to sell to)
[Clear definition of bad-fit customers]`,

        positioning: `Create a comprehensive positioning strategy:

## Positioning Statement
"For [target customers] who [have this problem], [Product Name] is a [product category] that [delivers this key benefit]. Unlike [primary alternative], [product] [key differentiator]."

## Market Category
[Where do you play? Are you creating a new category or competing in an existing one?]

## Competitive Differentiation Map
| Dimension | Us | Competitor A | Competitor B |
|-----------|-----|-------------|-------------|
| [...] | ✅ [...] | ❌ [...] | ⚠️ [...] |

## Messaging Framework
**For [Persona 1]:**
- Primary message: [...]
- Proof: [...]

**For [Persona 2]:**
- Primary message: [...]
- Proof: [...]

## Brand Voice
- We are: [3 adjectives]
- We are NOT: [3 contrasting adjectives]
- We sound like: [Reference brand or archetype]

## Elevator Pitches
**10-second:** [...]
**30-second:** [...]
**2-minute investor version:** [...]`,

        ab_copy: `Write 4 A/B copy variants — each testing a different psychological angle:

## Variant A — Feature-led (What it does)
**Headline:** [...]
**Body:** (2-3 sentences covering the feature + why it matters)
**CTA:** [...]
**Test hypothesis:** [What we expect to learn]

## Variant B — Outcome-led (What you get)
**Headline:** [...]
**Body:** (focuses on the end result, not the feature)
**CTA:** [...]
**Test hypothesis:** [...]

## Variant C — Pain-led (Problem agitation)
**Headline:** [...]
**Body:** (start with the pain they feel today, then relief)
**CTA:** [...]
**Test hypothesis:** [...]

## Variant D — Social Proof-led (Others are doing it)
**Headline:** [...]
**Body:** (lead with proof — customer name, stat, or result)
**CTA:** [...]
**Test hypothesis:** [...]

## Testing Recommendation
[Which variant to run first and why, what audience each suits best]`,

        social: `Write a multi-platform social media campaign (3 posts per platform):

## LinkedIn (B2B audience)
**Post 1 — Thought Leadership:**
[Full post]

**Post 2 — Case Study/Story:**
[Full post]

**Post 3 — Product/CTA:**
[Full post]

## Twitter/X (broader audience)
**Thread 1 — Educational:**
[Full thread, numbered]

**Thread 2 — Hot take/Engagement:**
[Full thread]

## Campaign Hashtag Strategy
| Category | Hashtags |
|----------|----------|
| Branded | [...] |
| Niche | [...] |
| Broad | [...] |`,

        brief: `Write a detailed marketing brief:

## Background & Context
[What's the situation, what led to this brief]

## Business Objective
[What business outcome does this support, with metric]

## Target Audience
[Specific ICP segment, NOT "everyone"]

## Core Message
[The one thing they must remember]

## Messaging Pillars (3 max)
1. [Pillar 1 — supported by proof]
2. [Pillar 2]
3. [Pillar 3]

## Creative Direction
[Tone, visual style, what to avoid]

## Deliverables Required
[List of assets needed]

## Timeline & Budget
[...]

## Success Metrics
| KPI | Current | Target | By When |
|-----|---------|--------|---------|
| [...] | [...] | [...] | [...] |`,
    };

    emitStep('generating', `Creating ${type.replace('_', ' ')} deliverable...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${MARKETING_EXPERT_SYSTEM_PROMPT}

Strategic framing:
${framing}
${marketContext ? `\nMarket intelligence:\n${marketContext.slice(0, 600)}` : ''}

REQUEST: ${intent}

${prompts[type] ?? prompts.brief}

Write the COMPLETE, READY-TO-USE deliverable. Be specific, concrete, and immediately actionable. No generic filler.`,
    });

    const output = response.text ?? '';
    const variantsArr = type === 'ab_copy'
        ? output.split(/## Variant [A-D]/i).filter(Boolean).map((v) => v.trim())
        : undefined;

    emitStep('skill_result', `Marketing ${type} complete — ${output.split(/\s+/).length} words`, {
        success: true,
        detail: `${variantsArr?.length ?? 1} deliverable(s) created`,
    });

    let savedToNotion = false;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            const notionRun = await runSkill('notion.create-page', ctx, {
                title: `Marketing — ${type}: ${intent.slice(0, 70)}`,
                content: output,
            });
            savedToNotion = (notionRun.result as { success?: boolean }).success === true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', success: savedToNotion });
        } catch {
            emitStep('skill_result', 'Notion not connected — output ready', { skillId: 'notion.create-page', success: false });
        }
    }

    emitStep('done', `Marketing ${type} complete${savedToNotion ? ' — saved to Notion' : ''}`, { success: true });
    return { output, variants: variantsArr, savedToNotion };
}

export const marketingAgentApp = express();
marketingAgentApp.use(express.json());
marketingAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(MARKETING_AGENT_MANIFEST));
