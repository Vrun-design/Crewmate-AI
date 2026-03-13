import type { LucideIcon } from 'lucide-react';

export interface Activity {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'research' | 'observation' | 'note' | 'action' | 'communication';
}

export interface Task {
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

export interface TaskRun {
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

export interface TaskDetail extends Task {
  latestRun?: TaskRun | null;
  runs: TaskRun[];
}

export interface Integration {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  configuredVia?: 'env' | 'vault' | 'none';
  icon: LucideIcon;
  logoUrl?: string;
  color: string;
  bgColor: string;
  desc: string;
  docsUrl?: string;
  setupSteps?: string[];
  capabilities?: string[];
  requiredKeys?: string[];
  missingKeys?: string[];
  notes?: string;
  /** OAuth-based integrations provide a server-side connect URL */
  connectUrl?: string;
}

export interface IntegrationConfigField {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  helpText?: string;
  value?: string;
  configured: boolean;
}

export interface IntegrationConfigState {
  integrationId: string;
  configuredVia: 'env' | 'vault' | 'none';
  fields: IntegrationConfigField[];
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

export interface Session {
  id: string;
  title: string;
  date: string;
  duration: string;
  tasks: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'success' | 'info' | 'warning' | 'default';
  read: boolean;
  sourcePath?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: string;
}

export interface Capability {
  id: string;
  title: string;
  description: string;
  status: 'live' | 'available' | 'setup_required';
  category: 'perception' | 'action' | 'memory' | 'orchestration';
}

export interface UserPreferences {
  voiceModel: string;
  textModel: string;
  imageModel: string;
  reasoningLevel: string;
  proactiveSuggestions: boolean;
  autoStartScreenShare: boolean;
  blurSensitiveFields: boolean;
}

export interface FeatureFlags {
  slackInbound: boolean;
  approvalGates: boolean;
  uiNavigator: boolean;
  researchGrounding: boolean;
}
