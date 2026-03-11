import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe, expect, test, vi} from 'vitest';
import {Account} from './Account';

const {logoutMock, clearSessionMock} = vi.hoisted(() => ({
  logoutMock: vi.fn().mockResolvedValue(undefined),
  clearSessionMock: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'USR-1',
      email: 'varun@example.com',
      name: 'Varun Dev',
      plan: 'MVP',
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: {
      voiceModel: 'Aoede',
      textModel: 'gemini-3.1-pro-preview',
      imageModel: 'gemini-3.1-flash-image-preview',
      reasoningLevel: 'high',
      proactiveSuggestions: true,
      autoStartScreenShare: false,
      blurSensitiveFields: true,
    },
    isLoading: false,
    isSaving: false,
    error: null,
    savePreferences: vi.fn(),
  }),
}));

vi.mock('../services/authService', () => ({
  authService: {
    logout: logoutMock,
  },
  authStorage: {
    clearSession: clearSessionMock,
  },
}));

describe('Account', () => {
  test('renders the real auth user and signs out through the auth service', async () => {
    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>,
    );

    expect(screen.getByDisplayValue('Varun Dev')).toBeInTheDocument();
    expect(screen.getByDisplayValue('varun@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /sign out/i}));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(clearSessionMock).toHaveBeenCalledTimes(1);
    });
  });
});
