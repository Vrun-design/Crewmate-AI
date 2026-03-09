import {ActivityIcon, CheckSquare, Command, Terminal} from 'lucide-react';
import type {Integration} from '../types';

type IntegrationApiShape = Omit<Integration, 'icon'> & {
  iconName?: string;
};

const integrationIcons = {
  slack: ActivityIcon,
  notion: Terminal,
  github: Terminal,
  linear: Command,
  clickup: CheckSquare,
} as const;

export function mapIntegration(integration: IntegrationApiShape): Integration {
  return {
    ...integration,
    icon: integrationIcons[integration.iconName as keyof typeof integrationIcons] ?? Terminal,
  };
}
