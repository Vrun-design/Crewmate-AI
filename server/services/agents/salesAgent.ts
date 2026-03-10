/**
 * Sales Agent — Phase 12 Full Workforce
 * Lead research, outreach emails, follow-up sequences, CRM notes
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const SALES_AGENT_MANIFEST = {
    id: 'crewmate-sales-agent',
    name: 'Sales Agent',
    department: 'Sales',
    description: 'Lead research, personalized outreach emails, follow-up sequences, and CRM updates.',
    capabilities: ['lead_research', 'outreach', 'follow_up', 'crm_notes', 'pipeline'],
    skills: ['gmail.send', 'web.search', 'browser.extract', 'notion.create-page'],
    model: serverConfig.geminiTextModel,
    emoji: '💼',
};

export async function runSalesAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { leadName?: string; company?: string; sendEmail?: boolean } = {},
): Promise<{ research: string; email: string; sent: boolean }> {
    const ai = createGeminiClient();
    const { leadName, company, sendEmail = false } = options;

    // Research the lead / company
    let research = '';
    if (company || leadName) {
        const query = [leadName, company].filter(Boolean).join(' ');
        emitStep('skill_call', `Researching ${query}...`, { skillId: 'web.search' });
        try {
            const t0 = Date.now();
            const r = await runSkill('web.search', ctx, { query: `${query} company overview news`, maxResults: 3 });
            research = (r.result as { message?: string }).message ?? '';
            emitStep('skill_result', 'Research gathered', { skillId: 'web.search', durationMs: Date.now() - t0, success: true, detail: `${research.length} chars` });
        } catch {
            emitStep('skill_result', 'Research unavailable', { skillId: 'web.search', success: false });
        }
    }

    // Write personalized outreach
    emitStep('generating', 'Crafting personalized outreach email...');
    const response = await ai.models.generateContent({
        model: serverConfig.geminiTextModel,
        contents: `You are an expert B2B sales professional. Write a personalized, concise outreach email.
Task: ${intent}
${leadName ? `Lead: ${leadName}` : ''}
${company ? `Company: ${company}` : ''}
${research ? `\nResearch context:\n${research.slice(0, 500)}` : ''}

Format as:
SUBJECT: <subject>
BODY:
<email body — 3-4 short paragraphs, personalized opener, clear value prop, soft CTA>`,
    });

    const email = response.text ?? '';
    emitStep('skill_result', `Outreach email ready (${email.split(/\s+/).length} words)`, { success: true });

    // Optionally send
    let sent = false;
    if (sendEmail) {
        emitStep('skill_call', 'Sending email...', { skillId: 'gmail.send' });
        try {
            const subjectMatch = /SUBJECT:\s*(.+)/.exec(email);
            const bodyMatch = /BODY:\s*([\s\S]+)/.exec(email);
            if (subjectMatch && bodyMatch) {
                await runSkill('gmail.send', ctx, { to: '', subject: subjectMatch[1].trim(), body: bodyMatch[1].trim() });
                sent = true;
                emitStep('skill_result', 'Email sent', { skillId: 'gmail.send', success: true });
            }
        } catch {
            emitStep('skill_result', 'Gmail not connected — draft only', { skillId: 'gmail.send', success: false });
        }
    }

    emitStep('done', sent ? 'Outreach sent' : 'Outreach email ready', { success: true });
    return { research, email, sent };
}

export const salesAgentApp = express();
salesAgentApp.use(express.json());
salesAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(SALES_AGENT_MANIFEST));
