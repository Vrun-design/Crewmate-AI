import React, {useState} from 'react';
import {Card} from '../components/ui/Card';
import {EmptyStateCard} from '../components/shared/EmptyStateCard';
import {PageHeader} from '../components/ui/PageHeader';
import {MemoryListView} from '../components/memory/MemoryListView';
import {MemoryMindMap} from '../components/memory/MemoryMindMap';
import {MemoryViewToggle} from '../components/memory/MemoryViewToggle';
import {useWorkspaceCollection} from '../hooks/useWorkspaceCollection';
import {workspaceService} from '../services/workspaceService';

export function MemoryBase() {
  const [view, setView] = useState<'list' | 'map'>('list');
  const {data: nodes, isLoading, error} = useWorkspaceCollection(workspaceService.getMemoryNodes);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <PageHeader 
        title="Memory Base" 
        description="Manage agent context, long-term knowledge, and vector embeddings."
      >
        <MemoryViewToggle view={view} onChange={setView} />
      </PageHeader>

      <Card className="flex-1">
        {isLoading || error ? (
          <div className="p-4 text-sm text-muted-foreground">
            {isLoading ? 'Loading memory nodes...' : `Memory API status: ${error}`}
          </div>
        ) : nodes.length > 0 ? (
          view === 'map' ? <MemoryMindMap nodes={nodes} /> : <MemoryListView nodes={nodes} />
        ) : (
          <EmptyStateCard
            title="No memory stored yet"
            description="Live conversations, uploaded context, and saved artifacts will create the first memory nodes here."
          />
        )}
      </Card>
    </div>
  );
}
