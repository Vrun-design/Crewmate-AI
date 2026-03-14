import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock3 } from 'lucide-react';
import { ActiveDelegatedTasksCard } from '../components/dashboard/ActiveDelegatedTasksCard';
import { IntegrationsCard } from '../components/dashboard/IntegrationsCard';
import { LiveSessionCard } from '../components/dashboard/LiveSessionCard';
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard';
import { RecentTasksCard } from '../components/dashboard/RecentTasksCard';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { LiveTaskCueBadge } from '../components/ui/LiveTaskCueBadge';
import { LiveSessionOverlay } from '../components/ui/LiveSessionOverlay';
import { PageHeader } from '../components/ui/PageHeader';
import { useDashboard } from '../hooks/useDashboard';
import { useLiveSessionContext } from '../contexts/LiveSessionContext';
import { getDisplayNameFromEmail } from '../utils/userName';

const SUGGESTED_PROMPTS = [
  'Check my Gmail for unread messages from today',
  "What's on my calendar for the next few hours?",
  'Search the web and write a brief report on a topic of my choice',
  'Draft a Slack message to my team',
  'Create a new Google Doc with meeting notes',
];

export function Dashboard() {
  const [userName, setUserName] = useState('User');
  const [isRecentDrawerOpen, setIsRecentDrawerOpen] = useState(false);
  const { data, isLoading, error, refresh } = useDashboard();
  const {
    session,
    isBusy,
    error: liveSessionError,
    isSessionActive,
    startSession,
    endSession,
    sendMessage,
    previewStream,
    screenShareStatus,
    screenShareError,
    isScreenShareSupported,
    startScreenShare,
    stopScreenShare,
    microphoneStatus,
    microphoneError,
    isMicrophoneSupported,
    toggleMicrophone,
    stopMicrophone,
    isOverlayOpen,
    setIsOverlayOpen,
    liveTaskCue,
  } = useLiveSessionContext();

  useEffect(() => {
    setUserName(getDisplayNameFromEmail(localStorage.getItem('crewmate_user_email')));
  }, []);

  function handleSessionToggle(): void {
    if (isSessionActive) {
      void endSession();
      stopScreenShare();
      void stopMicrophone();
      setIsOverlayOpen(false);
      return;
    }

    void startSession();
  }

  function handleOverlayClose(): void {
    setIsOverlayOpen(false);
  }

  async function handlePromptClick(prompt: string): Promise<void> {
    if (!isSessionActive) {
      await startSession();
      // Brief delay for the session to establish before sending
      await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    }
    void sendMessage(prompt);
  }

  return (
    <div className="h-full flex flex-col gap-4 pb-2">
      <PageHeader
        title={`Hi ${userName}`}
        description="How can I help you today? Let's build something cool."
      >
        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => setIsRecentDrawerOpen(true)}
            rounded="full"
          >
            <Clock3 size={16} />
            Recent
          </Button>
        </div>
      </PageHeader>

      {(error || isLoading || liveSessionError) && (
        <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{isLoading ? 'Loading your Crewmate dashboard...' : liveSessionError ?? `Dashboard API status: ${error}`}</span>
            {(error || liveSessionError) ? (
              <Button variant="secondary" onClick={() => void refresh()}>
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <AnimatePresence>
        {liveTaskCue && (
          <motion.div
            key={liveTaskCue.status}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <LiveTaskCueBadge cue={liveTaskCue} className="w-full rounded-2xl px-4 py-2.5" variant="dashboard" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void handlePromptClick(prompt)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        <LiveSessionCard
          session={session}
          isSessionActive={isSessionActive}
          microphoneStatus={microphoneStatus}
          screenShareStatus={screenShareStatus}
          isMicrophoneSupported={isMicrophoneSupported}
          isScreenShareSupported={isScreenShareSupported}
          isBusy={isBusy}
          provider={session?.provider || 'local'}
          previewStream={previewStream}
          onOpenOverlay={() => setIsOverlayOpen(true)}
          onToggleSession={handleSessionToggle}
          onToggleMicrophone={toggleMicrophone}
          onStartScreenShare={startScreenShare}
          onStopScreenShare={stopScreenShare}
          onSendMessage={sendMessage}
        />
      </div>

      <Drawer
        isOpen={isRecentDrawerOpen}
        onClose={() => setIsRecentDrawerOpen(false)}
        title="Recent Activity"
      >
        <div className="grid content-start gap-4">
          <ActiveDelegatedTasksCard summary={data?.activeTaskSummary} />
          <RecentTasksCard tasks={data?.tasks ?? []} />
          <RecentActivityCard activities={data?.activities ?? []} />
          <IntegrationsCard integrations={data?.integrations ?? []} />
        </div>
      </Drawer>

      <LiveSessionOverlay
        isOpen={isOverlayOpen && isSessionActive}
        onClose={handleOverlayClose}
        transcript={session?.transcript}
        onSendMessage={sendMessage}
        isBusy={isBusy}
        provider={session?.provider}
        previewStream={previewStream}
        onEndSession={handleSessionToggle}
        screenShareStatus={screenShareStatus}
        isScreenShareSupported={isScreenShareSupported}
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
        microphoneStatus={microphoneStatus}
        isMicrophoneSupported={isMicrophoneSupported}
        onToggleMicrophone={toggleMicrophone}
        liveTaskCue={liveTaskCue}
      />
    </div>
  );
}
