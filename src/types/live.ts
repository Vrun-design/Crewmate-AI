import type {Activity, Integration, MemoryNode, Task} from './index';

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
  provider?: 'local' | 'gemini-live';
}

export interface DashboardData {
  tasks: Task[];
  activities: Activity[];
  integrations: Integration[];
  memoryNodes: MemoryNode[];
  currentSession: LiveSession | null;
}
