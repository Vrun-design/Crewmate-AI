import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {Delegations} from './Delegations';

const createResearchBriefMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../hooks/useJobs', () => ({
  useJobs: () => ({
    jobs: [],
    isLoading: false,
    isSubmitting: false,
    error: null,
    refresh: vi.fn(),
    createResearchBrief: createResearchBriefMock,
  }),
}));

describe('Delegations', () => {
  test('queues a background research brief', async () => {
    render(<Delegations />);

    fireEvent.change(screen.getByPlaceholderText(/competitor analytics tools/i), {target: {value: 'Competitor pricing research'}});
    fireEvent.change(screen.getByPlaceholderText(/compare the top 3 options/i), {target: {value: 'Compare the top 3 competitors.'}});
    fireEvent.click(screen.getByRole('button', {name: /delegate background work/i}));

    await waitFor(() => {
      expect(createResearchBriefMock).toHaveBeenCalledTimes(1);
    });
  });
});
