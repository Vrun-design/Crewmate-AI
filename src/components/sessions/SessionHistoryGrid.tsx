import { useState } from 'react';
import { Calendar, CheckSquare, Loader2, MessageSquare, Mic, Play, Trash2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Drawer } from '../ui/Drawer';
import { api } from '../../lib/api';
import type { Session } from '../../types';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  status: string;
}

interface SessionHistoryGridProps {
  sessions: Session[];
}

export function SessionHistoryGrid({ sessions: initialSessions }: SessionHistoryGridProps): React.JSX.Element {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  async function handleOpenSession(session: Session): Promise<void> {
    setSelectedSession(session);
    setTranscript([]);
    setTranscriptLoading(true);
    try {
      const messages = await api.get<TranscriptMessage[]>(`/api/sessions/${session.id}/transcript`);
      setTranscript(messages ?? []);
    } catch {
      setTranscript([]);
    } finally {
      setTranscriptLoading(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    await api.delete(`/api/sessions/${id}`);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (selectedSession?.id === id) setSelectedSession(null);
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className="group hover:border-foreground/20 transition-all cursor-pointer" onClick={() => void handleOpenSession(session)}>
            {/* Thumbnail */}
            <div className="h-32 bg-secondary relative flex items-center justify-center border-b border-border">
              <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1618401471353-b98a52333646?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-500" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void handleOpenSession(session); }}
                className="w-10 h-10 rounded-full bg-background/50 border border-border flex items-center justify-center backdrop-blur-md z-10 group-hover:scale-110 transition-transform"
              >
                <Play size={16} className="text-foreground ml-1" />
              </button>
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-background/70 text-xs font-mono text-foreground backdrop-blur-md border border-border">
                {session.duration}
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handleDelete(session.id); }}
                  title="Delete session"
                  className="p-1.5 rounded-lg bg-background/80 border border-border backdrop-blur-md text-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
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

      {/* Session detail drawer with transcript */}
      <Drawer
        isOpen={selectedSession !== null}
        onClose={() => setSelectedSession(null)}
        title="Session Transcript"
      >
        {selectedSession && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">{selectedSession.title}</h3>
              <p className="text-xs font-mono text-muted-foreground">{selectedSession.id}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
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

            {/* Transcript */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <MessageSquare size={12} />
                Conversation Transcript
              </div>

              {transcriptLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Loading transcript...
                </div>
              ) : transcript.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center space-y-2">
                  <Mic size={20} className="mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No transcript recorded for this session.</p>
                  <p className="text-xs text-muted-foreground/70">
                    Transcripts are captured when audio transcription is active during a Gemini Live session.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {transcript.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                        msg.role === 'user'
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-secondary border border-border text-muted-foreground'
                      }`}>
                        {msg.role === 'user' ? 'U' : 'AI'}
                      </div>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary/10 text-foreground border border-primary/20 rounded-tr-sm'
                          : 'bg-secondary text-foreground border border-border rounded-tl-sm'
                      }`}>
                        {msg.text || <span className="italic text-muted-foreground">[empty]</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
