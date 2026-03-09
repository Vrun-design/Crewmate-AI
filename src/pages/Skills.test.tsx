import React from 'react';
import {render, screen} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {Skills} from './Skills';

vi.mock('../hooks/useCapabilities', () => ({
  useCapabilities: () => ({
    capabilities: [
      {
        id: 'live-screen',
        title: 'Live screen perception',
        description: 'Reads shared screen frames.',
        status: 'live',
        category: 'perception',
      },
      {
        id: 'tool-routing',
        title: 'Tool action routing',
        description: 'Routes explicit requests into tools.',
        status: 'setup_required',
        category: 'action',
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

describe('Skills', () => {
  test('renders the operator stack with real capability statuses', () => {
    render(<Skills />);

    expect(screen.getByText('Operator Stack')).toBeInTheDocument();
    expect(screen.getByText('Live screen perception')).toBeInTheDocument();
    expect(screen.getByText('Setup required')).toBeInTheDocument();
  });
});
