import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GoogleWorkspaceOnboardingModal } from './GoogleWorkspaceOnboardingModal';

const { refreshMock, startOAuthConnectionMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  startOAuthConnectionMock: vi.fn(),
}));

vi.mock('../../hooks/useIntegrations', () => ({
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

vi.mock('../../services/integrationsService', () => ({
  integrationsService: {
    startOAuthConnection: startOAuthConnectionMock,
  },
}));

function renderModal(
  overrides: Partial<React.ComponentProps<typeof GoogleWorkspaceOnboardingModal>> = {},
): ReturnType<typeof render> {
  return render(
    <GoogleWorkspaceOnboardingModal
      isOpen
      hasOnboardingQuery={false}
      oauthError={null}
      wasJustConnected={false}
      onClose={vi.fn()}
      onClearOnboardingQuery={vi.fn()}
      {...overrides}
    />,
  );
}

describe('GoogleWorkspaceOnboardingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem('crewmate_onboarding_complete');
  });

  test('renders the Google Workspace onboarding modal content', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Connect Google Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Draft Gmail emails')).toBeInTheDocument();
  });

  test('lets the user skip for now', () => {
    const onClose = vi.fn();
    const onClearOnboardingQuery = vi.fn();

    renderModal({ onClose, onClearOnboardingQuery });

    fireEvent.click(screen.getByText('Skip this step for now'));

    expect(window.localStorage.getItem('crewmate_onboarding_complete')).toBe('true');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClearOnboardingQuery).toHaveBeenCalledTimes(1);
  });

  test('starts Google Workspace OAuth with the dashboard onboarding redirect', async () => {
    startOAuthConnectionMock.mockResolvedValue({ redirectUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' });
    const assignMock = vi.fn();
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: assignMock },
    });

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Workspace' }));

    await waitFor(() => {
      expect(startOAuthConnectionMock).toHaveBeenCalledWith('google-workspace', '/dashboard?onboarding=google-workspace');
      expect(assignMock).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=test');
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  test('shows a friendly oauth failure banner when Google Workspace connect is cancelled', () => {
    renderModal({ hasOnboardingQuery: true, oauthError: 'Consent cancelled' });

    expect(screen.getByText(/Connection not completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Consent cancelled/i)).toBeInTheDocument();
  });
});
