import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../lib/api';
import { connectAuthenticatedSseStream } from '../lib/sse';
import { workspaceService } from '../services/workspaceService';
import { Tasks } from './Tasks';
import type { Task } from '../types';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../lib/sse', () => ({
  connectAuthenticatedSseStream: vi.fn(() => ({
    abort: vi.fn(),
  })),
}));

vi.mock('../hooks/useWorkspaceCollection', () => ({
  useWorkspaceCollection: () => useWorkspaceCollectionMock(),
}));

vi.mock('../services/workspaceService', async () => {
  const actual = await vi.importActual<typeof import('../services/workspaceService')>('../services/workspaceService');
  return {
    ...actual,
    workspaceService: {
      ...actual.workspaceService,
      createTask: vi.fn(),
      getTask: vi.fn(),
      cancelTask: vi.fn(),
    },
  };
});

const useWorkspaceCollectionMock = vi.fn<() => { data: Task[]; isLoading: boolean; error: Error | null }>(() => ({
  data: [
    { id: 'TSK-1', title: 'Create ClickUp task', status: 'completed', time: 'Today', tool: 'ClickUp', priority: 'High', sourceKind: 'manual' },
  ] satisfies Task[],
  isLoading: false,
  error: null,
}));

const mockApiGet = vi.mocked(api.get);
const mockApiPost = vi.mocked(api.post);
const mockConnectAuthenticatedSseStream = vi.mocked(connectAuthenticatedSseStream);
const mockWorkspaceCreateTask = vi.mocked(workspaceService.createTask);
const mockWorkspaceGetTask = vi.mocked(workspaceService.getTask);
const mockWorkspaceCancelTask = vi.mocked(workspaceService.cancelTask);

function renderTasks(): void {
  render(
    <MemoryRouter>
      <Tasks />
    </MemoryRouter>,
  );
}

