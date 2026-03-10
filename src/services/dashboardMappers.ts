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
  gmail: '/Google.svg',
  calendar: '/Google.svg',
  zapier: '/zapier.svg',
};

export function mapIntegration(integration: IntegrationApiShape): Integration {
  const logoKey = integration.iconName?.toLowerCase() ?? integration.id.toLowerCase();

  return {
    ...integration,
    icon: integrationIcons[integration.iconName as keyof typeof integrationIcons] ?? Terminal,
    logoUrl: customLogos[logoKey] ?? customLogos[integration.id.toLowerCase()],
  };
}
