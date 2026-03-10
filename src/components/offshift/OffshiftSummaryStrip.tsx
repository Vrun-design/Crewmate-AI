import React from 'react';
import { Clock3, Send, ShieldCheck, Workflow } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import type { OffshiftWorkItem } from '../../types';

interface OffshiftSummaryStripProps {
  items: OffshiftWorkItem[];
}

function SummaryStat({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{helper}</div>
    </div>
  );
}

export function OffshiftSummaryStrip({ items }: OffshiftSummaryStripProps) {
  const running = items.filter((item) => item.status === 'running').length;
  const delivered = items.filter((item) => item.deliveryChannels.some((channel) => channel.status === 'delivered')).length;
  const pendingApprovals = items.filter((item) => item.approvalStatus === 'pending').length;
  const sources = new Set(items.map((item) => item.startedFrom)).size;

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat
          label="Running Now"
          value={String(running)}
          helper="Jobs actively executing in the background."
          icon={Clock3}
          tone="border-amber-500/30 bg-amber-500/10 text-amber-500"
        />
        <SummaryStat
          label="Delivered"
          value={String(delivered)}
          helper="Items already pushed to Slack, Notion, or other endpoints."
          icon={Send}
          tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
        />
        <SummaryStat
          label="Needs Approval"
          value={String(pendingApprovals)}
          helper="Reserved for external actions gated behind approval."
          icon={ShieldCheck}
          tone="border-primary/30 bg-primary/10 text-primary"
        />
        <SummaryStat
          label="Origin Surfaces"
          value={String(sources)}
          helper="Where off-shift work is currently being started from."
          icon={Workflow}
          tone="border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-500"
        />
      </CardContent>
    </Card>
  );
}
