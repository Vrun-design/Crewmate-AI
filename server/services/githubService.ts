import { getEffectiveIntegrationConfig } from './integrationConfigService';
import { registerTool } from '../mcp/mcpServer';

interface CreateGithubIssueInput {
  title: string;
  body: string;
  labels?: string[];
}

interface GithubIssueResult {
  issueNumber: number;
  url: string;
  title: string;
}

function getGithubConfig(workspaceId: string) {
  const config = getEffectiveIntegrationConfig(workspaceId, 'github');
  return {
    token: config.token ?? '',
    repoOwner: config.repoOwner ?? '',
    repoName: config.repoName ?? '',
  };
}

export function isGithubConfigured(workspaceId: string) {
  const config = getGithubConfig(workspaceId);
  return Boolean(config.token && config.repoOwner && config.repoName);
}

export async function createGithubIssue(workspaceId: string, input: CreateGithubIssueInput): Promise<GithubIssueResult> {
  const config = getGithubConfig(workspaceId);
  if (!isGithubConfigured(workspaceId)) {
    throw new Error('GitHub integration is not configured. Save a token, repository owner, and repository name.');
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.repoOwner}/${config.repoName}/issues`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'crewmate-local-dev',
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        labels: input.labels ?? [],
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub issue creation failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    number: number;
    html_url: string;
    title: string;
  };

  return {
    issueNumber: payload.number,
    url: payload.html_url,
    title: payload.title,
  };
}

registerTool({
  name: 'create_github_issue',
  description: 'Create a GitHub issue when the user explicitly asks to file, log, or create an issue for an engineering problem.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      labels: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  handler: async (context, args) => {
    const body = typeof args.body === 'string' ? args.body : '';
    const screenshotSection = context.frameData
      ? `\n\n---\n**Screenshot at time of report:**\n![screenshot](data:${context.frameData.mimeType};base64,${context.frameData.data})`
      : '';

    return createGithubIssue(context.workspaceId, {
      title: typeof args.title === 'string' ? args.title : '',
      body: `${body}${screenshotSection}`,
      labels: Array.isArray(args.labels) ? args.labels.map(String) : [],
    });
  },
});
