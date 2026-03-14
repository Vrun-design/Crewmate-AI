import { useEffect, useRef } from 'react';
import type { Notification } from '../types';
import { subscribeToLiveEvents } from '../lib/liveEventsStream';
import type { LiveTaskCue } from '../types/liveTaskCue';

interface SessionUpdateEvent {
    sessionId: string;
}

interface LiveTaskUpdateEvent extends LiveTaskCue {
    sessionId: string;
    taskId: string;
    taskRunId: string;
    agentId?: string;
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
    live_task_update: LiveTaskUpdateEvent;
};

interface UseLiveEventsCallbacks {
    onSessionUpdate?: (data: SessionUpdateEvent) => void;
    onJobUpdate?: (data: JobUpdateEvent) => void;
    onNotification?: (data: NotificationEvent) => void;
    onLiveTaskUpdate?: (data: LiveTaskUpdateEvent) => void;
    onError?: (message: string) => void;
    enabled?: boolean;
}

function isLiveEvent(event: string): event is keyof LiveEventMap {
    return event === 'session_update' || event === 'job_update' || event === 'notification' || event === 'live_task_update';
}

export function useLiveEvents(callbacks: UseLiveEventsCallbacks): void {
    const callbacksRef = useRef(callbacks);

    useEffect(() => {
        callbacksRef.current = callbacks;
    }, [callbacks]);

    useEffect(() => {
        if (callbacks.enabled === false) {
            return;
        }

        return subscribeToLiveEvents({
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

                    if (event === 'live_task_update') {
                        callbacksRef.current.onLiveTaskUpdate?.(JSON.parse(dataRaw) as LiveTaskUpdateEvent);
                    }
                } catch (error) {
                    console.error('Failed to parse SSE data', error);
                    callbacksRef.current.onError?.('Live updates hit an unreadable event. Try refreshing this page if updates look stale.');
                }
            },
            onError: (message) => {
                callbacksRef.current.onError?.(message);
            },
        });
    }, [callbacks.enabled]);
}
