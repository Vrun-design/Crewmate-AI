import { useState } from 'react';
import { Terminal } from 'lucide-react';
import { ActivityDrawerContent } from '../activity/ActivityDrawerContent';
import { ActivityLogList } from '../activity/ActivityLogList';
import { EmptyStateCard } from '../shared/EmptyStateCard';
import { Card } from '../ui/Card';
import { Drawer } from '../ui/Drawer';
import { useWorkspaceCollection } from '../../hooks/useWorkspaceCollection';
import { workspaceService } from '../../services/workspaceService';
import type { Activity } from '../../types';

export function ActivityLogPanel(): React.JSX.Element {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const { data: activities, isLoading, error } = useWorkspaceCollection(workspaceService.getActivities);

    function handleOpenActivity(activity: Activity): void {
        setSelectedActivity(activity);
        setIsDrawerOpen(true);
    }

    return (
        <div className="space-y-4">            <Card>
            {isLoading || error ? (
                <div className="p-4 text-sm text-muted-foreground">
                    {isLoading ? 'Loading recent activity...' : `Activity API status: ${error}`}
                </div>
            ) : activities.length > 0 ? (
                <ActivityLogList activities={activities} onOpenActivity={handleOpenActivity} />
            ) : (
                <EmptyStateCard
                    title="No activity captured yet"
                    description="Live sessions, tool actions, and memory updates will appear here as soon as they happen."
                />
            )}
        </Card>

            <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title="Activity Details">
                <ActivityDrawerContent activity={selectedActivity} />
            </Drawer>
        </div>
    );
}
