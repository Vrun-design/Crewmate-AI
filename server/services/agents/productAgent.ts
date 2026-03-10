/**
 * Product Agent — Phase 12 Full Workforce
 * User stories, PRD drafting, backlog grooming, sprint planning, feature specs
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const PRODUCT_AGENT_MANIFEST = {
    id: 'crewmate-product-agent',
    name: 'Product Agent',
    department: 'Product',
    description: 'User story writing, PRD drafting, backlog grooming, sprint planning, and feature specifications.',
    capabilities: ['user_stories', 'prd', 'backlog', 'sprint_planning', 'feature_specs'],
    skills: ['clickup.create-task', 'notion.create-page', 'github.create-issue', 'web.search'],
    model: serverConfig.geminiResearchModel,
    emoji: '🗂️',
};

export async function runProductAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'user_story' | 'prd' | 'sprint' | 'spec'; createTicket?: boolean } = {},
): Promise<{ output: string; ticketCreated: boolean }> {
    const ai = createGeminiClient();
    const { type = 'user_story', createTicket = false } = options;

    emitStep('thinking', 'Analyzing product requirement...', { detail: intent });

    const prompts: Record<string, string> = {
        user_story: `Write user stories in the format: "As a [persona], I want [goal] so that [benefit]."
Include: Acceptance Criteria (3-5 bullet points), Dependencies, Definition of Done.`,
        prd: `Write a Product Requirements Document with sections:
1. Overview & Problem Statement
2. User Personas & Pain Points
3. Proposed Solution
4. User Stories & Flows
5. Success Metrics
6. Technical Considerations
7. Out of Scope`,
        sprint: `Create a sprint plan with:
- Sprint Goal
- User Stories (prioritized)
- Story Points per story
- Dependencies
- Risk flags`,
        spec: `Write a detailed feature specification with:
- Feature Overview
- User flows (numbered steps)
- Edge cases + error states
- API requirements (if any)
- Design requirements`,
    };

    emitStep('generating', `Writing ${type.replace('_', ' ')}...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `You are a senior product manager.
Request: ${intent}
${prompts[type]}
Write in markdown. Be specific and actionable.`,
    });

    const output = response.text ?? '';
    emitStep('skill_result', `${type} ready — ${output.split(/\s+/).length} words`, { success: true });

    let ticketCreated = false;
    if (createTicket) {
        emitStep('skill_call', 'Creating ClickUp task...', { skillId: 'clickup.create-task' });
        try {
            const t0 = Date.now();
            await runSkill('clickup.create-task', ctx, {
                name: intent.slice(0, 100),
                description: output.slice(0, 2000),
                priority: 3,
            });
            ticketCreated = true;
            emitStep('skill_result', 'ClickUp task created', { skillId: 'clickup.create-task', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'ClickUp not connected — saving to Notion instead', { skillId: 'clickup.create-task', success: false });
            try {
                await runSkill('notion.create-page', ctx, { title: intent.slice(0, 100), content: output });
                ticketCreated = true;
                emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', success: true });
            } catch {
                emitStep('skill_result', 'Neither ClickUp nor Notion connected', { success: false });
            }
        }
    }

    emitStep('done', `Product ${type} complete`, { success: true });
    return { output, ticketCreated };
}

export const productAgentApp = express();
productAgentApp.use(express.json());
productAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(PRODUCT_AGENT_MANIFEST));
