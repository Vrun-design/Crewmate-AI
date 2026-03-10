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
    const memories = await retrieveRelevantMemories(userId, 'Current workspace context and open tickets', 5);
    if (memories.length > 0) {
      memoryContext = memories.map((memory) => `- ${memory}`).join('\n');
    }
  } catch {
    // Graceful fallback if embeddings fail.
  }

  return `${personaPrompt}

Be concise, concrete, and grounded in the visible screen, the live transcript, and the user's explicit intent.
Only call tools for explicit action requests. If a tool is not available, say so plainly and continue helping.

Relevant past context (Memory):
${memoryContext}

Connected integrations:
${connected || 'No external integrations are currently configured beyond the local memory brain.'}
`;
}
