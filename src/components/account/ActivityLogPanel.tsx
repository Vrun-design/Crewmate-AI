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

type ActivityTypeFilter = '' | Activity['type'];

const TYPE_FILTERS: { value: ActivityTypeFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'action', label: 'Actions' },
  { value: 'observation', label: 'Observations' },
  { value: 'research', label: 'Research' },
  { value: 'communication', label: 'Comms' },
  { value: 'note', label: 'Notes' },
];

export function ActivityLogPanel(): React.JSX.Element {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>('');
  const { data: activities, isLoading, error } = useWorkspaceCollection(workspaceService.getActivities);

  const filtered = typeFilter
    ? activities.filter((activity) => activity.type === typeFilter)
    : activities;

  function handleOpenActivity(activity: Activity): void {
    setSelectedActivity(activity);
    setIsDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map(({ value, label }) => {
          const count = value === '' ? activities.length : activities.filter((activity) => activity.type === value).length;
          const isActive = typeFilter === value;

          return (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setTypeFilter(value)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
              }`}
            >
              {label}
              {count > 0 ? <span className="opacity-60">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <Card>
        {isLoading || error ? (
          <div className="p-4 text-sm text-muted-foreground">
            {isLoading ? 'Loading recent activity...' : `Activity API status: ${error}`}
          </div>
        ) : filtered.length > 0 ? (
          <ActivityLogList activities={filtered} onOpenActivity={handleOpenActivity} />
        ) : (
          <EmptyStateCard
            title={typeFilter ? `No ${typeFilter} activity yet` : 'No recent activity yet'}
            description="Live sessions, tool actions, and memory updates will appear here as they happen."
          />
        )}
      </Card>

      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title="Activity Details">
        <ActivityDrawerContent activity={selectedActivity} />
      </Drawer>
    </div>
  );
}
