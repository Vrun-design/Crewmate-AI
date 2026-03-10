import React from 'react';
import { Mail, ExternalLink, RefreshCw, Inbox } from 'lucide-react';
import { useGmailInbox } from '../../hooks/useGmailInbox';

export function GmailInboxCard(): React.ReactNode {
    const { messages, isConnected, isLoading, refresh } = useGmailInbox(5);

    if (!isConnected) {
        return (
            <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <Mail size={14} className="text-red-500" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">Gmail Inbox</h3>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center">
                        <Mail size={20} className="text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground">Gmail not connected</p>
                        <p className="text-xs text-muted-foreground mt-1">Connect Gmail in Integrations to see your inbox</p>
                    </div>
                    <a
                        href="/integrations"
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                        Connect Gmail <ExternalLink size={11} />
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <Mail size={14} className="text-red-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Gmail Inbox</h3>
                    {messages.filter((m) => !m.isRead).length > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                            {messages.filter((m) => !m.isRead).length}
                        </span>
                    ) : null}
                </div>
                <button
                    onClick={() => void refresh()}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    title="Refresh inbox"
                >
                    <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {isLoading && messages.length === 0 ? (
                <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
                    ))}
                </div>
            ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                    <Inbox size={20} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Inbox is empty</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {messages.map((email) => (
                        <div
                            key={email.id}
                            className={`group flex flex-col gap-0.5 p-3 rounded-xl border transition-colors cursor-default ${email.isRead
                                    ? 'border-transparent hover:border-border hover:bg-secondary/50'
                                    : 'border-border bg-secondary/30 hover:bg-secondary/60'
                                }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    {!email.isRead && (
                                        <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                                    )}
                                    <span className={`text-xs truncate ${email.isRead ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>
                                        {email.from.split('<')[0].trim() || email.from}
                                    </span>
                                </div>
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                    {formatEmailDate(email.date)}
                                </span>
                            </div>
                            <p className={`text-xs truncate ${email.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                                {email.subject || '(no subject)'}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">{email.snippet}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 pt-3 border-t border-border">
                <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                    Open Gmail <ExternalLink size={11} />
                </a>
            </div>
        </div>
    );
}

function formatEmailDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (diffHours < 24 * 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}
