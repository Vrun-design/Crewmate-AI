/**
 * GitHub PR Skill — draft and create pull requests
 * Uses GitHub API directly (same pattern as create-issue).
 */
import type { Skill } from '../types';
import { getEffectiveIntegrationConfig } from '../../services/integrationConfigService';

interface GithubPRResult {
    prNumber: number;
    url: string;
    title: string;
    state: string;
}

async function createGithubPR(workspaceId: string, input: {
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
}): Promise<GithubPRResult> {
    const config = getEffectiveIntegrationConfig(workspaceId, 'github');
    const token = config.token ?? '';
    const repoOwner = config.repoOwner ?? '';
    const repoName = config.repoName ?? '';

    if (!token || !repoOwner || !repoName) {
        throw new Error('GitHub integration is not configured. Save a token, repository owner, and repository name.');
    }

    const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/pulls`,
        {
            method: 'POST',
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'crewmate-local-dev',
            },
            body: JSON.stringify({
                title: input.title,
                body: input.body,
                head: input.head,
                base: input.base ?? 'main',
                draft: input.draft ?? false,
            }),
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`GitHub PR creation failed: ${response.status} ${text}`);
    }

    const payload = await response.json() as {
        number: number;
        html_url: string;
        title: string;
        state: string;
    };

    return {
        prNumber: payload.number,
        url: payload.html_url,
        title: payload.title,
        state: payload.state,
    };
}

export const githubCreatePRSkill: Skill = {
    id: 'github.create-pr',
    name: 'Create GitHub Pull Request',
    description: 'Create a pull request on GitHub. Use when the user asks to open a PR, submit changes for review, or merge code.',
    version: '1.0.0',
    category: 'code',
    personas: ['developer'],
    requiresIntegration: ['github'],
    triggerPhrases: [
        'Create a PR for these changes',
        'Open a pull request',
        'Submit this for code review',
        'Draft a PR description',
    ],
    preferredModel: 'research',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'PR title — clear and descriptive' },
            body: { type: 'string', description: 'PR description — what changed, why, and testing notes' },
            head: { type: 'string', description: 'The branch containing changes (e.g. "feature/my-feature")' },
            base: { type: 'string', description: 'Target branch for the PR (default: "main")' },
            draft: { type: 'boolean', description: 'Whether to create as a draft PR' },
        },
        required: ['title', 'body', 'head'],
    },
    handler: async (ctx, args) => {
        const result = await createGithubPR(ctx.workspaceId, {
            title: String(args.title ?? ''),
            body: String(args.body ?? ''),
            head: String(args.head ?? ''),
            base: String(args.base ?? 'main'),
            draft: Boolean(args.draft ?? false),
        });
        return {
            success: true,
            output: result,
            message: `✅ GitHub PR #${result.prNumber} created: "${result.title}" (${result.url})`,
        };
    },
};
