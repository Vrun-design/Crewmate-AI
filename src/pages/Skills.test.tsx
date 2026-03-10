import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Skills } from './Skills';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../hooks/useSkills', () => ({
  useSkills: () => ({
    skills: [
      {
        id: 'github.create-issue',
        name: 'Create GitHub Issue',
        description: 'Files a new issue in the connected GitHub repo.',
        version: '1.0.0',
        category: 'code',
        personas: ['developer'],
        requiresIntegration: ['github'],
        triggerPhrases: ['"Create a GitHub issue for this bug"'],
        preferredModel: 'quick',
      },
    ],
    isLoading: false,
    error: null,
    runSkill: vi.fn(),
  }),
}));

describe('Skills', () => {
  test('renders the skills hub with interactive skill cards', async () => {
    render(<Skills />);

    await waitFor(() => {
      expect(screen.getByText('Create GitHub Issue')).toBeInTheDocument();
    });

    expect(screen.getByText('Skills Hub')).toBeInTheDocument();
    expect(screen.getByText('Create GitHub Issue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create github issue/i })).toBeInTheDocument();
  });
});
