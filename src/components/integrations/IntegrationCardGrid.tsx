import React from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import type { Integration } from '../../types';
import { IntegrationLogo } from './IntegrationLogo';

interface IntegrationCardGridProps {
  integrations: Integration[];
  onOpen: (integration: Integration) => void;
}

export function IntegrationCardGrid({
  integrations,
  onOpen,
}: IntegrationCardGridProps): React.ReactNode {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {integrations.map((integration) => (
        <Card key={integration.id} className="p-5 flex flex-col h-full hover:border-border transition-colors">
          <div className="flex items-start justify-between mb-4">
            <IntegrationLogo
              integration={integration}
              containerClassName="h-10 w-10 rounded-xl"
              iconSize={20}
              imagePaddingClassName="p-1.5"
            />
            <Badge variant={integration.status === 'connected' ? 'success' : 'default'}>
              {integration.status === 'connected' ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <h3 className="text-lg font-medium mb-2 text-foreground">{integration.name}</h3>
          <p className="text-sm text-muted-foreground flex-1 mb-6">{integration.desc}</p>

          <Button
            variant={integration.status === 'connected' ? 'secondary' : 'primary'}
            className="w-full"
            onClick={() => onOpen(integration)}
          >
            {integration.status === 'connected' ? 'Configure' : 'Connect'}
          </Button>
        </Card>
      ))}
    </div>
  );
}
