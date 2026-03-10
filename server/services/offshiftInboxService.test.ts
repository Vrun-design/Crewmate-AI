import { describe, expect, test } from 'vitest';
import { requestLoginCode, verifyLoginCode } from './authService';
import { enqueueResearchBriefJob } from './delegationService';
import { listOffshiftWorkItems } from './offshiftInboxService';

describe('offshiftInboxService', () => {
  test('maps queued jobs into off-shift work items without breaking legacy jobs', () => {
    const email = `offshift-${Date.now()}@example.com`;
    const requestCode = requestLoginCode(email);
    const { user } = verifyLoginCode(email, requestCode.devCode);

    const job = enqueueResearchBriefJob(user.workspaceId, user.id, {
      topic: 'Crewmate competitors',
      goal: 'Summarize the landscape',
      audience: 'founders',
      deliverToNotion: false,
      notifyInSlack: false,
    });

    const items = listOffshiftWorkItems(user.id);
    const item = items.find((entry) => entry.id === job.id);

    expect(item).toMatchObject({
      id: job.id,
      startedFrom: 'delegation',
      startedFromLabel: 'Off-Shift',
      approvalStatus: 'not_required',
      deliveryChannels: [],
      artifactRefs: [],
    });
    expect(item?.handoffLog[0]?.type).toBe('created');
  });
});
