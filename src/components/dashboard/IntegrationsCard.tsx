import React from 'react';
import { Card, CardContent, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { Integration } from '../../types';

interface IntegrationsCardProps {
  integrations: Integration[];
}

export function IntegrationsCard({ integrations }: IntegrationsCardProps): React.ReactNode {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Integrations</CardTitle>
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">Manage</button>
        </div>
        <div className="space-y-3">
          {integrations.slice(0, 4).map((integration) => (
            <div
              key={integration.name}
              className="flex items-center justify-between p-2.5 rounded-xl hover-bg border border-transparent hover:border-border transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center ${integration.logoUrl ? 'bg-card border-border' : `${integration.bgColor} ${integration.color}`}`}
                >
                  {integration.logoUrl ? (
                    <img
                      src={integration.logoUrl}
                      alt={integration.name}
                      className={`w-5 h-5 object-contain ${integration.name.toLowerCase() === 'github' ? 'dark:invert' : ''}`}
                    />
                  ) : (
                    <integration.icon size={16} />
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{integration.name}</span>
              </div>
              <Badge variant={integration.status === 'connected' ? 'success' : 'default'}>
                {integration.status === 'connected' ? 'Connected' : 'Connect'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
