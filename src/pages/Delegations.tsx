import React, {useState} from 'react';
import {Badge} from '../components/ui/Badge';
import {Card, CardContent} from '../components/ui/Card';
import {PageHeader} from '../components/ui/PageHeader';
import {Button} from '../components/ui/Button';
import {EmptyStateCard} from '../components/shared/EmptyStateCard';
import {useJobs} from '../hooks/useJobs';

function getStatusVariant(status: 'queued' | 'running' | 'completed' | 'failed'): 'default' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'failed') {
    return 'warning';
  }

  return 'default';
}

export function Delegations() {
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('Founders and PMs');
  const [deliverToNotion, setDeliverToNotion] = useState(true);
  const [notifyInSlack, setNotifyInSlack] = useState(true);
  const {jobs, isLoading, isSubmitting, error, createResearchBrief} = useJobs();

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!topic.trim() || !goal.trim()) {
      return;
    }

    await createResearchBrief({
      topic,
      goal,
      audience,
      deliverToNotion,
      notifyInSlack,
    });

    setTopic('');
    setGoal('');
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Delegations"
        description="Queue off-shift work that Crewmate completes through an orchestrator -> researcher -> editor pipeline."
      />

      <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-6">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <div className="text-sm font-medium text-foreground">Queue a background brief</div>
              <div className="text-xs text-muted-foreground mt-1">
                Best judge flow: competitor teardown, launch analysis, or market research with Notion + Slack handoff.
              </div>
            </div>

            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring resize-none"
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
                <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                  Deliver final brief to Notion
                  <input type="checkbox" checked={deliverToNotion} onChange={(event) => setDeliverToNotion(event.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                  Post completion update to Slack
                  <input type="checkbox" checked={notifyInSlack} onChange={(event) => setNotifyInSlack(event.target.checked)} />
                </label>
              </div>

              <Button variant="primary" className="w-full" disabled={isSubmitting || !topic.trim() || !goal.trim()}>
                {isSubmitting ? 'Queueing...' : 'Delegate Background Work'}
              </Button>
            </form>

            {error ? <div className="text-sm text-amber-500">{error}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
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
              <EmptyStateCard
                title="No delegated jobs yet"
                description="Queue one async research brief and Crewmate will complete it off-shift through the A2A-style pipeline."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
