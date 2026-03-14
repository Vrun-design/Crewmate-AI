import { connectAuthenticatedSseStream } from './sse';

interface LiveEventsSubscriber {
  onEvent?: (event: string, dataRaw: string) => void;
  onError?: (message: string) => void;
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

let nextSubscriberId = 1;
let sharedController: AbortController | null = null;
let reconnectTimerId: number | null = null;
let reconnectAttemptCount = 0;
let hasReceivedEventSinceConnect = false;

const subscribers = new Map<number, LiveEventsSubscriber>();

function notifySubscribersOfEvent(event: string, dataRaw: string): void {
  subscribers.forEach((subscriber) => {
    subscriber.onEvent?.(event, dataRaw);
  });
}

function notifySubscribersOfError(message: string): void {
  subscribers.forEach((subscriber) => {
    subscriber.onError?.(message);
  });
}

function clearReconnectTimer(): void {
  if (reconnectTimerId !== null) {
    window.clearTimeout(reconnectTimerId);
    reconnectTimerId = null;
  }
}

function getReconnectDelayMs(): number {
  const delay = RECONNECT_BASE_DELAY_MS * (2 ** reconnectAttemptCount);
  return Math.min(delay, RECONNECT_MAX_DELAY_MS);
}

function scheduleReconnect(): void {
  if (subscribers.size === 0 || reconnectTimerId !== null) {
    return;
  }

  const delayMs = getReconnectDelayMs();
  reconnectAttemptCount += 1;
  reconnectTimerId = window.setTimeout(() => {
    reconnectTimerId = null;
    ensureSharedConnection();
  }, delayMs);
}

function closeSharedConnection(): void {
  sharedController?.abort();
  sharedController = null;
  clearReconnectTimer();
}

function handleUnexpectedDisconnect(errorMessage = 'Live updates disconnected. Reconnecting now.'): void {
  sharedController = null;

  if (subscribers.size === 0) {
    return;
  }

  notifySubscribersOfError(errorMessage);
  scheduleReconnect();
}

function ensureSharedConnection(): void {
  if (sharedController || subscribers.size === 0) {
    return;
  }

  hasReceivedEventSinceConnect = false;
  sharedController = connectAuthenticatedSseStream('/api/events', {
    onEvent: (event, dataRaw) => {
      hasReceivedEventSinceConnect = true;
      reconnectAttemptCount = 0;
      notifySubscribersOfEvent(event, dataRaw);
    },
    onClose: () => {
      handleUnexpectedDisconnect();
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('401')) {
        notifySubscribersOfError('Live updates disconnected because your session expired.');
        sharedController = null;
        return;
      }

      handleUnexpectedDisconnect(
        hasReceivedEventSinceConnect
          ? 'Live updates disconnected. Reconnecting now.'
          : 'Live updates could not connect. Retrying now.',
      );
    },
  });
}

export function subscribeToLiveEvents(subscriber: LiveEventsSubscriber): () => void {
  const subscriberId = nextSubscriberId;
  nextSubscriberId += 1;
  subscribers.set(subscriberId, subscriber);
  ensureSharedConnection();

  return () => {
    subscribers.delete(subscriberId);
    if (subscribers.size === 0) {
      reconnectAttemptCount = 0;
      closeSharedConnection();
    }
  };
}
