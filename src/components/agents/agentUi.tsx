import React from 'react';
import {
  BarChart2,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Code2,
  Compass,
  FlaskConical,
  HandCoins,
  Headphones,
  Lightbulb,
  Mail,
  MessageSquare,
  Megaphone,
  PenSquare,
  PenTool,
  Presentation,
  ScanSearch,
  Wrench,
  XCircle,
  Zap,
  LineChart,
  Scale,
  Users,
  Package,
  MonitorUp,
  Settings2,
  ClipboardList,
} from 'lucide-react';
import type { AgentStepType } from './types';
import type { AgentManifest, AgentTask } from './types';

export function StepIcon({ type }: { type: AgentStepType }): React.JSX.Element {
  const props = { size: 13 };

  switch (type) {
    case 'routing':
      return <Zap {...props} className="text-violet-400" />;
    case 'thinking':
      return <Brain {...props} className="text-blue-400" />;
    case 'skill_call':
      return <Wrench {...props} className="text-amber-400" />;
    case 'skill_result':
      return <CheckCircle2 {...props} className="text-emerald-400" />;
    case 'generating':
      return <FlaskConical {...props} className="text-indigo-400" />;
    case 'saving':
      return <BarChart2 {...props} className="text-teal-400" />;
    case 'done':
      return <CheckCircle2 {...props} className="text-emerald-500" />;
    case 'error':
      return <XCircle {...props} className="text-red-400" />;
    default:
      return <Bot {...props} className="text-muted-foreground" />;
  }
}

export const STEP_TYPE_LABELS: Record<AgentStepType, string> = {
  routing: 'Routing',
  thinking: 'Thinking',
  skill_call: 'Skill',
  skill_result: 'Result',
  generating: 'Generating',
  saving: 'Saving',
  done: 'Done',
  error: 'Error',
};

export const STEP_COLORS: Record<AgentStepType, string> = {
  routing: 'border-violet-500/30 bg-violet-500/5',
  thinking: 'border-blue-500/30 bg-blue-500/5',
  skill_call: 'border-amber-500/30 bg-amber-500/5',
  skill_result: 'border-emerald-500/30 bg-emerald-500/5',
  generating: 'border-indigo-500/30 bg-indigo-500/5',
  saving: 'border-teal-500/30 bg-teal-500/5',
  done: 'border-emerald-500/30 bg-emerald-500/5',
  error: 'border-red-500/30 bg-red-500/5',
};

export const AGENT_DEPT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Intelligence: Brain,
  Marketing: PenTool,
  Engineering: Code2,
  Comms: Mail,
  Ops: ClipboardList,
  Sales: BarChart2,
  Support: MessageSquare,
  Analytics: BarChart2,
  Finance: LineChart,
  Legal: Scale,
  People: Users,
  Product: Package,
  Navigation: MonitorUp,
  Default: Bot,
};

const AGENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'crewmate-research-agent': ScanSearch,
  'crewmate-marketing-agent': Megaphone,
  'crewmate-content-agent': PenSquare,
  'crewmate-social-agent': Presentation,
  'crewmate-devops-agent': Settings2,
  'crewmate-communications-agent': Mail,
  'crewmate-sales-agent': HandCoins,
  'crewmate-support-agent': Headphones,
  'crewmate-hr-agent': Users,
  'crewmate-product-agent': Lightbulb,
  'crewmate-finance-agent': LineChart,
  'crewmate-legal-agent': Scale,
  'crewmate-data-agent': BarChart2,
  'crewmate-ui-navigator-agent': Compass,
};

export function getAgentIcon(agent: Pick<AgentManifest, 'id' | 'department'>): React.ComponentType<{ size?: number; className?: string }> {
  return AGENT_ICONS[agent.id] ?? AGENT_DEPT_ICONS[agent.department] ?? AGENT_DEPT_ICONS.Default;
}

type AgentTaskStatusMeta = {
  badgeVariant: 'default' | 'success' | 'danger' | 'info';
  cardClassName: string;
  iconContainerClassName: string;
  label: string;
};

const AGENT_TASK_STATUS_META: Record<AgentTask['status'], AgentTaskStatusMeta> = {
  queued: {
    badgeVariant: 'default',
    cardClassName: 'border-border',
    iconContainerClassName: 'border-border bg-secondary',
    label: 'Queued',
  },
  running: {
    badgeVariant: 'info',
    cardClassName: 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.08)]',
    iconContainerClassName: 'border-blue-500/40 bg-blue-500/10',
    label: 'Running',
  },
  completed: {
    badgeVariant: 'success',
    cardClassName: 'border-emerald-500/20',
    iconContainerClassName: 'border-emerald-500/30 bg-emerald-500/10',
    label: 'Completed',
  },
  failed: {
    badgeVariant: 'danger',
    cardClassName: 'border-red-500/20',
    iconContainerClassName: 'border-red-500/30 bg-red-500/10',
    label: 'Failed',
  },
  cancelled: {
    badgeVariant: 'default',
    cardClassName: 'border-amber-500/20',
    iconContainerClassName: 'border-amber-500/30 bg-amber-500/10',
    label: 'Cancelled',
  },
};

export function getAgentTaskStatusMeta(status: AgentTask['status']): AgentTaskStatusMeta {
  return AGENT_TASK_STATUS_META[status];
}

export function getAgentTaskDurationSeconds(task: Pick<AgentTask, 'createdAt' | 'completedAt'>): number | null {
  if (!task.completedAt) {
    return null;
  }

  const durationMs = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
  return Math.max(0, Math.round(durationMs / 1000));
}

export function getAgentTaskAgentLabel(agentId?: string | null): string {
  if (!agentId) {
    return 'Crewmate';
  }

  const normalized = agentId
    .replace(/^crewmate-/, '')
    .replace(/-agent$/, '')
    .replace(/_agent$/, '')
    .replace(/_/g, '-');

  return normalized
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getSkillLabel(skillId?: string | null): string {
  if (!skillId) {
    return 'Direct Skill';
  }

  return skillId
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
