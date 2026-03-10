import type { RuntimeSession } from './liveGatewayTypes';

const runtimeSessions = new Map<string, RuntimeSession>();

export function getRuntimeSession(sessionId: string): RuntimeSession | undefined {
  return runtimeSessions.get(sessionId);
}

export function setRuntimeSession(sessionId: string, runtime: RuntimeSession): void {
  runtimeSessions.set(sessionId, runtime);
}

export function deleteRuntimeSession(sessionId: string): void {
  runtimeSessions.delete(sessionId);
}
