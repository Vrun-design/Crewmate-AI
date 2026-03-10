export const serverConfig = {
  port: Number.parseInt(process.env.PORT ?? '8787', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  databasePath: process.env.CREWMATE_DB_PATH ?? 'data/crewmate.db',
  encryptionKey: process.env.CREWMATE_ENCRYPTION_KEY ?? '',
  geminiApiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '',

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
