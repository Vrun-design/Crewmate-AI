import { useState } from 'react';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { IntegrationCardGrid } from '../integrations/IntegrationCardGrid';
import { IntegrationDrawerContent } from '../integrations/IntegrationDrawerContent';
import { useIntegrations } from '../../hooks/useIntegrations';
import { StepShell } from './StepShell';
import type { Integration } from '../../types';

type IntegrationSetupStepProps = {
  onComplete: () => void;
};

export function IntegrationSetupStep({ onComplete }: IntegrationSetupStepProps): React.JSX.Element {
  const { integrations, isLoading, error, refresh } = useIntegrations();
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const connectedCount = integrations.filter((integration) => integration.status === 'connected').length;

  return (
    <StepShell className="w-full max-w-5xl space-y-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Connect your tools</h1>
        <p className="text-muted-foreground">Link any integrations you want now. You can skip this and finish it later from the dashboard.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Integration readiness</h2>
          {!isLoading && !error ? (
            <span className="text-xs text-muted-foreground">{connectedCount} / {integrations.length} connected</span>
          ) : null}
        </div>

        {isLoading || error ? (
          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
            {isLoading ? 'Checking integration readiness...' : `Integration status: ${error}`}
          </div>
        ) : (
          <IntegrationCardGrid integrations={integrations} onOpen={setSelectedIntegration} />
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onComplete} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Skip for now
        </button>
        <Button variant="primary" onClick={onComplete} className="px-8 py-5 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
          Continue to dashboard
        </Button>
      </div>

      <Drawer
        isOpen={selectedIntegration !== null}
        onClose={() => setSelectedIntegration(null)}
        title={
          selectedIntegration
            ? selectedIntegration.status === 'connected'
              ? `Configure ${selectedIntegration.name}`
              : `Connect ${selectedIntegration.name}`
            : 'Integration'
        }
      >
        {selectedIntegration ? (
          <IntegrationDrawerContent
            integration={selectedIntegration}
            onClose={() => setSelectedIntegration(null)}
            onSaved={() => void refresh()}
          />
        ) : null}
      </Drawer>
    </StepShell>
  );
}
