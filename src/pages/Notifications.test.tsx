import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, test, vi} from 'vitest';
import {Notifications} from './Notifications';

const markAllReadMock = vi.fn().mockResolvedValue(undefined);
const apiGetMock = vi.fn();

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');

  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => apiGetMock(...args),
      patch: vi.fn(),
      post: vi.fn(),
    },
  };
});

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [
      {
        id: 'NTF-1',
        title: 'ClickUp task created',
        message: 'Crewmate created a follow-up task from the live session.',
        time: 'Just now',
        type: 'success',
        read: false,
      },
    ],
    isLoading: false,
    error: null,
    markAllRead: markAllReadMock,
  }),
}));

describe('Notifications', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({
      notifyOnSuccess: true,
      notifyOnError: true,
      inAppEnabled: true,
    });
  });

  test('renders live notifications and marks them as read', async () => {
    render(<Notifications />);

    expect(screen.getByText('ClickUp task created')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /mark all as read/i}));

    await waitFor(() => {
      expect(markAllReadMock).toHaveBeenCalledTimes(1);
    });
  });

  test('shows a retryable error when notification settings fail to load', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('Settings unavailable'));

    render(<Notifications />);

    fireEvent.click(screen.getByRole('button', { name: /delivery settings/i }));

    expect(await screen.findByText('Settings unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
