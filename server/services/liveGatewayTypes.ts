import type { Session, LiveServerMessage } from '@google/genai';
import type { AudioChunkRecord, SessionRecord } from '../types';

export type ToolCall = LiveServerMessage['toolCall'] extends { functionCalls?: infer T }
  ? T extends Array<infer U>
    ? U
    : never
  : never;

export interface PendingTurn {
  resolve: (session: SessionRecord) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export interface RuntimeSession {
  id: string;
  provider: 'gemini-live';
  session: Session;
  pendingTurn: PendingTurn | null;
  currentAssistantMessageId: string | null;
  currentAssistantText: string;
  currentUserTranscriptionMessageId: string | null;
  currentUserTranscriptionText: string;
  lastUserTurnText: string | null;
  hasVideoContext: boolean;
  hasAudioContext: boolean;
  audioChunks: AudioChunkRecord[];
  nextAudioChunkId: number;
  lastFrameData: { mimeType: string; data: string } | null;
  lastUserActivityTime: number;
  lastProactiveTime: number | null;
  proactiveInterval: NodeJS.Timeout | null;
}
