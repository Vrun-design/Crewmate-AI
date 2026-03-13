import { ActivityIcon, CheckSquare, Command, Terminal } from 'lucide-react';
import type { Integration } from '../types';

type IntegrationApiShape = Omit<Integration, 'icon'> & {
  iconName?: string;
};

const integrationIcons = {
  slack: ActivityIcon,
  notion: Terminal,
  linear: Command,
  clickup: CheckSquare,
  'google-workspace': Command,
} as const;

const customLogos: Record<string, string> = {
  slack: '/Slack.svg',
  notion: '/Notion.svg',
  linear: '/Linear.svg',
  clickup: '/Clikcup.svg',
  figma: '/Figma.svg',
  'google-workspace': '/Google.svg',
};

export function mapIntegration(integration: IntegrationApiShape): Integration {
  const logoKey = integration.iconName?.toLowerCase() ?? integration.id.toLowerCase();

  return {
    ...integration,
    icon: integrationIcons[integration.iconName as keyof typeof integrationIcons] ?? Terminal,
    logoUrl: customLogos[logoKey] ?? customLogos[integration.id.toLowerCase()],
  };
}
