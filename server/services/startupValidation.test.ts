import { describe, expect, test } from 'vitest';
import { serverConfig } from '../config';
import { validateStartupConfig } from './startupValidation';

describe('startupValidation', () => {
  test('fails production boot when unsafe settings are enabled', () => {
    const original = {
      isProduction: serverConfig.isProduction,
      exposeDevAuthCode: serverConfig.exposeDevAuthCode,
      encryptionKey: serverConfig.encryptionKey,
      geminiApiKey: serverConfig.geminiApiKey,
      firebaseProjectId: serverConfig.firebaseProjectId,
      firebaseWebApiKey: serverConfig.firebaseWebApiKey,
      firebaseWebAuthDomain: serverConfig.firebaseWebAuthDomain,
      firebaseWebAppId: serverConfig.firebaseWebAppId,
      publicAppUrl: serverConfig.publicAppUrl,
      publicWebAppUrl: serverConfig.publicWebAppUrl,
      slackInbound: serverConfig.featureFlags.slackInbound,
      slackSigningSecret: serverConfig.slackSigningSecret,
    };

    serverConfig.isProduction = true;
    serverConfig.exposeDevAuthCode = true;
    serverConfig.encryptionKey = '';
    serverConfig.geminiApiKey = '';
    serverConfig.firebaseProjectId = '';
    serverConfig.firebaseWebApiKey = '';
    serverConfig.firebaseWebAuthDomain = '';
    serverConfig.firebaseWebAppId = '';
    serverConfig.publicAppUrl = 'http://localhost:8787';
    serverConfig.publicWebAppUrl = 'http://localhost:3000';
    serverConfig.featureFlags.slackInbound = true;
    serverConfig.slackSigningSecret = '';

    expect(() => validateStartupConfig()).toThrow(/Production startup validation failed/);

    serverConfig.isProduction = original.isProduction;
    serverConfig.exposeDevAuthCode = original.exposeDevAuthCode;
    serverConfig.encryptionKey = original.encryptionKey;
    serverConfig.geminiApiKey = original.geminiApiKey;
    serverConfig.firebaseProjectId = original.firebaseProjectId;
    serverConfig.firebaseWebApiKey = original.firebaseWebApiKey;
    serverConfig.firebaseWebAuthDomain = original.firebaseWebAuthDomain;
    serverConfig.firebaseWebAppId = original.firebaseWebAppId;
    serverConfig.publicAppUrl = original.publicAppUrl;
    serverConfig.publicWebAppUrl = original.publicWebAppUrl;
    serverConfig.featureFlags.slackInbound = original.slackInbound;
    serverConfig.slackSigningSecret = original.slackSigningSecret;
  });
});
