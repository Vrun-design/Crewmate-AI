import type { JobStatus, OffshiftWorkItem, WorkApprovalStatus } from '../../types';

export function getStatusVariant(status: JobStatus): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'completed') {
    return 'success';
  }
  if (status === 'failed') {
    return 'danger';
  }
  if (status === 'running') {
    return 'warning';
  }

  return 'default';
}

export function getApprovalVariant(status: WorkApprovalStatus): 'default' | 'success' | 'warning' {
  if (status === 'approved') {
    return 'success';
  }
  if (status === 'pending') {
    return 'warning';
  }

  return 'default';
}

export function formatJobType(type: OffshiftWorkItem['type']): string {
  return type.replace(/_/g, ' ');
}

export function formatStartedFrom(type: OffshiftWorkItem['startedFromLabel']): string {
  return type;
}
