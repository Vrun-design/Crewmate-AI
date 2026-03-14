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
  connectionId: string;
  pendingTurn: PendingTurn | null;
  currentAssistantMessageId: string | null;
  currentAssistantModelText: string;
  currentAssistantOutputTranscriptionText: string;
  currentUserTranscriptionMessageId: string | null;
  currentUserTranscriptionText: string;
  lastUserTurnText: string | null;
  hasVideoContext: boolean;
  hasAudioContext: boolean;
  audioChunks: AudioChunkRecord[];
  nextAudioChunkId: number;
  lastAudioChunkSignature: string | null;
  playbackRevision: number;
  sessionResumptionHandle: string | null;
  canResume: boolean;
  isReconnecting: boolean;
  lastConsumedClientMessageIndex: string | null;
  lastFrameData: { mimeType: string; data: string } | null;
  lastUserActivityTime: number;
  lastProactiveTime: number | null;
  proactiveInterval: NodeJS.Timeout | null;
  pendingAnnouncements: string[];
}
