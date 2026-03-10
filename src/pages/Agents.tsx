/**
 * Agents Page — Phase 11 (Live Sub-Step Timeline)
 *
 * Shows the full A2A workforce with real-time task execution transparency:
 * - Every agent card with status + department
 * - Intent dispatch input
 * - Live task timeline showing each step an agent takes (skill calls, LLM calls, results)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Bot, Brain, Calendar, Code2, Mail, PenTool,
    Send, CheckCircle2, XCircle, Loader2, BarChart2,
    Search, Wrench, Zap, ArrowRight, ChevronDown, ChevronUp,
    Clock, FlaskConical, MessageSquare,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../lib/api';

// ── Step event types (mirror server/types/agentEvents.ts) ────────────────────

type AgentStepType = 'routing' | 'thinking' | 'skill_call' | 'skill_result' | 'generating' | 'saving' | 'done' | 'error';

interface AgentStepEvent {
    taskId: string;
    stepIndex: number;
    type: AgentStepType;
    timestamp: string;
    label: string;
    detail?: string;
    skillId?: string;
    durationMs?: number;
    success?: boolean;
}

interface AgentTask {
    id: string;
    agentId: string;
    intent: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
    steps?: AgentStepEvent[];
    createdAt: string;
    completedAt?: string;
}

interface AgentManifest {
    id: string;
    name: string;
    department: string;
    description: string;
    emoji: string;
    capabilities: string[];
    skills: string[];
}

// ── Step icon + color ─────────────────────────────────────────────────────────

function StepIcon({ type }: { type: AgentStepType }) {
    const props = { size: 13 };
    switch (type) {
        case 'routing': return <Zap {...props} className="text-violet-400" />;
        case 'thinking': return <Brain {...props} className="text-blue-400" />;
        case 'skill_call': return <Wrench {...props} className="text-amber-400" />;
        case 'skill_result': return <CheckCircle2 {...props} className="text-emerald-400" />;
        case 'generating': return <FlaskConical {...props} className="text-indigo-400" />;
        case 'saving': return <BarChart2 {...props} className="text-teal-400" />;
        case 'done': return <CheckCircle2 {...props} className="text-emerald-500" />;
        case 'error': return <XCircle {...props} className="text-red-400" />;
        default: return <Bot {...props} className="text-muted-foreground" />;
    }
}

const STEP_TYPE_LABELS: Record<AgentStepType, string> = {
    routing: 'Routing',
    thinking: 'Thinking',
    skill_call: 'Skill',
    skill_result: 'Result',
    generating: 'Generating',
    saving: 'Saving',
    done: 'Done',
    error: 'Error',
};

const STEP_COLORS: Record<AgentStepType, string> = {
    routing: 'border-violet-500/30 bg-violet-500/5',
    thinking: 'border-blue-500/30 bg-blue-500/5',
    skill_call: 'border-amber-500/30 bg-amber-500/5',
    skill_result: 'border-emerald-500/30 bg-emerald-500/5',
    generating: 'border-indigo-500/30 bg-indigo-500/5',
    saving: 'border-teal-500/30 bg-teal-500/5',
    done: 'border-emerald-500/30 bg-emerald-500/5',
    error: 'border-red-500/30 bg-red-500/5',
};

// ── Agent manifest icons ──────────────────────────────────────────────────────

const AGENT_DEPT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Intelligence: Brain,
    Marketing: PenTool,
    Engineering: Code2,
    Comms: Mail,
    Ops: Calendar,
    Sales: BarChart2,
    Support: MessageSquare,
    Default: Bot,
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StepRow: React.FC<{ step: AgentStepEvent; isLast: boolean }> = ({ step, isLast }) => (
    <div className="flex gap-3 group">
        {/* Timeline line */}
        <div className="flex flex-col items-center">
            <div className={`flex items-center justify-center w-5 h-5 rounded-full border ${STEP_COLORS[step.type]} flex-shrink-0 mt-0.5`}>
                <StepIcon type={step.type} />
            </div>
            {!isLast && <div className="w-px flex-1 bg-border/50 my-1" />}
        </div>

        {/* Content */}
        <div className="pb-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STEP_COLORS[step.type]}`}>
                    {STEP_TYPE_LABELS[step.type]}
                </span>
                {step.skillId && (
                    <span className="text-[10px] font-mono text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                        {step.skillId}
                    </span>
                )}
                {step.durationMs !== undefined && (
                    <span className="text-[10px] text-muted-foreground">{step.durationMs}ms</span>
                )}
            </div>
            <p className="text-sm text-foreground mt-1">{step.label}</p>
            {step.detail && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.detail}</p>
            )}
        </div>
    </div>
);

