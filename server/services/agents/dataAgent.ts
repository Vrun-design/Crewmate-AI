/**
 * Data Agent — Phase 12 Full Workforce
 * SQL query drafting, data interpretation, metrics analysis, chart descriptions
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const DATA_AGENT_MANIFEST = {
    id: 'crewmate-data-agent',
    name: 'Data Agent',
    department: 'Analytics',
    description: 'SQL query drafting, data interpretation, metrics analysis, KPI reporting, and data storytelling.',
    capabilities: ['sql_queries', 'data_interpretation', 'kpi_reporting', 'data_storytelling', 'metrics'],
    skills: ['terminal.run-command', 'notion.create-page', 'web.search'],
    model: serverConfig.geminiResearchModel,
    emoji: '📊',
};

export async function runDataAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'sql' | 'analysis' | 'report' | 'metrics' | 'story'; data?: string; schema?: string } = {},
): Promise<{ output: string; queries?: string[] }> {
    const ai = createGeminiClient();
    const { type = 'analysis', data, schema } = options;

    emitStep('thinking', 'Analyzing data request...', { detail: intent });

    const prompts: Record<string, string> = {
        sql: `Write efficient SQL queries to answer the request.
${schema ? `Database schema:\n${schema}` : 'Assume standard business analytics tables (users, events, orders, sessions).'}
Include:
- Main query with comments
- Alternative approaches if relevant
- Performance notes
- Sample output format`,
        analysis: `Analyze the following data/metrics and provide insights:
1. Key findings (3-5 bullets)
2. Trends identified
3. Anomalies or outliers
4. Root cause hypotheses
5. Recommended actions`,
        report: `Write a data report with:
- Executive Summary (3 sentences)
- Key Metrics table
- Trend Analysis
- Cohort insights (if applicable)
- Actionable Recommendations
- Next steps`,
        metrics: `Define and document the following metrics:
- Business definition
- Calculation formula
- Data sources required
- Update frequency
- Success benchmarks / industry standards
- Related metrics`,
        story: `Write a data story (narrative) that explains the data to a non-technical audience:
- Start with the business question
- Use plain English
- Explain what the numbers mean, not just what they are
- Include actionable insights
- End with a clear recommendation`,
    };

    // Try to run terminal for quick data queries if SQL
    const queries: string[] = [];
    if (type === 'sql') {
        emitStep('generating', 'Writing SQL queries...');
        const sqlResponse = await ai.models.generateContent({
            model: serverConfig.geminiResearchModel,
            contents: `You are a senior data analyst and SQL expert.
Request: ${intent}
${schema ? `Schema:\n${schema}` : ''}
${data ? `Sample data:\n${data.slice(0, 500)}` : ''}
${prompts.sql}
Write in markdown with proper SQL code blocks.`,
        });
        const output = sqlResponse.text ?? '';
        const sqlMatches = output.match(/```sql([\s\S]*?)```/gi) ?? [];
        sqlMatches.forEach((q) => queries.push(q.replace(/```sql\n?|```/g, '').trim()));
        emitStep('skill_result', `${queries.length} SQL queries generated`, { success: true });
        emitStep('done', `Data analysis complete — ${queries.length} queries`, { success: true });
        return { output, queries };
    }

    emitStep('generating', `Running ${type} analysis...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `You are a senior data analyst.
Request: ${intent}
${data ? `\nData/Context:\n${data.slice(0, 1000)}` : ''}
${prompts[type]}
Write in markdown with tables where useful.`,
    });

    const output = response.text ?? '';
    emitStep('skill_result', `Analysis complete — ${output.split(/\s+/).length} words`, { success: true });
    emitStep('done', 'Data task complete', { success: true });
    return { output, queries };
}

export const dataAgentApp = express();
dataAgentApp.use(express.json());
dataAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(DATA_AGENT_MANIFEST));
