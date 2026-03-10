export type OnboardingStep = 1 | 2 | 3 | 4;

export type OnboardingChoiceHandlers = {
  onManual: () => void;
  onVoice: () => void;
};
