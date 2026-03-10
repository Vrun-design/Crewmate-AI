/**
 * DevOps Agent — Phase 11 (Inline, with step streaming)
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const DEVOPS_AGENT_MANIFEST = {
    id: 'crewmate-devops-agent',
    name: 'DevOps Agent',
    department: 'Engineering',
    description: 'Code review, GitHub operations, terminal commands, CI/CD, architecture decisions.',
    capabilities: ['code_review', 'github', 'terminal', 'ci_cd', 'architecture'],
    skills: ['github.create-issue', 'github.create-pr', 'terminal.run-command', 'web.search'],
    model: serverConfig.geminiResearchModel,
    emoji: '⚙️',
};

export async function runDevOpsAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { code?: string; language?: string } = {},
): Promise<{ analysis: string; autoExecutions: unknown[] }> {
    const ai = createGeminiClient();
    const { code, language } = options;

    emitStep('thinking', 'Analyzing engineering request...', { detail: intent });

    const codeContext = code ? `\n\nCode to review (${language ?? 'unknown'}):\n\`\`\`${language ?? ''}\n${code}\n\`\`\`` : '';

    emitStep('generating', 'Running engineering analysis...', { detail: `Using ${serverConfig.geminiResearchModel}` });
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `You are an expert Staff Engineer and DevOps specialist.
You have access to GitHub, terminal commands, and engineering knowledge.
Be direct, concrete, and actionable. Format code with markdown.
Current workspace: ${ctx.workspaceId}

Task: ${intent}${codeContext}`,
    });

    const analysis = response.text ?? '';
    emitStep('skill_result', 'Analysis complete', { success: true, detail: `${analysis.split(/\s+/).length} words` });

    const autoExecutions: unknown[] = [];

    // Auto-create GitHub issue if applicable
    if (/create.*issue|file.*bug|log.*issue/i.test(intent)) {
        emitStep('skill_call', 'Creating GitHub issue...', { skillId: 'github.create-issue' });
        try {
            const t0 = Date.now();
            const run = await runSkill('github.create-issue', ctx, {
                title: intent.slice(0, 100),
                body: `${analysis}\n\n---\n*Auto-created by DevOps Agent*`,
                labels: ['agent-created'],
            });
            autoExecutions.push({ skill: 'github.create-issue', result: run.result });
            emitStep('skill_result', 'GitHub issue created', { skillId: 'github.create-issue', durationMs: Date.now() - t0, success: true });
        } catch {
            emitStep('skill_result', 'GitHub not configured — skipping issue creation', { skillId: 'github.create-issue', success: false });
        }
    }

    // Run tests if requested
    if (/run.*test|npm test|check.*test/i.test(intent)) {
        emitStep('skill_call', 'Running tests...', { skillId: 'terminal.run-command' });
        try {
            const t0 = Date.now();
            const run = await runSkill('terminal.run-command', ctx, { command: 'npm test' });
            autoExecutions.push({ skill: 'terminal.run-command', result: run.result });
            const dur = Date.now() - t0;
            const success = (run.result as { success?: boolean }).success !== false;
            emitStep('skill_result', success ? 'Tests passed' : 'Tests failed', { skillId: 'terminal.run-command', durationMs: dur, success });
        } catch {
            emitStep('skill_result', 'Terminal skill unavailable', { skillId: 'terminal.run-command', success: false });
        }
    }

    emitStep('done', `Engineering task complete`, { success: true });
    return { analysis, autoExecutions };
}

export const devOpsAgentApp = express();
devOpsAgentApp.use(express.json());
devOpsAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(DEVOPS_AGENT_MANIFEST));
