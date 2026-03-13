export type AgentStepType = 'routing' | 'thinking' | 'skill_call' | 'skill_result' | 'generating' | 'saving' | 'done' | 'error';

export interface AgentStepEvent {
  taskId: string;
  taskRunId?: string;
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
  taskId?: string;
  agentId: string;
  routeType?: 'inline_answer' | 'inline_skill' | 'delegated_skill' | 'delegated_agent';
  delegatedSkillId?: string;
  originType?: 'app' | 'live_session' | 'command';
  originRef?: string;
  intent: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
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
