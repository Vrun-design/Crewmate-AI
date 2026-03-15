import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CalendarDays, CheckCircle2, FileText, FolderOpen, Mail, Presentation, Sheet, Sparkles, X } from 'lucide-react';
import { useIntegrations } from '../../hooks/useIntegrations';
import { integrationsService } from '../../services/integrationsService';
import { onboardingFlowService } from '../../services/onboardingFlowService';
import { Button } from '../ui/Button';

interface GoogleWorkspaceOnboardingModalProps {
  isOpen: boolean;
  hasOnboardingQuery: boolean;
  oauthError: string | null;
  wasJustConnected: boolean;
  onClose: () => void;
  onClearOnboardingQuery: () => void;
}

const GOOGLE_CAPABILITIES = [
  { label: 'Create Docs', icon: FileText },
  { label: 'Build Sheets', icon: Sheet },
  { label: 'Generate Slides', icon: Presentation },
  { label: 'Draft Gmail emails', icon: Mail },
  { label: 'Block Calendar time', icon: CalendarDays },
  { label: 'Create Drive folders', icon: FolderOpen },
];

const DASHBOARD_ONBOARDING_REDIRECT = '/dashboard?onboarding=google-workspace';

export function GoogleWorkspaceOnboardingModal({
  isOpen,
  hasOnboardingQuery,
  oauthError,
  wasJustConnected,
  onClose,
  onClearOnboardingQuery,
}: GoogleWorkspaceOnboardingModalProps): React.JSX.Element | null {
  const { integrations, isLoading, error, refresh } = useIntegrations();
  const googleWorkspace = integrations.find((integration) => integration.id === 'google-workspace') ?? null;
  const isConnected = googleWorkspace?.status === 'connected';
  const shouldShowCompletionState = hasOnboardingQuery && (wasJustConnected || isConnected);
  const isConnectDisabled = isLoading || !googleWorkspace;
  const connectButtonLabel = isConnectDisabled ? 'Loading...' : 'Connect Google Workspace';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isConnected || shouldShowCompletionState) {
      return;
    }

    onboardingFlowService.markComplete();
    onClose();
  }, [isConnected, isOpen, onClose, shouldShowCompletionState]);

  function finishOnboarding(): void {
    onboardingFlowService.markComplete();
    onClearOnboardingQuery();
    onClose();
  }

  async function handleConnect(): Promise<void> {
    if (!googleWorkspace) {
      finishOnboarding();
      return;
    }

    const { redirectUrl } = await integrationsService.startOAuthConnection(
      googleWorkspace.id,
      DASHBOARD_ONBOARDING_REDIRECT,
    );
    window.location.assign(redirectUrl);
  }

  function renderStatusBanner(): React.JSX.Element | null {
    if (error) {
      return (
        <div className="w-full rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          Unable to load integrations: {error}
          <Button variant="secondary" className="mt-3 w-full" onClick={() => void refresh()}>
            Retry Connection
          </Button>
        </div>
      );
    }

    if (oauthError) {
      return (
        <div className="w-full rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          Connection not completed: {oauthError}
        </div>
      );
    }

    return null;
  }

  function renderActionArea(): React.JSX.Element {
    if (shouldShowCompletionState) {
      return (
        <div className="w-full space-y-4">
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            Google Workspace connected successfully
          </div>
          <Button variant="primary" className="h-12 w-full rounded-2xl text-base shadow-lg shadow-primary/25" onClick={finishOnboarding}>
            Get Started
            <ArrowRight size={18} className="ml-2" />
          </Button>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-md space-y-4">
        <Button
          variant="primary"
          className="h-12 w-full rounded-2xl text-base shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-primary/40"
          disabled={isConnectDisabled}
          onClick={() => void handleConnect()}
        >
          {connectButtonLabel}
        </Button>
        <button
          type="button"
          onClick={finishOnboarding}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip this step for now
        </button>
      </div>
    );
  }

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[180] bg-black/60 backdrop-blur-md"
            onClick={finishOnboarding}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, type: 'spring', bounce: 0.25 }}
            className="fixed inset-0 z-[181] flex items-center justify-center p-4 sm:p-6"
          >
            <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-border/50 bg-background/80 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

              <button
                type="button"
                aria-label="Close onboarding"
                className="absolute right-5 top-5 z-10 rounded-full p-2 text-muted-foreground transition-all hover:bg-secondary hover:text-foreground hover:scale-105"
                onClick={finishOnboarding}
              >
                <X size={20} />
              </button>

              <div className="relative px-8 pt-12 pb-10 text-center sm:px-12 sm:pt-16">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 outline outline-8 outline-blue-500/10 shadow-xl shadow-blue-500/25">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>

                <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
                  Welcome to Crewmate
                </h1>
                <p className="mx-auto max-w-md text-base text-muted-foreground text-balance">
                  Let's get your workspace set up. Connect your Google account to unlock AI-powered document creation, email drafting, and calendar management.
                </p>

                <div className="mt-10 mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {GOOGLE_CAPABILITIES.map(({ label, icon: Icon }) => (
                    <div key={label} className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-secondary/50 p-4 text-center transition-colors hover:bg-secondary/80">
                      <div className="rounded-xl bg-background p-2.5 text-foreground shadow-sm ring-1 ring-border/50">
                        <Icon size={18} />
                      </div>
                      <span className="mt-1 text-[13px] font-medium text-foreground/80">{label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-4">
                  {renderStatusBanner()}
                  {renderActionArea()}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
