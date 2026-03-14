/**
 * Finance Agent — World-Class CFO-Level Financial Strategist
 *
 * Multi-step pipeline:
 *   1. Market/benchmark research
 *   2. Financial document generation with expert structure
 *   3. Save to Notion
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import { maybeSaveAgentOutputToWorkspace, type WorkspaceOutputTarget } from './agentWorkspaceOutput';
import express from 'express';

export const FINANCE_AGENT_MANIFEST = {
    id: 'crewmate-finance-agent',
    name: 'Finance Agent',
    department: 'Finance',
    description: 'CFO-level financial strategist — financial models, budget templates, runway analysis, unit economics, investor reports, expense frameworks, and cost optimization (informational only — not financial advice).',
    capabilities: ['financial_models', 'budget_templates', 'runway_analysis', 'unit_economics', 'investor_reports', 'expense_frameworks', 'cost_optimization'],
    skills: ['notion.create-page', 'web.search'],
    model: serverConfig.geminiResearchModel,
    emoji: '💰',
};

const FINANCE_EXPERT_SYSTEM_PROMPT = `You are a world-class CFO and financial strategist with 15+ years leading finance at fast-growing startups and scale-ups from Seed to IPO. You've built financial models that attracted $200M+ in investment, implemented cost structures that extended runway by 18 months, and reported to boards of top-tier companies.

Your finance philosophy:
- Revenue solves all problems; cash flow keeps the lights on
- Every financial model should have 3 scenarios: base, bull, bear — never just one number
- Unit economics must be understood before scaling — CAC:LTV ratio is everything
- The best financial story is data-driven but narrative-first: numbers support the story
- Cash runway is the CEO's most important number — measure it weekly

Your frameworks:
- SaaS metrics: MRR, ARR, Churn, NRR, Gross Margin, CAC, LTV, LTV:CAC, Payback Period
- Fundraising: Use of funds, burn rate, runway, key milestones per round
- Budget: Zero-based for new periods, variance analysis monthly
- Expense review: Fixed vs variable, headcount vs non-headcount, R&D vs S&M vs G&A ratios

⚠️ IMPORTANT: Always include: "This is for informational and planning purposes only, not financial or investment advice. Consult a qualified financial professional before making decisions."

Output standards:
- All financial documents include markdown tables with clear labels
- All projections show assumptions explicitly
- Always include 3 scenarios (conservative / base / optimistic) for any forward-looking analysis`;

export async function runFinanceAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'invoice' | 'expense' | 'budget' | 'report' | 'analysis' | 'model' | 'investor'; saveToNotion?: boolean; outputTarget?: WorkspaceOutputTarget } = {},
): Promise<{ output: string; savedToNotion: boolean; workspaceUrl?: string }> {
    const ai = createGeminiClient();
    const { type = 'report', saveToNotion = true } = options;

    emitStep('thinking', `Preparing ${type} analysis...`, { detail: intent.slice(0, 80) });

    // Research benchmarks for analysis and investor reports
    let benchmarkContext = '';
    if (type === 'analysis' || type === 'investor' || type === 'model') {
        emitStep('skill_call', 'Researching industry benchmarks...', { skillId: 'web.search' });
        try {
            const t0 = Date.now();
            const query = type === 'investor'
                ? `SaaS investor metrics benchmarks ARR growth rate 2025`
                : `${intent} financial benchmarks industry averages 2025`;
            const r = await runSkill('web.search', ctx, { query, maxResults: 3 });
            benchmarkContext = (r.result as { message?: string }).message ?? '';
            emitStep('skill_result', 'Industry benchmarks gathered', { skillId: 'web.search', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Benchmark research unavailable — working from expertise', { skillId: 'web.search', success: false });
        }
    }

    const prompts: Record<string, string> = {
        model: `Build a comprehensive financial model framework:

## Financial Model: [Company/Initiative Name]
**Model Date:** [Date] | **Currency:** USD | **Period:** [Monthly / Quarterly]
⚠️ *Informational only — not financial advice*

## Key Assumptions
| Assumption | Value | Source / Rationale |
|-----------|-------|-------------------|
| Initial MRR | $[...] | [...] |
| Monthly growth rate | [X]% | [...] |
| Gross margin | [X]% | [...] |
| Churn rate (monthly) | [X]% | [...] |
| CAC | $[...] | [...] |
| Average contract value | $[...] | [...] |
| Months to payback | [...] | CAC ÷ (ACV × Gross Margin) |

## Revenue Model (3 Scenarios)

| Month | Conservative ARR | Base ARR | Optimistic ARR |
|-------|-----------------|----------|----------------|
| M1 | $[...] | $[...] | $[...] |
| M3 | $[...] | $[...] | $[...] |
| M6 | $[...] | $[...] | $[...] |
| M12 | $[...] | $[...] | $[...] |

**Scenario Assumptions:**
- Conservative: [X]% growth/month (key headwinds)
- Base: [X]% growth/month (current trajectory)
- Optimistic: [X]% growth/month (unlocking X)

## Unit Economics
| Metric | Value | Benchmark | Status |
|--------|-------|-----------|--------|
| LTV | $[...] | $[...] | ✅/⚠️ |
| CAC | $[...] | $[...] | ✅/⚠️ |
| LTV:CAC | [X]:1 | >3:1 | ✅/⚠️ |
| Payback period | [X] months | <12m | ✅/⚠️ |
| NRR | [X]% | >100% | ✅/⚠️ |
| Gross margin | [X]% | >70% | ✅/⚠️ |

## Cost Structure
| Category | Monthly | % of Revenue | Benchmark |
|----------|---------|-------------|-----------|
| COGS | $[...] | [X]% | [Y]% |
| S&M | $[...] | [X]% | [Y]% |
| R&D | $[...] | [X]% | [Y]% |
| G&A | $[...] | [X]% | [Y]% |
| **Total OpEx** | $[...] | [X]% | |

## Runway Analysis
| Scenario | Monthly Burn | Runway at Current Cash + 12m MRR |
|----------|-------------|----------------------------------|
| Conservative | $[...] | [...] months |
| Base | $[...] | [...] months |
| Optimistic | $[...] | [...] months |

## Key Milestones for Next Round
[Revenue, growth, and metric milestones needed to raise the next round]`,

        budget: `Create a comprehensive quarterly budget:

## Q[X] [Year] Budget
**Total Budget:** $[...] | **Headcount:** [N] | **Period:** [Dates]
⚠️ *Informational planning template — not financial advice*

## Revenue Plan
| Revenue Stream | Q[X-1] Actual | Q[X] Target | Notes |
|---------------|--------------|------------|-------|
| New ARR | $[...] | $[...] | [...] |
| Expansion ARR | $[...] | $[...] | [...] |
| Churn (reduction) | -$[...] | -$[...] | [...] |
| **Total ARR** | $[...] | $[...] | |

## Expense Budget
### Headcount (largest cost center)
| Role | Current | New Hires | Total | Monthly Cost | Rationale |
|------|---------|-----------|-------|-------------|-----------|
| Engineering | [...] | [...] | [...] | $[...] | [...] |
| Sales | [...] | [...] | [...] | $[...] | [...] |
| [Other] | [...] | [...] | [...] | $[...] | [...] |

### Non-Headcount Expenses
| Category | Q[X-1] | Q[X] Budget | Δ | Owner |
|----------|--------|------------|---|-------|
| Software & tools | $[...] | $[...] | [+/-X]% | [...] |
| Marketing & ads | $[...] | $[...] | [+/-X]% | [...] |
| Cloud / infra | $[...] | $[...] | [+/-X]% | [...] |
| Travel & events | $[...] | $[...] | [+/-X]% | [...] |
| Legal & finance | $[...] | $[...] | [+/-X]% | [...] |
| **Total Non-Head** | $[...] | $[...] | [+/-X]% | |

## Budget Summary
| Metric | Q[X-1] | Q[X] Budget | Δ |
|--------|--------|------------|---|
| Total Revenue | $[...] | $[...] | +X% |
| Total Expenses | $[...] | $[...] | +X% |
| EBITDA | -$[...] | -$[...] | [...] |
| Burn Rate (monthly) | $[...] | $[...] | [...] |
| Runway | [...] mo | [...] mo | [...] |

## Budget Risks & Contingency
| Risk | Impact | Mitigation |
|------|--------|-----------|
| [Risk 1] | $[X]K | [...] |
| [Risk 2] | $[X]K | [...] |`,

        investor: `Write an investor-ready financial narrative and metrics report:

## Investor Financial Update — [Month/Quarter Year]
**Prepared by:** Finance | **Confidential — Do not distribute**
⚠️ *Informational summary — consult financial and legal advisors for investment decisions*

## Executive Summary
[3-4 sentences: what happened this period, key wins, key concern, forward momentum]

## Key Metrics

### Revenue
| Metric | Last Period | This Period | Target | vs. Target |
|--------|------------|------------|--------|-----------|
| MRR | $[...] | $[...] | $[...] | [+/-X]% |
| ARR | $[...] | $[...] | $[...] | [+/-X]% |
| Revenue Growth (MoM) | [X]% | [X]% | [X]% | [On/Off] track |
| NRR (Net Revenue Retention) | [X]% | [X]% | >[100]% | [✅/⚠️] |

### Growth
| Metric | Value | Benchmark | Status |
|--------|-------|-----------|--------|
| New customers | [...] | [...] | ✅/⚠️ |
| Churn (% MRR) | [X]% | <[2]% | ✅/⚠️ |
| Pipeline ($) | $[...] | — | — |
| Conversion rate | [X]% | — | — |

### Unit Economics Snapshot
| Metric | Value | Target | Industry Benchmark |
|--------|-------|--------|--------------------|
| CAC | $[...] | $[...] | $[...] |
| LTV | $[...] | $[...] | $[...] |
| LTV:CAC | [X]:1 | >3:1 | — |
| Payback Period | [X] mo | <12 mo | — |

### Cash & Runway
| Metric | Value |
|--------|-------|
| Cash in bank | $[...] |
| Monthly burn | $[...] |
| Runway | [...] months |
| Projected cash-out date | [Month Year] |

## Highlights This Period
- ✅ [Key win 1 with specific numbers]
- ✅ [Key win 2]

## Risks & Concerns
- ⚠️ [Risk 1 with mitigation plan]
- ⚠️ [Risk 2]

## Next Period Guidance
[Revenue target, key milestones, hiring plan, capital deployment]`,

        expense: `Create a detailed expense analysis and optimization report:

## Expense Analysis Report
**Period:** [Month/Quarter] | **Team:** [Department/Company]
⚠️ *Informational only — not financial advice*

## Expense Summary by Category
| Category | This Period | Prior Period | YTD | % of Revenue | Benchmark |
|----------|------------|-------------|-----|-------------|-----------|
| Headcount | $[...] | $[...] | $[...] | [X]% | 40-60% |
| Software/SaaS | $[...] | $[...] | $[...] | [X]% | 5-10% |
| Cloud/Infra | $[...] | $[...] | $[...] | [X]% | 5-8% |
| Marketing | $[...] | $[...] | $[...] | [X]% | 10-20% |
| Travel/Events | $[...] | $[...] | $[...] | [X]% | 2-5% |
| Legal/Finance | $[...] | $[...] | $[...] | [X]% | 2-4% |
| Other | $[...] | $[...] | $[...] | [X]% | — |
| **TOTAL** | $[...] | $[...] | $[...] | | |

## Top 10 Expenses
| Vendor/Category | Amount | Business Justification | ROI Rating |
|----------------|--------|----------------------|-----------|
| [...] | $[...] | [...] | ✅ High / ⚠️ Med / ❌ Low |

## Cost Optimization Opportunities
| Opportunity | Est. Annual Savings | Effort | Priority |
|------------|-------------------|--------|----------|
| [e.g., Consolidate overlapping SaaS tools] | $[X]K | Low | High |
| [...] | $[X]K | Med | Med |

## Variance Analysis (vs Budget)
| Category | Budget | Actual | Variance | Root Cause |
|----------|--------|--------|----------|-----------|
| [...] | $[...] | $[...] | +/-$[...] | [...] |

## Recommendations
1. [Specific action with expected savings and timeline]
2. [...]`,

        report: `Write a comprehensive financial summary report:

## Financial Report — [Period]
⚠️ *Informational only — not financial advice*

## Executive Summary
[5-6 sentences: financial performance, key metrics, wins, concerns, and outlook]

## Revenue Performance
[Revenue table with MoM and YoY comparisons, broken down by stream]

## Key SaaS Metrics
[Full metrics table: MRR, ARR, Churn, NRR, CAC, LTV, Payback, Gross Margin]

## P&L Summary
| Line Item | This Period | Prior Period | YTD | Full Year Budget |
|-----------|------------|-------------|-----|-----------------|
| Revenue | $[...] | $[...] | $[...] | $[...] |
| COGS | -$[...] | | | |
| **Gross Profit** | $[...] | | | |
| Operating Expenses | -$[...] | | | |
| **EBITDA** | -$[...] | | | |

## Cash Position
[Cash table with burn rate and runway at 3 scenarios]

## Risks & Opportunities
[Table with risk/opportunity, impact, and mitigation/action plan]

## Q[X+1] Outlook
[Forward-looking narrative with targets and key assumptions]`,

        analysis: `Provide a comprehensive financial analysis:

## Financial Analysis: [Topic]
⚠️ *Informational only — not financial advice. Consult a qualified financial advisor.*

## Analysis Summary
[3-4 sentence executive summary of findings]

## Key Findings
| Finding | Data / Evidence | Implication |
|---------|----------------|-------------|
| [Finding 1] | [...] | [...] |
| [Finding 2] | [...] | [...] |
| [Finding 3] | [...] | [...] |

## Detailed Analysis

### [Section 1 — Primary analysis dimension]
[Deep dive with data, context, and interpretation]

### [Section 2 — Secondary dimension]
[...")

## 3-Scenario Analysis
| Scenario | Assumptions | Projected Outcome | Key Risk |
|----------|------------|------------------|---------|
| Conservative | [...] | [...] | [...] |
| Base Case | [...] | [...] | [...] |
| Optimistic | [...] | [...] | [...] |

## Recommendations (ranked by impact)
1. [Recommendation 1 — with specific action, timeline, expected outcome]
2. [Recommendation 2]
3. [Recommendation 3]

## Next Steps
[Clear action plan with owners and deadlines]`,

        invoice: `Draft a professional invoice template:

---
# INVOICE

**From:** [Company Name]
[Address] | [City, State ZIP] | [Country]
[Email] | [Phone]

**To:** [Client Company Name]
[Client Address]
[Client Contact Name]

---

**Invoice #:** INV-[XXXX]
**Invoice Date:** [Date]
**Due Date:** [Date — Net 30/15/7]
**Payment Terms:** [Net 30]

---

## Services

| Description | Quantity | Rate | Amount |
|-------------|---------|------|--------|
| [Service 1 — be specific] | [...] | $[...]/hr | $[...] |
| [Service 2] | [...] | $[...] | $[...] |
| [Milestone: Deliverable name] | 1 | $[...] | $[...] |

---

| | |
|---|---|
| **Subtotal** | $[...] |
| **Tax ([X]%)** | $[...] |
| **TOTAL DUE** | **$[...]** |

---

## Payment Instructions
**Bank Transfer:**
Bank: [Bank Name]
Account Name: [Name]
Account Number: [XXXXXX]
Routing/Sort: [XXXXXX]

**Other options:** [PayPal / Stripe link / Check payable to]

## Notes
[Payment terms, late payment policy, project notes]

*Thank you for your business!*`,
    };

    emitStep('generating', `Writing ${type} document...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${FINANCE_EXPERT_SYSTEM_PROMPT}

${benchmarkContext ? `\nIndustry benchmarks context:\n${benchmarkContext.slice(0, 600)}` : ''}

REQUEST: ${intent}

${prompts[type] ?? prompts.report}

Write the COMPLETE document. For financial tables, fill in plausible illustrative numbers based on context (clearly label as "illustrative"). Include all sections — no placeholders that can't be filled. Always include the disclaimer.`,
    });

    const output = response.text ?? '';
    emitStep('skill_result', `${type} complete — ${output.split(/\s+/).length} words`, { success: true });

    let savedToNotion = false;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            const notionRun = await runSkill('notion.create-page', ctx, {
                title: `Finance — ${type.toUpperCase()}: ${intent.slice(0, 70)}`,
                content: output,
            });
            savedToNotion = (notionRun.result as { success?: boolean }).success === true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', success: savedToNotion });
        } catch {
            emitStep('skill_result', 'Notion not connected — output ready', { skillId: 'notion.create-page', success: false });
        }
    }

    // Optional: save to Google Workspace (Sheets, Slides, or Docs)
    const workspaceUrl = await maybeSaveAgentOutputToWorkspace(output, intent, options.outputTarget, ctx, emitStep);

    emitStep('done', `Finance ${type} complete${savedToNotion ? ' — saved to Notion' : ''}${workspaceUrl ? ' — Google Workspace file created' : ''}`, { success: true });
    return { output, savedToNotion, workspaceUrl };
}

export const financeAgentApp = express();
financeAgentApp.use(express.json());
financeAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(FINANCE_AGENT_MANIFEST));
