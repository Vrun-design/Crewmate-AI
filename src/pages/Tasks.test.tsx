import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../lib/api';
import { connectAuthenticatedSseStream } from '../lib/sse';
import { Tasks } from './Tasks';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('../lib/sse', () => ({
  connectAuthenticatedSseStream: vi.fn(() => ({
    abort: vi.fn(),
  })),
}));

vi.mock('../hooks/useWorkspaceCollection', () => ({
  useWorkspaceCollection: () => ({
    data: [
      { id: 'TSK-1', title: 'Create GitHub issue', status: 'completed', time: 'Today', tool: 'GitHub', priority: 'High' },
    ],
    isLoading: false,
    error: null,
  }),
}));

const mockApiGet = vi.mocked(api.get);
const mockConnectAuthenticatedSseStream = vi.mocked(connectAuthenticatedSseStream);

describe('Tasks', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue([]);
    mockConnectAuthenticatedSseStream.mockClear();
  });

  test('opens create task drawer', async () => {
    render(<Tasks />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /new task/i }));

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Schedule team sync')).toBeInTheDocument();
  });

  test('opens live agent task drawer and subscribes to task events', async () => {
    mockApiGet.mockResolvedValueOnce([
      {
        id: 'agt-1',
        agentId: 'crewmate-research-agent',
        intent: 'Investigate conversion drop',
        status: 'running',
        createdAt: '2026-03-11T10:00:00.000Z',
        steps: [
          {
            taskId: 'agt-1',
            stepIndex: 1,
            type: 'thinking',
            timestamp: '2026-03-11T10:00:03.000Z',
            label: 'Reviewing traffic anomalies',
          },
        ],
      },
    ]);

    render(<Tasks />);

    expect(await screen.findByText('Investigate conversion drop')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /investigate conversion drop/i }));

    expect(await screen.findByText('Live Agent Task')).toBeInTheDocument();
    expect(screen.getByText('Execution Trace')).toBeInTheDocument();
    expect(screen.getAllByText('Reviewing traffic anomalies')).toHaveLength(2);

    expect(mockConnectAuthenticatedSseStream).toHaveBeenCalledWith(
      '/api/agents/tasks/agt-1/events',
      expect.objectContaining({
        onError: expect.any(Function),
        onEvent: expect.any(Function),
      }),
    );
  });
});
