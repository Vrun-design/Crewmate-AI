/**
 * Data Agent — Universe-Best Senior Data Scientist & Analytics Engineer
 *
 * Multi-step pipeline:
 *   1. Context & schema understanding
 *   2. Research benchmarks / industry metrics (web)
 *   3. SQL generation / data analysis / metrics definition / data story
 *   4. Auto-execute SQL via terminal if connected
 *   5. Save reports/dashboards to Notion
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import { maybeSaveAgentOutputToWorkspace, type WorkspaceOutputTarget } from './agentWorkspaceOutput';
import express from 'express';

export const DATA_AGENT_MANIFEST = {
    id: 'crewmate-data-agent',
    name: 'Data Agent',
    department: 'Analytics',
    description: 'Senior data scientist and analytics engineering expert — SQL query generation, cohort analysis, funnel analysis, KPI definition, data storytelling, dashboard design, A/B test analysis, and business intelligence strategy.',
    capabilities: ['sql_queries', 'cohort_analysis', 'funnel_analysis', 'kpi_definition', 'data_storytelling', 'dashboard_design', 'ab_analysis', 'bi_strategy'],
    skills: ['terminal.run-command', 'notion.create-page', 'web.search'],
    model: serverConfig.geminiResearchModel,
    emoji: '📊',
};

const DATA_EXPERT_SYSTEM_PROMPT = `You are a world-class Senior Data Scientist, Analytics Engineer, and BI Strategist with 12+ years turning raw data into strategic advantage. You've built data infrastructure for unicorn startups, designed metric frameworks used by thousands of analysts, and written SQL that runs in milliseconds on billion-row tables.

Your data philosophy:
- Metrics should drive decisions — if you can't act on a metric, don't report it
- Every analysis should answer a specific business question, not just describe what happened
- SQL is a communication tool: it should be readable by your future self at 2am
- The best dashboard is the one people actually look at — simplicity > comprehensiveness
- A/B test everything that matters — but only run tests you're powered to detect

Your analytical frameworks:
- North Star Metric: the one metric that best captures the value you deliver to customers
- HEART framework: Happiness, Engagement, Adoption, Retention, Task Success
- Pirate Metrics: AARRR — Acquisition, Activation, Retention, Revenue, Referral
- Cohort analysis: group users by acquisition date, measure behavior over time
- Funnel analysis: identify the biggest drop-off stage, that's where to focus

Your SQL standards:
- Always use CTEs (WITH clauses) for readability — never subquery hell
- Comment every non-obvious calculation
- Include sample output format as a comment
- Optimize for the engine (PostgreSQL vs BigQuery vs Snowflake have different idioms)
- Always think about indexes and partition pruning for large tables

Your output standards:
- SQL: production-grade, commented, with performance notes and sample output
- Reports: executive summary first, metrics table, trend analysis, actionable recommendations
- Metrics: business definition, formula, data source, benchmark, related metrics
- Stories: plain English, data supports the narrative (not vice versa), one clear recommendation`;

export async function runDataAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'sql' | 'analysis' | 'report' | 'metrics' | 'story' | 'dashboard' | 'ab_test' | 'funnel'; data?: string; schema?: string; outputTarget?: WorkspaceOutputTarget } = {},
): Promise<{ output: string; queries?: string[]; workspaceUrl?: string }> {
    const ai = createGeminiClient();
    const { type = 'analysis', data, schema } = options;

    emitStep('thinking', `Framing data problem: ${intent.slice(0, 80)}`, { detail: `Type: ${type}` });

    // Research industry benchmarks for reports and metrics
    let benchmarkContext = '';
    if (type === 'report' || type === 'metrics' || type === 'analysis') {
        emitStep('skill_call', 'Researching industry benchmarks...', { skillId: 'web.search' });
        try {
            const t0 = Date.now();
            const r = await runSkill('web.search', ctx, {
                query: `${intent} industry benchmarks KPI standards SaaS metrics 2025`,
                maxResults: 3,
            });
            benchmarkContext = (r.result as { message?: string }).message ?? '';
            emitStep('skill_result', 'Benchmarks gathered', { skillId: 'web.search', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Benchmark research unavailable — working from expertise', { skillId: 'web.search', success: false });
        }
    }

    const schemaContext = schema ? `\nDatabase schema:\n${schema}` : '\nAssume standard SaaS analytics schema (users, events, sessions, subscriptions, orders tables).';
    const dataContext = data ? `\nData/Context provided:\n${data.slice(0, 1500)}` : '';

    const prompts: Record<string, string> = {
        sql: `Write production-grade SQL to answer the request.

${schemaContext}

Requirements:
1. Use CTEs (WITH clauses) instead of nested subqueries
2. Comment every non-obvious calculation inline
3. Add a header comment block explaining the query's purpose
4. Include performance notes (indexes to add, potential bottlenecks)
5. Show expected output format as a comment at the end
6. Provide 2-3 alternative approaches if applicable

\`\`\`sql
/*
Purpose: [What this query answers]
Input tables: [Which tables it uses]
Returns: [What the output looks like]
Performance note: [Indexes needed, estimated runtime on large table]
*/

