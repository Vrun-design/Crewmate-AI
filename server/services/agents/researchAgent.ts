/**
 * Research Agent — Universe-Best Deep Intelligence Analyst
 *
 * The most powerful research pipeline possible:
 *   1. Query decomposition — breaks the topic into 4-6 targeted sub-questions
 *   2. Parallel multi-angle searches (not one query — many different angles)
 *   3. Source quality filtering and deduplication
 *   4. Structured findings synthesis with cross-source validation
 *   5. Executive brief calibrated to the audience and output type
 *   6. Optional deep-dive on specific source URLs
 *   7. Save to Notion
 *
 * Output types: executive brief, competitive intelligence, technical deep-dive,
 * market research, fact-check, person/company profile, news synthesis
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import { selectModel, determineComplexity } from '../modelRouter';
import { isFeatureEnabled } from '../featureFlagService';
import { maybeSaveAgentOutputToWorkspace, type WorkspaceOutputTarget } from './agentWorkspaceOutput';
import express from 'express';

export const RESEARCH_AGENT_MANIFEST = {
    id: 'crewmate-research-agent',
    name: 'Research Agent',
    department: 'Intelligence',
    description: 'Deep multi-angle research intelligence — market analysis, competitive landscapes, technical deep-dives, executive briefs, fact-checking, company/person profiles, and news synthesis. Conducts 4-6 targeted searches per topic for comprehensive coverage.',
    capabilities: [
        'multi_angle_search',
        'market_research',
        'competitive_intelligence',
        'technical_research',
        'company_profiling',
        'fact_checking',
        'news_synthesis',
        'executive_briefs',
    ],
    skills: ['web.search', 'web.summarize-url', 'browser.extract', 'notion.create-page'],
    model: serverConfig.geminiResearchModel,
    emoji: '🔬',
};

const RESEARCH_EXPERT_SYSTEM_PROMPT = `You are a world-class intelligence analyst and research director with 15+ years conducting deep research for investment firms, strategy consultancies, and Fortune 500 executives. You've produced landmark competitive analyses, market entry strategies, and technical assessments that shaped billion-dollar decisions.

Your research philosophy:
- One source is a data point. Three sources is a pattern. Five sources is evidence.
- Always research from multiple angles: historical, current, competitive, technical, human/cultural
- Distinguish facts from opinions from speculation — never conflate them
- The most important information is often what's NOT being said or covered
- Executive audiences want: So what? Why does this matter? What should I do?

Your research methodology:
1. **Decompose**: Break every topic into 4-6 distinct sub-questions covering different angles
2. **Search**: Run separate targeted searches for each angle — different keywords, different sources
3. **Filter**: Prioritize primary sources, recent data, and expert opinions over summaries
4. **Cross-validate**: If two independent sources say the same thing, it's probably true
5. **Synthesize**: Find the patterns, tensions, and insights that emerge across sources
6. **Calibrate**: Adjust depth and format to the audience (exec vs. technical vs. investor)

Your analysis frameworks:
- Market research: TAM/SAM/SOM, growth drivers, barriers to entry, key players
- Competitive intel: Porter's Five Forces, positioning maps, SWOT per competitor
- Technology research: maturity curve, adoption barriers, key papers/patents, ecosystem
- Company profiling: business model, funding, growth signals, leadership, risks
- Fact-checking: primary source → corroboration → confidence level → verdict

Output standards:
- Always cite sources with title and URL
- Use confidence levels: ✅ Confirmed (multiple sources) | ⚠️ Likely (1-2 sources) | ❓ Unclear (conflicting or no sources)
- Call out information gaps explicitly — what we couldn't find matters
- Recommendations must be specific and actionable, not generic platitudes`;

interface ResearchSource {
    title: string;
    url: string;
    snippet: string;
}

function getSourceValue(source: Record<string, unknown>, key: string): string {
    const value = source[key];
    return typeof value === 'string' ? value : '';
}

function normalizeResearchSources(output: unknown): ResearchSource[] {
    if (!Array.isArray(output)) return [];
    return output
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const source = item as Record<string, unknown>;
            const url = getSourceValue(source, 'url') || getSourceValue(source, 'href');
            if (!url) return null;
            return {
                title: getSourceValue(source, 'title') || 'Source',
                url,
                snippet: getSourceValue(source, 'content') || getSourceValue(source, 'body'),
            };
        })
        .filter((s): s is ResearchSource => s !== null);
}

function formatSources(sources: ResearchSource[]): string {
    return sources
        .map((s, i) => `${i + 1}. **${s.title}**\n   URL: ${s.url}\n   ${s.snippet ? s.snippet.slice(0, 200) : 'No excerpt'}`)
        .join('\n\n');
}

/** Determine the research type from the intent */
function classifyResearchType(intent: string): 'market' | 'competitive' | 'technical' | 'profile' | 'news' | 'factcheck' | 'general' {
    const lower = intent.toLowerCase();
    if (/market size|tam|market research|industry|sector|growth rate/i.test(lower)) return 'market';
    if (/competitor|competitive|vs\.|compare|landscape|alternatives/i.test(lower)) return 'competitive';
    if (/how does|how to|technical|architecture|stack|algorithm|code|implementation/i.test(lower)) return 'technical';
    if (/who is|company profile|about company|funding|valuation|startup/i.test(lower)) return 'profile';
    if (/latest|recent|news|update|announcement|launched|released/i.test(lower)) return 'news';
    if (/is it true|fact.?check|verify|claim|accurate|actually/i.test(lower)) return 'factcheck';
    return 'general';
}

