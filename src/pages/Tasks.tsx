import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Bot } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { Card } from '../components/ui/Card';
import { TaskList } from '../components/tasks/TaskList';
import { TaskDrawerContent } from '../components/tasks/TaskDrawerContent';
import { AgentTaskCard } from '../components/agents/AgentTaskCard';
import { AgentTaskDrawerContent } from '../components/agents/AgentTaskDrawerContent';
import { EmptyStateCard } from '../components/shared/EmptyStateCard';
import { useWorkspaceCollection } from '../hooks/useWorkspaceCollection';
import { workspaceService } from '../services/workspaceService';
import type { Task } from '../types';
import type { AgentTask, AgentStepEvent } from '../components/agents/types';
import { api } from '../lib/api';
import { connectAuthenticatedSseStream } from '../lib/sse';

type StatusFilter = 'all' | 'in_progress' | 'completed' | 'pending' | 'failed';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
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

function mergeCreatedTasks(standardTasks: Task[], createdTasks: Task[]): Task[] {
  return [
    ...createdTasks,
    ...standardTasks.filter((task) => !createdTasks.some((createdTask) => createdTask.id === task.id)),
  ];
}

function getDrawerTitle(agentTask: AgentTask | null, selectedTask: Task | null): string {
  if (agentTask) {
    return agentTask.status === 'running' || agentTask.status === 'queued' ? 'Live Agent Task' : 'Agent Task Details';
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

  return task;
}

export function Tasks(): React.JSX.Element {
  const { data: standardTasks, isLoading, error } = useWorkspaceCollection(workspaceService.getTasks);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [agentTasksError, setAgentTasksError] = useState<string | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const sseRef = useRef<AbortController | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedAgentTask, setSelectedAgentTask] = useState<AgentTask | null>(null);

  const loadAgentTasks = useCallback(async () => {
    try {
      const data = await api.get<AgentTask[]>('/api/agents/tasks');
      setAgentTasks(data ?? []);
      setAgentTasksError(null);
    } catch (loadError) {
      setAgentTasks([]);
      setAgentTasksError(loadError instanceof Error ? loadError.message : 'Unable to load live agent tasks');
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

        if (payload.type === 'completed' || payload.type === 'failed') {
          closeTaskStream();
        }
      },
      onError: () => {
        setAgentTasksError('Live task updates disconnected. Reopen the task to retry streaming.');
        closeTaskStream();
      },
    });
  }, [closeTaskStream]);

  function handleOpenTask(task: Task) {
    setSelectedTask(task);
    setSelectedAgentTask(null);
    setIsDrawerOpen(true);
  }

  function handleOpenAgentTask(task: AgentTask) {
    setSelectedAgentTask(task);
    setSelectedTask(null);
    setIsDrawerOpen(true);
    if (task.status === 'running' || task.status === 'queued') {
      subscribeToTask(task.id);
    }
  }

  function handleCreateTask() {
    setSelectedTask(null);
    setSelectedAgentTask(null);
    setIsDrawerOpen(true);
  }

  async function handleCreateStandardTask(input: { title: string; description: string; tool: string; priority: Task['priority'] }): Promise<void> {
    const createdTask = await workspaceService.createTask(input);
    setCreatedTasks((previousTasks) => [createdTask, ...previousTasks.filter((task) => task.id !== createdTask.id)]);
  }

  const allStandardTasks = mergeCreatedTasks(standardTasks, createdTasks);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const filteredStandard = statusFilter === 'all'
    ? allStandardTasks
    : allStandardTasks.filter((t) => t.status === statusFilter);

  const activeAgentTasks = agentTasks.filter((t) => t.status === 'running' || t.status === 'queued');
  const archivedAgentTasks = agentTasks.filter((t) => t.status === 'completed' || t.status === 'failed');
  const inProgressCount = allStandardTasks.filter((t) => t.status === 'in_progress').length + activeAgentTasks.length;

  const liveAgentTask = selectedAgentTask
    ? agentTasks.find((t) => t.id === selectedAgentTask.id) ?? selectedAgentTask
    : null;

  return (
    <>
      <div className="space-y-6 pb-10">
        <PageHeader
          title="Tasks"
          description={inProgressCount > 0 ? `${inProgressCount} task${inProgressCount > 1 ? 's' : ''} in progress` : `${allStandardTasks.length} total tasks`}
        >
          <Button variant="primary" className="btn-bevel btn-bevel-primary" onClick={handleCreateTask}>
            <Plus size={16} />
            New Task
          </Button>
        </PageHeader>

        {agentTasksError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {agentTasksError}
          </div>
        ) : null}

        {activeAgentTasks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Bot size={12} className="text-primary" /> Live Agent Tasks
            </p>
            {activeAgentTasks.map((task) => (
              <AgentTaskCard key={task.id} task={task} isActive={false} onOpen={() => handleOpenAgentTask(task)} />
            ))}
          </div>
        )}

        {archivedAgentTasks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Bot size={12} className="text-muted-foreground" /> Agent Task History
            </p>
            {archivedAgentTasks.map((task) => (
              <AgentTaskCard key={task.id} task={task} isActive={false} onOpen={() => handleOpenAgentTask(task)} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(({ value, label }) => {
            const count = value === 'all' ? allStandardTasks.length : allStandardTasks.filter((t) => t.status === value).length;
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

        <Card className="shadow-soft">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive m-4">{error}</div>
          ) : filteredStandard.length > 0 ? (
            <TaskList tasks={filteredStandard} onOpenTask={handleOpenTask} />
          ) : (
            <EmptyStateCard
              title={statusFilter === 'all' ? 'No tasks yet' : `No ${statusFilter.replace('_', ' ')} tasks`}
              description="Tasks created by Crewmate or added manually will appear here."
            />
          )}
        </Card>
      </div>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          closeTaskStream();
        }}
        title={getDrawerTitle(liveAgentTask, selectedTask)}
      >
        {liveAgentTask ? (
          <AgentTaskDrawerContent task={liveAgentTask} />
        ) : (
          <TaskDrawerContent
            task={selectedTask}
            onClose={() => setIsDrawerOpen(false)}
            onCreateTask={handleCreateStandardTask}
          />
        )}
      </Drawer>
    </>
  );
}
