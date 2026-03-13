import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { Card } from '../components/ui/Card';
import { TaskList } from '../components/tasks/TaskList';
import { TaskDrawerContent } from '../components/tasks/TaskDrawerContent';
import { AgentTaskDrawerContent } from '../components/agents/AgentTaskDrawerContent';
import { EmptyStateCard } from '../components/shared/EmptyStateCard';
import { useWorkspaceCollection } from '../hooks/useWorkspaceCollection';
import { workspaceService } from '../services/workspaceService';
import type { Task, TaskDetail } from '../types';
import type { AgentTask, AgentStepEvent } from '../components/agents/types';
import { api } from '../lib/api';
import { connectAuthenticatedSseStream } from '../lib/sse';
import { browserSessionStore } from '../stores/browserSessionStore';

const UI_NAVIGATOR_AGENT_ID = 'crewmate-ui-navigator-agent';

type StatusFilter = 'all' | 'in_progress' | 'completed' | 'pending' | 'failed' | 'cancelled';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

type AgentTaskStreamPayload = {
  type: string;
  task?: AgentTask;
  step?: AgentStepEvent;
  status?: AgentTask['status'];
  result?: unknown;
  error?: string;
  steps?: AgentStepEvent[];
};

type TaskFormInput = {
  title: string;
  description: string;
  tool: string;
  priority: Task['priority'];
};

function mergeCreatedTasks(standardTasks: Task[], createdTasks: Task[]): Task[] {
  return [
    ...createdTasks,
    ...standardTasks.filter((task) => !createdTasks.some((createdTask) => createdTask.id === task.id)),
  ];
}

function getDrawerTitle(agentTask: AgentTask | null, selectedTask: Task | null): string {
  if (agentTask) {
    return agentTask.status === 'running' || agentTask.status === 'queued' ? 'Background Task' : 'Background Task Details';
  }

  if (selectedTask) {
    return 'Task Details';
  }

  return 'Create New Task';
}

function updateAgentTaskFromPayload(task: AgentTask, payload: AgentTaskStreamPayload): AgentTask {
  if (payload.type === 'snapshot') {
    return payload.task ?? task;
  }

  if (payload.type === 'step' && payload.step) {
    return { ...task, steps: [...(task.steps ?? []), payload.step] };
  }

  if (payload.type === 'status') {
    return { ...task, status: payload.status ?? task.status };
  }

  if (payload.type === 'completed') {
    return {
      ...task,
      status: 'completed',
      result: payload.result,
      steps: payload.steps ?? task.steps,
      completedAt: new Date().toISOString(),
    };
  }

  if (payload.type === 'failed') {
    return {
      ...task,
      status: 'failed',
      error: payload.error,
      steps: payload.steps ?? task.steps,
    };
  }

  if (payload.type === 'cancelled') {
    return {
      ...task,
      status: 'cancelled',
      error: payload.error ?? 'Cancelled by user',
      steps: payload.steps ?? task.steps,
      completedAt: new Date().toISOString(),
    };
  }

  return task;
}

function withCancelledAgentTask(task: AgentTask): AgentTask {
  return {
    ...task,
    status: 'cancelled',
    error: 'Cancelled by user',
    completedAt: new Date().toISOString(),
  };
}

function matchesTaskSearch(task: Task, searchQuery: string): boolean {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return task.title.toLowerCase().includes(normalizedQuery)
    || (task.description ?? '').toLowerCase().includes(normalizedQuery);
}

function isTaskNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('task_not_found')
    || error.message.includes('404')
    || error.message.includes('not found');
}

