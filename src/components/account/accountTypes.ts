import type { LucideIcon } from 'lucide-react';

export type AccountTabId = 'profile' | 'ai-models' | 'preferences' | 'shortcuts' | 'personas' | 'sessions' | 'activity';

export type AccountUser = {
  id: string;
  email: string;
  name: string;
  plan: string;
};

export type AccountPreferences = {
  voiceModel: string;
  textModel: string;
  imageModel: string;
  reasoningLevel: string;
  proactiveSuggestions: boolean;
  autoStartScreenShare: boolean;
  blurSensitiveFields: boolean;
};

export type AccountTab = {
  id: AccountTabId;
  label: string;
  icon: LucideIcon;
};
