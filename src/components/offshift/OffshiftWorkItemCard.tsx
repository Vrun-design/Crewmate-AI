import React from 'react';
import { ArrowRight, Clock3, FileText, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card, CardContent } from '../ui/Card';
import { formatJobType, formatStartedFrom, getApprovalVariant, getStatusVariant } from './offshiftUtils';
import type { OffshiftWorkItem } from '../../types';

interface OffshiftWorkItemCardProps {
  item: OffshiftWorkItem;
}

function MetaBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Icon size={12} />
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function OffshiftWorkItemCard({ item }: OffshiftWorkItemCardProps): React.JSX.Element {
  const latestHandoff = item.handoffLog[item.handoffLog.length - 1];

  return (
    <Card className="overflow-visible">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
              <Badge variant="info">{formatJobType(item.type)}</Badge>
              <Badge variant={getApprovalVariant(item.approvalStatus)}>{item.approvalStatus.replace(/_/g, ' ')}</Badge>
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{item.title}</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{item.summary}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-right">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Latest Handoff</div>
            <div className="mt-2 text-sm font-medium text-foreground">{latestHandoff?.summary ?? 'Awaiting first handoff'}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {latestHandoff ? new Date(latestHandoff.at).toLocaleString() : 'No timeline yet'}
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-4">
          <MetaBlock icon={Sparkles} label="Started From" value={formatStartedFrom(item.startedFromLabel)} />
          <MetaBlock
            icon={Send}
            label="Delivered To"
            value={item.deliveryChannels.length > 0 ? item.deliveryChannels.map((channel) => channel.destinationLabel).join(', ') : 'In-app only'}
          />
          <MetaBlock
            icon={FileText}
            label="Artifacts"
            value={item.artifactRefs.length > 0 ? item.artifactRefs.map((artifact) => artifact.label).join(', ') : 'No artifact links yet'}
          />
          <MetaBlock
            icon={ShieldCheck}
            label="Approval"
            value={item.approvalStatus === 'not_required' ? 'No approval gate' : item.approvalStatus.replace(/_/g, ' ')}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.3fr,0.9fr]">
          <div className="rounded-2xl border border-border bg-card/30 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <Clock3 size={13} />
              Handoff Timeline
            </div>
            <div className="mt-4 space-y-3">
              {item.handoffLog.length > 0 ? item.handoffLog.map((entry, index) => (
                <div key={`${entry.at}-${index}`} className="flex gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-[11px] font-semibold text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{entry.summary}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {entry.actor} <ArrowRight className="mx-1 inline-block" size={10} /> {new Date(entry.at).toLocaleString()}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground">No handoff history captured yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/30 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Delivery Matrix</div>
            <div className="mt-4 space-y-3">
              {item.deliveryChannels.length > 0 ? item.deliveryChannels.map((channel) => (
                <div key={`${channel.channel}-${channel.destinationLabel}`} className="rounded-xl border border-border bg-background/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-foreground">{channel.destinationLabel}</div>
                    <Badge variant={channel.status === 'delivered' ? 'success' : channel.status === 'failed' ? 'danger' : 'default'}>
                      {channel.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{channel.channel}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {channel.deliveredAt ? `Delivered ${new Date(channel.deliveredAt).toLocaleString()}` : 'Delivery still pending'}
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-border bg-background/40 p-4 text-sm text-muted-foreground">
                  External delivery has not been attempted yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
