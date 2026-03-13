import type { LiveSession, TranscriptMessage } from '../types/live';

export function getElapsedLabel(startedAt: string): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(diffSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (diffSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function mergeSessionState(
  initialSession: LiveSession | null,
  currentSession: LiveSession | null,
): LiveSession | null {
  if (!initialSession) {
    return currentSession;
  }

  if (!currentSession || currentSession.id !== initialSession.id) {
    return initialSession;
  }

  return {
    ...currentSession,
    ...initialSession,
    provider: initialSession.provider ?? currentSession.provider,
  };
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function mergeStreamingText(currentText: string, incomingText: string): string {
  const current = normalizeText(currentText);
  const incoming = normalizeText(incomingText);

  if (!incoming) {
    return current;
  }

  if (!current || current === incoming) {
    return incoming;
  }

  if (incoming.startsWith(current) || incoming.includes(current) || incoming.endsWith(current)) {
    return incoming;
  }

  if (current.startsWith(incoming) || current.includes(incoming) || current.endsWith(incoming)) {
    return current;
  }

  return normalizeText(`${current} ${incoming}`);
}

export function upsertTranscript(
  transcript: TranscriptMessage[],
  role: TranscriptMessage['role'],
  text: string,
  status: TranscriptMessage['status'],
): TranscriptMessage[] {
  const normalizedText = normalizeText(text);
  const existingIndex = transcript.findIndex((message) => message.id === `live-${role}`);
  const nextMessage: TranscriptMessage = {
    id: `live-${role}`,
    role,
    text: normalizedText,
    status,
  };

  if (existingIndex === -1) {
    return [...transcript, nextMessage];
  }

  const nextTranscript = [...transcript];
  nextTranscript[existingIndex] = nextMessage;
  return nextTranscript;
}
