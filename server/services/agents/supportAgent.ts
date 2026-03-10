/**
 * Support Agent — Phase 12 Full Workforce
 * Customer ticket triage, FAQ drafts, escalation emails, response templates
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const SUPPORT_AGENT_MANIFEST = {
    id: 'crewmate-support-agent',
    name: 'Support Agent',
    department: 'Support',
    description: 'Ticket triage, customer response drafting, FAQ generation, escalation emails, and support playbooks.',
    capabilities: ['ticket_triage', 'response_drafting', 'faq', 'escalation', 'playbooks'],
    skills: ['gmail.send', 'slack.post-message', 'notion.create-page'],
    model: serverConfig.geminiTextModel,
    emoji: '🎧',
};

export async function runSupportAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'response' | 'faq' | 'triage' | 'escalation' | 'playbook'; customerName?: string; urgency?: 'low' | 'medium' | 'high' } = {},
): Promise<{ output: string; priority?: string }> {
    const ai = createGeminiClient();
    const { type = 'response', customerName, urgency = 'medium' } = options;

    emitStep('thinking', 'Analyzing support request...', { detail: intent });

    const prompts: Record<string, string> = {
        response: `Write a professional, empathetic customer support response. 
Resolve the issue clearly, apologize if appropriate, provide next steps.
${customerName ? `Address the customer as: ${customerName}` : ''}
Tone: helpful, concise, professional`,
        faq: `Create an FAQ document from the following topic. Format as Q&A pairs with clear, concise answers. Include 5-8 most likely questions.`,
        triage: `Analyze this support request and provide:
1. Priority level (Critical/High/Medium/Low) with reasoning
2. Category (Bug/Feature Request/How-to/Billing/Other)
3. Suggested owner/team
4. Suggested response time SLA
5. Draft acknowledgment message`,
        escalation: `Write an internal escalation email to the engineering/product team.
Include: Customer impact, Business impact, Steps to reproduce, Expected vs actual behavior, Urgency (${urgency}).`,
        playbook: `Create a support playbook for handling this type of issue:
- Identification criteria
- Initial response template
- Investigation steps (numbered)
- Resolution paths
- Escalation triggers
- Follow-up checklist`,
    };

    emitStep('generating', `Drafting ${type}...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiTextModel,
        contents: `You are an expert customer support specialist.
Issue/Request: ${intent}
${prompts[type]}
Write in markdown.`,
    });

    const output = response.text ?? '';

    // Extract priority for triage
    let priority: string | undefined;
    if (type === 'triage') {
        const match = /Priority level[:\s]+(\w+)/i.exec(output);
        priority = match?.[1];
        emitStep('skill_result', `Triaged as ${priority ?? urgency} priority`, { success: true });
    } else {
        emitStep('skill_result', `${type} document ready`, { success: true });
    }

    // If escalation, post to Slack
    if (type === 'escalation' && urgency === 'high') {
        emitStep('skill_call', 'Notifying team on Slack...', { skillId: 'slack.post-message' });
        try {
            await runSkill('slack.post-message', ctx, { text: `🚨 *High Priority Escalation*\n${output.slice(0, 400)}` });
            emitStep('skill_result', 'Slack notification sent', { skillId: 'slack.post-message', success: true });
        } catch {
            emitStep('skill_result', 'Slack not connected', { skillId: 'slack.post-message', success: false });
        }
    }

    emitStep('done', 'Support task complete', { success: true });
    return { output, priority };
}

export const supportAgentApp = express();
supportAgentApp.use(express.json());
supportAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(SUPPORT_AGENT_MANIFEST));
