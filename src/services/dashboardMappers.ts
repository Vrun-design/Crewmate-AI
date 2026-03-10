import { ActivityIcon, Calendar, CheckSquare, Command, Mail, Terminal } from 'lucide-react';
import type { Integration } from '../types';

type IntegrationApiShape = Omit<Integration, 'icon'> & {
  iconName?: string;
};

const integrationIcons = {
  slack: ActivityIcon,
  notion: Terminal,
  github: Terminal,
  linear: Command,
  clickup: CheckSquare,
  gmail: Mail,
  calendar: Calendar,
} as const;

const customLogos: Record<string, string> = {
  slack: '/Slack.svg',
  notion: '/Notion.svg',
  github: '/Github.svg',
  linear: '/Linear.svg',
  clickup: '/Clikcup.svg',
  figma: '/Figma.svg',
  gmail: '/Gmail.svg',
  calendar: '/GoogleCalendar.svg',
};

export function mapIntegration(integration: IntegrationApiShape): Integration {
  return {
    ...integration,
    icon: integrationIcons[integration.iconName as keyof typeof integrationIcons] ?? Terminal,
    logoUrl: integration.iconName ? customLogos[integration.iconName.toLowerCase()] : undefined,
  };
}
