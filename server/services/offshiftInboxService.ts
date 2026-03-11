import { listJobs } from './delegationService';
import type { JobRecord, OffshiftWorkItemRecord, WorkOriginType } from '../types';

function getOriginLabel(originType: WorkOriginType): string {
  if (originType === 'delegation') {
    return 'Off-Shift';
  }
  if (originType === 'live_session') {
    return 'Live session';
  }
  if (originType === 'slack') {
    return 'Slack';
  }
  if (originType === 'email') {
    return 'Email';
  }
  if (originType === 'telegram') {
    return 'Telegram';
  }

  return 'System';
}

function mapJobToWorkItem(job: JobRecord): OffshiftWorkItemRecord {
  return {
    id: job.id,
    title: job.title,
    type: job.type,
    status: job.status,
    startedFrom: job.originType,
    startedFromLabel: getOriginLabel(job.originType),
    summary: job.summary,
    deliveryChannels: job.deliveryChannels,
    artifactRefs: job.artifactRefs,
    approvalStatus: job.approvalStatus,
    approvalRequestedAt: job.approvalRequestedAt ?? null,
    approvedAt: job.approvedAt ?? null,
    handoffLog: job.handoffLog,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt ?? null,
  };
}

export function listOffshiftWorkItems(userId: string): OffshiftWorkItemRecord[] {
  return listJobs(userId).map(mapJobToWorkItem);
}
