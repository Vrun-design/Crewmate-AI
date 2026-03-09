import React from 'react';
import {Badge} from '../components/ui/Badge';
import {Card} from '../components/ui/Card';
import {PageHeader} from '../components/ui/PageHeader';
import {useCapabilities} from '../hooks/useCapabilities';

function getStatusLabel(status: 'live' | 'available' | 'setup_required'): string {
  if (status === 'live') {
    return 'Live';
  }

  if (status === 'available') {
    return 'Available';
  }

  return 'Setup required';
}

function getStatusVariant(status: 'live' | 'available' | 'setup_required'): 'success' | 'default' {
  return status === 'live' ? 'success' : 'default';
}

export function Skills() {
  const {capabilities, isLoading, error} = useCapabilities();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operator Stack"
        description="The real capability surface behind Crewmate: perception, tool actions, memory, and orchestration."
      />

      {(isLoading || error) && (
        <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-muted-foreground">
          {isLoading ? 'Loading live capabilities...' : `Capability API status: ${error}`}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {capabilities.map((capability) => (
          <Card key={capability.id} className="p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-medium text-foreground">{capability.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{capability.description}</div>
              </div>
              <Badge variant={getStatusVariant(capability.status)}>{getStatusLabel(capability.status)}</Badge>
            </div>
            <div className="pt-4 border-t border-border text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {capability.category}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
