import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardTitle } from '../ui/Card';
import type { Integration } from '../../types';

interface IntegrationsCardProps {
  integrations: Integration[];
}

export function IntegrationsCard({ integrations }: IntegrationsCardProps): React.ReactNode {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <CardTitle>Integrations</CardTitle>
          <Link to="/integrations" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">Manage</Link>
        </div>
        <div className="space-y-1">
          {integrations.slice(0, 4).map((integration) => (
            <Link
              key={integration.name}
              to="/integrations"
              className="flex items-center justify-between p-2.5 px-3 -mx-3 rounded-xl hover:bg-muted/30 border border-transparent transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-9 h-9 rounded-xl border shadow-sm flex items-center justify-center ${integration.logoUrl ? 'bg-card border-border/60' : `${integration.bgColor} ${integration.color}`}`}
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
                <span className="text-[14px] font-medium text-foreground/90 group-hover:text-foreground transition-colors">{integration.name}</span>
              </div>
              <span
                className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors ${integration.status === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-background group-hover:bg-muted text-foreground/80 border-border/80 shadow-sm'
                  }`}
              >
                {integration.status === 'connected' ? 'Connected' : 'Connect'}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
