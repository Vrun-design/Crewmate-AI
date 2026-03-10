/**
 * Communications Agent — Phase 11 (Inline, with step streaming)
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const COMMS_AGENT_MANIFEST = {
    id: 'crewmate-communications-agent',
    name: 'Communications Agent',
    department: 'Comms',
    description: 'Email drafting, Slack messages, follow-up sequences, professional outreach.',
    capabilities: ['email', 'slack', 'outreach', 'tone_calibration'],
    skills: ['gmail.send', 'gmail.draft', 'slack.post-message'],
    model: serverConfig.geminiTextModel,
    emoji: '📧',
};

export async function runCommunicationsAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { channel?: 'email' | 'slack'; to?: string; tone?: string; context?: string; send?: boolean } = {},
): Promise<{ draft: string; sent: boolean; executionResult?: unknown }> {
    const { channel = 'email', to, tone = 'professional', context = '', send = false } = options;
    const ai = createGeminiClient();

    emitStep('thinking', `Drafting ${channel} message...`, { detail: intent });

    const channelInstructions = channel === 'slack'
        ? 'Write a concise Slack message (1-3 short paragraphs, emoji-friendly, direct).'
        : `Write a professional email${to ? ` to ${to}` : ''}. Include Subject line and Body separately formatted as:\nSUBJECT: <subject>\nBODY:\n<body>`;

    emitStep('generating', `Composing ${channel === 'email' ? 'email' : 'Slack message'}...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiTextModel,
        contents: `You are an expert communications specialist. Tone: ${tone}.
${channelInstructions}
${context ? `Context: ${context}` : ''}
Request: ${intent}`,
    });

    const draft = response.text ?? '';
    emitStep('skill_result', 'Draft ready', { success: true, detail: `${draft.split(/\s+/).length} words` });

    let executionResult: unknown = null;
    if (send && channel === 'email' && to) {
        emitStep('skill_call', `Sending email to ${to}...`, { skillId: 'gmail.send' });
        try {
            const t0 = Date.now();
            const subjectMatch = /SUBJECT:\s*(.+)/.exec(draft);
            const bodyMatch = /BODY:\s*([\s\S]+)/.exec(draft);
            if (subjectMatch && bodyMatch) {
                const run = await runSkill('gmail.send', ctx, { to, subject: subjectMatch[1].trim(), body: bodyMatch[1].trim() });
                executionResult = run.result;
                emitStep('skill_result', 'Email sent', { skillId: 'gmail.send', durationMs: Date.now() - t0, success: true });
            }
        } catch {
            emitStep('skill_result', 'Gmail not connected — saved as draft only', { skillId: 'gmail.send', success: false });
        }
    } else if (send && channel === 'slack') {
        emitStep('skill_call', 'Posting to Slack...', { skillId: 'slack.post-message' });
        try {
            const t0 = Date.now();
            const run = await runSkill('slack.post-message', ctx, { text: draft });
            executionResult = run.result;
            emitStep('skill_result', 'Posted to Slack', { skillId: 'slack.post-message', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'Slack not connected', { skillId: 'slack.post-message', success: false });
        }
    }

    emitStep('done', `${send && executionResult ? 'Message sent' : 'Draft ready'}`, { success: true });
    return { draft, sent: send && executionResult !== null, executionResult };
}

export const communicationsAgentApp = express();
communicationsAgentApp.use(express.json());
communicationsAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(COMMS_AGENT_MANIFEST));
