/**
 * Product Agent — World-Class Senior Product Manager
 *
 * Multi-step pipeline:
 *   1. Market & competitive research
 *   2. User story / PRD / spec generation with full structure
 *   3. Auto-create ClickUp task + Notion page
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import { maybeSaveAgentOutputToWorkspace, type WorkspaceOutputTarget } from './agentWorkspaceOutput';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const PRODUCT_AGENT_MANIFEST = {
    id: 'crewmate-product-agent',
    name: 'Product Agent',
    department: 'Product',
    description: 'Expert product manager — PRDs, user stories, feature specs, sprint planning, competitive analysis, roadmap strategy, and opportunity assessment for shipping great products.',
    capabilities: ['prd', 'user_stories', 'feature_specs', 'sprint_planning', 'competitive_analysis', 'roadmap', 'opportunity_assessment'],
    skills: ['clickup.create-task', 'notion.create-page', 'web.search'],
    model: serverConfig.geminiResearchModel,
    emoji: '🗂️',
};

const PRODUCT_EXPERT_SYSTEM_PROMPT = `You are a world-class Senior Product Manager and product strategist with 12+ years shipping high-impact products at companies ranging from fast-moving startups to scaled platforms. You've shipped products used by millions and built roadmaps that drove 10x growth.

Your product philosophy:
- Fall in love with the problem, not the solution
- Ruthless prioritization: say NO to 9 out of 10 good ideas so you can go deep on the best one
- Every feature must have: a clear user pain, a measurable success metric, and a clear MVP scope
- Good engineering partnership starts with understanding technical constraints BEFORE writing the spec
- The best PRD is the one the team actually reads: scannable, concrete, no fluff

Your frameworks:
- Opportunity sizing: Job-to-be-done + frequency + intensity + willingness to pay
- Prioritization: RICE (Reach x Impact x Confidence / Effort) or ICE for quick decisions
- User stories: As a [specific persona], I want [goal] so that [measurable benefit]
- Feature briefs: Problem → Evidence → Solution → Metric → Risk
- Roadmap: Now (this quarter) / Next (next quarter) / Later (6+ months)

Output standards:
- PRDs: 2-5 pages, scannable, no ambiguity on scope, includes what's OUT of scope
- User stories: Specific enough that a developer can estimate, testable acceptance criteria
- Specs: Design callouts, API contract notes, edge cases, error states
- All docs include success metrics — if you can't measure it, don't build it`;

export async function runProductAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'user_story' | 'prd' | 'sprint' | 'spec' | 'roadmap' | 'competitive' | 'brief'; createTicket?: boolean; outputTarget?: WorkspaceOutputTarget } = {},
): Promise<{ output: string; ticketCreated: boolean; workspaceUrl?: string }> {
    const ai = createGeminiClient();
    const { type = 'prd', createTicket = true, outputTarget } = options;

    emitStep('thinking', 'Analyzing product challenge...', { detail: `${type}: ${intent.slice(0, 80)}` });

    // Research: competitors, user pain, market context
    let productContext = '';
    if (type === 'prd' || type === 'competitive' || type === 'roadmap') {
        emitStep('skill_call', 'Researching market and competitive landscape...', { skillId: 'web.search' });
        try {
            const t0 = Date.now();
            const query = type === 'competitive'
                ? `${intent} competitive analysis alternatives comparison 2025`
                : `${intent} user pain points product requirements best practices`;
            const r = await runSkill('web.search', ctx, { query, maxResults: 4 });
            productContext = (r.result as { message?: string }).message ?? '';
            emitStep('skill_result', 'Market context gathered', {
                skillId: 'web.search',
                durationMs: Date.now() - t0,
                success: true,
            });
        } catch {
            emitStep('skill_result', 'Research unavailable — proceeding from expertise', { skillId: 'web.search', success: false });
        }
    }

    const prompts: Record<string, string> = {
        user_story: `Write detailed user stories with full acceptance criteria:

## Feature: [Feature Name]
**Epic:** [Parent epic this belongs to]
**Priority:** [P0 / P1 / P2]

### Story 1
**As a** [specific user persona with context]
**I want** [specific, concrete action]
**So that** [measurable business or user benefit]

**Acceptance Criteria:**
- [ ] Given [context], when [action], then [expected outcome + observable behavior]
- [ ] [Edge case handled]
- [ ] [Error state handled]

**Out of scope for this story:**
- [What explicitly NOT to build]

**Dependencies:** [What must ship first]
**Estimated effort:** [S / M / L / XL with brief rationale]
**Success metric:** [How we know this story is achieving its goal]

[Repeat for additional related stories — aim for 3-5 that tell the full user journey]

### Story Map Summary
| Story | Priority | Effort | Dependency | Metric |
|-------|----------|--------|-----------|--------|
| [...] | [...] | [...] | [...] | [...] |`,

        prd: `Write a comprehensive Product Requirements Document:

## [Feature/Product Name] — PRD
**Status:** Draft | **Version:** 1.0 | **Author:** | **Last Updated:** [Date]
**Squad:** | **Target Release:** [Quarter/Sprint]

---

## TL;DR
[3-sentence executive summary — problem, solution, expected impact]

## Problem Statement
**The core problem:** [What specific user pain are we solving?]
**Who has this problem:** [Specific user segment — not "all users"]
**Evidence this matters:**
- [Data point / user quote / support ticket volume]
- [Business impact of NOT solving this]

**Current workarounds:** [How do users solve this today? Why is it bad?]

## Opportunity Sizing
- **Affected users:** [N users / X% of DAU]
- **Frequency:** [How often is this pain felt?]
- **Business value:** [Revenue risk, retention impact, NPS driver]
- **RICE Score:** Reach [N] × Impact [1-3] × Confidence [%] ÷ Effort [weeks]

## Proposed Solution

### What We're Building (In Scope)
[Clear, concrete description of the solution — include a simple user flow in numbered steps]

**User Flow:**
1. User [action]
2. System [response]
3. User [next action]
4. [Continue until task complete]

### Explicitly Out of Scope
- [Thing 1 we ARE NOT building in this version]
- [Thing 2]

### Why This Approach
[Brief rationale — alternatives considered and why rejected]

## Technical Notes
- [Key architecture decisions or constraints to flag]
- [API or data dependencies]
- [Performance requirements]
- [Security / compliance considerations]

## Design Requirements
- [UX principles or constraints]
- [Accessibility requirements]
- [Mobile/responsive requirements]

## Launch Plan
**MVP Scope:** [What's the minimum viable version?]
**Rollout:** [Feature flag / % rollout / full launch]

## Success Metrics
| Metric | Baseline | 30-day Target | 90-day Target |
|--------|----------|--------------|--------------|
| [Primary metric] | [...] | [...] | [...] |
| [Secondary metric] | [...] | [...] | [...] |

## Risk & Open Questions
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| [...] | High/Med/Low | High/Med/Low | [...] |

**Open questions** (must resolve before dev starts):
- [ ] [Question 1]
- [ ] [Question 2]`,

        spec: `Write a detailed technical feature specification:

## [Feature Name] — Technical Spec
**PM:** | **Tech Lead:** | **Designer:** | **Target Sprint:**

## Overview
[What this feature does — 2-3 sentences from a user perspective]

## User Flows

### Flow 1: [Main happy path]
**Entry point:** [How user gets here]
1. User [action]
   - **UI:** [What they see]
   - **System:** [What happens behind the scenes]
   - **API:** POST/GET [endpoint] with [payload]
2. [Continue...]
**End state:** [What success looks like]

### Flow 2: [Error / edge case]
[Same structure for error and edge cases]

## API Contract

### Endpoint: [METHOD] [/path]
**Request:**
\`\`\`json
{
  "field": "type — description"
}
\`\`\`
**Response (200):**
\`\`\`json
{
  "field": "type"  
}
\`\`\`
**Error responses:**
- 400: [Validation error — when this happens]
- 401: [Auth error]
- 404: [Not found]

## State Machine / Data Model
[Diagram or table of all states and transitions]

## Edge Cases & Error States
| Scenario | Expected Behavior |
|----------|------------------|
| [Edge case 1] | [...] |
| [Edge case 2] | [...] |

## Testing Requirements
- Unit tests: [What to cover]
- Integration tests: [What to cover]
- E2E tests: [Key user flows to cover]

## Analytics Events
| Event | Trigger | Properties |
|-------|---------|-----------|
| [...] | [...] | {...} |`,

        sprint: `Create a comprehensive sprint plan:

## Sprint [Number] Plan
**Sprint Goal:** [One clear, compelling sentence about what "done" looks like]
**Dates:** [Start] → [End] | **Capacity:** [N story points / N team member-days]

## Sprint Backlog

### Must Have (P0 — sprint fails without these)
| Story | Points | Owner | Dependencies |
|-------|--------|-------|-------------|
| [...] | [...] | [...] | [...] |

### Should Have (P1 — include if capacity allows)
| Story | Points | Owner | Dependencies |
|-------|--------|-------|-------------|
| [...] | [...] | [...] | [...] |

### Nice to Have (P2 — pull in if sprint is smooth)
| Story | Points | Owner | Dependencies |
|-------|--------|-------|-------------|
| [...] | [...] | [...] | [...] |

## Risk Flags
🔴 [Critical risk — could derail the sprint]
🟡 [Medium risk — keep an eye on]
🟢 [Low risk — monitor]

## Definition of Done
- [ ] Code reviewed and approved
- [ ] Unit tests written and passing
- [ ] Product demo approved
- [ ] Analytics events firing
- [ ] Deployed to staging

## Daily Standup Questions
1. What did you complete since last standup?
2. What are you working on today?
3. Any impediments?

## Sprint Ceremonies
| Ceremony | When | Duration | Goal |
|----------|------|----------|------|
| Planning | [Day/Time] | 2h | [This doc] |
| Daily standup | Daily [time] | 15min | Surface blockers |
| Mid-sprint check | [Day] | 30min | Scope adjustment |
| Demo | [Day] | 1h | Stakeholder alignment |
| Retro | [Day] | 1h | Continuous improvement |`,

        competitive: `Write a comprehensive competitive analysis:

## Competitive Analysis: [Product/Feature Area]
**Date:** [Date] | **Analyst:** Crewmate AI

## Market Overview
[3-4 sentences on market size, trajectory, and dynamics]

## Competitor Matrix
| Dimension | [Us] | [Competitor A] | [Competitor B] | [Competitor C] |
|-----------|------|------------|------------|------------|
| Price | [...] | [...] | [...] | [...] |
| [Feature 1] | ✅ | ❌ | ⚠️ | ✅ |
| [Feature 2] | ⚠️ | ✅ | ✅ | ❌ |
| Target market | [...] | [...] | [...] | [...] |

## Deep Dives

### [Competitor A]
**Positioning:** [...]
**Strengths:** [...]
**Weaknesses:** [...]
**Their best customers say:** [...]
**Their frustrated customers say:** [...]
**Pricing model:** [...]

[Repeat for each major competitor]

## Strategic Takeaways
**Where we win:** [Our clear advantages]
**Where we lose:** [Honest assessment of gaps]
**White space:** [What nobody is doing well that we could own]

## Recommendations
1. [Priority recommendation with rationale]
2. [...]`,

        roadmap: `Create a strategic product roadmap:

## Product Roadmap: [Product / Team Name]
**Vision:** [Where this product is going in 2-3 years]
**Mission for this roadmap:** [What we're optimizing for this period]

## Roadmap Themes
[3-5 strategic themes that organize the work — not features, themes]

## Now (This Quarter)
| Initiative | Theme | Impact | Effort | Owner | Status |
|-----------|-------|--------|--------|-------|--------|
| [...] | [...] | High/Med/Low | [weeks] | [...] | 🟡 In progress |

## Next (Next Quarter)  
[Same table — these are committed but not started]

## Later (6+ Months)
[Same table — directional, subject to change]

## Intentionally NOT on the roadmap
[Be explicit about what you decided NOT to build and why]

## Key Milestones
| Milestone | Date | Success Criteria |
|-----------|------|-----------------|
| [...] | [...] | [...] |

## Dependencies & Risks
| Dependency | Owner | Due | Risk if late |
|-----------|-------|-----|------------|
| [...] | [...] | [...] | [...] |`,

        brief: `Write a product opportunity brief:

## Opportunity: [Feature/Initiative Name]
**Submitted by:** | **Date:** | **Priority Request:** High/Med/Low

## The Problem
[Describe the user pain in 2-3 sentences from the user's perspective. Use their language.]

## Evidence
- **Data:** [Metric, number, or frequency that quantifies the problem]
- **User signal:** "[Direct quote from a user interview or support ticket]"
- **Business impact:** [Revenue or retention impact of NOT solving this]

## Proposed Direction (not a spec — just a direction)
[2-3 sentences on the general approach, as a starting point for team discussion]

## Success Looks Like
[How will we know we solved the problem? Specific metric + timeframe]

## Rough Sizing
- **Affected users:** [N users]
- **Estimated effort:** [XS / S / M / L / XL]
- **Priority score (RICE):** R[N] × I[1-3] × C[%] ÷ E[weeks] = [score]

## Open Questions
- [Question 1]
- [Question 2]`,
    };

    emitStep('generating', `Writing ${type.replace('_', ' ')}...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${PRODUCT_EXPERT_SYSTEM_PROMPT}

${productContext ? `\nMarket & competitive context:\n${productContext.slice(0, 800)}` : ''}

REQUEST: ${intent}

${prompts[type] ?? prompts.prd}

Write the COMPLETE document. Be specific and concrete — fill in plausible specifics based on context. Make it immediately usable by an engineering team. Avoid generic filler.`,
    });

    const output = response.text ?? '';
    emitStep('skill_result', `${type} complete — ${output.split(/\s+/).length} words`, { success: true });

    // Create ticket + save to Notion
    let ticketCreated = false;
    if (createTicket) {
        // Try ClickUp first
        emitStep('skill_call', 'Creating task tracking entry...', { skillId: 'clickup.create-task' });
        try {
            const t0 = Date.now();
            await runSkill('clickup.create-task', ctx, {
                name: `[${type.toUpperCase()}] ${intent.slice(0, 90)}`,
                description: output.slice(0, 2000),
                priority: 2,
            });
            ticketCreated = true;
            emitStep('skill_result', 'ClickUp task created', { skillId: 'clickup.create-task', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'ClickUp not connected — saving to Notion', { skillId: 'clickup.create-task', success: false });
        }

        // Always also save to Notion as source of truth
        try {
            emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
            const t0 = Date.now();
            const notionRun = await runSkill('notion.create-page', ctx, {
                title: `Product — ${type.toUpperCase()}: ${intent.slice(0, 70)}`,
                content: output,
            });
            if (!ticketCreated) ticketCreated = (notionRun.result as { success?: boolean }).success === true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Notion not connected', { skillId: 'notion.create-page', success: false });
        }
    }

    const workspaceUrl = await maybeSaveAgentOutputToWorkspace(output, intent, outputTarget, ctx, emitStep);
    emitStep('done', `Product ${type} complete${ticketCreated ? ' — task created and saved' : ''}${workspaceUrl ? ' — exported' : ''}`, { success: true });
    return { output, ticketCreated, workspaceUrl };
}

export const productAgentApp = express();
productAgentApp.use(express.json());
productAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(PRODUCT_AGENT_MANIFEST));
