import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function CrashyComponent(): React.JSX.Element {
  throw new Error('Boom');
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders a recovery fallback when a child crashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <CrashyComponent />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong in Crewmate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload app/i })).toBeInTheDocument();
  });

  test('reloads the app from the fallback action', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadSpy },
    });

    render(
      <AppErrorBoundary>
        <CrashyComponent />
      </AppErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /reload app/i }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
