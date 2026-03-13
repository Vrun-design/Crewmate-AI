import type {Activity, Integration, Task} from './index';

export interface TranscriptMessage {
  id: string;
  role: 'agent' | 'user';
  text: string;
  status?: 'complete' | 'streaming';
}

export interface AudioChunk {
  id: number;
  data: string;
  mimeType: string;
}

export type ScreenShareStatus = 'idle' | 'requesting' | 'sharing' | 'error';
export type MicrophoneStatus = 'idle' | 'requesting' | 'recording' | 'muted' | 'error';

export interface LiveSession {
  id: string;
  status: 'idle' | 'connecting' | 'live' | 'ended';
  startedAt: string;
  endedAt?: string | null;
  transcript: TranscriptMessage[];
  audioChunks?: AudioChunk[];
  playbackRevision?: number;
  provider?: 'local' | 'gemini-live';
}

export interface LiveToolCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

export interface LiveDirectBootstrap {
  session: LiveSession;
  bootstrap: {
    model: string;
    config: Record<string, unknown>;
  };
}

export interface LiveScreenshotArtifact {
  id: string;
  userId: string;
  workspaceId?: string | null;
  sessionId?: string | null;
  taskId?: string | null;
  taskRunId?: string | null;
  title?: string | null;
  caption?: string | null;
  mimeType: string;
  publicUrl: string;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  tasks: Task[];
  activities: Activity[];
  integrations: Integration[];
  currentSession: LiveSession | null;
  activeTaskSummary?: {
    count: number;
    liveOriginCount: number;
    items: Array<{
      id: string;
      intent: string;
      status: 'queued' | 'running';
      routeType: 'inline_answer' | 'inline_skill' | 'delegated_skill' | 'delegated_agent';
      originType?: 'app' | 'live_session' | 'command';
    }>;
  };
}
