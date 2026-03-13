export type ActivityType = 'research' | 'observation' | 'note' | 'action' | 'communication';

export interface ActivityRecord {
  id: string;
  title: string;
  description: string;
  time: string;
  type: ActivityType;
}

export interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  status: 'completed' | 'in_progress' | 'pending' | 'failed' | 'cancelled';
  time: string;
  tool: string;
  priority: 'High' | 'Medium' | 'Low';
  url?: string | null;
  linkedAgentTaskId?: string | null;
  sourceKind?: 'manual' | 'live' | 'delegated' | 'integration';
  currentRunId?: string | null;
  linkedSessionId?: string | null;
  artifactCount?: number;
}

export interface TaskRunRecord {
  id: string;
  taskId: string;
  runType: 'delegated_skill' | 'delegated_agent' | 'manual_sync';
  agentId?: string | null;
  skillId?: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: unknown[];
  result?: unknown;
  error?: string | null;
  originType?: 'app' | 'live_session' | 'command' | 'delegation' | 'slack' | 'email' | 'system' | null;
  originRef?: string | null;
  linkedAgentTaskId?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

export interface TaskDetailRecord extends TaskRecord {
  latestRun?: TaskRunRecord | null;
  runs: TaskRunRecord[];
}

export interface IntegrationRecord {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  configuredVia?: 'env' | 'vault' | 'none';
  iconName: string;
  color: string;
  bgColor: string;
  desc: string;
  docsUrl?: string;
  setupSteps?: string[];
  capabilities?: string[];
  requiredKeys?: string[];
  missingKeys?: string[];
  notes?: string;
  /** OAuth integrations provide a connect URL instead of API key fields */
  connectUrl?: string;
}

export interface IntegrationConfigFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  helpText?: string;
}

export interface IntegrationConfigFieldState extends IntegrationConfigFieldDefinition {
  value?: string;
  configured: boolean;
}

export interface IntegrationConfigState {
  integrationId: string;
  configuredVia: 'env' | 'vault' | 'none';
  fields: IntegrationConfigFieldState[];
  connection?: {
    accountEmail?: string;
    accountLabel?: string;
    grantedScopes?: string[];
    grantedModules?: string[];
    missingModules?: string[];
    defaults?: Record<string, string>;
    status: 'connected' | 'disconnected';
  };
}

export interface TranscriptMessage {
  id: string;
  role: 'agent' | 'user';
  text: string;
  status?: 'complete' | 'streaming';
}

export interface SessionRecord {
  id: string;
  status: 'idle' | 'connecting' | 'live' | 'ended';
  startedAt: string;
  endedAt?: string | null;
  transcript: TranscriptMessage[];
  provider?: 'local' | 'gemini-live';
  audioChunks?: AudioChunkRecord[];
  playbackRevision?: number;
}

export interface AudioChunkRecord {
  id: number;
  data: string;
  mimeType: string;
}

export interface DashboardPayload {
  tasks: TaskRecord[];
  activities: ActivityRecord[];
  integrations: IntegrationRecord[];
  currentSession: SessionRecord | null;
  activeTaskSummary?: {
    count: number;
    liveOriginCount: number;
    items: Array<{
      id: string;
      intent: string;
      status: 'queued' | 'running';
      routeType: 'inline_answer' | 'inline_skill' | 'delegated_skill' | 'delegated_agent';
      originType?: 'app' | 'live_session' | 'command';
    }>;
  };
}

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'success' | 'info' | 'warning' | 'default';
  read: boolean;
  sourcePath?: string | null;
}

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  plan: string;
  workspaceId: string;
}

export interface CapabilityRecord {
  id: string;
  title: string;
  description: string;
  status: 'live' | 'available' | 'setup_required';
  category: 'perception' | 'action' | 'memory' | 'orchestration';
}

export interface UserPreferencesRecord {
  voiceModel: string;
  textModel: string;
  imageModel: string;
  reasoningLevel: string;
  proactiveSuggestions: boolean;
  autoStartScreenShare: boolean;
  blurSensitiveFields: boolean;
}
