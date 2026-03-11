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
  status: 'completed' | 'in_progress' | 'pending';
  time: string;
  tool: string;
  priority: 'High' | 'Medium' | 'Low';
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
}

export interface Session {
  id: string;
  title: string;
  date: string;
  duration: string;
  tasks: number;
}

export interface MemoryNode {
  id: string;
  title: string;
  type: 'document' | 'preference' | 'integration' | 'core';
  tokens: string;
  lastSynced: string;
  active: boolean;
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

export type JobType = 'research_brief' | 'daily_digest' | 'workflow_run';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type WorkOriginType = 'delegation' | 'live_session' | 'slack' | 'email' | 'system';
export type WorkApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';
export type DeliveryChannelType = 'in_app' | 'slack' | 'email' | 'notion' | 'github' | 'clickup';

export interface WorkDelivery {
  channel: DeliveryChannelType;
  destinationLabel: string;
  deliveredAt?: string | null;
  status: 'pending' | 'delivered' | 'failed';
}

export interface WorkArtifact {
  kind: 'brief' | 'summary' | 'notion_page' | 'slack_message' | 'email' | 'issue' | 'doc' | 'digest';
  label: string;
  url?: string | null;
}

export interface WorkHandoff {
  at: string;
  type: 'created' | 'started' | 'delivered' | 'approval_requested' | 'approved' | 'failed';
  actor: string;
  summary: string;
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  originType: WorkOriginType;
  originRef?: string | null;
  deliveryChannels: WorkDelivery[];
  artifactRefs: WorkArtifact[];
  approvalStatus: WorkApprovalStatus;
  approvalRequestedAt?: string | null;
  approvedAt?: string | null;
  handoffLog: WorkHandoff[];
}

export interface CreativeArtifact {
  title: string;
  narrative: string;
  imageData?: string;
  imageMimeType?: string;
}

export interface FeatureFlags {
  offshiftInbox: boolean;
  jobTypesV2: boolean;
  slackInbound: boolean;
  approvalGates: boolean;
}

export interface OffshiftWorkItem {
  id: string;
  title: string;
  type: JobType;
  status: JobStatus;
  startedFrom: WorkOriginType;
  startedFromLabel: string;
  summary: string;
  deliveryChannels: WorkDelivery[];
  artifactRefs: WorkArtifact[];
  approvalStatus: WorkApprovalStatus;
  approvalRequestedAt?: string | null;
  approvedAt?: string | null;
  handoffLog: WorkHandoff[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface WorkflowTemplate {
  id: string;
  userId: string;
  name: string;
  description: string;
  intent: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
  createdAt: string;
  updatedAt: string;
}
