import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MemoryBase } from './MemoryBase';

// New MemoryBase uses /api/memory — mock the api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([
      { id: 'MEM-1', title: 'Project Alpha Guidelines', type: 'document', tokens: '1.0k', lastSynced: 'Today', active: true, source: 'live_turn' },
      { id: 'MEM-2', title: 'Project Alpha Specs', type: 'core', tokens: '2.0k', lastSynced: 'Today', active: true, source: 'skill_run' },
    ]),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

describe('MemoryBase', () => {
  test('renders memory nodes with timeline view', async () => {
    render(<MemoryBase />);

    expect(await screen.findByText('Project Alpha Guidelines')).toBeInTheDocument();
    expect(screen.getByText('Project Alpha Specs')).toBeInTheDocument();
    // Stats strip should show total count
    expect(screen.getByText('Total Memories')).toBeInTheDocument();
    expect(screen.getByText('Memory Base')).toBeInTheDocument();
  });
});
