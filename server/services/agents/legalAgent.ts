/**
 * Legal Agent — Phase 12 Full Workforce
 * Contract clause review, NDA summaries, compliance checklists (informational only — not legal advice)
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const LEGAL_AGENT_MANIFEST = {
    id: 'crewmate-legal-agent',
    name: 'Legal Agent',
    department: 'Legal',
    description: 'Contract clause analysis, NDA summaries, compliance checklists, policy drafts (informational only — not legal advice).',
    capabilities: ['contract_review', 'nda_summary', 'compliance', 'policy_drafts', 'term_analysis'],
    skills: ['web.search', 'web.summarize-url', 'notion.create-page'],
    model: serverConfig.geminiResearchModel,
    emoji: '⚖️',
};

export async function runLegalAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'review' | 'nda' | 'compliance' | 'policy' | 'terms'; saveToNotion?: boolean } = {},
): Promise<{ output: string; riskFlags: string[]; savedToNotion: boolean }> {
    const ai = createGeminiClient();
    const { type = 'review', saveToNotion = false } = options;

    emitStep('thinking', 'Analyzing legal document/request...', { detail: intent });

    // Research relevant regulations
    let legalContext = '';
    if (type === 'compliance') {
        emitStep('skill_call', 'Researching compliance requirements...', { skillId: 'web.search' });
        try {
            const t0 = Date.now();
            const r = await runSkill('web.search', ctx, { query: `${intent} legal compliance requirements 2025`, maxResults: 3 });
            legalContext = (r.result as { message?: string }).message ?? '';
            emitStep('skill_result', 'Compliance context gathered', { skillId: 'web.search', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Research unavailable', { skillId: 'web.search', success: false });
        }
    }

    const prompts: Record<string, string> = {
        review: `Review the following contract/clause and provide:
1. Plain-English summary of key terms
2. Risk flags 🔴 (high) / 🟡 (medium) / 🟢 (low)
3. Unusual or one-sided clauses to watch
4. Questions to ask the other party
5. Negotiation suggestions

DISCLAIMER: This is informational analysis, not legal advice. Consult a qualified attorney before signing.`,
        nda: `Summarize this NDA/confidentiality agreement:
1. What's confidential (scope)
2. Duration of obligations
3. Permitted disclosures
4. Consequences of breach
5. Key party obligations
6. Red flags or unusual terms

DISCLAIMER: Informational only — not legal advice.`,
        compliance: `Create a compliance checklist for the following requirement:
- Applicable regulations/laws
- Required policies
- Documentation needed
- Employee training requirements
- Reporting obligations
- Penalties for non-compliance

DISCLAIMER: Informational only — consult a legal professional.`,
        policy: `Draft a company policy document with:
- Purpose & Scope
- Definitions
- Policy Statement
- Procedures (numbered steps)
- Responsibilities (roles)
- Consequences for non-compliance
- Review schedule`,
        terms: `Analyze these terms and provide:
1. Plain-English summary
2. Data rights and usage
3. Termination rights
4. Liability limitations
5. Auto-renewal clauses
6. Red flags`,
    };

    emitStep('generating', `Writing ${type} analysis...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `You are a paralegal assistant with expertise in business law.
ALWAYS include: "⚠️ This is informational analysis only, not legal advice. Consult a qualified attorney."
Request: ${intent}
${legalContext ? `\nRegulatory context:\n${legalContext.slice(0, 500)}` : ''}
${prompts[type]}
Write in markdown. Flag risks clearly.`,
    });

    const output = response.text ?? '';

    // Extract risk flags
    const riskFlags = (output.match(/🔴[^\n]+|HIGH RISK[^\n]+/gi) ?? []).map((f) => f.trim());
    emitStep('skill_result', `Analysis complete — ${riskFlags.length} risk flags identified`, { success: true });

    let savedToNotion = false;
    if (saveToNotion) {
        emitStep('saving', 'Saving to Notion...', { skillId: 'notion.create-page' });
        try {
            await runSkill('notion.create-page', ctx, { title: `Legal: ${intent.slice(0, 80)}`, content: output });
            savedToNotion = true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', success: true });
        } catch {
            emitStep('skill_result', 'Notion not connected', { skillId: 'notion.create-page', success: false });
        }
    }

    emitStep('done', `Legal analysis complete — ${riskFlags.length} flags`, { success: true });
    return { output, riskFlags, savedToNotion };
}

export const legalAgentApp = express();
legalAgentApp.use(express.json());
legalAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(LEGAL_AGENT_MANIFEST));