const TaskCard: React.FC<{ task: AgentTask; isActive: boolean }> = ({ task, isActive }) => {
    const [expanded, setExpanded] = useState(isActive);

    useEffect(() => {
        if (isActive) setExpanded(true);
    }, [isActive]);

    const steps = task.steps ?? [];
    const duration = task.completedAt
        ? Math.round((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 1000)
        : null;

    const agentShort = task.agentId.replace('crewmate-', '').replace('-agent', '');

    return (
        <div className={`rounded-xl border bg-card/50 overflow-hidden transition-all duration-300 ${task.status === 'running' ? 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.08)]' :
                task.status === 'completed' ? 'border-emerald-500/20' :
                    task.status === 'failed' ? 'border-red-500/20' :
                        'border-border'
            }`}>
            {/* Header */}
            <button
                type="button"
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center text-sm ${task.status === 'running' ? 'border-blue-500/40 bg-blue-500/10' :
                        task.status === 'completed' ? 'border-emerald-500/30 bg-emerald-500/10' :
                            task.status === 'failed' ? 'border-red-500/30 bg-red-500/10' :
                                'border-border bg-secondary'
                    }`}>
                    {task.status === 'running' && <Loader2 size={14} className="text-blue-400 animate-spin" />}
                    {task.status === 'completed' && <CheckCircle2 size={14} className="text-emerald-400" />}
                    {task.status === 'failed' && <XCircle size={14} className="text-red-400" />}
                    {task.status === 'queued' && <Clock size={14} className="text-muted-foreground" />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{agentShort}</span>
                        {duration !== null && (
                            <span className="text-[10px] text-muted-foreground">· {duration}s</span>
                        )}
                        {steps.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">· {steps.length} steps</span>
                        )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{task.intent}</p>
                    {task.status === 'running' && steps.length > 0 && (
                        <p className="text-xs text-blue-400 mt-0.5 animate-pulse">
                            {steps[steps.length - 1]?.label ?? 'Working...'}
                        </p>
                    )}
                </div>

                {steps.length > 0 && (
                    <div className="flex-shrink-0 text-muted-foreground">
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                )}
            </button>

            {/* Live step timeline */}
            {expanded && steps.length > 0 && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-0">
                    {steps.map((step, i) => (
                        <StepRow key={`${step.taskId}-${step.stepIndex}`} step={step} isLast={i === steps.length - 1} />
                    ))}
                    {task.status === 'running' && (
                        <div className="flex gap-3 items-center pl-0.5 pt-1">
                            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                <Loader2 size={13} className="text-blue-400 animate-spin" />
                            </div>
                            <p className="text-xs text-muted-foreground animate-pulse">Working...</p>
                        </div>
                    )}
                </div>
            )}

            {/* Result preview */}
            {expanded && task.status === 'completed' && task.result && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3">
                    <pre className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                        {typeof task.result === 'string'
                            ? task.result.slice(0, 800)
                            : JSON.stringify(task.result, null, 2).slice(0, 800)}
                        {JSON.stringify(task.result ?? '').length > 800 ? '\n[...truncated]' : ''}
                    </pre>
                </div>
            )}

            {expanded && task.status === 'failed' && task.error && (
                <div className="px-4 pb-4 border-t border-red-500/20 pt-3">
                    <p className="text-xs text-red-400">{task.error}</p>
                </div>
            )}
        </div>
    );
};

const AgentCard: React.FC<{ agent: AgentManifest }> = ({ agent }) => {
    const DeptIcon = AGENT_DEPT_ICONS[agent.department] ?? AGENT_DEPT_ICONS.Default;
    return (
        <div className="rounded-xl border border-border bg-card/40 p-4 flex items-start gap-3 hover:border-foreground/20 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-lg flex-shrink-0">
                {agent.emoji}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{agent.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{agent.department}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{agent.description}</p>
                {agent.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {agent.skills.slice(0, 3).map((s) => (
                            <span key={s} className="text-[10px] font-mono bg-secondary text-muted-foreground rounded px-1.5 py-0.5">{s}</span>
                        ))}
                        {agent.skills.length > 3 && <span className="text-[10px] text-muted-foreground">+{agent.skills.length - 3}</span>}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export function Agents(): React.JSX.Element {
    const [agents, setAgents] = useState<AgentManifest[]>([]);
    const [tasks, setTasks] = useState<AgentTask[]>([]);
    const [intent, setIntent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [tab, setTab] = useState<'tasks' | 'crew'>('tasks');
    const sseRef = useRef<EventSource | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Load agents
    useEffect(() => {
        void api.get<AgentManifest[]>('/api/agents').then((data) => setAgents(data ?? []));
    }, []);

    // Load task history
    const loadTasks = useCallback(async () => {
        const data = await api.get<AgentTask[]>('/api/agents/tasks');
        setTasks(data ?? []);
    }, []);

    useEffect(() => { void loadTasks(); }, [loadTasks]);

    // Subscribe to SSE for a task
    const subscribeToTask = useCallback((taskId: string) => {
        if (sseRef.current) sseRef.current.close();
        const es = new EventSource(`/api/agents/tasks/${taskId}/events`);
        sseRef.current = es;

        es.onmessage = (e) => {
            const event = JSON.parse(e.data as string) as { type: string; step?: AgentStepEvent; status?: string; result?: unknown; error?: string; steps?: AgentStepEvent[] };

            setTasks((prev) => prev.map((t) => {
                if (t.id !== taskId) return t;

                if (event.type === 'step' && event.step) {
                    return { ...t, steps: [...(t.steps ?? []), event.step] };
                }
                if (event.type === 'status') {
                    return { ...t, status: (event.status as AgentTask['status']) ?? t.status };
                }
                if (event.type === 'completed') {
                    es.close();
                    return { ...t, status: 'completed', result: event.result, steps: event.steps ?? t.steps, completedAt: new Date().toISOString() };
                }
                if (event.type === 'failed') {
                    es.close();
                    return { ...t, status: 'failed', error: event.error, steps: event.steps ?? t.steps };
                }
                return t;
            }));
        };

        return () => es.close();
    }, []);

    // Scroll to bottom when new steps arrive
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [tasks]);

    const handleSubmit = useCallback(async () => {
        if (!intent.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await api.post<{ taskId: string }>('/api/orchestrate', { intent: intent.trim() });
            if (res?.taskId) {
                const newTask: AgentTask = {
                    id: res.taskId,
                    agentId: 'routing...',
                    intent: intent.trim(),
                    status: 'queued',
                    steps: [],
                    createdAt: new Date().toISOString(),
                };
                setTasks((p) => [newTask, ...p]);
                setActiveTaskId(res.taskId);
                setTab('tasks');
                setIntent('');
                subscribeToTask(res.taskId);
            }
        } finally {
            setIsSubmitting(false);
        }
    }, [intent, isSubmitting, subscribeToTask]);

    const runningCount = tasks.filter((t) => t.status === 'running').length;
    const completedCount = tasks.filter((t) => t.status === 'completed').length;

    return (
        <div className="flex flex-col h-full">
            <PageHeader
                title="Agent Network"
                description={`${agents.length} specialist agents · ${runningCount > 0 ? `${runningCount} running` : `${completedCount} completed`}`}
            />

            <div className="flex-1 overflow-auto">
                <div className="max-w-5xl mx-auto px-6 pb-24 space-y-6">

                    {/* Dispatch input */}
                    <div className="relative mt-2">
                        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            id="agent-dispatch-input"
                            className="w-full bg-card border border-border rounded-xl pl-10 pr-16 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition-all placeholder:text-muted-foreground"
                            placeholder="Dispatch a task to the crew... e.g. 'Write a blog post about AI agents' or 'Check git status'"
                            value={intent}
                            onChange={(e) => setIntent(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
                        />
                        <button
                            type="button"
                            onClick={() => void handleSubmit()}
                            disabled={!intent.trim() || isSubmitting}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                        >
                            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                    </div>

                    {/* Quick dispatch examples */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            'Research the latest AI agent frameworks',
                            'Write a LinkedIn post about our new feature',
                            'Check git status and run tests',
                            'Find a free slot for a 30min meeting tomorrow',
                        ].map((example) => (
                            <button
                                key={example}
                                type="button"
                                onClick={() => setIntent(example)}
                                className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5 hover:border-foreground/40 hover:text-foreground transition-all flex items-center gap-1.5"
                            >
                                <ArrowRight size={10} />
                                {example}
                            </button>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 border-b border-border">
                        {(['tasks', 'crew'] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {t === 'tasks' ? `Tasks${runningCount > 0 ? ` (${runningCount} live)` : ''}` : `Crew (${agents.length})`}
                            </button>
                        ))}
                    </div>

                    {/* Tasks tab */}
                    {tab === 'tasks' && (
                        <div className="space-y-3">
                            {tasks.length === 0 && (
                                <div className="text-center py-16 text-muted-foreground">
                                    <Bot size={32} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No tasks yet. Dispatch something above.</p>
                                </div>
                            )}
                            {tasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    isActive={task.id === activeTaskId}
                                />
                            ))}
                            <div ref={bottomRef} />
                        </div>
                    )}

                    {/* Crew tab */}
                    {tab === 'crew' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {agents.length === 0 && (
                                <div className="col-span-2 text-center py-16 text-muted-foreground">
                                    <Loader2 size={24} className="mx-auto mb-3 animate-spin opacity-40" />
                                    <p className="text-sm">Loading agent crew...</p>
                                </div>
                            )}
                            {agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
