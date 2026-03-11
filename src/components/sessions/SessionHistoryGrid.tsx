import { useState } from 'react';
import { Calendar, CheckSquare, Play, Trash2, ExternalLink } from 'lucide-react';
import { Card } from '../ui/Card';
import { Drawer } from '../ui/Drawer';
import { api } from '../../lib/api';
import type { Session } from '../../types';

interface SessionHistoryGridProps {
  sessions: Session[];
}

export function SessionHistoryGrid({ sessions: initialSessions }: SessionHistoryGridProps): React.JSX.Element {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  async function handleDelete(id: string): Promise<void> {
    await api.delete(`/api/sessions/${id}`);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (selectedSession?.id === id) setSelectedSession(null);
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className="group hover:border-border transition-all">
            {/* Thumbnail */}
            <div className="h-32 bg-secondary relative flex items-center justify-center border-b border-border">
              <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1618401471353-b98a52333646?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-500" />
              <button
                type="button"
                onClick={() => setSelectedSession(session)}
                className="w-10 h-10 rounded-full bg-background/50 border border-border flex items-center justify-center backdrop-blur-md z-10 group-hover:scale-110 transition-transform"
              >
                <Play size={16} className="text-foreground ml-1" />
              </button>
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-background/70 text-xs font-mono text-foreground backdrop-blur-md border border-border">
                {session.duration}
              </div>
              {/* Action menu */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  type="button"
                  onClick={() => setSelectedSession(session)}
                  title="View session"
                  className="p-1.5 rounded-lg bg-background/80 border border-border backdrop-blur-md text-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(session.id)}
                  title="Delete session"
                  className="p-1.5 rounded-lg bg-background/80 border border-border backdrop-blur-md text-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 cursor-pointer" onClick={() => setSelectedSession(session)}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium truncate pr-4 text-foreground text-sm">{session.title}</h3>
                <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
                  {session.id}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  {session.date}
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckSquare size={12} />
                  {session.tasks} turns
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Session detail drawer */}
      <Drawer
        isOpen={selectedSession !== null}
        onClose={() => setSelectedSession(null)}
        title="Session Details"
      >
        {selectedSession && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">{selectedSession.title}</h3>
              <p className="text-xs font-mono text-muted-foreground">{selectedSession.id}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-0.5">
                <div className="text-xs text-muted-foreground">Date</div>
                <div className="text-sm font-medium text-foreground">{selectedSession.date}</div>
              </div>
              <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-0.5">
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="text-sm font-medium text-foreground">{selectedSession.duration}</div>
              </div>
              <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-0.5">
                <div className="text-xs text-muted-foreground">Turns</div>
                <div className="text-sm font-medium text-foreground">{selectedSession.tasks}</div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
              Semantic memory and high-level summaries are compacted and stored for this session by the memory worker.
            </div>
            <button
              type="button"
              onClick={() => void handleDelete(selectedSession.id).then(() => setSelectedSession(null))}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive py-2.5 text-sm font-medium hover:bg-destructive/20 transition-colors"
            >
              <Trash2 size={14} />
              Delete this session
            </button>
          </div>
        )}
      </Drawer>
    </>
  );
}
