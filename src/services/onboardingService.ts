import { api } from '../lib/api';

const GUIDED_SETUP_KEY = 'crewmate_guided_setup';
const ACTIVE_GUIDED_SESSION_KEY = 'crewmate_active_guided_session';

export interface OnboardingProfile {
  agentName: string;
  voiceModel: string;
}

export interface ActiveGuidedSetupSession {
  profile: OnboardingProfile;
  sessionId: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export const onboardingService = {
  async saveProfile(profile: OnboardingProfile): Promise<void> {
    await api.put('/api/onboarding/profile', profile);
  },
  async getProfile(): Promise<OnboardingProfile | null> {
    try {
      return await api.get<OnboardingProfile>('/api/onboarding/profile');
    } catch {
      return null;
    }
  },
  async queueGuidedSetup(profile: OnboardingProfile): Promise<void> {
    await this.saveProfile(profile);

    if (!isBrowser()) {
      return;
    }

    window.localStorage.setItem(GUIDED_SETUP_KEY, JSON.stringify(profile));
  },
  resetGuidedSetupState(): void {
    if (!isBrowser()) {
      return;
    }

    window.localStorage.removeItem(GUIDED_SETUP_KEY);
    window.localStorage.removeItem(ACTIVE_GUIDED_SESSION_KEY);
  },
  getPendingGuidedSetup(): OnboardingProfile | null {
    if (!isBrowser()) {
      return null;
    }

    const raw = window.localStorage.getItem(GUIDED_SETUP_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as OnboardingProfile;
    } catch {
      return null;
    }
  },
  clearPendingGuidedSetup(): void {
    if (!isBrowser()) {
      return;
    }

    window.localStorage.removeItem(GUIDED_SETUP_KEY);
  },
  setActiveGuidedSetupSession(payload: ActiveGuidedSetupSession): void {
    if (!isBrowser()) {
      return;
    }

    window.localStorage.setItem(ACTIVE_GUIDED_SESSION_KEY, JSON.stringify(payload));
  },
  getActiveGuidedSetupSession(): ActiveGuidedSetupSession | null {
    if (!isBrowser()) {
      return null;
    }

    const raw = window.localStorage.getItem(ACTIVE_GUIDED_SESSION_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as ActiveGuidedSetupSession;
    } catch {
      return null;
    }
  },
  clearActiveGuidedSetupSession(): void {
    if (!isBrowser()) {
      return;
    }

    window.localStorage.removeItem(ACTIVE_GUIDED_SESSION_KEY);
  },
};
