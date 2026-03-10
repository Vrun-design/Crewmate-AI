import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, User, Zap } from 'lucide-react';
import { AgentNodeMap } from '../components/agents/AgentNodeMap';
import type { AgentManifest, AgentStepEvent, AgentTask } from '../components/agents/types';
import { Drawer } from '../components/ui/Drawer';
import { PageHeader } from '../components/ui/PageHeader';
import { api, buildAuthenticatedEventSourceUrl } from '../lib/api';

export function Agents(): React.JSX.Element {
    const [agents, setAgents] = useState<AgentManifest[]>([]);
    const [tasks, setTasks] = useState<AgentTask[]>([]);
    const [tasksError, setTasksError] = useState<string | null>(null);
    const [intent, setIntent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [tab, setTab] = useState<'tasks' | 'background-jobs' | 'crew'>('tasks');
    const sseRef = useRef<EventSource | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void api.get<AgentManifest[]>('/api/agents').then((data) => setAgents(data ?? []));
    }, []);

    const loadTasks = useCallback(async () => {
        try {
            const data = await api.get<AgentTask[]>('/api/agents/tasks');
            setTasks(data ?? []);
            setTasksError(null);
        } catch (loadError) {
            setTasks([]);
            setTasksError(loadError instanceof Error ? loadError.message : 'Unable to load agent tasks');
        }
    }, []);

    useEffect(() => {
        void loadTasks();
    }, [loadTasks]);

    useEffect(() => {
        return () => {
            sseRef.current?.close();
        };
    }, []);

    const subscribeToTask = useCallback((taskId: string) => {
        if (sseRef.current) {
            sseRef.current.close();
        }

        const eventSource = new EventSource(buildAuthenticatedEventSourceUrl(`/api/agents/tasks/${taskId}/events`));
        sseRef.current = eventSource;

        eventSource.onmessage = (event) => {
            const payload = JSON.parse(event.data as string) as {
                type: string;
                step?: AgentStepEvent;
                status?: string;
                result?: unknown;
                error?: string;
                steps?: AgentStepEvent[];
            };

            setTasks((previousTasks) =>
                previousTasks.map((task) => {
                    if (task.id !== taskId) {
                        return task;
                    }

                    if (payload.type === 'snapshot' && 'task' in payload) {
                        return (payload as { task: AgentTask }).task;
                    }

                    if (payload.type === 'step' && payload.step) {
                        return { ...task, steps: [...(task.steps ?? []), payload.step] };
                    }

                    if (payload.type === 'status') {
                        return { ...task, status: (payload.status as AgentTask['status']) ?? task.status };
                    }

                    if (payload.type === 'completed') {
                        eventSource.close();
                        return {
                            ...task,
                            status: 'completed',
                            result: payload.result,
                            steps: payload.steps ?? task.steps,
                            completedAt: new Date().toISOString(),
                        };
                    }

                    if (payload.type === 'failed') {
                        eventSource.close();
                        return {
                            ...task,
                            status: 'failed',
                            error: payload.error,
                            steps: payload.steps ?? task.steps,
                        };
                    }

                    return task;
                }),
            );
        };

        eventSource.onerror = () => {
            setTasksError('Live agent updates disconnected. Start or reopen a task to reconnect.');
            eventSource.close();
            if (sseRef.current === eventSource) {
                sseRef.current = null;
            }
        };

        return () => eventSource.close();
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [tasks]);

    const handleSubmit = useCallback(async () => {
        if (!intent.trim() || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await api.post<{ taskId: string }>('/api/orchestrate', { intent: intent.trim() });
            if (response?.taskId) {
                const newTask: AgentTask = {
                    id: response.taskId,
                    agentId: 'routing...',
                    intent: intent.trim(),
                    status: 'queued',
                    steps: [],
                    createdAt: new Date().toISOString(),
                };

                setTasks((previousTasks) => [newTask, ...previousTasks]);
                setActiveTaskId(response.taskId);
                setTab('tasks');
                setIntent('');
                subscribeToTask(response.taskId);
            }
        } finally {
            setIsSubmitting(false);
        }
    }, [intent, isSubmitting, subscribeToTask]);

    const description = `Your ${agents.length} specialized crew agents are ready. Click any node in the topology map to inspect their capabilities.`;

    // State to hold the selected agent for the Drawer
    const [selectedAgent, setSelectedAgent] = useState<AgentManifest | null>(null);

    // Derive active agents directly from tasks
    const activeAgentIds = new Set<string>(
        tasks.filter((t) => t.status === 'running').map((t) => t.agentId)
    );

    return (
        <div className="space-y-6 pb-10">
            <PageHeader title="Crew Network" description={description} />

            {tasksError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {tasksError}
                </div>
            ) : null}

            <div className="mt-4">
                {agents.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground w-full border border-border rounded-xl bg-card">
                        <Loader2 size={24} className="mx-auto mb-3 animate-spin opacity-40" />
                        <p className="text-sm">Initializing geometric node mapping...</p>
                    </div>
                ) : (
                    <AgentNodeMap
                        agents={agents}
                        activeAgentIds={activeAgentIds}
                        onNodeClick={setSelectedAgent}
                        selectedAgentId={selectedAgent?.id}
                    />
                )}
            </div>

            {/* Drawer Overlay for Selected Agent Details */}
            <Drawer
                isOpen={selectedAgent !== null}
                onClose={() => setSelectedAgent(null)}
                title={selectedAgent?.name ?? 'Agent Details'}
            >
                {selectedAgent && (
                    <div className="space-y-8 pb-10 mt-2">
                        {/* Header Section */}
                        <div className="flex flex-col gap-3 pb-6 border-b border-border">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(233,84,32,0.1)]">
                                <Bot size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-foreground tracking-tight">{selectedAgent.name}</h3>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="px-2.5 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium uppercase tracking-wider border border-border">
                                        {selectedAgent.department}
                                    </span>
                                    {activeAgentIds.has(selectedAgent.id) ? (
                                        <span className="flex items-center gap-1.5 text-primary text-xs font-medium uppercase tracking-wider">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                            Running Task
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                            System Idle
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Description Section */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <User size={16} className="text-muted-foreground" />
                                Objective
                            </h4>
                            <p className="text-[13px] leading-relaxed text-muted-foreground bg-secondary/50 p-4 rounded-xl border border-border/50">
                                {selectedAgent.description}
                            </p>
                        </div>

                        {/* Skills List */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mt-6">
                                <Zap size={16} className="text-muted-foreground" />
                                Available Capabilities
                            </h4>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {selectedAgent.skills.map((skill, index) => (
                                    <div
                                        key={index}
                                        className="px-3 py-1.5 bg-card border border-border/50 rounded-lg text-[13px] text-muted-foreground shadow-sm hover:border-primary/40 hover:text-foreground transition-colors"
                                    >
                                        {skill}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </Drawer>
        </div>
    );
}
