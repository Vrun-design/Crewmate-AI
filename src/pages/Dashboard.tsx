import React, {useEffect, useState} from 'react';
import {Play, Square, Terminal} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {ActiveSessionCard} from '../components/dashboard/ActiveSessionCard';
import {DashboardQuickStats} from '../components/dashboard/DashboardQuickStats';
import {IntegrationsCard} from '../components/dashboard/IntegrationsCard';
import {RecentActivityCard} from '../components/dashboard/RecentActivityCard';
import {RecentTasksCard} from '../components/dashboard/RecentTasksCard';
import {Button} from '../components/ui/Button';
import {LiveSessionOverlay} from '../components/ui/LiveSessionOverlay';
import {PageHeader} from '../components/ui/PageHeader';
import {useDashboard} from '../hooks/useDashboard';
import {useLiveSession} from '../hooks/useLiveSession';
import {useMicrophoneCapture} from '../hooks/useMicrophoneCapture';
import {useScreenShareCapture} from '../hooks/useScreenShareCapture';
import {getDisplayNameFromEmail} from '../utils/userName';

export function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('User');
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const {data, isLoading, error, refresh} = useDashboard();
  const {session, isBusy, elapsedLabel, isSessionActive, startSession, endSession, sendMessage} = useLiveSession({
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

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={`Hi ${userName}`}
        description="How can I help you today? Let's build something cool."
      >
        <div className="flex items-center gap-3">
          <Button variant="secondary">
            <Terminal size={16} />
            View Logs
          </Button>
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
        </div>
      </PageHeader>

      {(error || isLoading) && (
        <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-muted-foreground">
          {isLoading ? 'Loading local Crewmate workspace...' : `Local API status: ${error}`}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card/70 p-5 xl:col-span-2">
          <div className="text-sm font-medium text-foreground">Hero Demo Flow</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Best live path: share a screen, ask Crewmate to diagnose a UI issue, file a GitHub issue, then post the handoff to Slack.
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="primary" onClick={handleSessionToggle} disabled={isBusy}>
              {isSessionActive ? 'Resume Live Session' : 'Start Hero Session'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/delegations')}>
              Queue Async Brief
            </Button>
            <Button variant="secondary" onClick={() => navigate('/studio')}>
              Open Creative Studio
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/30 p-5">
          <div className="text-sm font-medium text-foreground">Judge Checklist</div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>1. Live screen + voice session works.</div>
            <div>2. One real tool action completes.</div>
            <div>3. One delegated async job finishes off-shift.</div>
            <div>4. One mixed-media artifact is generated.</div>
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
