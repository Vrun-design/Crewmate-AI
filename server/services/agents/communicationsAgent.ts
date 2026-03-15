/**
 * Communications Agent — Universe-Best Strategic Communications Expert
 *
 * Multi-step pipeline:
 *   1. Audience & context analysis
 *   2. Multi-format communication drafting (email, Slack, press release, announcement, memo, newsletter)
 *   3. Variant creation for A/B testing
 *   4. Auto-send to Slack if requested
 *   5. Save long-form comms to Notion
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import { maybeSaveAgentOutputToWorkspace, type WorkspaceOutputTarget } from './agentWorkspaceOutput';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const COMMS_AGENT_MANIFEST = {
    id: 'crewmate-communications-agent',
    name: 'Communications Agent',
    department: 'Comms',
    description: 'Strategic communications expert — executive emails, press releases, internal announcements, crisis communications, stakeholder updates, newsletters, Slack messages, and sensitive message drafting.',
    capabilities: ['executive_email', 'press_releases', 'internal_announcements', 'crisis_comms', 'stakeholder_updates', 'newsletters', 'slack_messages', 'sensitive_messaging'],
    skills: ['slack.post-message', 'slack.send-dm', 'notion.create-page'],
    model: serverConfig.geminiTextModel,
    emoji: '📧',
};

const COMMS_EXPERT_SYSTEM_PROMPT = `You are a world-class Chief Communications Officer and strategic communications expert with 15+ years leading comms at Fortune 500 companies, fast-growing startups, and in crisis situations. You've handled IPO communications, layoff announcements, product recalls, and viral PR moments — and you've done it all with clarity, empathy, and strategic precision.

Your communications philosophy:
- Every message serves a business purpose — clarity of objective is the first step before writing a single word
- Audience-first always: what does THIS person need to feel/think/do after reading this?
- Structure drives clarity: BLUF (Bottom Line Up Front) for busy executives, story arc for emotional messages, pyramid structure for press
- Tone is a strategic choice, not an accident: match the tone to the relationship, stakes, and outcome you need
- In a crisis, speed + transparency beats perfection every time

Your message frameworks:
**BLUF (executive comms):** Bottom line first, context second, ask last
**PREP (persuasive):** Point → Reason → Example → Point again
**SBI (feedback/difficult):** Situation → Behavior → Impact
**NEWS (press):** Headline → Who/What/When/Where/Why → Quote → Background
**3-3-3 (newsletter):** 3 big ideas, 3 sentences each, 3 action items

Your attention to craft:
- Subject lines: 6-8 words, specific, no "check-in" or "touching base"
- First sentence: never "I hope this email finds you well"
- CTA: one explicit ask, never buried at the end
- Length: match length to stakes — crisis gets short, strategy gets thorough
- Sensitive messages: lead with empathy before facts, acknowledge the human impact

Tone vocabulary:
- Formal: shareholders, board, legal, regulatory bodies
- Executive: C-suite, investors — direct, BLUF, data-backed
- Warm-professional: customers, partners, press — clear, human, authentic
- Internal: team, employees — honest, context-rich, two-way
- Crisis: transparent, decisive, empathetic — never defensive`;

const COMMS_FORMATS: Record<string, string> = {
    email: `Write a high-impact email:

Format as:
\`\`\`
To: [Recipient / role]
Subject: [6-8 words, specific, action-oriented or intriguing]

[BLUF / Bottom line in first 1-2 sentences]

[Context — brief, only what's necessary to understand the ask]

[Body — supporting details, structured in short paragraphs]

[Clear ask or next step — explicit, easy to act on]

[Signature]
\`\`\`

Then provide 2 alternative subject lines to A/B test.`,

    slack: `Write an effective Slack message:

**Tone guidelines:**
- No walls of text — max 3-4 short paragraphs
- Use **bold** for key points, \`code\` for technical terms
- Emoji sparingly and strategically (not every sentence)
- If update: context → what changed → what people need to do
- If announcement: lead with the big news first
- End with @mention if action needed from specific person

Write the message ready to send. Then add:
**Alternative short version:** [under 280 characters for when brevity is needed]`,

    announcement: `Write a compelling internal announcement:

\`\`\`
Subject: [Clear, scannable headline about what's changing]

Hey team, / Hi everyone,

[TL;DR — 2 sentences max on what's happening and why it matters to them]

**What's changing:**
[Specific, concrete — what is different from today]

**Why we're doing this:**
[Honest business reason — don't over-spin it]

**What this means for you:**
[Practical impact on their day-to-day]

**What happens next:**
[Timeline, who decides what, how to ask questions]

**Questions?** [Where to go, specific person or channel]

[Sign-off with appropriate warmth for the news]
\`\`\`

**If this is sensitive/bad news (layoff, org change, benefit cut):** Also provide a compassionate version that acknowledges the human impact first.`,

    press_release: `Write a publication-ready press release:

\`\`\`
FOR IMMEDIATE RELEASE / EMBARGOED UNTIL [Date/Time]

[COMPANY NAME] [DOES NEWSWORTHY THING]
[Secondary headline with key detail]

[City, Date] — [Company], [one-line description], today announced [the news in 1 clear sentence].

"[Strong executive quote — specific, forward-looking, NOT generic]" said [Name], [Title], [Company].

[Second paragraph: context — why this matters, market background, customer problem solved]

[Third paragraph: key details, numbers, specifics]

"[Customer/partner quote — specific outcome or reaction]" said [Name], [Title], [Customer Company].

[Additional context paragraph if needed]

**About [Company]**
[2-3 sentence boilerplate — crisp, current]

**Media Contact**
[Name] | [Email] | [Phone]
\`\`\`

**Social media versions:**
Twitter/X (280 chars): [...]
LinkedIn headline: [...]`,

    newsletter: `Write a compelling team or customer newsletter:

\`\`\`
Subject: [Specific, preview what's inside — not "Newsletter #12"]
Preview text: [The 1 line they read in inbox before opening]

---

👋 [Friendly opener — 1-2 sentences about this moment or what's changing]

---

## 🚀 [Big Story 1 Headline]
[3-4 sentences. What happened, why it matters, what's next.]
[CTA if any: "Read the full post →"]

## 📊 [Big Story 2 Headline] 
[3-4 sentences...]

## 🔧 [Update / What's new]
[Short bullets or a few sentences]

---

📌 **Coming up:**
- [Thing 1]
- [Thing 2]

💬 **What we're thinking about:** [1 question or thought experiment to spark conversation]

[Sign-off — warm, specific to this team]
\`\`\``,

    memo: `Write a clear internal memo:

\`\`\`
MEMO

TO: [Audience]
FROM: [Sender name & title]
DATE: [Date]
RE: [Clear topic — not vague]
CONFIDENTIALITY: [Internal / Confidential / Company-wide]

---

**SUMMARY**
[2-3 sentences: what this memo is about and what you need from the reader]

**BACKGROUND**
[Context — only what's necessary to understand the decision or situation]

**DETAILS**
[The substance — structured clearly. Use headers or bullets for complex information]

**DECISION / RECOMMENDATION**
[What has been decided or what you're recommending, and why]

**IMPLICATIONS**
[What changes, who is affected, what they need to do]

**NEXT STEPS**
| Action | Owner | Due Date |
|--------|-------|----------|
| [...] | [...] | [...] |

Questions to: [Name / channel]
\`\`\``,

    crisis: `Draft crisis communications:

**IMPORTANT: Crisis communication principles:**
- Acknowledge first, explain second — never lead with defensiveness
- Be specific about what happened and what you're doing — vague language destroys trust
- "We are investigating" is only acceptable for < 24 hours
- Never speculate about causes before confirmed
- Commit to timelines for updates

**Crisis Statement (external/press):**
\`\`\`
[Company] is aware of [specific incident — be direct]. We take this extremely seriously.

[What happened — factual, specific, no spin]

[What we're doing right now — concrete actions with verbs: "we have", "we are", "we will"]

[Timeline for next update: "We will provide an update by [specific time]"]

[Contact for press: [Name, email/phone]]
\`\`\`

**Internal Employee Message:**
\`\`\`
[Subject: Addressing [issue] — What you need to know]

I want to address [issue] directly with you before you see it externally...

[What happened — tell employees before they read it in the press]
[How it affects them]
[What leadership is doing]
[How to respond if asked by customers/press/family]
[Where to ask questions — specific channel]
\`\`\`

**Customer Communication:**
\`\`\`
[Acknowledge their impact specifically]
[What you know happened]
[What you're doing to fix it and prevent recurrence]
[Specific remediation if applicable]
[Next update timeline]
\`\`\`

**What NOT to say:** [3-4 phrases that would be disasters to include and why]`,

    dm: `Write a direct, human Slack DM or personal message:

Guidelines:
- Sound like a real person, not a corporate bot
- Be direct about the purpose — don't bury the reason for reaching out
- Match the relationship level in tone
- If following up: acknowledge the previous touch, don't pretend it didn't happen
- If sensitive: start with the relationship, not the ask

\`\`\`
Hey [Name],

[Opener that acknowledges the relationship OR the specific reason you're writing to them]

[Main substance — 2-3 sentences max]

[Clear ask or "no need to respond if this doesn't land right now"]

[Casual sign-off appropriate to the relationship]
\`\`\``,
};

export async function runCommunicationsAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: {
        channel?: 'email' | 'slack' | 'announcement' | 'press_release' | 'newsletter' | 'memo' | 'crisis' | 'dm';
        to?: string;
        tone?: string;
        context?: string;
        send?: boolean;
        outputTarget?: WorkspaceOutputTarget;
    } = {},
): Promise<{ draft: string; sent: boolean; executionResult?: unknown; workspaceUrl?: string }> {
    const {
        channel = 'email',
        to,
        tone = 'professional',
        context = '',
        send = false,
        outputTarget,
    } = options;
    const ai = createGeminiClient();

    emitStep('thinking', 'Analyzing communication goal and audience...', {
        detail: `${channel} → ${to ?? 'recipient'} | tone: ${tone}`,
    });

    // Strategy frame: who is the audience, what do we need them to feel/do?
    emitStep('thinking', 'Setting communication strategy...', { detail: intent.slice(0, 80) });
    const strategyResponse = await ai.models.generateContent({
        model: serverConfig.geminiTextModel,
        contents: `${COMMS_EXPERT_SYSTEM_PROMPT}

Before drafting, briefly define (2-3 bullets):
- Primary audience and what they care about most
- The ONE thing you need them to feel, think, or do after reading
- Tone rationale: why this tone for this audience and message?
- Any landmines or sensitive areas to navigate carefully

Communication request: "${intent}"
Channel: ${channel}
${to ? `Recipient/audience: ${to}` : ''}
${tone ? `Tone: ${tone}` : ''}
${context ? `Context: ${context}` : ''}`,
    });
    const strategy = strategyResponse.text ?? '';
    emitStep('thinking', 'Strategy set — drafting message...', { detail: strategy.slice(0, 100) });

    // Draft the communication
    const formatInstructions = COMMS_FORMATS[channel] ?? COMMS_FORMATS.email;
    emitStep('generating', `Crafting ${channel.replace('_', ' ')} message...`);

    const response = await ai.models.generateContent({
        model: serverConfig.geminiTextModel,
        contents: `${COMMS_EXPERT_SYSTEM_PROMPT}

Strategic framing:
${strategy}
${context ? `\nAdditional context:\n${context}` : ''}

REQUEST: ${intent}
${to ? `To / Audience: ${to}` : ''}
Tone: ${tone}

${formatInstructions}

Write the COMPLETE, READY-TO-SEND message. No [placeholder] text should remain where you have enough context to fill it. For sensitive messages: don't just draft the words — also add a brief "⚠️ Communication considerations" section with what to watch for in the response and any follow-up recommendations.`,
    });

    const draft = response.text ?? '';
    const wordCount = draft.split(/\s+/).length;
    emitStep('skill_result', `${channel.replace('_', ' ')} ready — ${wordCount} words`, { success: true });

    let executionResult: unknown = null;

    // Auto-send to Slack if requested
    if (send && (channel === 'slack' || channel === 'dm' || channel === 'announcement')) {
        const skillId = channel === 'dm' ? 'slack.send-dm' : 'slack.post-message';
        emitStep('skill_call', `Sending via ${skillId}...`, { skillId });
        try {
            const t0 = Date.now();
            // Extract just the message body (remove strategy wrapper)
            const messageBody = draft.replace(/^(Strategy:|Note:|⚠️ Communication considerations:)[\s\S]*$/m, '').trim();
            const run = channel === 'dm' && to
                ? await runSkill('slack.send-dm', ctx, { text: messageBody, recipientName: to })
                : await runSkill('slack.post-message', ctx, { text: messageBody });
            executionResult = run.result;
            emitStep('skill_result', 'Message sent successfully', { skillId, durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Slack not connected — draft ready to copy', { skillId, success: false });
        }
    }

    // Save longer-form communications to Notion
    if (channel === 'press_release' || channel === 'newsletter' || channel === 'memo' || channel === 'crisis' || wordCount > 200) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            const t0 = Date.now();
            await runSkill('notion.create-page', ctx, {
                title: `Comms — ${channel.replace('_', ' ').toUpperCase()}: ${intent.slice(0, 70)}`,
                content: draft,
            });
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Notion not connected — output ready', { skillId: 'notion.create-page', success: false });
        }
    }

    const workspaceUrl = await maybeSaveAgentOutputToWorkspace(draft, intent, outputTarget, ctx, emitStep);
    emitStep('done', `${send && executionResult ? '✅ Message sent' : '✅ Draft ready'} — ${wordCount} words${workspaceUrl ? ' — exported' : ''}`, { success: true });
    return { draft, sent: send && executionResult !== null, executionResult, workspaceUrl };
}

export const communicationsAgentApp = express();
communicationsAgentApp.use(express.json());
communicationsAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(COMMS_AGENT_MANIFEST));