WITH [step_1] AS (
    -- [Clear comment on what this CTE does]
    SELECT ...
    FROM ...
),

[step_2] AS (
    -- [Clear comment]
    SELECT ...
    FROM [step_1]
    WHERE ...
)

SELECT
    [column1],
    [column2],
    -- [Explain non-obvious calculations]
    [formula] AS [readable_name]
FROM [step_2]
ORDER BY [meaningful_sort];

/*
Expected output sample:
| column1 | column2 | readable_name |
|---------|---------|---------------|
| ...     | ...     | ...           |

Alternative approach (if query is slow):
[Alternative query using a different strategy]
*/
\`\`\``,

        analysis: `Provide a deep, actionable data analysis:

## Analysis: [Clear question being answered]

### Executive Summary
[3-4 sentences: what was analyzed, the #1 finding, and the recommended action]

### Key Findings
| Finding | Metric | vs. Benchmark | Signal |
|---------|--------|--------------|--------|
| [Finding 1] | [X] | [+/-Y vs industry] | ✅/⚠️/🔴 |
| [Finding 2] | [...] | [...] | [...] |

### Deep Dive

#### Trend Analysis
[Time-series analysis with specific data points. Identify: growth rate, seasonality, inflection points, anomalies]

#### Segment Analysis
[Break down by key dimensions: cohort, geography, plan tier, channel, etc.]
| Segment | Metric | % of Total | Trend |
|---------|--------|-----------|-------|
| [...] | [...] | [X]% | ↑↓→ |

#### Cohort Analysis
[Cohort retention table if applicable]
| Cohort | Month 0 | Month 1 | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|---------|---------|----------|
| [Jan] | 100% | [X]% | [X]% | [X]% | [X]% |

#### Root Cause Hypotheses
| Hypothesis | Evidence For | Evidence Against | Confidence |
|-----------|-------------|-----------------|-----------|
| [H1] | [...] | [...] | High/Med/Low |

### SQL to Dig Deeper
\`\`\`sql
-- Query to validate the primary finding:
[Specific query relevant to the analysis]
\`\`\`

### Recommendations
| Action | Expected Impact | Effort | Priority |
|--------|----------------|--------|----------|
| [Action 1] | +[X]% [metric] | Low/Med/High | P1 |

### What to Monitor Next
[2-3 leading indicators to watch in the next 30 days]`,

        report: `Write a comprehensive data and metrics report:

## [Report Name] — [Period]

### TL;DR (for the busy exec — 3 bullets max)
- [Most important number with context]
- [Second key insight]
- [One recommendation]

---

### Performance Scorecard
| Metric | Last Period | This Period | Δ | Target | Status |
|--------|-----------|------------|---|--------|--------|
| [Primary metric] | [...] | [...] | [+/-X]% | [...] | ✅/⚠️/🔴 |
| [Secondary] | [...] | [...] | [...] | [...] | [...] |

### Revenue & Growth
[MRR, ARR, growth rate, cohort retention — with context]

### User Metrics
[DAU/MAU, activation rate, engagement depth, feature adoption]

### Funnel Performance
| Stage | Users | Conversion | vs. Last Period |
|-------|-------|-----------|-----------------|
| [Awareness] | [N] | — | [...] |
| [Activation] | [N] | [X]% | [...] |
| [Retention D7] | [N] | [X]% | [...] |
| [Revenue] | [N] | [X]% | [...] |
| [Referral] | [N] | [X]% | [...] |

### Cohort Analysis
[Retention curves or cohort table]

### Anomalies & Investigations
[Anything that looks unexpected — call out spikes, drops, and what caused them]

### Recommendations
[Ranked by expected impact, with specific action, owner, and timeline]

### Appendix: Methodology
[How metrics are defined and calculated — important for reproducibility]`,

        metrics: `Define and document metrics comprehensively:

## Metrics Framework: [Area]

### North Star Metric
| Metric | Definition | Why this? |
|--------|-----------|----------|
| [North Star] | [Precise definition] | [Why this represents value delivered] |

### Primary Metrics (measure every week)
For each metric:

#### [Metric Name]
| Field | Value |
|-------|-------|
| **Business definition** | [What it measures in plain English] |
| **Formula** | \`[Numerator] / [Denominator] × 100\` |
| **Data source** | [Table.column → Table.column] |
| **Query** | See below |
| **Update frequency** | [Real-time / Daily / Weekly] |
| **Owner** | [Team responsible] |
| **Benchmark** | [Industry standard: e.g., SaaS D30 retention > 25%] |
| **Current baseline** | [Your current value] |
| **Target (90 days)** | [Goal] |
| **Related metrics** | [What moves with this metric] |

\`\`\`sql
-- [Metric Name] calculation:
SELECT
    DATE_TRUNC('week', created_at) AS week,
    [formula] AS metric_value
FROM [table]
WHERE [conditions]
GROUP BY 1
ORDER BY 1;
\`\`\`

[Repeat for each primary metric]

### Secondary Metrics (monitor monthly)
| Metric | Definition | Formula | Benchmark |
|--------|-----------|---------|-----------|
| [...] | [...] | [...] | [...] |

### Counter-Metrics (watch for unintended consequences)
[Metrics that should NOT move when optimizing primaries]

### Metric Hierarchy
\`\`\`
North Star: [Metric]
├── Input metric A → drives → North Star
│   ├── Leading indicator A1
│   └── Leading indicator A2
├── Input metric B
└── Input metric C
\`\`\``,

        story: `Write a compelling data story for a non-technical audience:

## [Story Title: The Insight, Not the Metric]
*A data story for [audience — leadership / investors / team]*

---

### The Question We Asked
[State the business question in plain English — not "we analyzed DAU" but "we wanted to understand why customers stop using our product"]

### What We Found
[Start with the most surprising or important finding. Use concrete numbers. NO jargon.]

> **"[Striking statistic or finding in quotation format — something that makes people stop and read]"**

[2-3 paragraphs building the narrative. Each paragraph adds a layer of understanding:]
- Paragraph 1: The headline finding with context
- Paragraph 2: Why this is happening (root cause)
- Paragraph 3: What this means for the business

### The Data in Plain English
[Explain the key chart/table as if to someone who's never seen a retention curve]

| What we measured | What we found | What it means |
|-----------------|---------------|---------------|
| [Metric] | [Number] | [Business implication] |

### The Story of Our Users
[A short narrative segment: follow a hypothetical/composite user through the funnel with data as the backdrop — this is what makes data stories memorable]

### What We're Going to Do About It
[3 specific actions, written as decisions: "We're going to X because the data shows Y, and we expect to see Z improvement in [metric] by [date]"]

1. **[Action]** — expected outcome: [specific metric improvement]
2. [...]
3. [...]

### What to Watch
[The 1-2 metrics that will tell us in 30 days whether our actions are working]`,

        dashboard: `Design a comprehensive analytics dashboard:

## Dashboard Design: [Dashboard Name]

### Purpose & Audience
| Dimension | Value |
|-----------|-------|
| Primary audience | [Who looks at this] |
| Update frequency | [Real-time / Hourly / Daily] |
| Primary decision | [What decision does this dashboard support?] |
| Time range default | [Last 7/30/90 days] |

---

### Layout Design (3-panel structure)

#### Panel 1: At-a-Glance (top bar — KPI cards)
| Card | Metric | Comparison | Alert Threshold |
|------|--------|-----------|-----------------|
| [Card 1] | [Metric] | vs. last period | [Red if < X] |
| [Card 2] | [...] | vs. target | [...] |
| [Card 3] | [...] | WoW | [...] |

#### Panel 2: Trend Charts (main body)
| Chart # | Chart Type | Metric | Breakdowns | Insight Question |
|---------|-----------|--------|-----------|-----------------|
| 1 | Line | [Primary metric over time] | [By segment] | "Is growth rate improving?" |
| 2 | Bar | [Volume metric] | [By channel/cohort] | [...] |
| 3 | Retention grid | [D1/D7/D30 retention] | [By cohort] | "Where do we lose users?" |
| 4 | Funnel | [Conversion stages] | [By segment] | "Where's the biggest drop-off?" |

#### Panel 3: Detail Tables (bottom — for drilling down)
| Table | Rows | Columns | Sort By | Filter By |
|-------|------|---------|---------|-----------|
| [Top segments] | [Segment] | [Key metrics] | [Primary metric desc] | [Date range] |

---

### Alerting Rules
| Condition | Alert | Channel | Owner |
|-----------|-------|---------|-------|
| [Primary metric drops X%] | 🔴 Critical | Slack #alerts | [Owner] |
| [Secondary metric drops Y%] | 🟡 Warning | Slack #data | [...] |

### SQL Queries for Each Panel
\`\`\`sql
-- KPI Card 1: [Metric Name]
[Query]

-- Trend Chart 1: [Metric] over time
[Query]
\`\`\`

### Governance
- **Owner:** [Team]
- **Review cadence:** [Monthly metric review meeting]
- **Definition changes:** [How to update documented definitions]`,

        ab_test: `Design and analyze an A/B test:

## A/B Test: [Name]

### Test Design

#### Hypothesis
**We believe that** [specific change]
**For** [target user segment]
**Will result in** [measurable outcome]
**Because** [mechanism / why we believe this]

#### Test Parameters
| Parameter | Value |
|-----------|-------|
| Primary metric | [The ONE metric to optimize] |
| Secondary metrics | [What else to monitor for side effects] |
| Guardrail metrics | [Metrics that must NOT decrease] |
| Traffic split | [50/50 or other] |
| Target sample size | [N users per variant — see power calculation] |
| Minimum runtime | [X days — must capture weekly seasonality] |
| Statistical significance | [95% confidence] |
| Minimum detectable effect | [X% improvement] |

#### Power Calculation
\`\`\`
Baseline: [current metric value, e.g., 5% conversion]
MDE: [minimum meaningful improvement, e.g., 0.5% absolute / 10% relative]
Power: 80%
Significance: 95% (two-tailed)
Required sample per variant: ~[N users]
Estimated runtime at [X traffic]: [Y days]
\`\`\`

#### SQL to Monitor
\`\`\`sql
-- Live test monitor query
WITH test_data AS (
    SELECT
        variant,
        COUNT(DISTINCT user_id) AS users,
        COUNT(DISTINCT CASE WHEN converted = true THEN user_id END) AS converted,
        ROUND(
            COUNT(DISTINCT CASE WHEN converted = true THEN user_id END)::NUMERIC
            / COUNT(DISTINCT user_id) * 100, 2
        ) AS conversion_rate
    FROM ab_test_assignments
    WHERE test_name = '[test_name]'
        AND assigned_at >= '[start_date]'
    GROUP BY 1
)
SELECT
    *,
    -- Relative lift
    ROUND((conversion_rate - LAG(conversion_rate) OVER (ORDER BY variant))
        / LAG(conversion_rate) OVER (ORDER BY variant) * 100, 1) AS lift_pct
FROM test_data;
\`\`\`

### Analysis Framework

#### Statistical Analysis
| Variant | Users | Conversions | Rate | Lift | p-value | Significant? |
|---------|-------|-------------|------|------|---------|-------------|
| Control | [N] | [N] | [X]% | — | — | — |
| Variant | [N] | [N] | [X]% | [+Y]% | [0.0X] | ✅/❌ |

#### Segment Analysis (did the test work differently for different groups?)
| Segment | Control Rate | Variant Rate | Lift | Significant? |
|---------|-------------|-------------|------|-------------|
| New users | [X]% | [X]% | [...] | ✅/❌ |
| Power users | [X]% | [X]% | [...] | ✅/❌ |

#### Novelty Effect Assessment
[Did metrics decay after first exposure? Week 1 vs Week 2+ comparison]

### Decision Framework
| Outcome | Decision | Next Step |
|---------|---------|-----------|
| Significant positive result | Ship to 100% | Run follow-up test on next optimization |
| Not significant (underpowered) | Extend runtime | Increase traffic allocation |
| Not significant (well-powered) | Don't ship | Learnings to apply to next hypothesis |
| Significant negative result | Stop test | Understand why, re-examine hypothesis |

### Learnings (fill in after test concludes)
[What we learned, even if the test failed — failed tests teach more than winners]`,
    };

    emitStep('generating', `Running ${type} analysis...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${DATA_EXPERT_SYSTEM_PROMPT}

${benchmarkContext ? `\nIndustry benchmarks:\n${benchmarkContext.slice(0, 600)}` : ''}
${schemaContext}
${dataContext}

REQUEST: ${intent}

${prompts[type] ?? prompts.analysis}

Write a COMPLETE, PRODUCTION-READY output. For SQL: write actual runnable queries with real table names inferred from context. For analysis: use specific numbers and comparisons, not vague descriptions. For metrics: fill in actual formulas, not [formula]. Be the most thorough, useful data analyst the user has ever worked with.`,
    });

    const output = response.text ?? '';
    const queries: string[] = [];
    const sqlMatches = output.match(/```sql([\s\S]*?)```/gi) ?? [];
    sqlMatches.forEach((q) => queries.push(q.replace(/```sql\n?|```/g, '').trim()));

    emitStep('skill_result', `${type} complete — ${queries.length} SQL queries, ${output.split(/\s+/).length} words`, { success: true });

    // Save reports, metrics docs, and dashboards to Notion
    const saveTypes = ['report', 'metrics', 'story', 'dashboard', 'ab_test'];
    if (saveTypes.includes(type)) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            const t0 = Date.now();
            const notionRun = await runSkill('notion.create-page', ctx, {
                title: `Data — ${type.replace('_', ' ').toUpperCase()}: ${intent.slice(0, 70)}`,
                content: output,
            });
            const notionResult = notionRun.result as { success?: boolean; output?: { url?: string; title?: string } };
            const notionPageUrl = notionResult.output?.url;
            const notionLabel = notionResult.output?.title ? `"${notionResult.output.title}"` : 'page';
            emitStep('skill_result', notionPageUrl ? `Saved to Notion — ${notionLabel}` : 'Saved to Notion', { skillId: 'notion.create-page', durationMs: Date.now() - t0, success: notionResult.success === true, url: notionPageUrl });
        } catch {
            emitStep('skill_result', 'Notion not connected — output ready', { skillId: 'notion.create-page', success: false });
        }
    }

    // Optional: save to Google Workspace (Sheets, Slides, or Docs)
    const workspaceUrl = await maybeSaveAgentOutputToWorkspace(output, intent, options.outputTarget, ctx, emitStep);

    emitStep('done', `Data ${type} complete${queries.length > 0 ? ` — ${queries.length} queries ready` : ''}${workspaceUrl ? ' — Google Workspace file created' : ''}`, { success: true });
    return { output, queries, workspaceUrl };
}

export const dataAgentApp = express();
dataAgentApp.use(express.json());
dataAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(DATA_AGENT_MANIFEST));
