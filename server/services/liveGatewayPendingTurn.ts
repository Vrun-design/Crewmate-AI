import { getSessionMeta } from '../repositories/sessionRepository';
import type { SessionRecord } from '../types';
import type { RuntimeSession } from './liveGatewayTypes';

export function clearPendingTurn(runtime: RuntimeSession): void {
  if (!runtime.pendingTurn) {
    return;
  }

  clearTimeout(runtime.pendingTurn.timer);
  runtime.pendingTurn = null;
}

export function resolvePendingTurn(runtime: RuntimeSession): void {
  const pendingTurn = runtime.pendingTurn;
  if (!pendingTurn) {
    return;
  }

  clearPendingTurn(runtime);

  const meta = getSessionMeta(runtime.id);
  if (!meta) {
    pendingTurn.reject(new Error('Session state missing after model response.'));
    return;
  }

  pendingTurn.resolve({
    ...meta,
    transcript: [],
    provider: 'gemini-live',
    audioChunks: [],
    playbackRevision: runtime.playbackRevision,
  });
}

export function createPendingTurn(
  runtime: RuntimeSession,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<SessionRecord> {
  return new Promise<SessionRecord>((resolve, reject) => {
    runtime.pendingTurn = {
      resolve,
      reject,
      timer: setTimeout(() => {
        clearPendingTurn(runtime);
        reject(new Error(timeoutMessage));
      }, timeoutMs),
    };
  });
}
