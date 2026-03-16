import { createUserContent } from '@google/genai';
import { getRuntimeSession } from './liveGatewayRuntimeStore';
import type { RuntimeSession } from './liveGatewayTypes';
import type { AgentTask } from './orchestrator';

function buildAnnouncementPrompt(
  intro: string,
  taskTitle: string,
  detailLabel: 'Reason' | 'Result',
  detail: string,
): string {
  return [
    intro,
    'Reply in exactly one short spoken sentence.',
    `Task: "${taskTitle}"`,
    detail ? `${detailLabel}: "${detail}"` : '',
    'Do not ask a follow-up question.',
  ].filter(Boolean).join('\n');
}

function dispatchRuntimePrompt(runtime: RuntimeSession, prompt: string): void {
  runtime.lastUserTurnText = null;
  runtime.lastUserActivityTime = Date.now();
  runtime.session.sendClientContent({
    turns: createUserContent(prompt),
    turnComplete: true,
  });
}

export function enqueueRuntimeAnnouncement(runtime: RuntimeSession, prompt: string): void {
  if (runtime.pendingTurn || runtime.isReconnecting) {
    runtime.pendingAnnouncements.push(prompt);
    return;
  }

  dispatchRuntimePrompt(runtime, prompt);
}

export function flushPendingAnnouncements(runtime: RuntimeSession): void {
  if (runtime.pendingTurn || runtime.isReconnecting || runtime.pendingAnnouncements.length === 0) {
    return;
  }

  const nextPrompt = runtime.pendingAnnouncements.shift();
  if (!nextPrompt) {
    return;
  }

  dispatchRuntimePrompt(runtime, nextPrompt);
}

function buildLiveTaskAnnouncementPrompt(task: AgentTask, summary: string | null): string {
  const taskTitle = task.intent.slice(0, 140);
  const detail = (summary ?? task.error ?? '').slice(0, 220);

  if (task.status === 'failed') {
    return buildAnnouncementPrompt(
      'A background task you started for the user has failed. Say that it failed, mention the task briefly, and include the reason if it is useful.',
      taskTitle,
      'Reason',
      detail,
    );
  }

  return buildAnnouncementPrompt(
    'A background task you started for the user has finished. Give a very brief one-sentence heads-up — mention the task name and say it is done. Do not summarise the result unless it fits in 5 words.',
    taskTitle,
    'Result',
    detail,
  );
}

export function announceLiveTaskUpdate(sessionId: string, task: AgentTask, summary: string | null): void {
  const runtime = getRuntimeSession(sessionId);
  if (!runtime) {
    return;
  }

  enqueueRuntimeAnnouncement(runtime, buildLiveTaskAnnouncementPrompt(task, summary));
}
