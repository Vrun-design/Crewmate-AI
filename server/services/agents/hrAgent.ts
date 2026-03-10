/**
 * HR Agent — Phase 12 Full Workforce
 * Job descriptions, interview questions, offer letters, onboarding plans
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
    description: 'Job descriptions, interview question banks, offer letters, onboarding plans, and performance reviews.',
    capabilities: ['job_descriptions', 'interview_questions', 'offer_letters', 'onboarding', 'performance'],
    skills: ['notion.create-page', 'gmail.send', 'web.search'],
    model: serverConfig.geminiTextModel,
    emoji: '👥',
};

export async function runHRAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'jd' | 'interview' | 'offer' | 'onboarding' | 'review'; role?: string; saveToNotion?: boolean } = {},
): Promise<{ output: string; savedToNotion: boolean }> {
    const ai = createGeminiClient();
    const { type = 'jd', role, saveToNotion = false } = options;

    emitStep('thinking', `Preparing ${type} for ${role ?? 'the role'}...`);

    const prompts: Record<string, string> = {
        jd: `Write a compelling job description with: Role Overview, Key Responsibilities (6-8 bullets), Requirements (must-have vs nice-to-have), What We Offer, Company Culture snippet. Be specific and avoid jargon.`,
        interview: `Create a structured interview guide with:
- Warmup questions (2)
- Technical/role-specific questions (5-7) with evaluation rubric
- Behavioral questions using STAR format (3)
- Culture fit questions (2)
- Questions the candidate might ask`,
        offer: `Draft a professional offer letter with: Role title, Start date placeholder, Compensation placeholder, Benefits highlights, Acceptance deadline, warm, professional tone.`,
        onboarding: `Create a 30-day onboarding plan with:
- Week 1: Orientation + tools setup
- Week 2: Team introductions + process learning
- Week 3-4: First project
- Success metrics at day 30`,
        review: `Create a performance review framework with: Self-assessment questions, Manager evaluation rubric, Goals for next period, Development areas, Overall rating guide.`,
    };

    emitStep('generating', `Writing ${type} document...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiTextModel,
        contents: `You are an experienced HR professional and people ops expert.
${role ? `Role: ${role}` : ''}
Request: ${intent}
${prompts[type]}
Write in markdown. Professional but warm tone.`,
    });

    const output = response.text ?? '';
    emitStep('skill_result', `${type} document ready — ${output.split(/\s+/).length} words`, { success: true });

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

    emitStep('done', 'HR document ready', { success: true });
    return { output, savedToNotion };
}

export const hrAgentApp = express();
hrAgentApp.use(express.json());
hrAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(HR_AGENT_MANIFEST));
