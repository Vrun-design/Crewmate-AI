import React, { useEffect, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { ActiveSessionCard } from '../components/dashboard/ActiveSessionCard';
import { DashboardQuickStats } from '../components/dashboard/DashboardQuickStats';
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
import { buildGuidedSetupPrompt } from '../utils/onboarding';
import { getDisplayNameFromEmail } from '../utils/userName';

export function Dashboard() {
  const [userName, setUserName] = useState('User');
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [hasAttemptedGuidedSetup, setHasAttemptedGuidedSetup] = useState(false);
  const { data, isLoading, error, refresh } = useDashboard();
  const { session, isBusy, elapsedLabel, isSessionActive, startSession, endSession, sendMessage } = useLiveSession({
    initialSession: data?.currentSession ?? null,
    onSessionChange: refresh,
  });
  const {
    status: screenShareStatus,
    error: screenShareError,
    isSupported: isScreenShareSupported,
    startScreenShare,
    stopScreenShare,
  } = useScreenShareCapture({
    sessionId: session?.id ?? null,
    enabled: isOverlayOpen && isSessionActive,
  });
  const {
    status: microphoneStatus,
    error: microphoneError,
    isSupported: isMicrophoneSupported,
    toggleMicrophone,
    stopMicrophone,
  } = useMicrophoneCapture({
    sessionId: session?.id ?? null,
    enabled: isOverlayOpen && isSessionActive,
  });

  useEffect(() => {
    setUserName(getDisplayNameFromEmail(localStorage.getItem('crewmate_user_email')));
  }, []);

  const tasks = data?.tasks ?? [];
  const activities = data?.activities ?? [];
  const integrations = data?.integrations ?? [];
  const disconnectedIntegrations = integrations.filter((integration) => integration.status !== 'connected').length;
  const pendingGuidedSetup = onboardingService.getPendingGuidedSetup();

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
    stopScreenShare();
    void stopMicrophone();
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

      await sendMessage(buildGuidedSetupPrompt(pendingGuidedSetup), nextSession.id);
      onboardingService.clearPendingGuidedSetup();
    })();
  }, [hasAttemptedGuidedSetup, isBusy, isSessionActive, pendingGuidedSetup, sendMessage, startSession]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={`Hi ${userName}`}
        description="How can I help you today? Let's build something cool."
      >
        <Button
          variant={isSessionActive ? 'danger' : 'primary'}
          onClick={handleSessionToggle}
          disabled={isBusy}
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
      </PageHeader>

      {(error || isLoading) && (
        <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-muted-foreground">
          {isLoading ? 'Loading local Crewmate workspace...' : `Local API status: ${error}`}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/30 p-5 mt-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Workspace readiness</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {pendingGuidedSetup
                ? 'Guided live setup is queued. Crewmate will ask onboarding questions as soon as the live session starts.'
                : disconnectedIntegrations > 0
                  ? `${disconnectedIntegrations} integration${disconnectedIntegrations === 1 ? '' : 's'} still need setup before Crewmate can take actions for you.`
                  : 'Your connected tools are ready. Start a live session or queue background work from the product surfaces.'}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{isSessionActive ? 'Live session active' : 'Live session idle'}</span>
            <span>{tasks.length} tracked tasks</span>
            <span>{activities.length} recent activities</span>
          </div>
        </div>
      </div>

      <DashboardQuickStats
        tasks={tasks}
        integrations={integrations}
        session={session}
        isSessionActive={isSessionActive}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ActiveSessionCard session={session} isSessionActive={isSessionActive} elapsedLabel={elapsedLabel} />
          <RecentActivityCard activities={activities} />
        </div>

        <div className="space-y-6">
          <RecentTasksCard tasks={tasks} />
          <GmailInboxCard />
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
