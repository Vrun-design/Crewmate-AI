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
        id: 'slack.post-message',
        name: 'Post Slack Message',
        description: 'Sends a message to the connected Slack workspace.',
        version: '1.0.0',
        category: 'communication',
        requiresIntegration: ['slack'],
        triggerPhrases: ['"Post this update to Slack"'],
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
      expect(screen.getByText('Post Slack Message')).toBeInTheDocument();
    });

    expect(screen.getByText('Skills Hub')).toBeInTheDocument();
    expect(screen.getByText('Post Slack Message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /post slack message/i })).toBeInTheDocument();
  });
});
