import React, { useEffect, useMemo } from 'react';
import { ArrowRight, CheckCircle2, FileText, Mail, Presentation, Sheet, CalendarDays, FolderOpen } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useIntegrations } from '../hooks/useIntegrations';
import { integrationsService } from '../services/integrationsService';
import { onboardingFlowService } from '../services/onboardingFlowService';

const GOOGLE_CAPABILITIES = [
  { label: 'Create Docs', icon: FileText },
  { label: 'Build Sheets', icon: Sheet },
  { label: 'Generate Slides', icon: Presentation },
  { label: 'Draft Gmail emails', icon: Mail },
  { label: 'Block Calendar time', icon: CalendarDays },
  { label: 'Create Drive folders', icon: FolderOpen },
];

export function Onboarding(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { integrations, isLoading, error, refresh } = useIntegrations();
  const [connectError, setConnectError] = React.useState<string | null>(null);
  const [isConnecting, setIsConnecting] = React.useState(false);

  const googleWorkspace = useMemo(
    () => integrations.find((integration) => integration.id === 'google-workspace') ?? null,
    [integrations],
  );

  const isConnected = googleWorkspace?.status === 'connected';
  const wasJustConnected = new URLSearchParams(location.search).get('connected') === 'true';
  const oauthError = new URLSearchParams(location.search).get('error_description');

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

  async function handleConnectGoogleWorkspace(): Promise<void> {
    if (!googleWorkspace) {
      navigate('/integrations');
      return;
    }

    setConnectError(null);
    setIsConnecting(true);

    try {
      const { redirectUrl } = await integrationsService.startOAuthConnection(googleWorkspace.id, '/onboarding');
      window.location.assign(redirectUrl);
    } catch (loadError) {
      setConnectError(loadError instanceof Error ? loadError.message : 'Unable to start Google Workspace connection');
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="One last step"
        description="Connect Google Workspace now, or skip and come back to it later from Integrations."
      />

      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          Unable to load integrations: {error}
          <Button variant="secondary" className="ml-3" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : null}

      {connectError ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          {connectError}
        </div>
      ) : null}

      {oauthError ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          Google Workspace connection was not completed: {oauthError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                Google Workspace
              </div>
              <h2 className="text-2xl font-semibold text-foreground">Connect once, then start working</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Approve access once and Crewmate can help with docs, sheets, decks, drafts, calendar blocks, and Drive setup.
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
            {isConnected ? (
              <Button variant="primary" onClick={handleContinue}>
                Continue to dashboard
                <ArrowRight size={16} className="ml-2" />
              </Button>
            ) : (
              <Button variant="primary" disabled={isLoading || !googleWorkspace || isConnecting} onClick={() => void handleConnectGoogleWorkspace()}>
                {isConnecting ? 'Opening Google...' : 'Connect Google Workspace'}
              </Button>
            )}
            {!isConnected ? <Button variant="secondary" onClick={handleSkip}>Skip for now</Button> : null}
            <Link to="/integrations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              Open Integrations
            </Link>
          </div>
        </section>

        <aside className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">What you unlock</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>1. Connect once when you are ready.</p>
            <p>2. Create Docs, Sheets, Slides, and Drive folders from prompts.</p>
            <p>3. Draft Gmail messages and prepare calendar holds faster.</p>
          </div>

          {wasJustConnected || isConnected ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700">
              Google Workspace is ready. You can now ask Crewmate to create Docs, Sheets, Slides, drafts, and calendar blocks.
            </div>
          ) : (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground">
              This is optional for now. You can skip it, explore the product, and connect later from Integrations.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
