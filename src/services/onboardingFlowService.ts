const ONBOARDING_COMPLETE_KEY = 'crewmate_onboarding_complete';

export const onboardingFlowService = {
  markComplete(): void {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  },
  reset(): void {
    localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  },
  isComplete(): boolean {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  },
};
