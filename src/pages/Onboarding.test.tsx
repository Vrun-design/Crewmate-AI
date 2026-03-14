import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Onboarding } from './Onboarding';

const { refreshMock, startOAuthConnectionMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  startOAuthConnectionMock: vi.fn(),
}));

vi.mock('../hooks/useIntegrations', () => ({
  useIntegrations: () => ({
    integrations: [
      {
        id: 'google-workspace',
        name: 'Google Workspace',
        status: 'disconnected',
        icon: () => <span>G</span>,
        color: 'text-foreground',
        bgColor: 'bg-foreground/10',
        desc: 'Google tools',
        connectUrl: '/api/integrations/google-workspace/connect',
      },
    ],
    isLoading: false,
    error: null,
    refresh: refreshMock,
  }),
}));

vi.mock('../services/integrationsService', () => ({
  integrationsService: {
    startOAuthConnection: startOAuthConnectionMock,
  },
}));

describe('Onboarding', () => {
  beforeEach(() => {
    window.localStorage.setItem('crewmate_auth_token', 'auth_123');
    window.localStorage.removeItem('crewmate_onboarding_complete');
  });

  test('renders the Google Workspace onboarding step', () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    expect(screen.getByText('Connect your tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Google Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Draft Gmail emails')).toBeInTheDocument();
  });

  test('lets the user skip for now', () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(window.localStorage.getItem('crewmate_onboarding_complete')).toBe('true');
  });

  test('starts Google Workspace OAuth through the authenticated integrations service', async () => {
    startOAuthConnectionMock.mockResolvedValue({ redirectUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' });
    const assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { assign: assignMock },
      writable: true,
    });

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Workspace' }));

    await waitFor(() => {
      expect(startOAuthConnectionMock).toHaveBeenCalledWith('google-workspace', '/onboarding');
    });
  });

  test('shows a friendly oauth failure banner when Google Workspace connect is cancelled', () => {
    render(
      <MemoryRouter initialEntries={['/onboarding?error=access_denied&error_description=Consent%20cancelled']}>
        <Onboarding />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Google Workspace connection was not completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Consent cancelled/i)).toBeInTheDocument();
  });
});
