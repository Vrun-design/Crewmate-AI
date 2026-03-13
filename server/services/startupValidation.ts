import { serverConfig } from '../config';

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

  if (!serverConfig.firebaseProjectId.trim()) {
    errors.push('FIREBASE_PROJECT_ID is required in production.');
  }

  if (!serverConfig.firebaseWebApiKey.trim() || !serverConfig.firebaseWebAuthDomain.trim() || !serverConfig.firebaseWebAppId.trim()) {
    errors.push('VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_APP_ID are required in production.');
  }

  if (serverConfig.featureFlags.slackInbound && !serverConfig.slackSigningSecret.trim()) {
    errors.push('SLACK_SIGNING_SECRET is required when FEATURE_SLACK_INBOUND=true in production.');
  }

  if (errors.length > 0) {
    throw new Error(`Production startup validation failed:\n- ${errors.join('\n- ')}`);
  }
}
