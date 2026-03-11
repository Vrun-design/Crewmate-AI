import type { RuntimeSession } from './liveGatewayTypes';

function normalizeText(text: string): string {
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

  if (incoming.startsWith(current) || incoming.includes(current)) {
    return incoming;
  }

  if (current.startsWith(incoming) || current.includes(incoming) || current.endsWith(incoming)) {
    return current;
  }

  if (incoming.endsWith(current)) {
    return incoming;
  }

  return normalizeText(`${current} ${incoming}`);
}

export function getAssistantTranscriptText(runtime: RuntimeSession): string {
  return normalizeText(runtime.currentAssistantOutputTranscriptionText || runtime.currentAssistantModelText);
}
