import { describe, expect, test } from 'vitest';
import { requestLoginCode, verifyLoginCode } from './authService';
import { enqueueDailyDigestJob, enqueueWorkflowRunJob, listJobs } from './delegationService';

describe('delegationService', () => {
  test('queues a daily digest job with the new off-shift metadata', () => {
    const email = `digest-${Date.now()}@example.com`;
    const requestCode = requestLoginCode(email);
    const { user } = verifyLoginCode(email, requestCode.devCode);

    const job = enqueueDailyDigestJob(user.workspaceId, user.id, {
      audience: 'leadership',
      timeWindowLabel: 'Daily',
      deliverToNotion: false,
      notifyInSlack: false,
    });

    expect(job.type).toBe('daily_digest');
    expect(job.summary).toContain('leadership');
    expect(job.handoffLog[0]?.type).toBe('created');

    const jobs = listJobs(user.id);
    expect(jobs.some((entry) => entry.id === job.id && entry.type === 'daily_digest')).toBe(true);
  });

  test('queues a generic workflow run job', () => {
    const email = `workflow-${Date.now()}@example.com`;
    const requestCode = requestLoginCode(email);
    const { user } = verifyLoginCode(email, requestCode.devCode);

    const job = enqueueWorkflowRunJob(user.workspaceId, user.id, {
      title: 'Launch review',
      intent: 'Summarize recent launch work, blockers, and next decisions.',
      deliverToNotion: false,
      notifyInSlack: false,
    });

    expect(job.type).toBe('workflow_run');
    expect(job.summary).toContain('Summarize recent launch work');
    expect(job.handoffLog[0]?.summary).toContain('generic off-shift workflow');
  });
});
