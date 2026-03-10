import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {Tasks} from './Tasks';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
  },
  buildAuthenticatedEventSourceUrl: vi.fn((path: string) => `http://localhost${path}`),
}));

vi.mock('../hooks/useWorkspaceCollection', () => ({
  useWorkspaceCollection: () => ({
    data: [
      {id: 'TSK-1', title: 'Create GitHub issue', status: 'completed', time: 'Today', tool: 'GitHub', priority: 'High'},
    ],
    isLoading: false,
    error: null,
  }),
}));

describe('Tasks', () => {
  test('opens create task drawer', async () => {
    render(<Tasks />);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: /new task/i})).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', {name: /new task/i}));

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Schedule team sync')).toBeInTheDocument();
  });
});
