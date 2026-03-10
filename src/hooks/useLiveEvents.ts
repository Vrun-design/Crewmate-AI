import { useEffect } from 'react';
import type { Notification } from '../types';

interface SessionUpdateEvent {
    sessionId: string;
}

interface JobUpdateEvent {
    jobId: string;
    status: string;
}

type NotificationEvent = Omit<Notification, 'time'> & {
    time?: string;
};

type LiveEventMap = {
    job_update: JobUpdateEvent;
    notification: NotificationEvent;
    session_update: SessionUpdateEvent;
};

interface UseLiveEventsCallbacks {
    onSessionUpdate?: (data: SessionUpdateEvent) => void;
    onJobUpdate?: (data: JobUpdateEvent) => void;
    onNotification?: (data: NotificationEvent) => void;
}

function isLiveEvent(event: string): event is keyof LiveEventMap {
    return event === 'session_update' || event === 'job_update' || event === 'notification';
}

export function useLiveEvents(callbacks: UseLiveEventsCallbacks): void {
    useEffect(() => {
        const token = window.localStorage.getItem('crewmate_auth_token');
        if (!token) return;

        const controller = new AbortController();

        async function connect() {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/events`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                });

                if (!response.body) return;

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    let newlineIndex;

                    while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
                        const message = buffer.slice(0, newlineIndex);
                        buffer = buffer.slice(newlineIndex + 2);

                        let event = '';
                        let dataRaw = '';

                        for (const line of message.split('\n')) {
                            if (line.startsWith('event: ')) event = line.slice(7).trim();
                            if (line.startsWith('data: ')) dataRaw = line.slice(6).trim();
                        }

                        if (event && dataRaw && dataRaw !== '"connected"' && isLiveEvent(event)) {
                            try {
                                if (event === 'session_update') {
                                    callbacks.onSessionUpdate?.(JSON.parse(dataRaw) as SessionUpdateEvent);
                                }
                                if (event === 'job_update') {
                                    callbacks.onJobUpdate?.(JSON.parse(dataRaw) as JobUpdateEvent);
                                }
                                if (event === 'notification') {
                                    callbacks.onNotification?.(JSON.parse(dataRaw) as NotificationEvent);
                                }
                            } catch (error) {
                                console.error('Failed to parse SSE data', error);
                            }
                        }
                    }
                }
            } catch (error: unknown) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    console.error('SSE Connection Error:', error);
                }
            }
        }

        void connect();

        return () => {
            controller.abort();
        };
    }, [callbacks.onSessionUpdate, callbacks.onJobUpdate, callbacks.onNotification]);
}
