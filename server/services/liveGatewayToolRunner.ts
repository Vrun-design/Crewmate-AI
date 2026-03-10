import type { FunctionResponse, LiveServerMessage } from '@google/genai';
import { db } from '../db';
import { getSessionUserId } from '../repositories/sessionRepository';
import { callTool } from '../mcp/mcpServer';
import { insertActivity } from './activityService';
import type { RuntimeSession } from './liveGatewayTypes';

function getToolErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown tool execution error';
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

  const frameData = runtime.lastFrameData;
  const functionResponses: FunctionResponse[] = [];
  const memberRow = db
    .prepare('SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1')
    .get(userId) as { workspaceId: string } | undefined;
  const workspaceId = memberRow?.workspaceId ?? '';

  for (const call of calls) {
    try {
      if (!call.name) {
        throw new Error('Tool call missing name');
      }

      const args = call.args as Record<string, unknown>;
      let output: unknown;
      const skillId = call.name.replace(/_/g, '.');
      const { getSkill, runSkill } = await import('../skills/registry');
      const skill = getSkill(skillId);

      if (skill) {
        const runRecord = await runSkill(skillId, { userId, workspaceId }, args);
        output = runRecord.result;
      } else {
        output = await callTool(call.name, { userId, workspaceId, frameData }, args);
      }

      insertActivity(`Executed ${call.name}`, 'Tool call executed successfully.', 'action', userId);
      functionResponses.push({
        id: call.id,
        name: call.name,
        response: { output },
      });
    } catch (error) {
      const messageText = getToolErrorMessage(error);
      insertActivity(`${call.name ?? 'Tool'} failed`, messageText, 'note', userId);
      functionResponses.push({
        id: call.id,
        name: call.name,
        response: { error: messageText },
      });
    }
  }

  runtime.session.sendToolResponse({ functionResponses });
}
