import React, {useState} from 'react';
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
