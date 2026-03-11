import React, { useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { ActiveSessionCard } from '../components/dashboard/ActiveSessionCard';
import { GmailInboxCard } from '../components/dashboard/GmailInboxCard';
import { IntegrationsCard } from '../components/dashboard/IntegrationsCard';
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard';
import { RecentTasksCard } from '../components/dashboard/RecentTasksCard';
import { Button } from '../components/ui/Button';
import { LiveSessionOverlay } from '../components/ui/LiveSessionOverlay';
import { PageHeader } from '../components/ui/PageHeader';
import { useDashboard } from '../hooks/useDashboard';
import { useLiveSession } from '../hooks/useLiveSession';
import { useMicrophoneCapture } from '../hooks/useMicrophoneCapture';
import { useScreenShareCapture } from '../hooks/useScreenShareCapture';
import { onboardingService } from '../services/onboardingService';
import { workspaceService } from '../services/workspaceService';
import { buildGuidedSetupMemoryText, buildGuidedSetupPrompt } from '../utils/onboarding';
import { getDisplayNameFromEmail } from '../utils/userName';

export function Dashboard() {
  const [userName, setUserName] = useState('User');
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [hasAttemptedGuidedSetup, setHasAttemptedGuidedSetup] = useState(false);
  const { data, isLoading, error, refresh } = useDashboard();
  const {
    session,
    isBusy,
    error: liveSessionError,
    elapsedLabel,
    isSessionActive,
    isAssistantSpeaking,
    startSession,
    endSession,
    sendMessage,
  } = useLiveSession({
    initialSession: data?.currentSession ?? null,
    onSessionChange: refresh,
  });
  const {
    status: screenShareStatus,
    error: screenShareError,
    isSupported: isScreenShareSupported,
    previewStream,
    startScreenShare,
    stopScreenShare,
  } = useScreenShareCapture({
    sessionId: session?.id ?? null,
    enabled: isSessionActive,
  });
  const {
    status: microphoneStatus,
    error: microphoneError,
    isSupported: isMicrophoneSupported,
    toggleMicrophone,
    stopMicrophone,
  } = useMicrophoneCapture({
    sessionId: session?.id ?? null,
    enabled: isSessionActive,
    isAssistantSpeaking,
  });

  useEffect(() => {
    setUserName(getDisplayNameFromEmail(localStorage.getItem('crewmate_user_email')));
  }, []);

  const tasks = data?.tasks ?? [];
  const activities = data?.activities ?? [];
  const integrations = data?.integrations ?? [];
  const pendingGuidedSetup = onboardingService.getPendingGuidedSetup();
  const activeGuidedSetupSession = onboardingService.getActiveGuidedSetupSession();

  function handleSessionToggle(): void {
    if (isSessionActive) {
      void endSession();
      stopScreenShare();
      void stopMicrophone();
      setIsOverlayOpen(false);
      return;
    }

    void startSession();
    setIsOverlayOpen(true);
  }

  function handleOverlayClose(): void {
    setIsOverlayOpen(false);
  }

  useEffect(() => {
    if (!pendingGuidedSetup || hasAttemptedGuidedSetup || isSessionActive || isBusy) {
      return;
    }

    setHasAttemptedGuidedSetup(true);
    setIsOverlayOpen(true);

    void (async () => {
      const nextSession = await startSession();
      if (!nextSession) {
        return;
      }

      onboardingService.setActiveGuidedSetupSession({
        profile: pendingGuidedSetup,
        sessionId: nextSession.id,
      });
      await sendMessage(buildGuidedSetupPrompt(pendingGuidedSetup), nextSession.id);
      onboardingService.clearPendingGuidedSetup();
    })();
  }, [hasAttemptedGuidedSetup, isBusy, isSessionActive, pendingGuidedSetup, sendMessage, startSession]);

  useEffect(() => {
    if (!session || session.status !== 'ended' || !activeGuidedSetupSession) {
      return;
    }

    if (activeGuidedSetupSession.sessionId !== session.id) {
      return;
    }

    const transcript = session.transcript.filter((message) => message.text.trim());
    onboardingService.clearActiveGuidedSetupSession();

    if (transcript.length === 0) {
      return;
    }

    void workspaceService.ingestMemory({
      title: 'Guided onboarding summary',
      type: 'document',
      searchText: buildGuidedSetupMemoryText(activeGuidedSetupSession.profile, transcript),
    });
  }, [activeGuidedSetupSession, session]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={`Hi ${userName}`}
        description="How can I help you today? Let's build something cool."
      >
        <div className="relative">
          {pendingGuidedSetup && !isSessionActive && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          )}
          <Button
            variant={isSessionActive ? 'danger' : 'primary'}
            onClick={handleSessionToggle}
            disabled={isBusy}
            className={pendingGuidedSetup && !isSessionActive ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background' : ''}
          >
            {isSessionActive ? (
              <>
                <Square size={16} className="fill-current" />
                {isBusy ? 'Ending...' : 'End Session'}
              </>
            ) : (
              <>
                <Play size={16} className="fill-current" />
                {isBusy ? 'Starting...' : 'Start Live Session'}
              </>
            )}
          </Button>
        </div>
      </PageHeader>

      {(error || isLoading || liveSessionError) && (
        <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-muted-foreground">
          {isLoading ? 'Loading local Crewmate workspace...' : liveSessionError ?? `Local API status: ${error}`}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ActiveSessionCard
            session={session}
            isSessionActive={isSessionActive}
            elapsedLabel={elapsedLabel}
            isOverlayOpen={isOverlayOpen}
            microphoneStatus={microphoneStatus}
            previewStream={previewStream}
            screenShareStatus={screenShareStatus}
            onOpenOverlay={() => setIsOverlayOpen(true)}
          />
          <RecentActivityCard activities={activities} />
        </div>

        <div className="space-y-6">
          <GmailInboxCard />
          <RecentTasksCard tasks={tasks} />
          <IntegrationsCard integrations={integrations} />
        </div>
      </div>

      <LiveSessionOverlay
        isOpen={isOverlayOpen && isSessionActive}
        onClose={handleOverlayClose}
        transcript={session?.transcript}
        onSendMessage={sendMessage}
        isBusy={isBusy}
        provider={session?.provider}
        screenShareStatus={screenShareStatus}
        screenShareError={screenShareError}
        isScreenShareSupported={isScreenShareSupported}
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
        microphoneStatus={microphoneStatus}
        microphoneError={microphoneError}
        isMicrophoneSupported={isMicrophoneSupported}
        onToggleMicrophone={toggleMicrophone}
      />
    </div>
  );
}
