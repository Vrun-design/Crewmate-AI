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
  status: 'completed' | 'in_progress' | 'pending';
  time: string;
  tool: string;
  priority: 'High' | 'Medium' | 'Low';
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
}

export interface MemoryNodeRecord {
  id: string;
  title: string;
  type: 'document' | 'preference' | 'integration' | 'core';
  tokens: string;
  lastSynced: string;
  active: boolean;
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
  memoryNodes: MemoryNodeRecord[];
  currentSession: SessionRecord | null;
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

export interface JobRecord {
  id: string;
  type: 'research_brief';
  status: 'queued' | 'running' | 'completed' | 'failed';
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface CreativeArtifactRecord {
  title: string;
  narrative: string;
  imageData?: string;
  imageMimeType?: string;
}
