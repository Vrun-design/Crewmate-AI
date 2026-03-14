import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveEvents } from '../../hooks/useLiveEvents';
import { useToast } from '../../contexts/ToastContext';

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

export function TaskToastListener(): React.JSX.Element | null {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const seenEventsRef = useRef(new Set<string>());

  useLiveEvents({
    onLiveTaskUpdate: (event) => {
      const eventKey = `${event.taskRunId}:${event.status}`;
      if (seenEventsRef.current.has(eventKey)) {
        return;
      }
      seenEventsRef.current.add(eventKey);

      if (event.status === 'running') {
        showToast({
          title: 'Background task started',
          description: truncateText(event.title, 90),
          variant: 'info',
          durationMs: 3500,
          actionLabel: 'Open task',
          onAction: () => navigate(`/tasks?task=${encodeURIComponent(event.taskId)}`),
        });
        return;
      }

      if (event.status === 'completed') {
        showToast({
          title: 'Background task completed',
          description: event.summary ? truncateText(event.summary, 120) : truncateText(event.title, 90),
          variant: 'success',
          durationMs: 5000,
          actionLabel: 'Open task',
          onAction: () => navigate(`/tasks?task=${encodeURIComponent(event.taskId)}`),
        });
        return;
      }

      showToast({
        title: 'Background task failed',
        description: event.summary ? truncateText(event.summary, 120) : truncateText(event.title, 90),
        variant: 'error',
        durationMs: 6500,
        actionLabel: 'Open task',
        onAction: () => navigate(`/tasks?task=${encodeURIComponent(event.taskId)}`),
      });
    },
  });

  return null;
}
