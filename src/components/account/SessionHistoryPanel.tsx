import React from 'react';
import { EmptyStateCard } from '../shared/EmptyStateCard';
import { SessionHistoryGrid } from '../sessions/SessionHistoryGrid';
import { useWorkspaceCollection } from '../../hooks/useWorkspaceCollection';
import { workspaceService } from '../../services/workspaceService';

export function SessionHistoryPanel() {
    const { data: sessions, isLoading, error } = useWorkspaceCollection(workspaceService.getSessions);

    if (isLoading || error) {
        return (
            <div className="glass-panel rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                {isLoading ? 'Loading session history...' : `Session API status: ${error}`}
            </div>
        );
    }

    if (sessions.length > 0) {
        return <SessionHistoryGrid sessions={sessions} />;
    }

    return (
        <EmptyStateCard
            title="No sessions recorded yet"
            description="Start a live session and Crewmate will build a real history here."
        />
    );
}
