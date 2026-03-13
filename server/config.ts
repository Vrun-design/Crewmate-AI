function parseBooleanEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
}

const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const appEnv = process.env.NODE_ENV ?? 'development';
const isProduction = appEnv === 'production';

export const serverConfig = {
  appEnv,
  isProduction,
  port,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  publicAppUrl: process.env.PUBLIC_APP_URL ?? `http://localhost:${port}`,
  publicWebAppUrl: process.env.PUBLIC_WEB_APP_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '25mb',
  databasePath: process.env.CREWMATE_DB_PATH ?? 'data/crewmate.db',
  artifactStoragePath: process.env.CREWMATE_ARTIFACTS_PATH ?? 'data/artifacts',
  encryptionKey: process.env.CREWMATE_ENCRYPTION_KEY ?? '',
  exposeDevAuthCode: parseBooleanEnv('AUTH_EXPOSE_DEV_CODE', !isProduction),
  inboundCommandToken: process.env.CREWMATE_COMMAND_TOKEN ?? '',
  screenshotShareTtlMs: Number.parseInt(process.env.SCREENSHOT_SHARE_TTL_MS ?? `${60 * 60 * 1000}`, 10),
  geminiApiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ?? '',
  firebaseWebApiKey: process.env.VITE_FIREBASE_API_KEY ?? '',
  firebaseWebAuthDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  firebaseWebAppId: process.env.VITE_FIREBASE_APP_ID ?? '',
  firebaseWebMessagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  firebaseWebStorageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  firebaseWebMeasurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID ?? '',
  featureFlags: {
    slackInbound: parseBooleanEnv('FEATURE_SLACK_INBOUND'),
    approvalGates: parseBooleanEnv('FEATURE_APPROVAL_GATES'),
    uiNavigator: parseBooleanEnv('FEATURE_UI_NAVIGATOR', true),
    researchGrounding: parseBooleanEnv('FEATURE_RESEARCH_GROUNDING', true),
  },

  // ── Model routing ──────────────────────────────────────────────────────────
  // Live audio — real-time bidirectional sessions (native audio multimodal)
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.5-flash-native-audio-preview-12-2025',
  // Quick tasks — orchestration, routing, skill calls
  geminiTextModel: process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.1-flash-lite-preview',
  // Deep research + content generation
  geminiResearchModel: process.env.GEMINI_RESEARCH_MODEL ?? 'gemini-3.1-pro-preview',
  // Multi-agent orchestration (intent classification, task routing)
  geminiOrchestrationModel: process.env.GEMINI_ORCHESTRATION_MODEL ?? 'gemini-3.1-pro-preview',
  // Creative/content-heavy generation
  geminiCreativeModel: process.env.GEMINI_CREATIVE_MODEL ?? 'gemini-3.1-flash-image-preview',
  // Ultra-fast responses (filler, confirmations)
  geminiLiteModel: process.env.GEMINI_LITE_MODEL ?? 'gemini-3.1-flash-lite-preview',

  // ── Live API voices ────────────────────────────────────────────────────────
  // Supported voices: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-native-audio-preview
  geminiLiveVoices: ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'] as const,

  // ── Integrations ──────────────────────────────────────────────────────────
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? '',
  slackDefaultChannelId: process.env.SLACK_DEFAULT_CHANNEL_ID ?? '',
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET ?? '',
  slackClientId: process.env.SLACK_CLIENT_ID ?? '',
  slackClientSecret: process.env.SLACK_CLIENT_SECRET ?? '',
  slackRedirectUri: process.env.SLACK_REDIRECT_URI ?? '',
  notionToken: process.env.NOTION_TOKEN ?? '',
  notionParentPageId: process.env.NOTION_PARENT_PAGE_ID ?? '',
  notionClientId: process.env.NOTION_CLIENT_ID ?? '',
  notionClientSecret: process.env.NOTION_CLIENT_SECRET ?? '',
  notionRedirectUri: process.env.NOTION_REDIRECT_URI ?? '',
  clickupToken: process.env.CLICKUP_TOKEN ?? '',
  clickupListId: process.env.CLICKUP_LIST_ID ?? '',
  clickupClientId: process.env.CLICKUP_CLIENT_ID ?? '',
  clickupClientSecret: process.env.CLICKUP_CLIENT_SECRET ?? '',
  clickupRedirectUri: process.env.CLICKUP_REDIRECT_URI ?? '',
  googleWorkspaceClientId: process.env.GOOGLE_WORKSPACE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '',
  googleWorkspaceClientSecret: process.env.GOOGLE_WORKSPACE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleWorkspaceRedirectUri: process.env.GOOGLE_WORKSPACE_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI ?? '',
};