/** Build 4-6 search queries for comprehensive multi-angle coverage */
function buildSearchQueries(intent: string, researchType: string): string[] {
    const base = intent.replace(/^(research|look up|find out|what is|who is|tell me about)\s+/i, '').trim();

    const queryTemplates: Record<string, string[]> = {
        market: [
            `${base} market size revenue 2024 2025`,
            `${base} market growth rate CAGR trends forecast`,
            `${base} key players competitors landscape`,
            `${base} market challenges barriers opportunities`,
            `${base} industry report statistics data`,
        ],
        competitive: [
            `${base} competitive landscape main players`,
            `${base} pricing comparison features`,
            `${base} market share revenue funding`,
            `${base} strengths weaknesses advantages`,
            `${base} customer reviews complaints alternatives`,
        ],
        technical: [
            `${base} how it works architecture overview`,
            `${base} technical deep dive implementation`,
            `${base} best practices limitations tradeoffs`,
            `${base} examples use cases real world`,
            `${base} vs alternatives comparison technical`,
        ],
        profile: [
            `${base} company overview business model`,
            `${base} funding history investors valuation`,
            `${base} founders CEO leadership team`,
            `${base} products services customers revenue`,
            `${base} recent news announcements 2024 2025`,
        ],
        news: [
            `${base} latest news 2025`,
            `${base} recent announcement update`,
            `${base} what happened recent development`,
            `${base} analysis impact implications`,
        ],
        factcheck: [
            `${base} primary source evidence`,
            `${base} research study data statistics`,
            `${base} expert opinion consensus`,
            `${base} contrary evidence counterargument`,
        ],
        general: [
            `${base}`,
            `${base} overview explained`,
            `${base} examples case studies`,
            `${base} pros cons analysis`,
            `${base} 2024 2025 latest`,
        ],
    };

    return (queryTemplates[researchType] ?? queryTemplates.general).slice(0, 5);
}

