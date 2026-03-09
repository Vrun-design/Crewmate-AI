import {db} from '../db';
import type {UserPreferencesRecord} from '../types';

const defaultPreferences: UserPreferencesRecord = {
  voiceModel: 'alex',
  textModel: 'gemini-3.1-pro',
  imageModel: 'gemini-3.1-flash-image',
  reasoningLevel: 'high',
  proactiveSuggestions: true,
  autoStartScreenShare: false,
  blurSensitiveFields: true,
};

export function getUserPreferences(userId: string): UserPreferencesRecord {
  const row = db.prepare(`
    SELECT
      voice_model as voiceModel,
      text_model as textModel,
      image_model as imageModel,
      reasoning_level as reasoningLevel,
      proactive_suggestions as proactiveSuggestions,
      auto_start_screen_share as autoStartScreenShare,
      blur_sensitive_fields as blurSensitiveFields
    FROM user_preferences
    WHERE user_id = ?
  `).get(userId) as
    | (Omit<UserPreferencesRecord, 'proactiveSuggestions' | 'autoStartScreenShare' | 'blurSensitiveFields'> & {
        proactiveSuggestions: number;
        autoStartScreenShare: number;
        blurSensitiveFields: number;
      })
    | undefined;

  if (!row) {
    return defaultPreferences;
  }

  return {
    ...row,
    proactiveSuggestions: Boolean(row.proactiveSuggestions),
    autoStartScreenShare: Boolean(row.autoStartScreenShare),
    blurSensitiveFields: Boolean(row.blurSensitiveFields),
  };
}

export function saveUserPreferences(userId: string, input: UserPreferencesRecord): UserPreferencesRecord {
  const updatedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO user_preferences (
      user_id,
      voice_model,
      text_model,
      image_model,
      reasoning_level,
      proactive_suggestions,
      auto_start_screen_share,
      blur_sensitive_fields,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      voice_model = excluded.voice_model,
      text_model = excluded.text_model,
      image_model = excluded.image_model,
      reasoning_level = excluded.reasoning_level,
      proactive_suggestions = excluded.proactive_suggestions,
      auto_start_screen_share = excluded.auto_start_screen_share,
      blur_sensitive_fields = excluded.blur_sensitive_fields,
      updated_at = excluded.updated_at
  `).run(
    userId,
    input.voiceModel,
    input.textModel,
    input.imageModel,
    input.reasoningLevel,
    input.proactiveSuggestions ? 1 : 0,
    input.autoStartScreenShare ? 1 : 0,
    input.blurSensitiveFields ? 1 : 0,
    updatedAt,
  );

  return getUserPreferences(userId);
}
