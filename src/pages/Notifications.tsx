import React from 'react';
import {AlertCircle, Bell, Check, CheckCircle2, Clock, Settings} from 'lucide-react';
import {EmptyStateCard} from '../components/shared/EmptyStateCard';
import {Button} from '../components/ui/Button';
import {Card, CardContent} from '../components/ui/Card';
import {PageHeader} from '../components/ui/PageHeader';
import {useNotifications} from '../hooks/useNotifications';

export function Notifications() {
  const {notifications, isLoading, error, markAllRead} = useNotifications();

  function getVisuals(type: 'success' | 'info' | 'warning' | 'default') {
    if (type === 'success') {
      return {icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10'};
    }

    if (type === 'warning') {
      return {icon: AlertCircle, color: 'text-amber-500', bgColor: 'bg-amber-500/10'};
    }

    if (type === 'info') {
      return {icon: Bell, color: 'text-blue-500', bgColor: 'bg-blue-500/10'};
    }

    return {icon: CheckCircle2, color: 'text-muted-foreground', bgColor: 'bg-secondary'};
  }

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <PageHeader 
        title="Notifications" 
        description="Stay updated on agent activities, tasks, and system alerts."
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="flex items-center gap-2" onClick={() => void markAllRead()}>
            <Check size={16} />
            Mark all as read
          </Button>
          <Button variant="secondary" className="flex items-center gap-2 px-2">
            <Settings size={16} />
          </Button>
        </div>
      </PageHeader>

      <Card>
        {isLoading || error ? (
          <CardContent className="p-4 text-sm text-muted-foreground">
            {isLoading ? 'Loading notifications...' : `Notification API status: ${error}`}
          </CardContent>
        ) : notifications.length > 0 ? (
          <CardContent className="p-0 divide-y divide-border">
            {notifications.map((notification) => {
              const visuals = getVisuals(notification.type);
              return (
                <div
                  key={notification.id}
                  className={`p-4 sm:p-6 flex gap-4 transition-colors hover:bg-secondary/50 ${notification.read ? 'opacity-70' : 'bg-blue-500/[0.02]'}`}
                >
                  <div className={`mt-1 shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${visuals.bgColor} ${visuals.color}`}>
                    <visuals.icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-1">
                      <h3 className={`text-sm font-medium truncate ${notification.read ? 'text-foreground/80' : 'text-foreground'}`}>
                        {notification.title}
                      </h3>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <Clock size={12} />
                        {notification.time}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                  </div>
                  {!notification.read ? (
                    <div className="shrink-0 flex items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        ) : (
          <EmptyStateCard
            title="No notifications yet"
            description="Task completions, live tool actions, and integration warnings will show up here."
          />
        )}
      </Card>
    </div>
  );
}