export async function runResearchAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { outputType?: 'brief' | 'deep' | 'bullets' | 'report'; saveToNotion?: boolean; outputTarget?: WorkspaceOutputTarget } = {},
): Promise<{ plan: string; findings: string; brief: string; sources: ResearchSource[]; grounded: boolean; workspaceUrl?: string }> {
    const ai = createGeminiClient();
    const { outputType = 'brief', saveToNotion = false } = options;
    const complexity = determineComplexity(intent);
    const researchModel = selectModel('research', complexity, intent.length);
    const textModel = selectModel('general', 'low');
    const researchType = classifyResearchType(intent);

    // Step 1: Query decomposition — plan the research angles
    emitStep('thinking', 'Decomposing research topic into targeted angles...', {
        detail: `Type: ${researchType} | Complexity: ${complexity}`,
    });

    const planResponse = await ai.models.generateContent({
        model: researchModel,
        contents: `${RESEARCH_EXPERT_SYSTEM_PROMPT}

You are planning a research task. Create a precise research plan for:
"${intent}"

Research type: ${researchType}

Define:
1. **Core research question** (the single most important question to answer)
2. **4-5 sub-questions** (different angles to attack this from)
3. **Key sources to target** (types of sources, not specific URLs)
4. **Success criteria** (what does a complete answer look like?)
5. **Known biases to watch for** (what perspectives might be over/under-represented?)

Be concise — this is an internal plan, not the final output.`,
    });
    const plan = planResponse.text ?? '';
    emitStep('thinking', 'Research plan ready — launching multi-angle searches', {
        detail: plan.slice(0, 150),
    });

    // Step 2: Multi-angle parallel searches (4-5 different queries)
    const searchQueries = buildSearchQueries(intent, researchType);
    const allSources: ResearchSource[] = [];
    const searchContexts: string[] = [];
    const groundedResearchEnabled = isFeatureEnabled('researchGrounding');

    emitStep('skill_call', `Running ${searchQueries.length} targeted searches...`, { skillId: 'web.search' });

    for (let i = 0; i < searchQueries.length; i++) {
        const query = searchQueries[i];
        try {
            const t0 = Date.now();
            const searchRun = await runSkill('web.search', ctx, { query, maxResults: 5 });
            const sources = normalizeResearchSources(searchRun.result.output);
            const message = typeof searchRun.result.message === 'string' ? searchRun.result.message : '';

            // Deduplicate sources by URL
            sources.forEach((s) => {
                if (!allSources.find((existing) => existing.url === s.url)) {
                    allSources.push(s);
                }
            });

            if (message) searchContexts.push(`[Search ${i + 1}: "${query}"]\n${message}`);

            emitStep('skill_result', `Search ${i + 1}/${searchQueries.length}: ${sources.length} unique sources`, {
                skillId: 'web.search',
                durationMs: Date.now() - t0,
                success: sources.length > 0,
                detail: `"${query.slice(0, 60)}"`,
            });
        } catch {
            // Non-fatal — continue with other searches
        }
    }

    // Step 3: Deep-dive: try to extract content from top 2 sources
    if (groundedResearchEnabled && allSources.length > 0) {
        const topSources = allSources.slice(0, 2);
        for (const source of topSources) {
            emitStep('skill_call', `Deep reading: ${source.title.slice(0, 50)}...`, { skillId: 'web.summarize-url' });
            try {
                const t0 = Date.now();
                const extracted = await runSkill('web.summarize-url', ctx, { url: source.url });
                const summary = typeof (extracted.result as { message?: string }).message === 'string'
                    ? (extracted.result as { message: string }).message
                    : '';
                if (summary.length > 100) {
                    searchContexts.push(`[Deep read: "${source.title}"]\n${summary.slice(0, 800)}`);
                    emitStep('skill_result', 'Full article extracted', {
                        skillId: 'web.summarize-url',
                        durationMs: Date.now() - t0,
                        success: true,
                        detail: `${summary.length} chars extracted`,
                    });
                }
            } catch {
                // Non-fatal
            }
        }
    }

    const totalSources = allSources.length;
    const totalContext = searchContexts.join('\n\n---\n\n');
    emitStep('thinking', `${totalSources} unique sources across ${searchQueries.length} searches — cross-referencing...`, {
        detail: `${totalContext.length} chars of evidence`,
    });

    // Step 4: Deep synthesis across all sources
    const evidenceBlock = groundedResearchEnabled && totalSources > 0
        ? `Use ONLY the supplied evidence. Cite sources inline by title when making claims. If evidence is incomplete or contradictory, say so explicitly with confidence levels (✅/⚠️/❓).\n\nEvidence:\n${totalContext.slice(0, 6000)}`
        : `External evidence is limited. Be explicit about uncertainty. Clearly label any claim as provisional if unsupported.\n${totalSources === 0 ? 'No web sources retrieved — draw from training knowledge and flag this clearly.' : `Sources available: ${totalSources}`}`;

    const findingPrompts: Record<string, string> = {
        market: `Produce a structured market research memo:
## Market Overview
## Market Size & Growth (TAM/SAM/SOM if inferable)
## Key Players & Competitive Dynamics
## Growth Drivers
## Barriers & Risks
## Investment/Opportunity Assessment
## Confidence Assessment (what's well-supported vs speculative)`,

        competitive: `Produce a competitive intelligence memo:
## Competitive Landscape Summary
## Key Competitors (table: name, positioning, strengths, weaknesses, estimated size)
## Competitive Differentiation Map
## Market Positioning Matrix
## Key Competitive Risks
## Strategic Opportunities
## Intelligence Gaps (what we couldn't find)`,

        technical: `Produce a technical research memo:
## Technical Overview (plain English first, then depth)
## How It Works (architecture/mechanism)
## Current State of the Technology
## Tradeoffs & Limitations
## Real-World Implementations & Case Studies
## Best Practices
## Key Resources & Further Reading
## Confidence Assessment`,

        profile: `Produce a comprehensive profile:
## Overview
## Business Model
## Key Metrics (funding, revenue, employees, growth if available)
## Leadership & Team
## Products/Services
## Competitive Position
## Recent Developments
## Risk Factors
## Intelligence Gaps`,

        news: `Produce a news synthesis memo:
## What Happened (the key event/development)
## Timeline of Events
## Key Players Involved
## Impact Analysis (who/what is affected and how)
## Different Perspectives / Coverage Angles
## What This Means Going Forward
## Open Questions`,

        factcheck: `Produce a fact-check analysis:
## The Claim
## Verdict: [TRUE / MOSTLY TRUE / MIXED / MOSTLY FALSE / FALSE / UNVERIFIABLE]
## Evidence For
## Evidence Against
## Primary Sources
## Caveats & Context
## Confidence Level: [High / Medium / Low] — why`,

        general: `Produce a comprehensive research brief:
## Summary (3-5 sentences — the core of what was found)
## Key Findings (5-7 specific, evidenced findings with confidence levels)
## Supporting Evidence & Analysis
## Counterpoints & Alternative Views
## Information Gaps
## Recommendations`,
    };

    emitStep('generating', 'Cross-referencing sources and synthesizing findings...', {
        detail: `${researchType} analysis of ${totalSources} sources`,
    });
    const findingsResponse = await ai.models.generateContent({
        model: researchModel,
        contents: `${RESEARCH_EXPERT_SYSTEM_PROMPT}

Topic: "${intent}"
Research type: ${researchType}

Research plan:
${plan}

${evidenceBlock}

${findingPrompts[researchType] ?? findingPrompts.general}

CRITICAL: 
- Use confidence levels: ✅ Confirmed | ⚠️ Likely | ❓ Unclear
- Be specific with numbers and data points — not vague generalities
- Cite sources by title in the text when making claims
- Call out what you couldn't find — information gaps are findings too`,
    });
    const findings = findingsResponse.text ?? '';

    // Step 5: Write calibrated executive brief
    emitStep('generating', 'Writing executive brief...', {
        detail: `Format: ${outputType} | ${totalSources} sources`,
    });

    const briefStyle: Record<string, string> = {
        brief: 'Write a concise markdown executive brief (600-900 words). Lead with the most important insight. End with specific recommendations.',
        deep: 'Write a comprehensive deep-diver report (1500-2500 words). Include all nuance, supporting data, and full source citations.',
        bullets: 'Write a scannable bullet-point summary. Max 3-5 bullets per section. Decision-maker ready.',
        report: 'Write a formal intelligence report with numbered sections, evidence citations, and an executive summary at the top.',
    };

    const briefResponse = await ai.models.generateContent({
        model: textModel,
        contents: `${RESEARCH_EXPERT_SYSTEM_PROMPT}

You are turning raw research findings into a polished, high-impact deliverable.

Research topic: "${intent}"
Type: ${researchType}

${briefStyle[outputType] ?? briefStyle.brief}

Required sections:
## Executive Summary
[2-4 sentences: the single most important insight and its implication]

## Key Findings
[The most important, actionable, evidence-backed findings]

## Analysis
[Synthesis of patterns, tensions, and implications across the evidence]

## Recommendations
[Specific, actionable recommendations — not "you should investigate further"]

## Sources & Confidence
[List sources with confidence assessment for main claims]

Raw findings to synthesize:
${findings}

${totalSources > 0 ? `Sources:\n${formatSources(allSources.slice(0, 10))}` : 'Note: Limited web sources — flag knowledge boundaries clearly.'}`,
    });
    const brief = findingsResponse.text ? (briefResponse.text ?? '') : '';

    // Step 6: Save to Notion for deep research and reports
    if (saveToNotion || outputType === 'report' || outputType === 'deep') {
        emitStep('saving', 'Saving research to Notion...', { skillId: 'notion.create-page' });
        try {
            const t0 = Date.now();
            await runSkill('notion.create-page', ctx, {
                title: `Research: ${intent.slice(0, 90)}`,
                content: `# Research: ${intent}\n\n${brief}\n\n---\n\n## Full Findings\n\n${findings}\n\n---\n\n## Sources\n\n${formatSources(allSources)}`,
            });
            emitStep('skill_result', 'Research saved to Notion', {
                skillId: 'notion.create-page',
                durationMs: Date.now() - t0,
                success: true,
            });
        } catch {
            emitStep('skill_result', 'Notion not connected — research ready in output', { skillId: 'notion.create-page', success: false });
        }
    }

    // Optional: save to Google Workspace (Sheets, Slides, or Docs)
    const workspaceUrl = await maybeSaveAgentOutputToWorkspace(brief, intent, options.outputTarget, ctx, emitStep);

    const wordCount = brief.split(/\s+/).length;
    emitStep('done', `Research complete — ${wordCount} word ${outputType} | ${totalSources} sources | ${searchQueries.length} angles`, {
        success: true,
    });

    return {
        plan,
        findings,
        brief,
        sources: allSources,
        grounded: groundedResearchEnabled && totalSources > 0,
        workspaceUrl,
    };
}

export const researchAgentApp = express();
researchAgentApp.use(express.json());
researchAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(RESEARCH_AGENT_MANIFEST));
