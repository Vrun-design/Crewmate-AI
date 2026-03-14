import { buildApiUrl, getAuthToken } from './api';

interface SseHandlers {
  onEvent?: (event: string, dataRaw: string) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

export function connectAuthenticatedSseStream(
  path: string,
  handlers: SseHandlers,
): AbortController | null {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  const controller = new AbortController();

  void (async () => {
    try {
      const response = await fetch(buildApiUrl(path), {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          handlers.onClose?.();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let separatorIndex = buffer.indexOf('\n\n');

        while (separatorIndex >= 0) {
          const message = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);

          let event = 'message';
          let dataRaw = '';

          for (const line of message.split('\n')) {
            if (line.startsWith('event: ')) {
              event = line.slice(7).trim();
            }

            if (line.startsWith('data: ')) {
              dataRaw = line.slice(6).trim();
            }
          }

          if (dataRaw) {
            handlers.onEvent?.(event, dataRaw);
          }

          separatorIndex = buffer.indexOf('\n\n');
        }
      }
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        handlers.onError?.(error);
      }
    }
  })();

  return controller;
}
