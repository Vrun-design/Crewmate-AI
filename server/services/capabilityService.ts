import { listIntegrationCatalog } from './integrationCatalog';
import { listTools } from '../mcp/mcpServer';
import { listDiscoveredAgents } from './agents/agentDiscovery';
import type { CapabilityRecord } from '../types';

export function listCapabilities(workspaceId: string, userId: string): CapabilityRecord[] {
  const integrations = listIntegrationCatalog(workspaceId, userId);
  const connectedIntegrationCount = integrations.filter((integration) => integration.status === 'connected').length;

  const mcpCapabilities: CapabilityRecord[] = listTools().map((t) => ({
    id: `mcp - ${t.name} `,
    title: `MCP: ${t.name} `,
    description: t.description,
    status: 'live',
    category: 'action'
  }));

  const a2aCapabilities: CapabilityRecord[] = listDiscoveredAgents().map((a) => ({
    id: `a2a - ${a.id} `,
    title: `A2A Agent: ${a.name} `,
    description: a.description,
    status: a.status === 'online' ? 'live' : 'setup_required',
    category: 'orchestration'
  }));

  return [
    {
      id: 'live-screen',
      title: 'Live screen perception',
      description: 'Reads shared screen frames during active Gemini Live sessions.',
      status: 'live',
      category: 'perception',
    },
    {
      id: 'live-mic',
      title: 'Live microphone perception',
      description: 'Transcribes and reasons over live microphone input in-session.',
      status: 'live',
      category: 'perception',
    },
    {
      id: 'live-mic',
      title: 'Live microphone perception',
      description: 'Transcribes and reasons over live microphone input in-session.',
      status: 'live',
      category: 'perception',
    },
    ...mcpCapabilities,
    {
      id: 'memory-checkpoints',
      title: 'Memory checkpointing',
      description: 'Stores completed live turns as local memory nodes for later recall.',
      status: 'live',
      category: 'memory',
    },
    ...a2aCapabilities,
    {
      id: 'creative-studio',
      title: 'Creative mixed output',
      description: 'Generates narrative plus an accompanying image artifact from a single prompt.',
      status: 'live',
      category: 'action',
    },
  ];
}
