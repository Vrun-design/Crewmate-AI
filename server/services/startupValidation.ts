import { serverConfig } from '../config';

function isLocalhostUrl(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}

export function validateStartupConfig(): void {
  if (!serverConfig.isProduction) {
    return;
  }

  const errors: string[] = [];

  if (serverConfig.exposeDevAuthCode) {
    errors.push('AUTH_EXPOSE_DEV_CODE must be false in production.');
  }

  if (!serverConfig.encryptionKey.trim()) {
    errors.push('CREWMATE_ENCRYPTION_KEY is required in production.');
  }

  if (!serverConfig.geminiApiKey.trim()) {
    errors.push('GOOGLE_API_KEY or GEMINI_API_KEY is required in production.');
  }

  if (!serverConfig.firebaseProjectId.trim()) {
    errors.push('FIREBASE_PROJECT_ID is required in production.');
  }

  if (!serverConfig.firebaseWebApiKey.trim() || !serverConfig.firebaseWebAuthDomain.trim() || !serverConfig.firebaseWebAppId.trim()) {
    errors.push('VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_APP_ID are required in production.');
  }

  if (serverConfig.featureFlags.slackInbound && !serverConfig.slackSigningSecret.trim()) {
    errors.push('SLACK_SIGNING_SECRET is required when FEATURE_SLACK_INBOUND=true in production.');
  }

  if (!serverConfig.publicAppUrl.trim() || isLocalhostUrl(serverConfig.publicAppUrl)) {
    errors.push('PUBLIC_APP_URL must be set to a non-localhost URL in production.');
  }

  if (!serverConfig.publicWebAppUrl.trim() || isLocalhostUrl(serverConfig.publicWebAppUrl)) {
    errors.push('PUBLIC_WEB_APP_URL must be set to a non-localhost URL in production.');
  }

  if (errors.length > 0) {
    throw new Error(`Production startup validation failed:\n- ${errors.join('\n- ')}`);
  }
}
