import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CalendarDays, CheckCircle2, FileText, FolderOpen, Mail, Presentation, Sheet, X } from 'lucide-react';
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
      '/dashboard?onboarding=google-workspace',
    );
    window.location.assign(redirectUrl);
  }

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[180] bg-black/55 backdrop-blur-sm"
            onClick={finishOnboarding}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[181] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">Connect Google Workspace</div>
                  <div className="text-xs text-muted-foreground">Optional setup. You can skip it and keep exploring.</div>
                </div>
                <button
                  type="button"
                  aria-label="Close onboarding"
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  onClick={finishOnboarding}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-6 p-5 md:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                        Google Workspace
                      </div>
                      <h2 className="text-2xl font-semibold text-foreground">Connect once, then start working</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Give Crewmate access when you are ready to create docs, sheets, decks, drafts, calendar blocks, and Drive folders.
                      </p>
                    </div>
                    {isConnected ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600">
                        <CheckCircle2 size={16} />
                        Connected
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {GOOGLE_CAPABILITIES.map(({ label, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
                        <div className="rounded-xl border border-border bg-card p-2 text-muted-foreground">
                          <Icon size={16} />
                        </div>
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {shouldShowCompletionState ? (
                      <Button variant="primary" onClick={finishOnboarding}>
                        Continue to dashboard
                        <ArrowRight size={16} className="ml-2" />
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        disabled={isLoading || !googleWorkspace}
                        onClick={() => void handleConnect()}
                      >
                        {isLoading || !googleWorkspace ? 'Loading...' : 'Connect Google Workspace'}
                      </Button>
                    )}
                    <Button variant="secondary" onClick={finishOnboarding}>
                      Skip for now
                    </Button>
                  </div>
                </section>

                <aside className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground">What you unlock</h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>1. Connect once when you are ready.</p>
                    <p>2. Create Docs, Sheets, Slides, and Drive folders from prompts.</p>
                    <p>3. Draft Gmail messages and prepare calendar holds faster.</p>
                  </div>

                  {error ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
                      Unable to load integrations: {error}
                      <Button variant="secondary" className="ml-3" onClick={() => void refresh()}>
                        Retry
                      </Button>
                    </div>
                  ) : null}

                  {oauthError ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">
                      Google Workspace connection was not completed: {oauthError}
                    </div>
                  ) : null}

                  {shouldShowCompletionState ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700">
                      Google Workspace is ready. You can now ask Crewmate to create Docs, Sheets, Slides, drafts, and calendar blocks.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground">
                      This is optional. Skip it now and connect later from Integrations.
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
