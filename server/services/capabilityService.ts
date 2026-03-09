import {listIntegrationCatalog} from './integrationCatalog';
import type {CapabilityRecord} from '../types';

export function listCapabilities(userId: string): CapabilityRecord[] {
  const integrations = listIntegrationCatalog(userId);
  const connectedIntegrationCount = integrations.filter((integration) => integration.status === 'connected').length;

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
      id: 'tool-routing',
      title: 'Tool action routing',
      description: `Routes explicit requests into ${connectedIntegrationCount} configured external tools plus the local memory brain.`,
      status: connectedIntegrationCount > 0 ? 'live' : 'setup_required',
      category: 'action',
    },
    {
      id: 'memory-checkpoints',
      title: 'Memory checkpointing',
      description: 'Stores completed live turns as local memory nodes for later recall.',
      status: 'live',
      category: 'memory',
    },
    {
      id: 'a2a-handoff',
      title: 'Async delegation engine',
      description: 'Routes off-shift research briefs through an orchestrator -> researcher -> editor pipeline.',
      status: 'live',
      category: 'orchestration',
    },
    {
      id: 'creative-studio',
      title: 'Creative mixed output',
      description: 'Generates narrative plus an accompanying image artifact from a single prompt.',
      status: 'live',
      category: 'action',
    },
  ];
}
