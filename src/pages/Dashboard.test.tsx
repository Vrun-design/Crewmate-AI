import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, test, vi} from 'vitest';
import {Dashboard} from './Dashboard';

const refreshMock = vi.fn();
const startSessionMock = vi.fn();
const endSessionMock = vi.fn();
const sendMessageMock = vi.fn();

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: () => ({
    data: {
      tasks: [
        {id: 'TSK-1', title: 'Fix checkout bug', status: 'completed', time: 'Today', tool: 'GitHub', priority: 'High'},
      ],
      activities: [
        {
          id: 'ACT-1',
          title: 'GitHub issue created',
          description: 'Opened issue #11',
          time: 'Today',
          type: 'action',
        },
      ],
      integrations: [
        {
          id: 'github',
          name: 'GitHub',
          status: 'connected',
          icon: () => <span>GH</span>,
          color: 'text-foreground',
          bgColor: 'bg-foreground/10',
          desc: 'GitHub',
        },
      ],
      memoryNodes: [],
      currentSession: null,
    },
    isLoading: false,
    error: null,
    refresh: refreshMock,
  }),
}));

vi.mock('../hooks/useLiveSession', () => ({
  useLiveSession: () => ({
    session: null,
    isBusy: false,
    elapsedLabel: '00:00',
    isSessionActive: false,
    startSession: startSessionMock,
    endSession: endSessionMock,
    sendMessage: sendMessageMock,
  }),
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('crewmate_user_email', 'varun@example.com');
  });

  test('renders dashboard data from hooks', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Hi Varun')).toBeInTheDocument();
    expect(screen.getByText('Fix checkout bug')).toBeInTheDocument();
    expect(screen.getByText('GitHub issue created')).toBeInTheDocument();
    expect(screen.getAllByText('GitHub')[0]).toBeInTheDocument();
  });

  test('starts the live session when the CTA is clicked', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', {name: /start hero session/i}));

    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledTimes(1);
    });
  });
});
