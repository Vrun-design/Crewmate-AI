import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {MemoryBase} from './MemoryBase';

vi.mock('../hooks/useWorkspaceCollection', () => ({
  useWorkspaceCollection: () => ({
    data: [
      {id: 'MEM-1', title: 'Project Alpha Guidelines', type: 'document', tokens: '1.0k', lastSynced: 'Today', active: true},
      {id: 'MEM-2', title: 'Project Alpha Specs', type: 'core', tokens: '2.0k', lastSynced: 'Today', active: true},
    ],
    isLoading: false,
    error: null,
  }),
}));

describe('MemoryBase', () => {
  test('switches between list and map views', () => {
    render(<MemoryBase />);

    expect(screen.getByText('Project Alpha Guidelines')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /mind map/i}));

    expect(screen.getByText('Project Alpha Specs')).toBeInTheDocument();
  });
});
