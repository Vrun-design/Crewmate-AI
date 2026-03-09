import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {ActivityLog} from './ActivityLog';

vi.mock('../hooks/useWorkspaceCollection', () => ({
  useWorkspaceCollection: () => ({
    data: [
      {
        id: 'ACT-1',
        title: 'Doing research',
        description: 'Looking up React 19 concurrent features',
        time: 'Today',
        type: 'research',
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

describe('ActivityLog', () => {
  test('opens activity details drawer', () => {
    render(<ActivityLog />);

    fireEvent.click(screen.getByText('Doing research'));

    expect(screen.getByText('Activity Details')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Raw Context'})).toBeInTheDocument();
  });
});
