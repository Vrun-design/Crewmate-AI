import type { Skill } from '../types';
import { createGithubIssue } from '../../services/githubService';

export const githubCreateIssueSkill: Skill = {
    id: 'github.create-issue',
    name: 'Create GitHub Issue',
    description: 'File a new issue in the connected GitHub repository. Use when the user spots a bug, wants to track a feature request, or reports a technical problem.',
    version: '1.0.0',
    category: 'code',
    personas: ['developer', 'founder'],
    requiresIntegration: ['github'],
    triggerPhrases: [
        'Create a GitHub issue for this bug',
        'File an issue for this problem',
        'Log this as a GitHub issue',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Issue title — clear and descriptive' },
            body: { type: 'string', description: 'Full issue description with steps to reproduce, expected vs actual behavior' },
            labels: { type: 'array', description: 'Optional labels like "bug", "enhancement"', items: { type: 'string' } },
        },
        required: ['title', 'body'],
    },
    handler: async (ctx, args) => {
        const result = await createGithubIssue(ctx.workspaceId, {
            title: String(args.title ?? ''),
            body: String(args.body ?? ''),
            labels: Array.isArray(args.labels) ? args.labels.map(String) : [],
        });
        return {
            success: true,
            output: result,
            message: `✅ GitHub issue #${result.issueNumber} filed: "${result.title}" (${result.url})`,
        };
    },
};
