import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, Bell, Check, CheckCircle2, Clock, Settings2,
  Loader2, Webhook, Send, ToggleLeft, ToggleRight, CheckCircle,
} from 'lucide-react';
import { EmptyStateCard } from '../components/shared/EmptyStateCard';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { useNotifications } from '../hooks/useNotifications';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationPrefs {
  slackWebhookUrl?: string;
  slackChannelName?: string;
  notifyOnSuccess: boolean;
  notifyOnError: boolean;
  inAppEnabled: boolean;
}

// ── Notification Preferences Panel ────────────────────────────────────────────

function NotificationSettings(): React.JSX.Element {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    notifyOnSuccess: true, notifyOnError: true, inAppEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    void api.get<NotificationPrefs>('/api/notification-prefs').then((data) => {
      if (data) setPrefs(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = useCallback(async (patch: Partial<NotificationPrefs>) => {
    const updated = { ...prefs, ...patch };
    setPrefs(updated);
    setSaving(true);
    try {
      const saved = await api.patch<NotificationPrefs>('/api/notification-prefs', updated);
      if (saved) setPrefs(saved);
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  const testSlack = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; status: number }>('/api/notification-prefs/test', {});
      setTestResult({ success: res?.success ?? false, message: res?.success ? '✅ Test message delivered!' : `Failed — HTTP ${res?.status ?? '?'}` });
    } catch (err) {
      setTestResult({ success: false, message: `Error: ${String(err)}` });
    } finally {
      setTesting(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground opacity-40" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* In-app notifications */}
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bell size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">In-App Notifications</p>
              <p className="text-xs text-muted-foreground">Bell icon + feed in this page (always recommended)</p>
            </div>
          </div>
          <button type="button" onClick={() => void save({ inAppEnabled: !prefs.inAppEnabled })}>
            {prefs.inAppEnabled
              ? <ToggleRight size={24} className="text-emerald-400" />
              : <ToggleLeft size={24} className="text-muted-foreground" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'notifyOnSuccess' as const, label: 'Task completed', icon: '✅' },
            { key: 'notifyOnError' as const, label: 'Task failed', icon: '❌' },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => void save({ [key]: !prefs[key] })}
              className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${prefs[key] ? 'border-foreground/20 bg-foreground/5' : 'border-border bg-card/20 opacity-60'
                }`}
            >
              <div className="flex items-center gap-2">
                <span>{icon}</span>
                <span className="text-xs font-medium">{label}</span>
              </div>
              {prefs[key]
                ? <CheckCircle size={14} className="text-emerald-400" />
                : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground" />}
            </button>
          ))}
        </div>
      </div>

      {/* Slack webhook */}
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Webhook size={15} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Slack Webhook</p>
            <p className="text-xs text-muted-foreground">Get task notifications as Slack messages in DMs or a channel</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Incoming Webhook URL</label>
            <input
              id="slack-webhook-url-input"
              type="password"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-foreground/30"
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              value={prefs.slackWebhookUrl ?? ''}
              onChange={(e) => setPrefs((p) => ({ ...p, slackWebhookUrl: e.target.value }))}
              onBlur={() => void save({ slackWebhookUrl: prefs.slackWebhookUrl })}
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Create at <strong>api.slack.com/apps</strong> → Incoming Webhooks → Add to Workspace
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Channel name (display only)</label>
            <input
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
              placeholder="#agent-notifications"
              value={prefs.slackChannelName ?? ''}
              onChange={(e) => setPrefs((p) => ({ ...p, slackChannelName: e.target.value }))}
              onBlur={() => void save({ slackChannelName: prefs.slackChannelName })}
            />
          </div>

          <div className="flex gap-2">
            <button
              id="save-slack-prefs-btn"
              type="button"
              onClick={() => void save(prefs)}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {saving ? 'Saving…' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : 'Save'}
            </button>

            <button
              id="test-slack-btn"
              type="button"
              onClick={() => void testSlack()}
              disabled={testing || !prefs.slackWebhookUrl}
              className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Test
            </button>
          </div>

          {testResult && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${testResult.success ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* What you'll receive section */}
      <div className="rounded-xl border border-border bg-card/20 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">What you'll receive</p>
        <div className="space-y-1.5">
          {[
            '✅ Task complete: agent name, intent summary, steps executed, duration',
            '❌ Task failed: error message, agent name, what was attempted',
          ].map((item) => (
            <p key={item} className="text-xs text-muted-foreground">{item}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Notifications(): React.JSX.Element {
  const { notifications, isLoading, error, markAllRead } = useNotifications();
  const [tab, setTab] = useState<'feed' | 'settings'>('feed');

  function getVisuals(type: 'success' | 'info' | 'warning' | 'default') {
    if (type === 'success') return { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
    if (type === 'warning') return { icon: AlertCircle, color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
    if (type === 'info') return { icon: Bell, color: 'text-primary', bgColor: 'bg-primary/10' };
    return { icon: CheckCircle2, color: 'text-muted-foreground', bgColor: 'bg-secondary' };
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Notifications"
        description="Agent task updates, system alerts, and delivery settings."
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="flex items-center gap-2" onClick={() => void markAllRead()}>
            <Check size={16} />
            Mark all as read
          </Button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit border border-border">
        {([
          { key: 'feed' as const, label: 'Notification Feed', icon: Bell },
          { key: 'settings' as const, label: 'Delivery Settings', icon: Settings2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'feed' && (
        <Card>
          {isLoading || error ? (
            <CardContent className="p-4 text-sm text-muted-foreground">
              {isLoading ? 'Loading notifications…' : `Error: ${error}`}
            </CardContent>
          ) : notifications.length > 0 ? (
            <CardContent className="p-0 divide-y divide-border">
              {notifications.map((notification) => {
                const visuals = getVisuals(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`p-4 sm:p-6 flex gap-4 transition-colors hover:bg-secondary/50 ${notification.read ? 'opacity-70' : 'bg-primary/[0.02]'}`}
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
                    {!notification.read && (
                      <div className="shrink-0 flex items-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                    )}
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
      )}

      {tab === 'settings' && <NotificationSettings />}
    </div>
  );
}