export function Tasks(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: tasks, isLoading, error } = useWorkspaceCollection(workspaceService.getTasks);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [agentTasksError, setAgentTasksError] = useState<string | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const sseRef = useRef<AbortController | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<TaskDetail | null>(null);
  const [selectedAgentTask, setSelectedAgentTask] = useState<AgentTask | null>(null);
  const [isCancellingTask, setIsCancellingTask] = useState(false);
  const [isRetryingTask, setIsRetryingTask] = useState(false);

  const loadAgentTasks = useCallback(async () => {
    try {
      const data = await api.get<AgentTask[]>('/api/agents/tasks');
      setAgentTasks(data ?? []);
      setAgentTasksError(null);
    } catch (loadError) {
      setAgentTasks([]);
      setAgentTasksError(loadError instanceof Error ? loadError.message : 'Unable to load background tasks');
    }
  }, []);

  useEffect(() => {
    void loadAgentTasks();
  }, [loadAgentTasks]);

  useEffect(() => {
    return () => {
      sseRef.current?.abort();
    };
  }, []);

  const closeTaskStream = useCallback(() => {
    sseRef.current?.abort();
    sseRef.current = null;
  }, []);

  const subscribeToTask = useCallback((taskId: string) => {
    closeTaskStream();
    sseRef.current = connectAuthenticatedSseStream(`/api/agents/tasks/${taskId}/events`, {
      onEvent: (_event, dataRaw) => {
        const payload = JSON.parse(dataRaw) as AgentTaskStreamPayload;

        setAgentTasks((prev) =>
          prev.map((task) => {
            if (task.id !== taskId) {
              return task;
            }

            return updateAgentTaskFromPayload(task, payload);
          }),
        );

        if (payload.type === 'completed' || payload.type === 'failed' || payload.type === 'cancelled') {
          closeTaskStream();
          // Auto-refresh the full task list so status badges update without manual reload
          setTimeout(() => void loadAgentTasks(), 600);
        }
      },
      onError: () => {
        setAgentTasksError('Live task updates disconnected. Reopen the task to retry streaming.');
        closeTaskStream();
      },
    });
  }, [closeTaskStream]);

  useEffect(() => {
    const requestedTaskId = searchParams.get('task');
    if (!requestedTaskId || tasks.length === 0) {
      return;
    }

    const matchingTask = tasks.find((task) => task.id === requestedTaskId);
    if (!matchingTask) {
      return;
    }
    void handleOpenTask(matchingTask);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('task');
    setSearchParams(nextParams, { replace: true });
  }, [tasks, searchParams, setSearchParams]);

  async function handleOpenTask(task: Task) {
    let detail: TaskDetail | null = null;
    try {
      detail = await workspaceService.getTask(task.id);
      setSelectedTaskDetail(detail);
    } catch (loadError) {
      setAgentTasksError(loadError instanceof Error ? loadError.message : 'Unable to load task details');
    }

    const runId = detail?.latestRun?.id ?? detail?.currentRunId ?? task.currentRunId ?? null;
    if (runId) {
      const existingAgentTask = agentTasks.find((agentTask) => agentTask.id === runId);
      if (existingAgentTask) {
        setSelectedTask(task);
        handleOpenAgentTask(existingAgentTask);
        return;
      }

      try {
        const fetchedAgentTask = await api.get<AgentTask>(`/api/agents/tasks/${runId}`);
        setAgentTasks((prev) => prev.some((agentTask) => agentTask.id === fetchedAgentTask.id) ? prev : [fetchedAgentTask, ...prev]);
        setSelectedTask(task);
        handleOpenAgentTask(fetchedAgentTask);
        return;
      } catch (loadError) {
        if (!isTaskNotFoundError(loadError)) {
          setAgentTasksError(loadError instanceof Error ? loadError.message : 'Unable to load background task details');
          return;
        }
      }
    }

    setSelectedTask(detail ?? task);
    setSelectedAgentTask(null);
    setIsDrawerOpen(true);
  }

  function handleOpenAgentTask(task: AgentTask) {
    setSelectedAgentTask(task);
    setIsDrawerOpen(true);
    if (task.status === 'running' || task.status === 'queued') {
      subscribeToTask(task.id);
      // Activate PiP for UI Navigator tasks
      if (task.agentId === UI_NAVIGATOR_AGENT_ID) {
        browserSessionStore.set({
          taskId: task.id,
          intent: task.intent.slice(0, 120),
        });
      }
    }
  }

  function handleCreateTask() {
    setSelectedTask(null);
    setSelectedTaskDetail(null);
    setSelectedAgentTask(null);
    setIsDrawerOpen(true);
  }

  async function handleCreateStandardTask(input: TaskFormInput): Promise<Task> {
    const createdTask = await workspaceService.createTask({ ...input, mode: 'manual' }) as Task;
    setCreatedTasks((previousTasks) => [createdTask, ...previousTasks.filter((task) => task.id !== createdTask.id)]);
    return createdTask;
  }

  async function handleDelegateTask(input: TaskFormInput): Promise<TaskDetail> {
    const createdTask = await workspaceService.createTask({ ...input, mode: 'delegated' }) as TaskDetail;
    setCreatedTasks((previousTasks) => [createdTask, ...previousTasks.filter((task) => task.id !== createdTask.id)]);
    setSelectedTask(createdTask);
    setSelectedTaskDetail(createdTask);
    setIsDrawerOpen(true);

    const runId = createdTask.latestRun?.id ?? createdTask.currentRunId ?? null;
    if (runId) {
      try {
        const fetchedAgentTask = await api.get<AgentTask>(`/api/agents/tasks/${runId}`);
        setAgentTasks((prev) => prev.some((agentTask) => agentTask.id === fetchedAgentTask.id) ? prev : [fetchedAgentTask, ...prev]);
        handleOpenAgentTask(fetchedAgentTask);
      } catch (loadError) {
        setAgentTasksError(loadError instanceof Error ? loadError.message : 'Unable to load background task details');
      }
    }

    return createdTask;
  }

  async function handleRetryAgentTask(task: AgentTask): Promise<void> {
    setIsRetryingTask(true);
    try {
      const result = await api.post<{ taskId: string }>('/api/orchestrate', { intent: task.intent });
      await loadAgentTasks();
      const newTask = await api.get<AgentTask>(`/api/agents/tasks/${result.taskId}`);
      setAgentTasks((prev) => [newTask, ...prev.filter((agentTask) => agentTask.id !== newTask.id)]);
      handleOpenAgentTask(newTask);
    } catch (retryError) {
      setAgentTasksError(retryError instanceof Error ? retryError.message : 'Unable to retry task');
    } finally {
      setIsRetryingTask(false);
    }
  }

  async function handleCancelAgentTask(taskId: string): Promise<void> {
    setIsCancellingTask(true);
    try {
      const parentTaskId = selectedTaskDetail?.id ?? selectedTask?.id;
      if (!parentTaskId) {
        throw new Error('Unable to resolve selected task');
      }
      const cancelledTaskDetail = await workspaceService.cancelTask(parentTaskId);
      setSelectedTaskDetail(cancelledTaskDetail);
      setSelectedTask(cancelledTaskDetail);
      let cancelledTask: AgentTask | null = null;
      try {
        cancelledTask = await api.get<AgentTask>(`/api/agents/tasks/${taskId}`);
      } catch {
        cancelledTask = null;
      }

      if (cancelledTask && cancelledTask.id) {
        setAgentTasks((prev) => prev.map((task) => (task.id === taskId ? cancelledTask! : task)));
        setSelectedAgentTask(cancelledTask);
      } else {
        setAgentTasks((prev) => prev.map((task) => (task.id === taskId ? withCancelledAgentTask(task) : task)));
        setSelectedAgentTask((prev) => (
          prev && prev.id === taskId ? withCancelledAgentTask(prev) : prev
        ));
      }
      closeTaskStream();
      setAgentTasksError(null);
    } catch (cancelError) {
      setAgentTasksError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel task');
    } finally {
      setIsCancellingTask(false);
    }
  }

  const allTasks = mergeCreatedTasks(tasks, createdTasks);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStandard = allTasks.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesSearch = matchesTaskSearch(t, searchQuery);
    return matchesStatus && matchesSearch;
  });

  const inProgressCount = allTasks.filter((t) => t.status === 'in_progress' || t.status === 'pending').length;

  const liveAgentTask = selectedAgentTask
    ? agentTasks.find((t) => t.id === selectedAgentTask.id) ?? selectedAgentTask
    : null;
  const visibleTask = selectedTaskDetail ?? selectedTask;

  return (
    <>
      <div className="space-y-6 pb-10">
        <PageHeader
          title="Tasks"
          description={inProgressCount > 0 ? `${inProgressCount} task${inProgressCount > 1 ? 's' : ''} active` : `${allTasks.length} total tasks`}
        >
          <Button variant="primary" className="btn-bevel btn-bevel-primary" onClick={handleCreateTask}>
            <Plus size={16} />
            New Task
          </Button>
        </PageHeader>

        {agentTasksError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{agentTasksError}</span>
              <Button variant="secondary" onClick={() => void loadAgentTasks()}>Retry</Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(({ value, label }) => {
              const count = value === 'all' ? allTasks.length : allTasks.filter((t) => t.status === value).length;
              const isActive = statusFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${isActive
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-card text-muted-foreground border-border hover:border-muted-foreground/50 hover:text-foreground'
                    }`}
                >
                  {label}
                  {count > 0 && <span className="opacity-60">{count}</span>}
                </button>
              );
            })}
          </div>
          {/* Keyword search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-full border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44"
            />
          </div>
        </div>

        <Card className="shadow-soft">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive m-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
                <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
              </div>
            </div>
          ) : filteredStandard.length > 0 ? (
            <TaskList tasks={filteredStandard} onOpenTask={(task) => void handleOpenTask(task)} />
          ) : (
            <EmptyStateCard
              title={statusFilter === 'all' ? 'No tasks yet' : `No ${statusFilter.replace('_', ' ')} tasks`}
              description="Background tasks and manually tracked work will appear here."
            />
          )}
        </Card>
      </div>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          closeTaskStream();
          setSelectedTaskDetail(null);
        }}
        title={getDrawerTitle(liveAgentTask, visibleTask)}
      >
        {liveAgentTask ? (
          <div className="space-y-6">
            <AgentTaskDrawerContent
              task={liveAgentTask}
              onCancel={liveAgentTask.status === 'queued' || liveAgentTask.status === 'running'
                ? () => void handleCancelAgentTask(liveAgentTask.id)
                : undefined}
              isCancelling={isCancellingTask}
              onRetry={liveAgentTask.status === 'failed'
                ? () => void handleRetryAgentTask(liveAgentTask)
                : undefined}
              isRetrying={isRetryingTask}
              runHistory={selectedTaskDetail?.runs ?? []}
            />
          </div>
        ) : (
          <TaskDrawerContent
            task={visibleTask}
            onClose={() => setIsDrawerOpen(false)}
            onCreateTask={handleCreateStandardTask}
            onDelegateTask={handleDelegateTask}
          />
        )}
      </Drawer>
    </>
  );
}
