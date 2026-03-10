import React, { useState } from 'react';
import { ArrowUpRight, Bot, RefreshCcw, Workflow } from 'lucide-react';
import { OffshiftSummaryStrip } from '../offshift/OffshiftSummaryStrip';
import { OffshiftWorkItemCard } from '../offshift/OffshiftWorkItemCard';
import { EmptyStateCard } from '../shared/EmptyStateCard';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { WorkflowTemplatePanel } from '../offshift/WorkflowTemplatePanel';
import { useJobs } from '../../hooks/useJobs';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { useOffshiftInbox } from '../../hooks/useOffshiftInbox';
import { useWorkflowTemplates } from '../../hooks/useWorkflowTemplates';
import type { WorkflowTemplate } from '../../types';

function getStatusVariant(status: 'queued' | 'running' | 'completed' | 'failed'): 'default' | 'success' | 'warning' {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'warning';
    return 'default';
}

export function BackgroundJobsTab() {
    const [workflowTitle, setWorkflowTitle] = useState('');
    const [workflowIntent, setWorkflowIntent] = useState('');
    const [workflowDescription, setWorkflowDescription] = useState('');
    const [topic, setTopic] = useState('');
    const [goal, setGoal] = useState('');
    const [audience, setAudience] = useState('Founders and PMs');
    const [deliverToNotion, setDeliverToNotion] = useState(true);
    const [notifyInSlack, setNotifyInSlack] = useState(true);

    const { flags } = useFeatureFlags();
    const { jobs, isLoading: isJobsLoading, isSubmitting, error: jobsError, createResearchBrief, createWorkflowRun } = useJobs();
    const { items: inboxItems, isLoading: isInboxLoading, refresh: refreshInbox } = useOffshiftInbox(flags.offshiftInbox);
    const { templates, isLoading: isTemplatesLoading, isSaving: isTemplateSaving, createTemplate, deleteTemplate } = useWorkflowTemplates(flags.jobTypesV2);

    async function handleResearchSubmit(event: React.FormEvent): Promise<void> {
        event.preventDefault();
        if (!topic.trim() || !goal.trim()) return;
        await createResearchBrief({ topic, goal, audience, deliverToNotion, notifyInSlack });
        setTopic('');
        setGoal('');
    }

    async function handleWorkflowRun(event: React.FormEvent): Promise<void> {
        event.preventDefault();
        if (!workflowTitle.trim() || !workflowIntent.trim()) return;
        await createWorkflowRun({ title: workflowTitle, intent: workflowIntent, deliverToNotion, notifyInSlack });
        setWorkflowTitle('');
        setWorkflowIntent('');
        setWorkflowDescription('');
    }

    async function handleSaveTemplate(): Promise<void> {
        if (!workflowTitle.trim() || !workflowIntent.trim() || !workflowDescription.trim()) return;
        await createTemplate({ name: workflowTitle, description: workflowDescription, intent: workflowIntent, deliverToNotion, notifyInSlack });
    }

    function applyTemplate(template: WorkflowTemplate): void {
        setWorkflowTitle(template.name);
        setWorkflowDescription(template.description);
        setWorkflowIntent(template.intent);
        setDeliverToNotion(template.deliverToNotion);
        setNotifyInSlack(template.notifyInSlack);
    }

    return (
        <div className="space-y-8">
            {/* Forms Section */}
            <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-6">
                {/* Research Brief Form */}
                <Card>
                    <CardContent className="p-6 space-y-5">
                        <div>
                            <div className="text-sm font-medium text-foreground">Queue a research brief</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Use this when you want a focused async research workflow with optional Notion and Slack delivery.
                            </div>
                        </div>

                        <form className="space-y-4" onSubmit={(event) => void handleResearchSubmit(event)}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Topic</label>
                                <input
                                    value={topic}
                                    onChange={(event) => setTopic(event.target.value)}
                                    placeholder="Competitor analytics tools for startups"
                                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Goal</label>
                                <textarea
                                    value={goal}
                                    onChange={(event) => setGoal(event.target.value)}
                                    placeholder="Compare the top 3 options, recommend one, and explain why."
                                    rows={4}
                                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-ring"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Audience</label>
                                <input
                                    value={audience}
                                    onChange={(event) => setAudience(event.target.value)}
                                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
                                />
                            </div>

                            <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
                                <label className="flex items-center justify-between gap-3 text-sm text-foreground cursor-pointer">
                                    Deliver final brief to Notion
                                    <input type="checkbox" checked={deliverToNotion} onChange={(event) => setDeliverToNotion(event.target.checked)} />
                                </label>
                                <label className="flex items-center justify-between gap-3 text-sm text-foreground cursor-pointer">
                                    Post completion update to Slack
                                    <input type="checkbox" checked={notifyInSlack} onChange={(event) => setNotifyInSlack(event.target.checked)} />
                                </label>
                            </div>

                            <Button variant="primary" className="w-full" disabled={isSubmitting || !topic.trim() || !goal.trim()}>
                                {isSubmitting ? 'Queueing...' : 'Delegate Background Work'}
                            </Button>
                        </form>
                        {jobsError && <div className="text-sm text-amber-500">{jobsError}</div>}
                    </CardContent>
                </Card>

                {/* Generic Workflow Form & Templates */}
                <div className="space-y-6">
                    {flags.jobTypesV2 && (
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Queue a generic off-shift workflow</div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Describe the work in plain English. Crewmate will route it through the orchestrator.
                                        </div>
                                    </div>
                                    <Badge variant="info">Generic</Badge>
                                </div>
                                <form className="space-y-4" onSubmit={(event) => void handleWorkflowRun(event)}>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Workflow name</label>
                                        <input
                                            value={workflowTitle}
                                            onChange={(event) => setWorkflowTitle(event.target.value)}
                                            placeholder="Weekly launch summary"
                                            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-ring"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Template description</label>
                                        <input
                                            value={workflowDescription}
                                            onChange={(event) => setWorkflowDescription(event.target.value)}
                                            placeholder="Summarize recent cross-functional launch progress."
                                            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:border-ring"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Off-shift instructions</label>
                                        <textarea
                                            value={workflowIntent}
                                            onChange={(event) => setWorkflowIntent(event.target.value)}
                                            placeholder="Summarize all recent activity from GitHub and tasks."
                                            rows={5}
                                            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm resize-none focus:outline-none focus:border-ring"
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-3 mt-4">
                                        <Button variant="secondary" type="submit" disabled={isSubmitting || !workflowTitle.trim() || !workflowIntent.trim()}>
                                            {isSubmitting ? 'Queueing...' : 'Queue Off-Shift Workflow'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            type="button"
                                            disabled={isTemplateSaving || !workflowTitle.trim() || !workflowDescription.trim() || !workflowIntent.trim()}
                                            onClick={() => void handleSaveTemplate()}
                                        >
                                            {isTemplateSaving ? 'Saving...' : 'Save as Template'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {flags.jobTypesV2 && (
                        <WorkflowTemplatePanel templates={templates} isLoading={isTemplatesLoading} isSaving={isTemplateSaving} onApply={applyTemplate} onDelete={(id) => void deleteTemplate(id)} />
                    )}
                </div>
            </div>

            {/* Inbox & Job Status Section */}
            <div className="mt-12">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-foreground">Running & Completed Jobs</h3>
                    {flags.offshiftInbox && (
                        <Button variant="ghost" size="sm" onClick={() => void refreshInbox()} disabled={isInboxLoading}>
                            <RefreshCcw size={14} className="mr-2" /> Refresh Inbox
                        </Button>
                    )}
                </div>

                {flags.offshiftInbox ? (
                    <div className="space-y-4">
                        <OffshiftSummaryStrip items={inboxItems} />
                        <Card>
                            <CardContent className="p-5">
                                {isInboxLoading ? (
                                    <div className="py-12 text-center text-sm text-muted-foreground">Loading inbox tracking...</div>
                                ) : inboxItems.length > 0 ? (
                                    <div className="space-y-4">
                                        {inboxItems.map((item) => (
                                            <React.Fragment key={item.id}>
                                                <OffshiftWorkItemCard item={item} />
                                            </React.Fragment>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyStateCard title="No background jobs tracked yet" description="Queue a delegated job above." />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            {isJobsLoading ? (
                                <div className="p-6 text-sm text-muted-foreground">Loading delegated jobs...</div>
                            ) : jobs.length > 0 ? (
                                <div className="divide-y divide-border">
                                    {jobs.map((job) => (
                                        <div key={job.id} className="p-5 flex flex-col gap-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-base font-medium text-foreground">{job.title}</div>
                                                    <div className="mt-1 text-sm text-muted-foreground">{job.summary}</div>
                                                </div>
                                                <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>{new Date(job.createdAt).toLocaleString()}</span>
                                                <span>{job.type.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyStateCard title="No delegated jobs yet" description="Queue one async research brief or workflow upstream." />
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
