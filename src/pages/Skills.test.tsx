import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Skills } from './Skills';

const useFeatureFlagsMock = vi.fn();
const useSkillsMock = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => useFeatureFlagsMock(),
}));

vi.mock('../hooks/useSkills', () => ({
  useSkills: () => useSkillsMock(),
}));

describe('Skills', () => {
  test('renders the disabled state when the skills hub feature flag is off', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { skillsHub: false },
      isLoading: false,
      error: null,
    });
    useSkillsMock.mockReturnValue({
      skills: [],
      isLoading: false,
      error: null,
      runSkill: vi.fn(),
    });

    render(<Skills />);

    expect(screen.getByText('Skills Hub is disabled here')).toBeInTheDocument();
  });

  test('falls back to trigger phrases when usage examples are empty', async () => {
    useFeatureFlagsMock.mockReturnValue({
      flags: { skillsHub: true },
      isLoading: false,
      error: null,
    });
    useSkillsMock.mockReturnValue({
      skills: [
        {
          id: 'slack.post-message',
          name: 'Post Slack Message',
          description: 'Sends a message to the connected Slack workspace.',
          version: '1.0.0',
          category: 'communication',
          requiresIntegration: ['slack'],
          triggerPhrases: ['Post this update to Slack'],
          usageExamples: [],
          preferredModel: 'quick',
        },
      ],
      isLoading: false,
      error: null,
      runSkill: vi.fn(),
    });

    render(<Skills />);

    await waitFor(() => {
      expect(screen.getByText('Post Slack Message')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /post slack message/i }));

    expect(screen.getByRole('button', { name: /post this update to slack/i })).toBeInTheDocument();
    expect(screen.getByText('Send To Orchestrator')).toBeInTheDocument();
  });
});
