import React, { useEffect, useMemo } from 'react';
import { ArrowRight, CheckCircle2, FileText, Mail, Presentation, Sheet, CalendarDays, FolderOpen } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useIntegrations } from '../hooks/useIntegrations';
import { onboardingFlowService } from '../services/onboardingFlowService';

const GOOGLE_CAPABILITIES = [
  { label: 'Create Docs', icon: FileText },
  { label: 'Build Sheets', icon: Sheet },
  { label: 'Generate Slides', icon: Presentation },
  { label: 'Draft Gmail emails', icon: Mail },
  { label: 'Block Calendar time', icon: CalendarDays },
  { label: 'Create Drive folders', icon: FolderOpen },
];

function buildConnectHref(connectUrl?: string): string {
  if (!connectUrl) {
    return '/integrations';
  }

  const separator = connectUrl.includes('?') ? '&' : '?';
  return `${import.meta.env.VITE_API_URL ?? ''}${connectUrl}${separator}redirectPath=${encodeURIComponent('/onboarding')}`;
}

export function Onboarding(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { integrations, isLoading, error, refresh } = useIntegrations();

  const googleWorkspace = useMemo(
    () => integrations.find((integration) => integration.id === 'google-workspace') ?? null,
    [integrations],
  );

  const isConnected = googleWorkspace?.status === 'connected';
  const wasJustConnected = new URLSearchParams(location.search).get('connected') === 'true';

  useEffect(() => {
    if (isConnected) {
      onboardingFlowService.markComplete();
    }
  }, [isConnected]);

  function handleSkip(): void {
    onboardingFlowService.markComplete();
    navigate('/dashboard');
  }

  function handleContinue(): void {
    onboardingFlowService.markComplete();
    navigate('/dashboard');
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Connect your tools"
        description="Connect Google Workspace once so Crewmate can start creating docs, sheets, slides, drafts, and calendar holds right away."
      />

      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          Unable to load integrations: {error}
          <Button variant="secondary" className="ml-3" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                Google Workspace
              </div>
              <h2 className="text-2xl font-semibold text-foreground">One connection, six helpful actions</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in with Google, approve access once, and your live agents can immediately help with Workspace tasks.
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

          <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            Crewmate will prefer draft and create flows first. Gmail send and calendar invites still require explicit confirmation before they run.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {isConnected ? (
              <Button variant="primary" onClick={handleContinue}>
                Continue to dashboard
                <ArrowRight size={16} className="ml-2" />
              </Button>
            ) : (
              <a href={buildConnectHref(googleWorkspace?.connectUrl)}>
                <Button variant="primary" disabled={isLoading || !googleWorkspace}>
                  Connect Google Workspace
                </Button>
              </a>
            )}
            <Button variant="secondary" onClick={handleSkip}>
              Skip for now
            </Button>
            <Link to="/integrations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              Open Integrations
            </Link>
          </div>
        </section>

        <aside className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">What happens next</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>1. Connect Google Workspace once.</p>
            <p>2. Start a live session or type a request.</p>
            <p>3. Ask for docs, sheets, decks, drafts, or calendar help in plain English.</p>
          </div>

          {wasJustConnected || isConnected ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700">
              Google Workspace is ready. You can now ask Crewmate to create Docs, Sheets, Slides, drafts, and calendar blocks.
            </div>
          ) : (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground">
              Normal users only click connect and approve access. No API keys, no Google Cloud Console, no manual setup.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
