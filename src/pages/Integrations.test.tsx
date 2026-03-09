import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {vi} from 'vitest';
import {describe, expect, test} from 'vitest';
import {Integrations} from './Integrations';

const {refreshMock, integrationConfigMock} = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  integrationConfigMock: {
    integrationId: 'github',
    configuredVia: 'vault' as const,
    fields: [
      {
        key: 'token',
        label: 'Access token',
        placeholder: 'ghp_...',
        secret: true,
        configured: true,
      },
    ],
  },
}));

vi.mock('../hooks/useIntegrations', () => ({
  useIntegrations: () => ({
    integrations: [
      {
        id: 'github',
        name: 'GitHub',
        status: 'connected',
        icon: () => <span>GH</span>,
        color: 'text-foreground',
        bgColor: 'bg-foreground/10',
        desc: 'Create issues',
        setupSteps: ['Create token'],
        capabilities: ['Create issues'],
        requiredKeys: ['token', 'repoOwner', 'repoName'],
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
  test('opens integration drawer for configuration', () => {
    render(<Integrations />);

    fireEvent.click(screen.getByRole('button', {name: /configure|connect/i}));

    expect(screen.getByText('Configure GitHub')).toBeInTheDocument();
  });
});
