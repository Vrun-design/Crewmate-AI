import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {vi} from 'vitest';
import {describe, expect, test} from 'vitest';
import {Integrations} from './Integrations';

const {refreshMock, integrationConfigMock} = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  integrationConfigMock: {
    integrationId: 'google-workspace',
    configuredVia: 'vault' as const,
    fields: [
      {
        key: 'defaultCalendarId',
        label: 'Default calendar ID',
        placeholder: 'primary',
        secret: false,
        configured: true,
        value: 'primary',
      },
    ],
    connection: {
      status: 'connected' as const,
      accountEmail: 'owner@example.com',
      accountLabel: 'Owner User',
      grantedModules: ['gmail', 'docs', 'sheets'],
      missingModules: ['slides', 'calendar'],
      grantedScopes: ['openid'],
      defaults: {
        defaultCalendarId: 'primary',
      },
    },
  },
}));

vi.mock('../hooks/useIntegrations', () => ({
  useIntegrations: () => ({
    integrations: [
      {
        id: 'google-workspace',
        name: 'Google Workspace',
        status: 'connected',
        icon: () => <span>N</span>,
        color: 'text-foreground',
        bgColor: 'bg-foreground/10',
        desc: 'Create docs',
        connectUrl: '/api/integrations/google-workspace/connect',
        setupSteps: ['Connect account'],
        capabilities: ['Create and append Google Docs'],
        requiredKeys: [],
        missingKeys: [],
      },
    ],
    isLoading: false,
    error: null,
    refresh: refreshMock,
  }),
}));

vi.mock('../hooks/useIntegrationConfig', () => ({
  useIntegrationConfig: () => ({
    config: integrationConfigMock,
    isLoading: false,
    isSaving: false,
    error: null,
    saveConfig: vi.fn(),
    clearConfig: vi.fn(),
  }),
}));

describe('Integrations', () => {
  test('adds bottom padding to the page shell', () => {
    const {container} = render(<Integrations />);

    expect(container.firstChild).toHaveClass('pb-10');
  });

  test('opens integration drawer for configuration', () => {
    render(<Integrations />);

    fireEvent.click(screen.getByRole('button', {name: /configure|connect/i}));

    expect(screen.getByText('Configure Google Workspace')).toBeInTheDocument();
    expect(screen.getByText(/Connected as/i)).toBeInTheDocument();
    expect(screen.getByText('Default calendar ID')).toBeInTheDocument();
  });
});
