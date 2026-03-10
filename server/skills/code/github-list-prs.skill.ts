import type { Skill } from '../types';
import { getEffectiveIntegrationConfig } from '../../services/integrationConfigService';

interface GithubPR {
    number: number;
    title: string;
    state: string;
    url: string;
    author: string;
    createdAt: string;
    draft: boolean;
}

async function listGithubPRs(workspaceId: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GithubPR[]> {
    const config = getEffectiveIntegrationConfig(workspaceId, 'github');
    const token = config.token ?? '';
    const repoOwner = config.repoOwner ?? '';
    const repoName = config.repoName ?? '';

    if (!token || !repoOwner || !repoName) {
        throw new Error('GitHub integration is not configured. Save a token, repository owner, and repository name.');
    }

    const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/pulls?state=${state}&per_page=20`,
        {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'User-Agent': 'crewmate-local-dev',
            },
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`GitHub list PRs failed: ${response.status} ${text}`);
    }

    const payload = await response.json() as Array<{
        number: number;
        title: string;
        state: string;
        html_url: string;
        draft: boolean;
        created_at: string;
        user: { login: string };
    }>;

    return payload.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: pr.created_at,
        draft: pr.draft,
    }));
}

export const githubListPRsSkill: Skill = {
    id: 'github.list-prs',
    name: 'List GitHub Pull Requests',
    description: 'List open pull requests on GitHub. Use when the user asks to see what PRs are open, check code review status, or get a PR overview.',
    version: '1.0.0',
    category: 'code',
    personas: ['developer'],
    requiresIntegration: ['github'],
    triggerPhrases: [
        'What PRs are open?',
        'Show me the pull requests',
        'List open PRs',
        'What needs code review?',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            state: { type: 'string', description: 'PR state filter: "open", "closed", or "all". Defaults to "open".' },
        },
    },
    handler: async (ctx, args) => {
        const state = (args.state as 'open' | 'closed' | 'all') ?? 'open';
        const prs = await listGithubPRs(ctx.workspaceId, state);
        const summary = prs.map((pr) =>
            `#${pr.number} [${pr.draft ? 'DRAFT' : pr.state.toUpperCase()}] "${pr.title}" by @${pr.author} — ${pr.url}`,
        ).join('\n');
        return {
            success: true,
            output: prs,
            message: prs.length > 0
                ? `✅ Found ${prs.length} ${state} PR(s):\n${summary}`
                : `ℹ️ No ${state} pull requests found.`,
        };
    },
};
