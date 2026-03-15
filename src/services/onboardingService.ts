import { api } from '../lib/api';
import { getUserFacingErrorMessage } from '../utils/errorHandling';

export interface OnboardingProfile {
  agentName: string;
  voiceModel: string;
  userName?: string;
  customSoul?: string;
}

export const onboardingService = {
  async saveProfile(profile: OnboardingProfile): Promise<void> {
    await api.put('/api/onboarding/profile', profile);
  },
  async getProfile(): Promise<OnboardingProfile | null> {
    try {
      return await api.get<OnboardingProfile>('/api/onboarding/profile');
    } catch (error) {
      throw new Error(getUserFacingErrorMessage(error, 'Unable to load orchestrator profile'));
    }
  },
};
