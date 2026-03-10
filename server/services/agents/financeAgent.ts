/**
 * Finance Agent — Phase 12 Full Workforce
 * Invoice drafts, expense summaries, budget breakdowns (text-based, not financial advice)
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const FINANCE_AGENT_MANIFEST = {
    id: 'crewmate-finance-agent',
    name: 'Finance Agent',
    department: 'Finance',
    description: 'Invoice drafts, expense summaries, budget templates, financial reports, and cost analysis (informational only — not financial advice).',
    capabilities: ['invoices', 'expense_summary', 'budget_templates', 'cost_analysis', 'reports'],
    skills: ['notion.create-page', 'gmail.send'],
    model: serverConfig.geminiTextModel,
    emoji: '💰',
};

export async function runFinanceAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'invoice' | 'expense' | 'budget' | 'report' | 'analysis'; saveToNotion?: boolean } = {},
): Promise<{ output: string; savedToNotion: boolean }> {
    const ai = createGeminiClient();
    const { type = 'report', saveToNotion = false } = options;

    emitStep('thinking', `Preparing ${type} document...`);

    const prompts: Record<string, string> = {
        invoice: `Draft a professional invoice template with: Invoice #, Date, From/To fields, Line items table (Description | Qty | Rate | Amount), Subtotal, Tax, Total, Payment terms, Bank details placeholder.`,
        expense: `Create an expense summary report with: Category breakdown table, Total spend, Month-over-month comparison placeholder, Top expenses, Budget vs Actual table, Recommendations to reduce costs.`,
        budget: `Create a quarterly budget template with: Revenue projections, Operating expenses by category (headcount, software, marketing, infra, legal), Capex, Burn rate, Runway estimate. Use markdown tables.`,
        report: `Write a financial summary report with: Executive summary, Revenue highlights, Cost highlights, Key metrics (MRR, CAC, LTV, Burn), Risks & Opportunities, Recommendations.`,
        analysis: `Provide a cost analysis framework for the request. Include: Cost drivers, Fixed vs variable costs, Unit economics, Break-even analysis template, Optimization opportunities.`,
    };

    emitStep('generating', `Writing ${type} document...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiTextModel,
        contents: `You are a CFO-level finance professional. 
IMPORTANT: This is informational only, not financial advice.
Request: ${intent}
${prompts[type]}
Write in markdown with proper tables. Be specific and structured.`,
    });

    const output = response.text ?? '';
    emitStep('skill_result', `${type} ready — ${output.split(/\s+/).length} words`, { success: true });

    let savedToNotion = false;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            await runSkill('notion.create-page', ctx, { title: intent.slice(0, 100), content: output });
            savedToNotion = true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', success: true });
        } catch {
            emitStep('skill_result', 'Notion not connected', { skillId: 'notion.create-page', success: false });
        }
    }

    emitStep('done', 'Finance document ready', { success: true });
    return { output, savedToNotion };
}

export const financeAgentApp = express();
financeAgentApp.use(express.json());
financeAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(FINANCE_AGENT_MANIFEST));
