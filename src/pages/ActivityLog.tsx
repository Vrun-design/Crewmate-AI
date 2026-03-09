import React, {useState} from 'react';
import {Terminal} from 'lucide-react';
import {ActivityDrawerContent} from '../components/activity/ActivityDrawerContent';
import {ActivityLogList} from '../components/activity/ActivityLogList';
import {EmptyStateCard} from '../components/shared/EmptyStateCard';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {Drawer} from '../components/ui/Drawer';
import {PageHeader} from '../components/ui/PageHeader';
import {useWorkspaceCollection} from '../hooks/useWorkspaceCollection';
import {workspaceService} from '../services/workspaceService';
import type {Activity} from '../types';

export function ActivityLog() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const {data: activities, isLoading, error} = useWorkspaceCollection(workspaceService.getActivities);

  function handleOpenActivity(activity: Activity): void {
    setSelectedActivity(activity);
    setIsDrawerOpen(true);
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <PageHeader 
        title="Recent Activity" 
        description="A comprehensive log of all actions, observations, and research performed by your AI agent."
      >
        <Button variant="secondary">
          <Terminal size={16} />
          Export Logs
        </Button>
      </PageHeader>

      <Card className="flex-1">
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
