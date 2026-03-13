import {api} from '../lib/api';
import type {AudioChunk, LiveDirectBootstrap, LiveScreenshotArtifact, LiveSession, LiveToolCall} from '../types/live';

export const liveSessionService = {
  start() {
    return api.post<LiveSession>('/api/sessions/live');
  },
  startDirect() {
    return api.post<LiveDirectBootstrap>('/api/sessions/live/direct');
  },
  end(sessionId: string) {
    return api.post<LiveSession>(`/api/sessions/${sessionId}/end`);
  },
  getSession(sessionId: string) {
    return api.get<LiveSession>(`/api/sessions/${sessionId}`);
  },
  getCurrentSession() {
    return api.get<LiveSession | null>('/api/sessions/current');
  },
  sendMessage(sessionId: string, text: string) {
    return api.post<LiveSession>(`/api/sessions/${sessionId}/messages`, {text});
  },
  getAudioChunks(sessionId: string, after = 0) {
    return api.get<AudioChunk[]>(`/api/sessions/${sessionId}/audio-chunks?after=${after}`);
  },
  sendFrame(sessionId: string, payload: {mimeType: string; data: string}) {
    return api.post<{ok: boolean}>(`/api/sessions/${sessionId}/frame`, payload);
  },
  captureScreenshot(sessionId: string, payload?: {mimeType?: string; data?: string; title?: string; caption?: string}) {
    return api.post<LiveScreenshotArtifact>(`/api/sessions/${sessionId}/screenshot`, payload ?? {});
  },
  sendAudio(sessionId: string, payload: {mimeType: string; data: string}) {
    return api.post<{ok: boolean}>(`/api/sessions/${sessionId}/audio`, payload);
  },
  endAudio(sessionId: string) {
    return api.post<{ok: boolean}>(`/api/sessions/${sessionId}/audio/end`);
  },
  executeToolCalls(sessionId: string, calls: LiveToolCall[]) {
    return api.post<{functionResponses: Array<{id?: string; name?: string; response?: {output?: unknown; error?: string}}>}>(`/api/sessions/${sessionId}/tool-calls`, {calls});
  },
  persistTurn(sessionId: string, payload: {userText?: string; assistantText?: string}) {
    return api.post<LiveSession>(`/api/sessions/${sessionId}/turns`, payload);
  },
};
