import React, {useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {IntegrationCardGrid} from '../components/integrations/IntegrationCardGrid';
import {IntegrationDrawerContent} from '../components/integrations/IntegrationDrawerContent';
import {Drawer} from '../components/ui/Drawer';
import {PageHeader} from '../components/ui/PageHeader';
import {Button} from '../components/ui/Button';
import {useIntegrations} from '../hooks/useIntegrations';
import type {Integration} from '../types';

export function Integrations(): React.JSX.Element {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const {integrations, isLoading, error, refresh} = useIntegrations();
  const location = useLocation();
  const callbackState = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const integration = params.get('integration');
    const connected = params.get('connected');
    const errorCode = params.get('error');
    const errorDescription = params.get('error_description');
    if (!integration) {
      return null;
    }

    return {
      integration,
      connected,
      errorCode,
      errorDescription,
    };
  }, [location.search]);

  function handleOpenIntegration(integration: Integration): void {
    setSelectedIntegration(integration);
    setIsDrawerOpen(true);
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader 
        title="Integrations" 
        description="Connect your tools to allow the agent to execute tasks."
      />

      {(isLoading || error) && (
        <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{isLoading ? 'Loading integration readiness...' : `Integration status: ${error}`}</span>
            {error ? <Button variant="secondary" onClick={() => void refresh()}>Retry</Button> : null}
          </div>
        </div>
      )}

      {callbackState?.connected === 'false' ? (
        <div className="glass-panel rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          {callbackState.errorDescription
            ? `${callbackState.integration} connection was not completed: ${callbackState.errorDescription}`
            : `${callbackState.integration} connection was not completed.`}
        </div>
      ) : null}

      {callbackState?.connected === 'true' ? (
        <div className="glass-panel rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
          {callbackState.integration} connected successfully.
        </div>
      ) : null}

      <IntegrationCardGrid integrations={integrations} onOpen={handleOpenIntegration} />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={
          selectedIntegration
            ? selectedIntegration.status === 'connected'
              ? `Configure ${selectedIntegration.name}`
              : `Connect ${selectedIntegration.name}`
            : 'Integration'
        }
      >
        {selectedIntegration && (
          <IntegrationDrawerContent
            integration={selectedIntegration}
            onClose={() => setIsDrawerOpen(false)}
            onSaved={() => void refresh()}
          />
        )}
      </Drawer>
    </div>
  );
}
