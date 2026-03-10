export type AgentStepType = 'routing' | 'thinking' | 'skill_call' | 'skill_result' | 'generating' | 'saving' | 'done' | 'error';

export interface AgentStepEvent {
  taskId: string;
  stepIndex: number;
  type: AgentStepType;
  timestamp: string;
  label: string;
  detail?: string;
  skillId?: string;
  durationMs?: number;
  success?: boolean;
}

export interface AgentTask {
  id: string;
  agentId: string;
  intent: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  steps?: AgentStepEvent[];
  createdAt: string;
  completedAt?: string;
}

export interface AgentManifest {
  id: string;
  name: string;
  department: string;
  description: string;
  emoji: string;
  capabilities: string[];
  skills: string[];
}
