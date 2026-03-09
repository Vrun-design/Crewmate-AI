import React from 'react';
import {Filter} from 'lucide-react';
import {EmptyStateCard} from '../components/shared/EmptyStateCard';
import {SessionHistoryGrid} from '../components/sessions/SessionHistoryGrid';
import {Button} from '../components/ui/Button';
import {PageHeader} from '../components/ui/PageHeader';
import {useWorkspaceCollection} from '../hooks/useWorkspaceCollection';
import {workspaceService} from '../services/workspaceService';

export function Sessions() {
  const {data: sessions, isLoading, error} = useWorkspaceCollection(workspaceService.getSessions);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Session History" 
        description="Review past recordings and generated artifacts."
      >
        <Button variant="secondary" size="sm">
          <Filter size={14} />
          Filter
        </Button>
      </PageHeader>

      {isLoading || error ? (
        <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-muted-foreground">
          {isLoading ? 'Loading session history...' : `Session API status: ${error}`}
        </div>
      ) : sessions.length > 0 ? (
        <SessionHistoryGrid sessions={sessions} />
      ) : (
        <EmptyStateCard
          title="No sessions recorded yet"
          description="Start a live session and Crewmate will build a real history here, including transcript-derived titles and durations."
        />
      )}
    </div>
  );
}
