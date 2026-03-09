import React from 'react';
import {render, screen} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {Sessions} from './Sessions';

vi.mock('../hooks/useWorkspaceCollection', () => ({
  useWorkspaceCollection: () => ({
    data: [
      {id: 'SES-1', title: 'Bug Triage & Ticket Creation', date: 'Today', duration: '10m 00s', tasks: 2},
    ],
    isLoading: false,
    error: null,
  }),
}));

describe('Sessions', () => {
  test('renders the session history grid', () => {
    render(<Sessions />);

    expect(screen.getByText('Session History')).toBeInTheDocument();
    expect(screen.getByText('Bug Triage & Ticket Creation')).toBeInTheDocument();
  });
});
