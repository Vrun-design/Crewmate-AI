import { useEffect, useRef } from 'react';
import type { Notification } from '../types';
import { connectAuthenticatedSseStream } from '../lib/sse';

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
    const callbacksRef = useRef(callbacks);

    useEffect(() => {
        callbacksRef.current = callbacks;
    }, [callbacks]);

    useEffect(() => {
        const controller = connectAuthenticatedSseStream('/api/events', {
            onEvent: (event, dataRaw) => {
                if (dataRaw === '"connected"' || !isLiveEvent(event)) {
                    return;
                }

                try {
                    if (event === 'session_update') {
                        callbacksRef.current.onSessionUpdate?.(JSON.parse(dataRaw) as SessionUpdateEvent);
                    }

                    if (event === 'job_update') {
                        callbacksRef.current.onJobUpdate?.(JSON.parse(dataRaw) as JobUpdateEvent);
                    }

                    if (event === 'notification') {
                        callbacksRef.current.onNotification?.(JSON.parse(dataRaw) as NotificationEvent);
                    }
                } catch (error) {
                    console.error('Failed to parse SSE data', error);
                }
            },
            onError: (error) => {
                console.error('SSE Connection Error:', error);
            },
        });

        return () => controller?.abort();
    }, []);
}
