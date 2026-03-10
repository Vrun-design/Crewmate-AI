import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Activity, MonitorUp } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { useWorkspaceCollection } from '../hooks/useWorkspaceCollection';
import { workspaceService } from '../services/workspaceService';
import { SessionHistoryPanel } from '../components/account/SessionHistoryPanel';
import { ActivityLogPanel } from '../components/account/ActivityLogPanel';

type SessionTabId = 'history' | 'activity';

interface SessionTab {
  id: SessionTabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const SESSION_TABS: SessionTab[] = [
  { id: 'history', label: 'Session History', icon: MonitorUp },
  { id: 'activity', label: 'Activity Log', icon: Activity },
];

export function Sessions(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') as SessionTabId | null;
  const validTab = initialTab && SESSION_TABS.some((tab) => tab.id === initialTab) ? initialTab : 'history';

  const [activeTab, setActiveTabState] = useState<SessionTabId>(validTab);

  function setActiveTab(tab: SessionTabId): void {
    setActiveTabState(tab);
    setSearchParams({ tab });
  }

  useEffect(() => {
    if (initialTab && initialTab !== activeTab && SESSION_TABS.some((tab) => tab.id === initialTab)) {
      setActiveTabState(initialTab);
    }
  }, [activeTab, initialTab]);

  const { data: activities } = useWorkspaceCollection(workspaceService.getActivities);

  function exportToCsv(): void {
    const header = 'ID,Title,Description,Type,Time';
    const rows = activities.map((activity) =>
      [activity.id, activity.title, activity.description, activity.type, activity.time]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Sessions & Activity" description="Review past live sessions and background system activity logs.">
        {activeTab === 'activity' ? (
          <Button
            variant="secondary"
            onClick={exportToCsv}
            disabled={activities.length === 0}
          >
            <Download size={14} />
            Export CSV
          </Button>
        ) : null}
      </PageHeader>

      <div className="mt-2 flex items-center gap-1 border-b border-border">
        {SESSION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeTab === tab.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'history' ? <SessionHistoryPanel /> : null}
        {activeTab === 'activity' ? <ActivityLogPanel /> : null}
      </div>
        </div>
  );
}
