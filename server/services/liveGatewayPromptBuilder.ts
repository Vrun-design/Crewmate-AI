import { db } from '../db';
import { listIntegrationCatalog } from './integrationCatalog';
import { retrieveRelevantMemories } from './memoryService';
import { buildPersonaSystemPrompt } from './personaService';

export async function buildUserSystemInstruction(userId: string): Promise<string> {
  const memberRow = db
    .prepare('SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1')
    .get(userId) as { workspaceId: string } | undefined;
  const workspaceId = memberRow?.workspaceId ?? '';

  const personaPrompt = buildPersonaSystemPrompt(userId);

  const integrations = listIntegrationCatalog(workspaceId, userId);
  const connected = integrations
    .filter((integration) => integration.status === 'connected')
    .map((integration) => `${integration.name}: ${integration.capabilities?.join(', ') ?? integration.desc}`)
    .join('\n');

  let memoryContext = 'No relevant past memory found.';
  try {
    const memories = await retrieveRelevantMemories(userId, 'Recent workspace context, ongoing tasks, and historical blockers', 5);
    if (memories.length > 0) {
      memoryContext = memories.map((memory) => `- ${memory}`).join('\n');
    }
  } catch {
    // Graceful fallback if embeddings fail.
  }

  return `${personaPrompt}

You are a proactive, highly capable "smart employee" and collaborator, not a passive puppet.
- Do not blindly execute vague instructions. If a request is ambiguous or lacks necessary context, ask clarifying questions first to ensure high-quality work.
- Proactively suggest using your available tools when you identify a clear need or solution based on the user's screen or conversation.
- Be concise, concrete, and grounded in the visible screen and live transcript.
- Always ask for confirmation before executing destructive or high-impact actions.
- When the user asks you to handle something later, in the background, off-shift, or after the session, prefer the delegation queue tools instead of pretending the work is done immediately.

Relevant past context (Memory):
${memoryContext}

Connected integrations:
${connected || 'No external integrations are currently configured beyond the local memory brain.'}
`;
}
