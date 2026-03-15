import { db } from '../db';
import { getUserPreferences, saveUserPreferences } from './preferencesService';

export interface OnboardingProfileInput {
  agentName: string;
  voiceModel: string;
  userName?: string;
  customSoul?: string;
}

export interface OnboardingProfileRecord extends OnboardingProfileInput {
  userName: string;
  customSoul: string;
  updatedAt: string;
}

const DEFAULT_AGENT_NAME = 'Crewmate';

export function getOnboardingProfile(userId: string): OnboardingProfileRecord {
  const row = db.prepare(`
    SELECT agent_name as agentName, user_name as userName, custom_soul as customSoul, updated_at as updatedAt
    FROM onboarding_profiles
    WHERE user_id = ?
  `).get(userId) as { agentName: string; userName: string; customSoul: string; updatedAt: string } | undefined;

  if (!row) {
    return {
      agentName: DEFAULT_AGENT_NAME,
      userName: '',
      customSoul: '',
      voiceModel: getUserPreferences(userId).voiceModel,
      updatedAt: new Date(0).toISOString(),
    };
  }

  return {
    ...row,
    voiceModel: getUserPreferences(userId).voiceModel,
  };
}

export function saveOnboardingProfile(userId: string, input: OnboardingProfileInput): OnboardingProfileRecord {
  const updatedAt = new Date().toISOString();
  const agentName = input.agentName.trim() || DEFAULT_AGENT_NAME;
  const userName = input.userName?.trim() ?? '';
  const customSoul = input.customSoul?.trim() ?? '';

  db.prepare(`
    INSERT INTO onboarding_profiles (user_id, agent_name, user_name, custom_soul, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      agent_name = excluded.agent_name,
      user_name = excluded.user_name,
      custom_soul = excluded.custom_soul,
      updated_at = excluded.updated_at
  `).run(userId, agentName, userName, customSoul, updatedAt);

  const currentPreferences = getUserPreferences(userId);
  saveUserPreferences(userId, {
    ...currentPreferences,
    voiceModel: input.voiceModel,
  });

  return getOnboardingProfile(userId);
}
