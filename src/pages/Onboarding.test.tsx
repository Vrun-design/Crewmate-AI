import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Onboarding } from './Onboarding';

const refreshMock = vi.fn();

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
});
