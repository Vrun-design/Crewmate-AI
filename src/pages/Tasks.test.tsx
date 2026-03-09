import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {Tasks} from './Tasks';

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
  test('opens create task drawer', () => {
    render(<Tasks />);

    fireEvent.click(screen.getByRole('button', {name: /new task/i}));

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Schedule team sync')).toBeInTheDocument();
  });
});
