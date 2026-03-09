import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {Notifications} from './Notifications';

const markAllReadMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [
      {
        id: 'NTF-1',
        title: 'GitHub issue created',
        message: 'Crewmate opened a bug ticket from the live session.',
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
  test('renders live notifications and marks them as read', async () => {
    render(<Notifications />);

    expect(screen.getByText('GitHub issue created')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /mark all as read/i}));

    await waitFor(() => {
      expect(markAllReadMock).toHaveBeenCalledTimes(1);
    });
  });
});
