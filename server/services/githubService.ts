import {getEffectiveIntegrationConfig} from './integrationConfigService';

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

function getGithubConfig(userId: string) {
  const config = getEffectiveIntegrationConfig(userId, 'github');
  return {
    token: config.token ?? '',
    repoOwner: config.repoOwner ?? '',
    repoName: config.repoName ?? '',
  };
}

export function isGithubConfigured(userId: string) {
  const config = getGithubConfig(userId);
  return Boolean(config.token && config.repoOwner && config.repoName);
}

export async function createGithubIssue(userId: string, input: CreateGithubIssueInput): Promise<GithubIssueResult> {
  const config = getGithubConfig(userId);
  if (!isGithubConfigured(userId)) {
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
