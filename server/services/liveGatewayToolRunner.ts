import type { FunctionResponse, LiveServerMessage } from '@google/genai';
import { db } from '../db';
import { getSessionUserId } from '../repositories/sessionRepository';
import { insertActivity } from './activityService';
import { createNotification } from './notificationService';
import { buildToolExecutionNotification } from './notificationFormatter';
import type { RuntimeSession } from './liveGatewayTypes';
import { getSkillRouteType } from './executionPolicy';
import { delegateSkillExecution } from './orchestrator';
import { buildReplyTarget } from './channelTasking';
import { logServerError } from './runtimeLogger';

function getToolErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown tool execution error';
}

function getSkillFailureMessage(result: unknown): string {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return 'Tool execution failed.';
  }

  const record = result as Record<string, unknown>;
  const error = typeof record.error === 'string' ? record.error.trim() : '';
  if (error) {
    return error;
  }

  const message = typeof record.message === 'string' ? record.message.trim() : '';
  if (message) {
    return message;
  }

  return 'Tool execution failed.';
}

const DELEGATION_TEMPLATES = [
  (skillName: string) => `On it — running ${skillName} in the background. I'll keep listening while that runs.`,
  (_skillName: string) => `Kicked that off — you'll see the result in the Tasks panel when it's done.`,
  (skillName: string) => `Starting ${skillName} now. I'll let you know when it's ready.`,
  (_skillName: string) => `Running that in the background. What else do you need?`,
  (skillName: string) => `${skillName} is on its way — I'll flag it when it's complete.`,
];

let delegationTemplateIndex = 0;
function getDelegationMessage(skillName: string): string {
  const template = DELEGATION_TEMPLATES[delegationTemplateIndex % DELEGATION_TEMPLATES.length];
  delegationTemplateIndex++;
  return template(skillName);
}

function getWorkspaceIdForUser(userId: string): string {
  const memberRow = db
    .prepare('SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1')
    .get(userId) as { workspaceId: string } | undefined;
  return memberRow?.workspaceId ?? '';
}

function getNotificationPayload(
  callName: string,
  skillName: string,
  delegatedTaskId: string | null,
  output: unknown,
): { title: string; message: string; type: 'info' | 'success' | 'warning' | 'default' } | null {
  if (delegatedTaskId) {
    return {
      title: 'Background task started',
      message: `Started ${skillName} as task ${delegatedTaskId}. It is running in the background and may still fail. Track progress in Tasks.`,
      type: 'info',
    };
  }

  return buildToolExecutionNotification(callName, output);
}

function buildErrorSpokenResponse(errorMessage: string, skillId?: string): string {
  const lower = errorMessage.toLowerCase();

  // Integration not connected
  if (lower.includes('not connected') || lower.includes('no token') || lower.includes('unauthorized') || lower.includes('401')) {
    const integrationName = skillId?.split('.')?.[0] ?? 'that integration';
    const displayName = integrationName.charAt(0).toUpperCase() + integrationName.slice(1);
    return `That didn't work — ${displayName} isn't connected yet. You can connect it in Integrations. Want me to open that for you?`;
  }

  // Rate limit
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many requests')) {
    return `Hit a rate limit on that one — give it a moment and then try again.`;
  }

  // Network / timeout
  if (lower.includes('timeout') || lower.includes('econnrefused') || lower.includes('network') || lower.includes('fetch failed')) {
    return `There was a connection issue with that request. Check your internet and try again — or I can retry it.`;
  }

  // Permission denied
  if (lower.includes('403') || lower.includes('forbidden') || lower.includes('permission')) {
    return `I don't have permission to do that — you may need to reconnect the integration with broader access.`;
  }

  if (lower.includes('requested entity was not found')) {
    return `I couldn't find the exact Google file to update. If you open it on screen or give me the exact file name, I can try again.`;
  }

  // Unknown skill
  if (lower.includes('unknown') || lower.includes('not found') || lower.includes('404')) {
    return `I tried to run that but couldn't find the right tool. That capability might not be set up yet.`;
  }

  // Generic fallback — still better than raw error text
  return `That didn't work — something went wrong on my end. The error was: ${errorMessage.slice(0, 120)}. Want to try again?`;
}

