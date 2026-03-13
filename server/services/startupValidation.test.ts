import { describe, expect, test } from 'vitest';
import { serverConfig } from '../config';
import { validateStartupConfig } from './startupValidation';

describe('startupValidation', () => {
  test('fails production boot when unsafe settings are enabled', () => {
    const original = {
      isProduction: serverConfig.isProduction,
      exposeDevAuthCode: serverConfig.exposeDevAuthCode,
      encryptionKey: serverConfig.encryptionKey,
      firebaseProjectId: serverConfig.firebaseProjectId,
      firebaseWebApiKey: serverConfig.firebaseWebApiKey,
      firebaseWebAuthDomain: serverConfig.firebaseWebAuthDomain,
      firebaseWebAppId: serverConfig.firebaseWebAppId,
      slackInbound: serverConfig.featureFlags.slackInbound,
      slackSigningSecret: serverConfig.slackSigningSecret,
    };

    serverConfig.isProduction = true;
    serverConfig.exposeDevAuthCode = true;
    serverConfig.encryptionKey = '';
    serverConfig.firebaseProjectId = '';
    serverConfig.firebaseWebApiKey = '';
    serverConfig.firebaseWebAuthDomain = '';
    serverConfig.firebaseWebAppId = '';
    serverConfig.featureFlags.slackInbound = true;
    serverConfig.slackSigningSecret = '';

    expect(() => validateStartupConfig()).toThrow(/Production startup validation failed/);

    serverConfig.isProduction = original.isProduction;
    serverConfig.exposeDevAuthCode = original.exposeDevAuthCode;
    serverConfig.encryptionKey = original.encryptionKey;
    serverConfig.firebaseProjectId = original.firebaseProjectId;
    serverConfig.firebaseWebApiKey = original.firebaseWebApiKey;
    serverConfig.firebaseWebAuthDomain = original.firebaseWebAuthDomain;
    serverConfig.firebaseWebAppId = original.firebaseWebAppId;
    serverConfig.featureFlags.slackInbound = original.slackInbound;
    serverConfig.slackSigningSecret = original.slackSigningSecret;
  });
});
