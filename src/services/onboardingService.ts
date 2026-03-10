const ONBOARDING_PROFILE_KEY = 'crewmate_onboarding_profile';
const GUIDED_SETUP_KEY = 'crewmate_guided_setup';

export interface OnboardingProfile {
  agentName: string;
  voiceModel: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export const onboardingService = {
  saveProfile(profile: OnboardingProfile): void {
    if (!isBrowser()) {
      return;
    }

    window.localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(profile));
  },
  getProfile(): OnboardingProfile | null {
    if (!isBrowser()) {
      return null;
    }

    const raw = window.localStorage.getItem(ONBOARDING_PROFILE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as OnboardingProfile;
    } catch {
      return null;
    }
  },
  queueGuidedSetup(profile: OnboardingProfile): void {
    if (!isBrowser()) {
      return;
    }

    this.saveProfile(profile);
    window.localStorage.setItem(GUIDED_SETUP_KEY, JSON.stringify(profile));
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
};
