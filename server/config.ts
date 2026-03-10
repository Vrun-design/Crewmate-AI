function parseBooleanEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
}

export const serverConfig = {
  appEnv: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '8787', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '25mb',
  databasePath: process.env.CREWMATE_DB_PATH ?? 'data/crewmate.db',
  encryptionKey: process.env.CREWMATE_ENCRYPTION_KEY ?? '',
  geminiApiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '',
  allowUnsafeCustomSkillWebhooks: parseBooleanEnv('ALLOW_UNSAFE_CUSTOM_SKILL_WEBHOOKS'),
  featureFlags: {
    offshiftInbox: parseBooleanEnv('FEATURE_OFFSHIFT_INBOX'),
    jobTypesV2: parseBooleanEnv('FEATURE_JOB_TYPES_V2'),
    slackInbound: parseBooleanEnv('FEATURE_SLACK_INBOUND'),
    approvalGates: parseBooleanEnv('FEATURE_APPROVAL_GATES'),
  },

  // ── Model routing ──────────────────────────────────────────────────────────
  // Live audio — real-time bidirectional sessions
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.5-flash-native-audio-preview-12-2025',
  // Quick tasks — orchestration, routing, skill calls
  geminiTextModel: process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.1-flash-lite-preview',
  // Deep research + content generation
  geminiResearchModel: process.env.GEMINI_RESEARCH_MODEL ?? 'gemini-3.1-pro-preview',
  // Multi-agent orchestration (intent classification, task routing)
  geminiOrchestrationModel: process.env.GEMINI_ORCHESTRATION_MODEL ?? 'gemini-3.1-pro-preview',
  // Creative + image generation/editing
  geminiCreativeModel: process.env.GEMINI_CREATIVE_MODEL ?? 'gemini-3.1-flash-image-preview',
  // Ultra-fast responses (filler, confirmations)
  geminiLiteModel: process.env.GEMINI_LITE_MODEL ?? 'gemini-3.1-flash-lite-preview',

  // ── Live API voices ────────────────────────────────────────────────────────
  // Supported voices: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-native-audio-preview
  geminiLiveVoices: ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'] as const,

  // ── Integrations ──────────────────────────────────────────────────────────
  githubToken: process.env.GITHUB_TOKEN ?? '',
  githubRepoOwner: process.env.GITHUB_REPO_OWNER ?? '',
  githubRepoName: process.env.GITHUB_REPO_NAME ?? '',
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? '',
  slackDefaultChannelId: process.env.SLACK_DEFAULT_CHANNEL_ID ?? '',
  notionToken: process.env.NOTION_TOKEN ?? '',
  notionParentPageId: process.env.NOTION_PARENT_PAGE_ID ?? '',
  clickupToken: process.env.CLICKUP_TOKEN ?? '',
  clickupListId: process.env.CLICKUP_LIST_ID ?? '',
};
