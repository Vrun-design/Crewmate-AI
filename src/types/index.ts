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

export interface Job {
  id: string;
  type: 'research_brief';
  status: 'queued' | 'running' | 'completed' | 'failed';
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface CreativeArtifact {
  title: string;
  narrative: string;
  imageData?: string;
  imageMimeType?: string;
}
