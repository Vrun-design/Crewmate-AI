/**
 * HR Agent — World-Class People Operations Expert
 *
 * Multi-step pipeline:
 *   1. Role/context analysis
 *   2. Market benchmarking (web research)
 *   3. Document generation with expert structure
 *   4. Save to Notion
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const HR_AGENT_MANIFEST = {
    id: 'crewmate-hr-agent',
    name: 'HR Agent',
    department: 'People',
    description: 'Expert people operations partner — job descriptions, structured interview guides, offer letters, 30-60-90 onboarding plans, performance frameworks, compensation benchmarking, culture docs, and HR policy drafting.',
    capabilities: ['job_descriptions', 'interview_guides', 'offer_letters', 'onboarding_plans', 'performance_frameworks', 'comp_benchmarking', 'culture_docs', 'hr_policies'],
    skills: ['notion.create-page', 'web.search', 'clickup.create-task'],
    model: serverConfig.geminiResearchModel,
    emoji: '👥',
};

const HR_EXPERT_SYSTEM_PROMPT = `You are a world-class Head of People and HR Business Partner with 15+ years scaling teams from 10 to 1,000+ at fast-growing startups and enterprise companies. You've built world-class talent acquisition pipelines, performance systems, and cultures that people fight to join.

Your HR philosophy:
- Hiring is the highest-leverage activity in a company — one A-player is worth 3 B-players
- Structure removes bias: every interview must have a rubric, not just a gut feel
- Onboarding determines 6-month retention: the first 30 days are critical
- Culture is written in behavior, not values posters
- Compensation philosophy: pay for the role and the market, not for the person's history

Your output standards:
- Job descriptions: compelling enough to attract A-players, specific enough to repel bad fits
- Interview guides: structured with scoring rubrics, behavioral + situational + technical questions
- Offer letters: professional, warm, complete with all components
- Onboarding plans: day-by-day for week 1, weekly for month 1, milestone-based for months 2-3
- Performance reviews: self-assessment + manager evaluation + forward-looking development
- Policies: legally aware, clear, enforceable, and human`;

export async function runHRAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'jd' | 'interview' | 'offer' | 'onboarding' | 'review' | 'policy' | 'culture'; role?: string; saveToNotion?: boolean } = {},
): Promise<{ output: string; savedToNotion: boolean }> {
    const ai = createGeminiClient();
    const { type = 'jd', role, saveToNotion = true } = options;

    emitStep('thinking', `Preparing expert ${type} for: ${role ?? intent.slice(0, 60)}...`);

    // Market benchmarking research
    let benchmarkContext = '';
    if (type === 'jd' || type === 'offer' || type === 'review') {
        emitStep('skill_call', 'Researching market benchmarks...', { skillId: 'web.search' });
        try {
            const t0 = Date.now();
            const query = type === 'jd'
                ? `${role ?? intent} job description requirements skills 2025`
                : type === 'offer'
                ? `${role ?? intent} compensation salary range benefits 2025`
                : `performance review framework best practices ${role ?? intent} 2025`;
            const r = await runSkill('web.search', ctx, { query, maxResults: 3 });
            benchmarkContext = (r.result as { message?: string }).message ?? '';
            emitStep('skill_result', 'Market benchmarks gathered', {
                skillId: 'web.search',
                durationMs: Date.now() - t0,
                success: true,
            });
        } catch {
            emitStep('skill_result', 'Benchmark research unavailable — working from expertise', { skillId: 'web.search', success: false });
        }
    }

    const prompts: Record<string, string> = {
        jd: `Write a compelling, inclusive job description that attracts A-players and repels bad fits:

## [ROLE TITLE]
**Department:** | **Location:** | **Type:** Full-time | **Level:** [IC / Senior / Staff / Lead]

## Why This Role Matters
[2-3 sentences on the impact this person will have on the company — not generic filler]

## What You'll Do
[6-8 specific, concrete responsibilities — start each with an action verb]
- Drive [specific outcome]...
- Build [specific thing]...

## What Makes You a Strong Fit
**Must-haves (deal-breakers if missing):**
- [Requirement 1 — be specific]
- [Requirement 2]

**Strong advantages:**
- [Nice-to-have 1]
- [Nice-to-have 2]

## What We Offer
[Compensation range, equity, benefits — be specific, not vague]

## Our Culture
[2-4 sentences that are honest and specific — not "we move fast and care deeply"]

## Interview Process
[Outline the steps so candidates know what to expect]`,

        interview: `Create a structured interview guide with scoring rubrics:

## Interview Guide: [ROLE TITLE]
**Recommended for:** [Stage of interview — phone screen / technical / values fit / final]
**Duration:** [60-90 mins] | **Interviewer:** [Suggested role to conduct this]

## Pre-Interview Setup
- Review candidate's [...]
- Prepare scoring sheet
- Block 10 min after for scorecarding

## Warm-Up (5 min)
[2 easy openers to get them talking]

## Core Questions

### Technical / Role Competencies (20-25 min)
| Question | What We're Assessing | Green Flags | Red Flags |
|----------|---------------------|-------------|-----------|
| [Q1] | [...] | [...] | [...] |
| [Q2] | [...] | [...] | [...] |
| [Q3] | [...] | [...] | [...] |

### Behavioral / STAR Questions (20 min)
| Question | Competency | Green Flags | Red Flags |
|----------|-----------|-------------|-----------|
| "Tell me about a time..." | [...] | [...] | [...] |
| "Give me an example of..." | [...] | [...] | [...] |

### Situational Questions (10 min)
[2-3 "What would you do if..." scenarios with expected approach]

### Candidate Questions (10 min)
[5 great questions to ask them — helps candidates who aren't great at asking questions]

## Scoring Rubric
| Dimension | 1 (No hire) | 3 (Maybe) | 5 (Strong hire) |
|-----------|-------------|-----------|-----------------|
| [Competency 1] | [...] | [...] | [...] |
| [Competency 2] | [...] | [...] | [...] |

**Overall Recommendation:** ☐ Strong hire  ☐ Hire  ☐ Pass  ☐ Strong pass`,

        offer: `Draft a warm, professional offer letter:

[Company Letterhead]
[Date]

Dear [Candidate Name],

We are thrilled to offer you the position of **[Job Title]** at [Company Name].

**Start Date:** [Date]
**Location:** [Office / Remote / Hybrid - specify]
**Manager:** [Hiring Manager Name]

**Compensation Package:**
- Base Salary: $[Amount] per year, paid [biweekly/semi-monthly]
- [Equity: X,XXX stock options / RSUs at $X exercise price, vesting over 4 years with 1-year cliff]
- [Bonus: X% target annual bonus, paid [quarterly/annually], based on [company/individual] performance]

**Benefits:**
- Health: [Medical, dental, vision — specify coverage level]
- [Other benefits: 401k match, PTO policy, learning budget, equipment stipend, etc.]

**This offer is contingent upon:**
- [Background check / reference checks]
- [Any other conditions]

Please confirm your acceptance by [Date] by signing and returning this letter.

We are genuinely excited about what you'll bring to [Company] and the [Team]. [1-2 sentences that are specific to this person — reference something from the interview]

Welcome aboard!

[Signature]
[Name], [Title]

---
Accepted by: _________________ Date: _____________`,

        onboarding: `Create a comprehensive 90-day onboarding plan:

## Onboarding Plan: [ROLE TITLE]
**Start Date:** [Date] | **Manager:** [Name] | **Buddy:** [Name]

## Pre-Start (Before Day 1)
| Task | Owner | Due |
|------|-------|-----|
| Send welcome email with day 1 logistics | HR | D-7 |
| Set up accounts (email, Slack, tools) | IT | D-5 |
| Assign onboarding buddy | Manager | D-3 |
| Send reading list (company handbook, team wiki) | Manager | D-2 |

## Week 1: Orientation & Foundation
**Goals:** Feel welcome, understand the company, set up tools

| Day | Morning | Afternoon |
|-----|---------|-----------|
| Day 1 | Welcome breakfast, IT setup | Company overview with CEO/manager |
| Day 2 | Team introductions | Deep dive on product/service |
| Day 3 | Core processes & tools | Shadow a key meeting |
| Day 4 | Customer stories | Role-specific orientation |
| Day 5 | Week 1 retro with manager | Plan for Week 2 |

**Week 1 Success Check:** [3 things they should know/have by end of week 1]

## Month 1: Learning & Contribution
**Goals:** Understand the team, ship first contribution

[Week-by-week plan with specific activities, meetings, and milestones]

**30-Day Check-In Questions:**
- What's been most surprising?
- Where do you need more support?
- What's your first impression of the biggest opportunity?

## Month 2: Independence
**Goals:** Run projects independently, build key relationships

[Milestone-based plan with specific deliverables]

## Month 3: Impact
**Goals:** Lead a project, contribute to team strategy

[Milestone-based plan with specific deliverables]

**90-Day Success Metrics:**
- [ ] [Specific measurable outcome]
- [ ] [Relationship goal]
- [ ] [Process/tool mastery]
- [ ] [First significant contribution shipped]`,

        review: `Create a comprehensive performance review framework:

## Performance Review: [ROLE TITLE]
**Review Period:** | **Completed by:** Employee + Manager

---

## Part 1: Employee Self-Assessment

### Accomplishments
*What are you most proud of this period? Be specific about impact.*
[Open field]

### Goals Review
| Goal Set | Progress | Impact | Learning |
|----------|---------|--------|---------|
| [Goal 1] | [%] | [...] | [...] |

### Competency Self-Rating (1-5)
| Competency | Score (1-5) | Evidence |
|-----------|-------------|---------|
| [Role-specific competency] | | |
| Collaboration | | |
| Impact & ownership | | |
| Growth mindset | | |

### Development Goals (Next Period)
[Top 2-3 areas for growth with specific actions]

---

## Part 2: Manager Evaluation

### Performance Summary
Overall rating: ☐ Exceptional ☐ Exceeds ☐ Meets ☐ Developing ☐ Below

### Strengths (3-5 specific, evidenced)
[...]

### Development Areas (1-2 specific, with support plan)
[...]

### Compensation Recommendation
☐ At market | ☐ Merit increase: ___% | ☐ Promotion review | ☐ No change

### 30-day plan for next period
[Clear, measurable goals for the next review cycle]`,

        policy: `Draft a comprehensive company policy:

## [Policy Name]
**Version:** 1.0 | **Last Updated:** [Date] | **Owner:** People Operations
**Applies to:** All [Company Name] employees worldwide

## Purpose
[Why this policy exists — 2-3 sentences]

## Scope
[Who this applies to and any exceptions]

## Policy Statement
[Clear, unambiguous statement of the policy]

## Definitions
[Key terms defined clearly]

## Procedures
[Numbered, step-by-step process]

## Responsibilities
| Role | Responsibility |
|------|---------------|
| Employee | [...] |
| Manager | [...] |
| HR | [...] |

## Violations & Consequences
[Clear, graduated consequence structure]

## Exceptions Process
[How to request an exception]

## Review Schedule
This policy will be reviewed annually.

## Questions
Contact People Operations at [contact info]`,

        culture: `Create a compelling culture document:

## [Company Name] Culture Guide

### Our Mission
[Why we exist beyond making money]

### Our Values
*Values are behaviors, not aspirations. We live these daily.*

#### Value 1: [Name]
**What it looks like in practice:**
- ✅ Do: [Specific behavior]
- ❌ Don't: [What it's NOT]
*Example: [Specific story of this value in action]*

[Repeat for each value — 4-6 values max]

### How We Work
**Communication:** [Async vs sync norms, response time expectations]
**Meetings:** [What meetings exist, how they run, when to cancel]
**Decisions:** [How decisions get made — who decides what]
**Feedback:** [How feedback is given, requested, received]
**Conflict:** [How we handle disagreement constructively]

### The Behaviors That Get People Promoted
[6-8 specific, observable behaviors]

### The Behaviors That Get People Managed Out
[4-6 specific behaviors that violate the culture — honest and direct]

### What Success Looks Like at [Company]
[What a great [6-month, 1-year, 3-year] looks like for someone joining today]`,
    };

    emitStep('generating', `Writing expert ${type} document...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${HR_EXPERT_SYSTEM_PROMPT}

${role ? `Role: ${role}` : ''}
${benchmarkContext ? `\nMarket benchmark context:\n${benchmarkContext.slice(0, 600)}` : ''}

REQUEST: ${intent}

${prompts[type] ?? prompts.jd}

Write the COMPLETE, READY-TO-USE document. Make it specific to the role and context — no generic placeholder text that can't be used immediately. Fill in plausible specifics where the user hasn't provided them.`,
    });

    const output = response.text ?? '';
    const wordCount = output.split(/\s+/).length;
    emitStep('skill_result', `${type} document complete — ${wordCount} words`, { success: true });

    let savedToNotion = false;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            const notionRun = await runSkill('notion.create-page', ctx, {
                title: `HR — ${type.toUpperCase()}: ${role ?? intent.slice(0, 70)}`,
                content: output,
            });
            savedToNotion = (notionRun.result as { success?: boolean }).success === true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', success: savedToNotion });
        } catch {
            emitStep('skill_result', 'Notion not connected — output ready', { skillId: 'notion.create-page', success: false });
        }
    }

    emitStep('done', `HR ${type} complete${savedToNotion ? ' — saved to Notion' : ''}`, { success: true });
    return { output, savedToNotion };
}

export const hrAgentApp = express();
hrAgentApp.use(express.json());
hrAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(HR_AGENT_MANIFEST));
