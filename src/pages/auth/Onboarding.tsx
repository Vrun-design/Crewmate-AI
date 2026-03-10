import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_LIVE_VOICE } from '../../constants/liveVoices';
import { onboardingService } from '../../services/onboardingService';
import { IntegrationSetupStep } from '../../components/onboarding/IntegrationSetupStep';
import { ManualSetupStep } from '../../components/onboarding/ManualSetupStep';
import { StepOne } from '../../components/onboarding/StepOne';
import { StepTwo } from '../../components/onboarding/StepTwo';
import type { OnboardingStep } from '../../components/onboarding/types';

export function Onboarding(): React.JSX.Element {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [agentName, setAgentName] = useState('Crewmate');
  const [voice, setVoice] = useState(DEFAULT_LIVE_VOICE);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    onboardingService.resetGuidedSetupState();
  }, []);

  async function handleStartGuidedSetup(): Promise<void> {
    setIsSaving(true);
    setError(null);

    try {
      onboardingService.resetGuidedSetupState();
      await onboardingService.queueGuidedSetup({ agentName, voiceModel: voice });
      navigate('/dashboard');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to start guided setup');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinishManualSetup(): Promise<void> {
    setIsSaving(true);
    setError(null);

    try {
      onboardingService.resetGuidedSetupState();
      await onboardingService.saveProfile({ agentName, voiceModel: voice });
      navigate('/dashboard');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to finish onboarding');
    } finally {
      setIsSaving(false);
    }
  }

  const progressPct = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-foreground/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-foreground opacity-[0.03] blur-[100px]" />

      <div className="h-[2px] w-full bg-secondary fixed top-0 left-0 z-50">
        <motion.div
          className="h-full bg-foreground"
          initial={{ width: '0%' }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {isSaving ? (
          <div className="mb-4 w-full max-w-xl rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            Saving onboarding setup...
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 w-full max-w-xl rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <StepOne
              agentName={agentName}
              setAgentName={setAgentName}
              voice={voice}
              setVoice={setVoice}
              onNext={() => setStep(2)}
            />
          ) : null}

          {/* Step 2: Choose between Live session or Manual */}
          {step === 2 ? (
            <StepTwo
              onVoice={() => void handleStartGuidedSetup()}
              onManual={() => {
                onboardingService.resetGuidedSetupState();
                setStep(3);
              }}
            />
          ) : null}

          {step === 3 ? (
            <ManualSetupStep onNext={() => setStep(4)} />
          ) : null}

          {step === 4 ? (
            <IntegrationSetupStep onComplete={() => void handleFinishManualSetup()} />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
