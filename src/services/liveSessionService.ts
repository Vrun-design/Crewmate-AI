import {api} from '../lib/api';
import type {AudioChunk, LiveSession} from '../types/live';

export const liveSessionService = {
  start() {
    return api.post<LiveSession>('/api/sessions/live');
  },
  end(sessionId: string) {
    return api.post<LiveSession>(`/api/sessions/${sessionId}/end`);
  },
  getSession(sessionId: string) {
    return api.get<LiveSession>(`/api/sessions/${sessionId}`);
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
  sendAudio(sessionId: string, payload: {mimeType: string; data: string}) {
    return api.post<{ok: boolean}>(`/api/sessions/${sessionId}/audio`, payload);
  },
  endAudio(sessionId: string) {
    return api.post<{ok: boolean}>(`/api/sessions/${sessionId}/audio/end`);
  },
};
