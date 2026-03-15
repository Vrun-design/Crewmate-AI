/**
 * Support Agent — World-Class Customer Success & Support Expert
 *
 * Multi-step pipeline:
 *   1. Issue analysis & triage
 *   2. Response / playbook / FAQ generation
 *   3. Auto-notify team on high urgency (Slack)
 *   4. Save to Notion knowledge base
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import { maybeSaveAgentOutputToWorkspace, type WorkspaceOutputTarget } from './agentWorkspaceOutput';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const SUPPORT_AGENT_MANIFEST = {
    id: 'crewmate-support-agent',
    name: 'Support Agent',
    department: 'Support',
    description: 'Expert customer support and success partner — ticket triage, empathetic response drafting, FAQ generation, escalation emails, support playbooks, and CS strategy.',
    capabilities: ['ticket_triage', 'response_drafting', 'faq_generation', 'escalation', 'support_playbooks', 'cs_strategy'],
    skills: ['slack.post-message', 'notion.create-page', 'web.search'],
    model: serverConfig.geminiTextModel,
    emoji: '🎧',
};

const SUPPORT_EXPERT_SYSTEM_PROMPT = `You are a world-class VP of Customer Support and Customer Success with 12+ years building high-performing support organizations at SaaS companies. You've reduced churn by 40%, built knowledge bases used by thousands of customers, and created playbooks that scale support teams from 3 to 300.

Your support philosophy:
- Every customer interaction is a retention and expansion opportunity
- Speed and empathy solve 80% of support issues — the other 20% require expertise
- A good response acknowledges the feeling before solving the problem
- The best support is proactive: anticipate the next question and answer it
- Escalations should be rare if playbooks are good; fast if they're needed

Your response standards:
- Open by acknowledging the specific issue (not generic "Thank you for reaching out")
- Offer a direct answer or clear next step within the first 2 sentences
- Anticipate the natural follow-up question and answer it proactively
- End with a clear CTA and offer of further help
- Tone: warm, human, competent — never robotic or over-formal

Your escalation standards:
- Flag: customer mentions churn/cancel, executive involved, data loss, security issue, revenue impact
- Include: customer impact, business impact, steps to reproduce, timeline, suggested owner`;

export async function runSupportAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: {
        type?: 'response' | 'faq' | 'triage' | 'escalation' | 'playbook' | 'strategy';
        customerName?: string;
        urgency?: 'low' | 'medium' | 'high' | 'critical';
        outputTarget?: WorkspaceOutputTarget;
    } = {},
): Promise<{ output: string; priority?: string; workspaceUrl?: string }> {
    const ai = createGeminiClient();
    const { type = 'response', customerName, urgency = 'medium', outputTarget } = options;

    emitStep('thinking', 'Analyzing support request...', { detail: `${type} | urgency: ${urgency}` });

    // For playbooks and FAQs, look up best practices
    let knowledgeContext = '';
    if (type === 'playbook' || type === 'strategy') {
        emitStep('skill_call', 'Researching support best practices...', { skillId: 'web.search' });
        try {
            const t0 = Date.now();
            const r = await runSkill('web.search', ctx, {
                query: `${intent} customer support best practices playbook 2025`,
                maxResults: 3,
            });
            knowledgeContext = (r.result as { message?: string }).message ?? '';
            emitStep('skill_result', 'Best practices gathered', { skillId: 'web.search', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Research unavailable — proceeding from expertise', { skillId: 'web.search', success: false });
        }
    }

    const prompts: Record<string, string> = {
        response: `Write a world-class customer support response:

**Guidelines:**
- Start by acknowledging the SPECIFIC issue (not "Thank you for contacting us")
- Provide a direct solution or clear next steps within the first 2 sentences
- Anticipate their follow-up question and answer it proactively
- Be warm but efficient — respect their time
- End with a specific offer of further help and your name
${customerName ? `- Address the customer as: ${customerName}` : ''}

Format as a ready-to-send email or message:
\`\`\`
Subject: Re: [their likely subject line]

Hi [Name],

[Response body]

Best,
[Agent name]
\`\`\``,

        faq: `Create a customer-facing FAQ document:

## Frequently Asked Questions: [Topic]

*Format each Q&A to be:*
- *Question: exactly how a customer would phrase it — check actual search queries they use*
- *Answer: direct, max 4 sentences, links to docs if relevant*

### Getting Started
**Q:** [Question 1]
**A:** [Answer — direct, helpful, no jargon]

**Q:** [Question 2]
**A:** [...]

### [Category 2]
[Continue organically — 8-12 total Q&As, organized by logical category]

### Still have questions?
[Clear escalation path — how to contact support]`,

        triage: `Analyze this support request and provide a triage assessment:

## Triage Assessment

### Priority Classification
**Priority:** ☐ P0-Critical ☐ P1-High ☐ P2-Medium ☐ P3-Low
**Rationale:** [Why this priority — specific business/customer impact]

### Category
**Type:** ☐ Bug ☐ Feature Request ☐ How-To ☐ Billing ☐ Account ☐ Security ☐ Other
**Subcategory:** [...]

### Impact Assessment
| Dimension | Assessment |
|-----------|-----------|
| Customer impact | [Individual / Small segment / Large segment / All users] |
| Revenue risk | [None / At risk / Lost / Unknown] |
| Churn signal | [None / Yellow flag / Red flag] |
| Data integrity | [Not affected / Potentially affected / Confirmed affected] |

### Routing
**Assigned to:** [Support Tier 1 / Tier 2 / Engineering / Product / Billing / CSM]
**Escalate to:** [Manager / VP Support / Engineering lead — if needed]

### SLA
**First response by:** [Time based on priority]
**Resolution target:** [Time based on priority]

### Draft Acknowledgment
\`\`\`
Hi [Name],

Thank you for reaching out. [Acknowledge the specific issue in 1 sentence].

[If P1-P0: "This is a high priority for us and I'm escalating immediately."]
[If P2-P3: "I'm looking into this and will have an update for you by [time]."]

[Your name]
\`\`\`

### Internal Notes
[What the agent should know before diving in — account history, known issues, relevant context]`,

        escalation: `Write a comprehensive internal escalation report:

## 🚨 Escalation Report
**Priority:** ${urgency === 'critical' ? '🔴 P0 CRITICAL' : urgency === 'high' ? '🟠 P1 HIGH' : '🟡 P2 MEDIUM'}
**Reported by:** Support | **Date:** [Date] | **Customer:** ${customerName ?? '[Customer Name]'}

---

### Customer Impact
- **Account tier:** [Startup / Growth / Enterprise / Strategic]
- **MRR at risk:** $[Amount] | **ARR:** $[Amount]
- **Accounts affected:** [N users / entire workspace]
- **Time impacted:** [Since when]
- **Churn risk:** ☐ Mentioned cancellation ☐ Frustrated but retained ☐ Unclear

### Issue Description
[Clear, jargon-free description of what the customer is experiencing]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Expected result]: [...]
4. [Actual result]: [...]

### Environment
- Browser/App version: [...]
- Account ID: [...]
- Other relevant context: [...]

### Business Impact
[Revenue risk, SLA breach, reputation risk — be direct]

### What We've Tried
[Steps the support team has already attempted]

### Requested Action
**From:** [Engineering / Product / Billing / Executive team]
**Ask:** [Specific request — fix by X, join a call at Y, update roadmap priority]
**By:** [Urgency timeline]

### Customer Communication Plan
[What we've told the customer and what we plan to say next]`,

        playbook: `Create a comprehensive support playbook:

## Support Playbook: [Issue Type]
**Version:** 1.0 | **Owner:** Support Team | **Last Updated:** [Date]

---

## Quick Summary
[2-3 sentences: what this issue is, why it happens, how to spot it]

### Identification Signals
| Signal | How to spot it | What it means |
|--------|---------------|---------------|
| [Signal 1] | [...] | [...] |
| [Signal 2] | [...] | [...] |

### Automatic Escalation Triggers (stop and escalate immediately)
- 🔴 [Trigger 1 — e.g., customer mentions "cancel" or "churn"]
- 🔴 [Trigger 2 — e.g., data loss confirmed]
- 🔴 [Trigger 3 — e.g., security incident]

---

## Response Procedure

### Step 1: First Response (target: < 1 hour)
\`\`\`
Hi [Name],

Thank you for reaching out about [specific issue]. [Acknowledge the impact in 1 sentence].

I'm [investigating / looking into this / escalating to our engineering team] and will [specific next step] by [time].

[Your name]
\`\`\`

### Step 2: Investigation Checklist
- [ ] [Check 1 — what to look at in the system]
- [ ] [Check 2]
- [ ] [Check 3]

### Step 3: Resolution Paths

**Path A — [Most common root cause]**
1. [Resolution step]
2. [Resolution step]
→ Expected time to resolve: [X minutes]

**Path B — [Second most common]**
1. [Steps]
→ Expected time: [X]

**Path C — Escalate if:**
[Conditions that require escalation to Tier 2 or Engineering]

### Step 4: Resolution Confirmation
\`\`\`
Hi [Name],

I've resolved the issue by [brief description of fix]. [1 sentence on what changed or what to do differently].

Please let me know if you see anything else — happy to help.

[Your name]
\`\`\`

### Step 5: Post-Resolution
- [ ] Log root cause in bug tracker / known issues
- [ ] Update FAQ if this comes up 3+ times
- [ ] File product feedback if customer-impacting
- [ ] Follow up in 48 hours for high-priority tickets

---

## Common Questions & Answers
| Question | Answer |
|----------|--------|
| "How long will this take?" | [...] |
| "Will I be compensated?" | [...] |
| "Why did this happen?" | [...] |`,

        strategy: `Write a customer support strategy framework:

## Customer Support Strategy: [Company Name / Team]
**Author:** Crewmate AI | **Period:** [Quarter/Year]

## Vision
[Where does this support team want to be in 2 years?]

## Current State Assessment
[Honest assessment of current support quality, team size, tooling, metrics]

## Strategic Priorities
### Priority 1: [Deflection & Self-Service]
- Goal: [X% of tickets resolved without agent contact]
- How: [Knowledge base, chatbot, better docs]
- Timeline: [...]

### Priority 2: [Response Time & Quality]
- Goal: [Target metrics]
- How: [Process, tooling, training]
- Timeline: [...]

### Priority 3: [Escalation & Engineering Partnership]
- Goal: [Reduce escalation time]
- How: [Clear escalation paths, product feedback loop]

## KPI Dashboard
| Metric | Current | Target | Owner |
|--------|---------|--------|-------|
| First Response Time | [...] | [...] | [...] |
| Resolution Time (P1) | [...] | [...] | [...] |
| CSAT Score | [...] | [...] | [...] |
| Ticket Deflection Rate | [...] | [...] | [...] |
| Churn Rate from Support Issues | [...] | [...] | [...] |

## Recommended Tooling
[Current stack assessment + recommendations]

## Hiring Plan
[When to hire and what roles — based on ticket volume growth]`,
    };

    emitStep('generating', `Crafting expert ${type} response...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiTextModel,
        contents: `${SUPPORT_EXPERT_SYSTEM_PROMPT}

Issue: ${intent}
Urgency: ${urgency}
${customerName ? `Customer: ${customerName}` : ''}
${knowledgeContext ? `\nBest practices context:\n${knowledgeContext.slice(0, 500)}` : ''}

${prompts[type] ?? prompts.response}

Write the COMPLETE, READY-TO-USE output. For responses and escalations: write exactly what can be sent as-is with minimal editing. For playbooks and FAQs: every section must be complete and immediately usable.`,
    });

    const output = response.text ?? '';

    // Extract priority for triage
    let priority: string | undefined;
    if (type === 'triage') {
        const match = /P[0-3][-\s](Critical|High|Medium|Low)/i.exec(output);
        priority = match?.[0] ?? urgency;
        emitStep('skill_result', `Triaged: ${priority}`, { success: true });
    } else {
        emitStep('skill_result', `${type} complete — ${output.split(/\s+/).length} words`, { success: true });
    }

    // Auto-notify engineering on critical/high escalations
    if ((type === 'escalation' || type === 'triage') && (urgency === 'high' || urgency === 'critical')) {
        emitStep('skill_call', `🚨 Notifying team on Slack (${urgency} priority)...`, { skillId: 'slack.post-message' });
        try {
            const urgencyEmoji = urgency === 'critical' ? '🔴' : '🟠';
            const t0 = Date.now();
            await runSkill('slack.post-message', ctx, {
                text: `${urgencyEmoji} *${urgency.toUpperCase()} Support ${type === 'escalation' ? 'Escalation' : 'Triage'}*\n${customerName ? `Customer: ${customerName}\n` : ''}Issue: ${intent.slice(0, 200)}\n\nFull report in Notion.`,
            });
            emitStep('skill_result', 'Team notified on Slack', { skillId: 'slack.post-message', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Slack not connected', { skillId: 'slack.post-message', success: false });
        }
    }

    // Save playbooks and FAQs to Notion
    if (type === 'playbook' || type === 'faq' || type === 'strategy') {
        emitStep('saving', 'Saving to Notion knowledge base...', { skillId: 'notion.create-page' });
        try {
            const t0 = Date.now();
            await runSkill('notion.create-page', ctx, {
                title: `Support ${type.toUpperCase()}: ${intent.slice(0, 80)}`,
                content: output,
            });
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Notion not connected', { skillId: 'notion.create-page', success: false });
        }
    }

    const workspaceUrl = await maybeSaveAgentOutputToWorkspace(output, intent, outputTarget, ctx, emitStep);
    emitStep('done', `Support ${type} complete${workspaceUrl ? ' — exported' : ''}`, { success: true });
    return { output, priority, workspaceUrl };
}

export const supportAgentApp = express();
supportAgentApp.use(express.json());
supportAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(SUPPORT_AGENT_MANIFEST));
