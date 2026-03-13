import { listSkills } from '../skills/registry';
import { listDiscoveredAgents } from './agents/agentDiscovery';
import type { CapabilityRecord } from '../types';

export function listCapabilities(workspaceId: string, userId: string): CapabilityRecord[] {
  const skillCapabilities: CapabilityRecord[] = listSkills().map((skill) => ({
    id: `skill - ${skill.id} `,
    title: `Skill: ${skill.name} `,
    description: skill.description,
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
    ...skillCapabilities,
    {
      id: 'memory-checkpoints',
      title: 'Memory checkpointing',
      description: 'Stores live context, durable knowledge, and artifact references for later recall.',
      status: 'live',
      category: 'memory',
    },
    ...a2aCapabilities,
  ];
}