describe('Tasks', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockReset();
    mockConnectAuthenticatedSseStream.mockClear();
    mockWorkspaceCreateTask.mockReset();
    mockWorkspaceGetTask.mockReset();
    mockWorkspaceCancelTask.mockReset();
    useWorkspaceCollectionMock.mockReset();
    useWorkspaceCollectionMock.mockReturnValue({
      data: [
        { id: 'TSK-1', title: 'Create ClickUp task', status: 'completed', time: 'Today', tool: 'ClickUp', priority: 'High', sourceKind: 'manual' },
      ] satisfies Task[],
      isLoading: false,
      error: null,
    });
    mockWorkspaceGetTask.mockImplementation(async (id: string) => ({
      id,
      title: id === 'TSK-AGT-1' ? 'Investigate conversion drop' : 'Create ClickUp task',
      status: id === 'TSK-AGT-1' ? 'in_progress' : 'completed',
      time: 'Today',
      tool: id === 'TSK-AGT-1' ? 'Crewmate Live' : 'ClickUp',
      priority: id === 'TSK-AGT-1' ? 'Medium' : 'High',
      sourceKind: id === 'TSK-AGT-1' ? 'delegated' : 'manual',
      currentRunId: id === 'TSK-AGT-1' ? 'RUN-1' : null,
      runs: id === 'TSK-AGT-1' ? [{
        id: 'RUN-1',
        taskId: 'TSK-AGT-1',
        runType: 'delegated_agent',
        status: 'running',
        steps: [],
        startedAt: '2026-03-11T10:00:00.000Z',
      }] : [],
      latestRun: id === 'TSK-AGT-1' ? {
        id: 'RUN-1',
        taskId: 'TSK-AGT-1',
        runType: 'delegated_agent',
        status: 'running',
        steps: [],
        startedAt: '2026-03-11T10:00:00.000Z',
      } : null,
    }));
    mockWorkspaceCreateTask.mockImplementation(async (input: { title: string; description?: string; tool: string; priority: Task['priority']; mode?: 'manual' | 'delegated' }) => ({
      id: 'TSK-CREATED',
      title: input.title,
      description: input.description ?? '',
      status: input.mode === 'delegated' ? 'pending' : 'pending',
      time: 'Now',
      tool: input.tool,
      priority: input.priority,
      sourceKind: input.mode === 'delegated' ? 'delegated' : 'manual',
      currentRunId: input.mode === 'delegated' ? 'RUN-CREATED' : null,
      runs: input.mode === 'delegated' ? [{
        id: 'RUN-CREATED',
        taskId: 'TSK-CREATED',
        runType: 'delegated_skill',
        status: 'queued',
        skillId: input.tool === 'Notion' ? 'notion.create-page' : undefined,
        steps: [],
        startedAt: '2026-03-13T10:30:00.000Z',
      }] : [],
      latestRun: input.mode === 'delegated' ? {
        id: 'RUN-CREATED',
        taskId: 'TSK-CREATED',
        runType: 'delegated_skill',
        status: 'queued',
        skillId: input.tool === 'Notion' ? 'notion.create-page' : undefined,
        steps: [],
        startedAt: '2026-03-13T10:30:00.000Z',
      } : null,
    } as unknown as Task));
  });

  test('opens create task drawer', async () => {
    renderTasks();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /new task/i }));

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delegate' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Schedule team sync')).toBeInTheDocument();
  });

  test('delegates a task from the drawer and opens the run details', async () => {
    mockApiGet
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: 'RUN-CREATED',
        taskId: 'TSK-CREATED',
        agentId: 'skill-registry',
        delegatedSkillId: 'notion.create-page',
        routeType: 'delegated_skill',
        intent: 'Create Notion Page: Launch brief',
        status: 'queued',
        createdAt: '2026-03-13T10:30:00.000Z',
        steps: [],
      });

    renderTasks();

    fireEvent.click(await screen.findByRole('button', { name: /new task/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delegate' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Create launch summary in Notion'), {
      target: { value: 'Launch brief' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe what Crewmate should do/i), {
      target: { value: 'Summarize the launch update and save it.' },
    });
    fireEvent.click(screen.getByText('Crewmate'));
    fireEvent.click(screen.getByText('Notion'));
    fireEvent.click(screen.getByRole('button', { name: /start background task/i }));

    await waitFor(() => {
      expect(mockWorkspaceCreateTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Launch brief',
        tool: 'Notion',
        mode: 'delegated',
      }));
    });

    expect(await screen.findByText('Create Notion Page: Launch brief')).toBeInTheDocument();
  });

  test('opens live agent task drawer and subscribes to task events', async () => {
    mockApiGet.mockResolvedValueOnce([
      {
        id: 'RUN-1',
        taskId: 'TSK-AGT-1',
        agentId: 'crewmate-research-agent',
        intent: 'Investigate conversion drop',
        status: 'running',
        createdAt: '2026-03-11T10:00:00.000Z',
        steps: [
          {
            taskId: 'TSK-AGT-1',
            taskRunId: 'RUN-1',
            stepIndex: 1,
            type: 'thinking',
            timestamp: '2026-03-11T10:00:03.000Z',
            label: 'Reviewing traffic anomalies',
          },
        ],
      },
    ]);
    useWorkspaceCollectionMock.mockReturnValue({
      data: [
        {
          id: 'TSK-AGT-1',
          title: 'Investigate conversion drop',
          status: 'in_progress',
          time: 'Today',
          tool: 'Crewmate Live',
          priority: 'Medium',
          sourceKind: 'delegated',
          currentRunId: 'RUN-1',
        },
      ] satisfies Task[],
      isLoading: false,
      error: null,
    });

    renderTasks();

    expect(await screen.findByText('Investigate conversion drop')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Investigate conversion drop'));

    // Switch to the Activity tab to see the trace
    const activityButton = await screen.findByRole('button', { name: /Activity Trace/i });
    fireEvent.click(activityButton);

    // Verify the tab is selected/active
    expect(activityButton).toHaveClass('text-foreground');

    expect(mockConnectAuthenticatedSseStream).toHaveBeenCalledWith(
      '/api/agents/tasks/RUN-1/events',
      expect.objectContaining({
        onError: expect.any(Function),
        onEvent: expect.any(Function),
      }),
    );
  });

  test('cancels a running agent task from the drawer', async () => {
    mockApiGet.mockResolvedValueOnce([
      {
        id: 'RUN-1',
        taskId: 'TSK-AGT-1',
        agentId: 'crewmate-research-agent',
        intent: 'Investigate conversion drop',
        status: 'running',
        createdAt: '2026-03-11T10:00:00.000Z',
        steps: [],
      },
    ]);
    useWorkspaceCollectionMock.mockReturnValue({
      data: [
        {
          id: 'TSK-AGT-1',
          title: 'Investigate conversion drop',
          status: 'in_progress',
          time: 'Today',
          tool: 'Crewmate Live',
          priority: 'Medium',
          sourceKind: 'delegated',
          currentRunId: 'RUN-1',
        },
      ] satisfies Task[],
      isLoading: false,
      error: null,
    });
    mockWorkspaceCancelTask.mockResolvedValueOnce({
      id: 'TSK-AGT-1',
      title: 'Investigate conversion drop',
      status: 'cancelled',
      time: 'Today',
      tool: 'Crewmate Live',
      priority: 'Medium',
      sourceKind: 'delegated',
      currentRunId: 'RUN-1',
      runs: [
        {
          id: 'RUN-1',
          taskId: 'TSK-AGT-1',
          runType: 'delegated_agent',
          status: 'cancelled',
          steps: [],
          error: 'Cancelled by user',
          startedAt: '2026-03-11T10:00:00.000Z',
          completedAt: '2026-03-11T10:01:00.000Z',
        },
      ],
      latestRun: {
        id: 'RUN-1',
        taskId: 'TSK-AGT-1',
        runType: 'delegated_agent',
        status: 'cancelled',
        steps: [],
        error: 'Cancelled by user',
        startedAt: '2026-03-11T10:00:00.000Z',
        completedAt: '2026-03-11T10:01:00.000Z',
      },
    });

    renderTasks();

    expect(await screen.findByText('Investigate conversion drop')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Investigate conversion drop'));
    fireEvent.click(await screen.findByRole('button', { name: /cancel task/i }));

    await waitFor(() => {
      expect(mockWorkspaceCancelTask).toHaveBeenCalledWith('TSK-AGT-1');
    });

    expect((await screen.findAllByText('Cancelled')).length).toBeGreaterThan(0);
  });
});
