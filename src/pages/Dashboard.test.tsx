import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, test, vi} from 'vitest';
import {Dashboard} from './Dashboard';

const refreshMock = vi.fn();
const startSessionMock = vi.fn();
const endSessionMock = vi.fn();
const sendMessageMock = vi.fn();
const stopMicrophoneMock = vi.fn();
const toggleMicrophoneMock = vi.fn();
const startScreenShareMock = vi.fn();
const stopScreenShareMock = vi.fn();
const setIsOverlayOpenMock = vi.fn();
const useDashboardMock = vi.fn();
const baseDashboardData = {
  tasks: [
    {id: 'TSK-1', title: 'Fix checkout bug', status: 'completed', time: 'Today', tool: 'ClickUp', priority: 'High'},
  ],
  activities: [
    {
      id: 'ACT-1',
      title: 'ClickUp task created',
      description: 'Created task BUG-11',
      time: 'Today',
      type: 'action',
    },
  ],
  integrations: [
    {
      id: 'clickup',
      name: 'ClickUp',
      status: 'connected',
      icon: () => <span>CU</span>,
      color: 'text-foreground',
      bgColor: 'bg-foreground/10',
      desc: 'ClickUp',
    },
  ],
  currentSession: null,
};

function mockDashboard(overrides: Partial<typeof baseDashboardData> = {}) {
  useDashboardMock.mockReturnValue({
    data: {
      ...baseDashboardData,
      ...overrides,
    },
    isLoading: false,
    error: null,
    refresh: refreshMock,
  });
}

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: () => useDashboardMock(),
}));

vi.mock('../contexts/LiveSessionContext', () => ({
  useLiveSessionContext: () => ({
    session: null,
    isBusy: false,
    error: null,
    elapsedLabel: '00:00',
    isSessionActive: false,
    isAssistantSpeaking: false,
    startSession: startSessionMock,
    endSession: endSessionMock,
    sendMessage: sendMessageMock,
    previewStream: null,
    screenShareStatus: 'idle',
    screenShareError: null,
    isScreenShareSupported: true,
    startScreenShare: startScreenShareMock,
    stopScreenShare: stopScreenShareMock,
    microphoneStatus: 'idle',
    microphoneError: null,
    isMicrophoneSupported: true,
    startMicrophone: vi.fn(),
    stopMicrophone: stopMicrophoneMock,
    toggleMicrophone: toggleMicrophoneMock,
    isOverlayOpen: false,
    setIsOverlayOpen: setIsOverlayOpenMock,
  }),
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('crewmate_user_email', 'varun@example.com');
    mockDashboard();
  });

  test('renders dashboard data from hooks', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Hi Varun')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recent' })).toBeInTheDocument();
    expect(screen.queryByText('Fix checkout bug')).not.toBeInTheDocument();
  });

  test('starts the live session when the CTA is clicked', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole('button', {name: /start live session/i})[1]);

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledTimes(1);
    });
  });

  test('opens recent drawer and renders empty states when tasks and activity are missing', () => {
    mockDashboard({
      tasks: [],
      activities: [],
      integrations: [],
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Recent' }));

    expect(screen.getByText('No tasks queued')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Go to Tasks'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Open Sessions'})).toBeInTheDocument();
  });
});
