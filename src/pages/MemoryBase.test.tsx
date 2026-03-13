import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MemoryBase } from './MemoryBase';

// New MemoryBase uses /api/memory — mock the api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      recentContext: [
        { id: 'MEM-1', kind: 'session', sourceType: 'live_turn', title: 'Project Alpha sync', summary: 'Discussed rollout blockers.', tokens: '1.0k', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      knowledge: [
        { id: 'MEM-2', kind: 'knowledge', sourceType: 'skill_run', title: 'Project Alpha Guidelines', summary: 'Core launch guidance for the team.', tokens: '2.0k', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      artifacts: [
        { id: 'MEM-3', kind: 'artifact', sourceType: 'integration', title: 'Project Alpha Spec', artifactUrl: 'https://example.com/spec', tokens: '0.4k', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      totals: { recentContext: 1, knowledge: 1, artifacts: 1, active: 3 },
    }),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

describe('MemoryBase', () => {
  test('renders grouped memory records', async () => {
    render(<MemoryBase />);

    expect(await screen.findByText('Project Alpha Guidelines')).toBeInTheDocument();
    expect(screen.getByText('Project Alpha Spec')).toBeInTheDocument();
    expect(screen.getAllByText('Recent Context').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Knowledge').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Artifacts').length).toBeGreaterThan(0);
    expect(screen.getByText('Memory')).toBeInTheDocument();
  });
});
