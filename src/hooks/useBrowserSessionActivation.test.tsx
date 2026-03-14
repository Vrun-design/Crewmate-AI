import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { UI_NAVIGATOR_AGENT_ID } from '../constants/agents';
import { api } from '../lib/api';
import { browserSessionStore } from '../stores/browserSessionStore';
import { useBrowserSessionActivation } from './useBrowserSessionActivation';

const mockApiGet = vi.mocked(api.get);
const useLiveEventsMock = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('./useLiveEvents', () => ({
  useLiveEvents: (callbacks: unknown) => useLiveEventsMock(callbacks),
}));

function BrowserSessionActivationHarness(): React.JSX.Element | null {
  useBrowserSessionActivation();
  return null;
}

describe('useBrowserSessionActivation', () => {
  beforeEach(() => {
    browserSessionStore.clear();
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue([]);
    useLiveEventsMock.mockReset();
  });

  test('hydrates the store from active UI navigator tasks', async () => {
    mockApiGet.mockResolvedValue([
      {
        id: 'RUN-1',
        agentId: UI_NAVIGATOR_AGENT_ID,
        intent: 'Open the billing settings page',
        status: 'running',
      },
    ]);

    render(<BrowserSessionActivationHarness />);

    await waitFor(() => {
      expect(browserSessionStore.get()).toEqual({
        taskId: 'RUN-1',
        intent: 'Open the billing settings page',
      });
    });
  });

  test('activates the store from live task updates', () => {
    let liveCallbacks: { onLiveTaskUpdate?: (event: { agentId?: string; status: string; taskRunId: string; title: string }) => void } | null = null;
    useLiveEventsMock.mockImplementation((callbacks) => {
      liveCallbacks = callbacks as typeof liveCallbacks;
    });

    render(<BrowserSessionActivationHarness />);

    act(() => {
      liveCallbacks?.onLiveTaskUpdate?.({
        agentId: UI_NAVIGATOR_AGENT_ID,
        status: 'running',
        taskRunId: 'RUN-2',
        title: 'Fill out the demo request form',
      });
    });

    expect(browserSessionStore.get()).toEqual({
      taskId: 'RUN-2',
      intent: 'Fill out the demo request form',
    });
  });
});
