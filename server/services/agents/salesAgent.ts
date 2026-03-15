/**
 * Sales Agent — World-Class Enterprise Sales Strategist
 *
 * Multi-step pipeline:
 *   1. Lead / company intelligence research (web)
 *   2. Personalized outreach, sequences, or battle cards generation
 *   3. Save to Notion
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import { maybeSaveAgentOutputToWorkspace, type WorkspaceOutputTarget } from './agentWorkspaceOutput';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';
import { buildAgentSystemPrompt } from '../agentPromptBuilder';

export const SALES_AGENT_MANIFEST = {
    id: 'crewmate-sales-agent',
    name: 'Sales Agent',
    department: 'Sales',
    description: 'Expert enterprise sales strategist — personalized outreach, multi-touch sequences, discovery call guides, competitive battle cards, objection handling, and pipeline acceleration.',
    capabilities: ['personalized_outreach', 'email_sequences', 'discovery_guides', 'battle_cards', 'objection_handling', 'pipeline_acceleration', 'proposal_drafting'],
    skills: ['web.search', 'browser.extract', 'notion.create-page'],
    model: serverConfig.geminiResearchModel,
    emoji: '💼',
};

const SALES_EXPERT_SYSTEM_PROMPT = `You are a world-class enterprise sales strategist and senior Account Executive with 15+ years closing seven and eight-figure deals at SaaS companies. You've led teams that built $100M+ pipelines and maintained 120%+ quota attainment consistently.

Your sales philosophy:
- Never spray and pray — every outreach should feel like it was written only for that person
- Sell the outcome, not the feature — nobody buys software, they buy the result it produces
- Qualification first, pitch second — a bad deal closed is worse than no deal at all
- Objections are buying signals — handle them with curiosity, not defense
- Deals die in the middle — be more disciplined about multi-threading and champion building

Your outreach principles:
- Research the person specifically: their role changes, company news, LinkedIn posts, funding events
- The subject line's only job is to get the email opened — make it specific and intriguing
- First line must NOT be about you — acknowledge something real about their world
- Your pitch comes in sentence 3 or 4, only after showing you understand their context
- One CTA per email — never give people a choice or you get no response

Your sequences:
- Email 1 (Day 1): The relevance hook — why them, why now
- Email 2 (Day 3): The challenger insight — teach them something valuable
- Email 3 (Day 7): Social proof — a similar company's outcome
- Email 4 (Day 14): The break-up email — moves them to respond or close the loop

Output standards: write outreach that an AE can send immediately with minimal editing`;

export async function runSalesAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { leadName?: string; company?: string; sendEmail?: boolean; type?: 'outreach' | 'sequence' | 'discovery' | 'battlecard' | 'objection' | 'proposal'; outputTarget?: WorkspaceOutputTarget } = {},
): Promise<{ research: string; email: string; sent: boolean; workspaceUrl?: string }> {
    const ai = createGeminiClient();
    const { leadName, company, type = 'outreach', outputTarget } = options;

    emitStep('thinking', 'Analyzing sales context...', { detail: `${type}: ${company ?? leadName ?? intent.slice(0, 60)}` });

    // Deep lead/company research
    let research = '';
    const searchTarget = [company, leadName].filter(Boolean).join(' ') || intent;
    emitStep('skill_call', `Researching ${searchTarget}...`, { skillId: 'web.search' });
    try {
        const t0 = Date.now();
        const queries = [
            `${searchTarget} company news funding announcements 2025`,
        ];
        const r = await runSkill('web.search', ctx, { query: queries[0], maxResults: 5 });
        research = (r.result as { message?: string }).message ?? '';
        emitStep('skill_result', 'Lead intelligence gathered', {
            skillId: 'web.search',
            durationMs: Date.now() - t0,
            success: true,
            detail: `${research.length} chars of intelligence`,
        });
    } catch {
        emitStep('skill_result', 'Research unavailable — proceeding from intent context', { skillId: 'web.search', success: false });
    }

    const prompts: Record<string, string> = {
        outreach: `Write a hyper-personalized cold outreach email:

**Guidelines:**
- Subject line: specific to something real about them (not generic "quick question")
- First line: acknowledge something specific about their company, role, or recent news (reference research)
- No more than 3 short paragraphs total
- Pitch in sentence 3-4 only — not sentence 1
- ONE clear, low-commitment CTA (15-30 min call, not a demo)
- Avoid: "I hope this finds you well", "I wanted to reach out", "We help companies like yours"

---
Subject: [...]
Hi [${leadName ?? 'Name'}],

[First line — specific reference to something real about them or their company]

[2-3 sentences: make it about their world and problem, then introduce the connection to what we do and what outcome a similar company got]

[CTA — one specific action, easy to say yes to]

[Signature]`,

        sequence: `Write a complete 4-email outreach sequence:

## Email 1 — Day 1: The Relevance Hook
**Subject:** [Specific to their situation/news]
**Body:**
[Personalized — references specific context about them]
[Bridge to your value proposition in 1 sentence]
[CTA: specific low-commitment ask]

## Email 2 — Day 3: The Challenger Insight
**Subject:** [Something that teaches them something valuable]
**Body:**
[Open with a provocative stat or insight relevant to their industry]
[Connect insight to a problem you solve]
[Reference: "We saw this happen with [similar company]"]
[CTA: "Worth a quick 20 min to explore?"]

## Email 3 — Day 7: Social Proof
**Subject:** [How [Similar Company] [Achieved Outcome]]
**Body:**
[Lead with a specific customer story — outcome, not features]
["You might be facing something similar with [their situation]."]
[CTA: "Happy to share how we did it — quick call?"]

## Email 4 — Day 14: The Break-Up
**Subject:** [Should I close your file?] or [Is now just bad timing?]
**Body:**
[Acknowledge you've reached out a few times]
["I don't want to keep interrupting if this isn't relevant."]
["If [problem they have] comes up later, I'll be here."]
["Any chance you'd mind sharing what you're working on instead? Always happy to help even if it's not with us."]

## LinkedIn Connection Request (parallel)
[30-word max personalized note for LinkedIn]

## Call Script (if they accept)
**Opening:** [...]
**Discovery questions:** [3-4 questions to qualify]
**Pivot to pitch:** [When and how to introduce the product]`,

        discovery: `Write a comprehensive discovery call guide:

## Discovery Call Guide: [Product/Market]

### Pre-Call Prep (10 min before)
- [ ] Review their LinkedIn + company news
- [ ] Check CRM for any previous touches
- [ ] Identify: what do I need to learn to know if this is a good fit?
- [ ] Prepare hypothesis: "I think they might be struggling with [X] because [Y]"

### Opening (2-3 min)
[Script for building rapport, setting agenda, getting them to talk]
"I did some research on [Company] before we chatted — I saw [specific thing]. I'm curious, is [problem] something you're actively working on?"

### Discovery Questions
**Company & Context:**
- "What's driving growth at [Company] right now?"
- "What does [their role] focus on most this quarter?"

**Problem & Pain:**
- "What's causing [problem you solve] to be a challenge for you today?"
- "What have you tried to solve it, and where have those approaches fallen short?"
- "How is this affecting [metric — revenue, team productivity, customer retention]?"

**Priority & Urgency:**
- "Is this something on your list for this quarter, or is it more future-looking?"
- "What happens if this doesn't get solved in the next 6 months?"

**Budget & Process:**
- "When you've bought tools like this before, how did you approach it?"
- "Is there a defined budget for this kind of initiative?"
- "Who else would be involved in a decision like this?"

### Qualification Summary (MEDDIC)
| Element | What to Learn |
|---------|---------------|
| Metrics | What numbers will improve? |
| Economic Buyer | Who approves the spend? |
| Decision Criteria | How do they choose? |
| Decision Process | What steps to get to yes? |
| Identify Pain | What's the real consequence of not solving this? |
| Champion | Who will fight for this internally? |

### Pitch (only if qualified)
[How to introduce the product after qualification — outcome-led, not feature-led]

### Next Step Script
"Based on what you've shared, I think [product] could specifically help with [their specific problem] — similar to what we did for [reference customer] who achieved [outcome]. 
Does it make sense to set up a [30-min technical deep dive / custom demo] to see how this would work specifically for your situation?"

### Objection Handling
| Objection | What it really means | Response |
|-----------|---------------------|----------|
| "We're too busy right now" | Not a priority, no champion | "Totally understand — when does the [problem] become more pressing?" |
| "We're happy with our current solution" | Not aware of the gap | "That's great — out of curiosity, how do you currently handle [specific pain point]?" |
| "Send me some information" | Want to end the call politely | "Of course — so I can send something actually relevant, can I ask: what specifically are you trying to solve?" |
| "It's too expensive" | Haven't quantified the value | "I hear you. Let me ask — what's the cost of NOT solving [problem] per month?" |`,

        battlecard: `Create a comprehensive competitive battle card:

## Battle Card: [Our Product] vs [Competitor]

### 30-Second Differentiation
[One paragraph: what we beat them on, when we win, when they win]

### Where We Win
| Dimension | Us | Them | Proof Point |
|-----------|-----|------|-------------|
| [Strength 1] | ✅ [Feature/outcome] | ❌ [Their gap] | [Customer quote or data] |
| [Strength 2] | ✅ [...] | ❌/⚠️ [...] | [...] |
| [Strength 3] | ✅ [...] | ❌/⚠️ [...] | [...] |

### Where They Win (be honest — credibility with prospects)
| Dimension | Their strength | Our position |
|-----------|--------------|-------------|
| [Their advantage] | [...] | [How to address: reframe, trap question, redirect] |

### Common Objections in Competitive Deals
| When prospect says... | It really means... | Your response |
|----------------------|-------------------|---------------|
| "[Their product] is cheaper" | [...] | [...] |
| "We already use [competitor] for X" | [...] | [...] |
| "They have [specific feature] you don't" | [...] | [...] |

### Trap Questions (steer evaluation to our strengths)
[3-4 questions to ask that reveal gaps in the competitor's offering without directly attacking them]

### Champions' Internal Sell for Our Product
[The narrative a champion should use when selling us internally against this competitor]

### Deal Signals (when you're likely losing to this competitor)
- [Signal 1]
- [Signal 2]

### Deal Signals (when you're winning)
- [Signal 1]
- [Signal 2]`,

        objection: `Create an objection handling playbook:

## Objection Handling Guide

### The Objection Framework: LAER
1. **Listen** — let them finish without interrupting
2. **Acknowledge** — validate their concern before addressing it
3. **Explore** — ask a clarifying question to understand the root cause
4. **Respond** — address the real concern, not just the surface objection

---

### Price Objections
**"It's too expensive"**
- Root cause: Value not clearly established
- Acknowledge: "I hear that — budget is always a real constraint."
- Explore: "Help me understand — what would make the price feel right? Is it the total cost, or is it about certainty of ROI?"
- Respond: [ROI reframe, ROI calculator, payment terms, phased approach]

**"We can't get budget right now"**
- Root cause: Not a priority, or wrong buyer contacted
- Acknowledge + Explore: "That makes sense — is this more of a timing issue, or is it that this initiative isn't in the budget plan?"
- Respond: [Future pipeline if timing, escalate to economic buyer if priority issue]

### Timing Objections
[Same LAER structure for timing objections]

### Competitor Objections
[Same LAER structure — reference battle card]

### Trust & Risk Objections
**"You're too small / we've never heard of you"**
**"What happens if your company doesn't exist in 2 years?"**
[LAER responses]

### Stakeholder Objections
**"I need to check with [my boss / IT / legal / procurement]"**
[How to multi-thread without undermining the champion]

### "Send me information" (avoidance objection)
[The art of keeping the conversation going without being pushy]`,

        proposal: `Write a compelling sales proposal:

## Proposal for [Company Name]
**Prepared by:** [Your Name/Company] | **Date:** [Date] | **Opportunity:** [Deal name]
**Confidential — Prepared exclusively for [Contact Name]**

---

## Executive Summary
[3-4 sentences: what they told us, what we propose, what outcome they'll get, why now]

## Their Situation (as we understand it)
[Summarize the key pain points and context from discovery — show them you listened]

**Current challenges:**
- [Challenge 1 — their words, not yours]
- [Challenge 2]

**Business impact of these challenges:**
[Quantify the cost of the problem — in their metric, not yours]

## Our Proposed Solution

### What We'll Do
[Clear description of what you're delivering — specific, not vague]

### How It Works
[Simple numbered steps of the engagement or implementation]

### Timeline
| Milestone | Date |
|-----------|------|
| Contract signed | [Date] |
| Onboarding begins | [Date] |
| First value delivered | [Date] |
| Full deployment | [Date] |

## Expected Outcomes
| Metric | Current | Projected Improvement | Timeframe |
|--------|---------|----------------------|-----------|
| [Their key metric] | [...] | [...] | [...] |
| [Secondary metric] | [...] | [...] | [...] |

**ROI Summary:** Based on [methodology], we project [outcome] in [timeframe], representing [X]x return on your investment.

## Investment
| Package | Annual Investment | Monthly |
|---------|-----------------|---------|
| [Package name] | $[...] | $[...] |

[What's included — clear scope]
[What's not included — clear exclusions]

## Why [Your Company]
- [Differentiator 1 — specific to their evaluation criteria]
- [Differentiator 2]
- [Relevant customer story: "[Customer] achieved [result]"]

## Next Steps
1. [Specific action] — [Owner] by [Date]
2. [Legal review] — [Owner] by [Date]
3. [Contract signature] — [Date]

**Questions?** [Contact details]`,
    };

    emitStep('generating', `Crafting personalized ${type}...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        config: { systemInstruction: buildAgentSystemPrompt('sales') },
        contents: `${SALES_EXPERT_SYSTEM_PROMPT}

${leadName ? `Lead name: ${leadName}` : ''}
${company ? `Company: ${company}` : ''}
${research ? `\nResearch intelligence:\n${research.slice(0, 800)}` : ''}

REQUEST: ${intent}

${prompts[type] ?? prompts.outreach}

Write the COMPLETE, READY-TO-SEND output. For outreach: make it feel like it was written only for this specific person. Use any real details from the research. Be specific — no [placeholder] should remain that references information you have.`,
    });

    const email = response.text ?? '';
    emitStep('skill_result', `${type} complete — ${email.split(/\s+/).length} words`, { success: true });

    // Save sequences and battle cards to Notion
    if (type === 'sequence' || type === 'battlecard' || type === 'discovery' || type === 'proposal') {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            const t0 = Date.now();
            await runSkill('notion.create-page', ctx, {
                title: `Sales — ${type.toUpperCase()}: ${company ?? leadName ?? intent.slice(0, 70)}`,
                content: email,
            });
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Notion not connected — output ready', { skillId: 'notion.create-page', success: false });
        }
    }

    const workspaceUrl = await maybeSaveAgentOutputToWorkspace(email, intent, outputTarget, ctx, emitStep);
    emitStep('done', `Sales ${type} complete${workspaceUrl ? ' — exported' : ''}`, { success: true });
    return { research, email, sent: false, workspaceUrl };
}

export const salesAgentApp = express();
salesAgentApp.use(express.json());
salesAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(SALES_AGENT_MANIFEST));