export async function executeLiveFunctionCalls(input: {
  sessionId: string;
  userId: string;
  calls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>;
}): Promise<FunctionResponse[]> {
  const functionResponses: FunctionResponse[] = [];
  const workspaceId = getWorkspaceIdForUser(input.userId);

  for (const call of input.calls) {
    try {
      if (!call.name) {
        throw new Error('Tool call missing name');
      }

      const args = call.args ?? {};
      const skillId = call.name.replace(/_/g, '.');
      const { getSkill, runSkill } = await import('../skills/registry');
      const skill = getSkill(skillId);

      if (!skill) {
        throw new Error(`Unknown live skill: ${skillId}`);
      }

      let output: unknown;
      let delegatedTaskId: string | null = null;
      if (getSkillRouteType(skill, 'live') === 'delegated_skill') {
        const delegated = await delegateSkillExecution(
          skillId,
          { userId: input.userId, workspaceId, sessionId: input.sessionId },
          args,
          {
            intent: `Live delegation: ${skill.name}`,
            originType: 'live_session',
            originRef: buildReplyTarget('live_session', { sessionId: input.sessionId }) ?? input.sessionId,
          },
        );
        delegatedTaskId = delegated.taskId;
        output = {
          spoken_response: getDelegationMessage(skill.name),
          delegatedTaskId: delegated.taskId,
          status: 'delegated',
        };
        insertActivity(
          `Delegated ${skill.name}`,
          'Started background work from the live session.',
          'action',
          input.userId,
          { notify: false },
        );
      } else {
        const runRecord = await runSkill(skillId, { userId: input.userId, workspaceId, sessionId: input.sessionId }, args);
        if (runRecord.result.success === false) {
          throw new Error(getSkillFailureMessage(runRecord.result));
        }

        output = {
          spoken_response: typeof runRecord.result.message === 'string'
            ? runRecord.result.message
            : skill.invokedMessage ?? `${skill.name} completed.`,
          inlineSkillResult: runRecord.result.output ?? runRecord.result,
          output: runRecord.result.output ?? runRecord.result,
          message: runRecord.result.message,
        };
      }

      if (!delegatedTaskId) {
        insertActivity(`Executed ${call.name}`, 'Tool call executed successfully.', 'action', input.userId, { notify: false });
      }

      const notification = getNotificationPayload(call.name, skill.name, delegatedTaskId, output);
      if (notification) {
        createNotification(input.userId, {
          title: notification.title,
          message: notification.message,
          type: notification.type,
          sourcePath: '/notifications',
        });
      }

      functionResponses.push({
        id: call.id,
        name: call.name,
        response: { output },
      });
    } catch (error) {
      const messageText = getToolErrorMessage(error);
      logServerError('liveGatewayToolRunner:execute-call', error, {
        sessionId: input.sessionId,
        userId: input.userId,
        toolName: call.name ?? null,
      });
      insertActivity(`${call.name ?? 'Tool'} failed`, messageText, 'note', input.userId);
      functionResponses.push({
        id: call.id,
        name: call.name,
        response: {
          spoken_response: buildErrorSpokenResponse(messageText, call.name?.replace(/_/g, '.') ?? undefined),
          error: messageText,
          success: false,
        },
      });
    }
  }

  return functionResponses;
}

export async function handleToolCall(runtime: RuntimeSession, message: LiveServerMessage): Promise<void> {
  const calls = message.toolCall?.functionCalls ?? [];
  if (calls.length === 0) {
    return;
  }

  const userId = getSessionUserId(runtime.id);
  if (!userId) {
    throw new Error('Live session is missing its owner context.');
  }

  const functionResponses = await executeLiveFunctionCalls({
    sessionId: runtime.id,
    userId,
    calls: calls.map((call) => ({
      id: call.id,
      name: call.name,
      args: call.args as Record<string, unknown>,
    })),
  });

  runtime.session.sendToolResponse({ functionResponses });
}
