import { describe, expect, test } from 'vitest';
import { requestLoginCode, verifyLoginCode } from './authService';
import { createWorkflowTemplate, deleteWorkflowTemplate, listWorkflowTemplates } from './workflowTemplateService';

describe('workflowTemplateService', () => {
  test('creates, lists, and deletes workflow templates per user', () => {
    const email = `template-${Date.now()}@example.com`;
    const requestCode = requestLoginCode(email);
    const { user } = verifyLoginCode(email, requestCode.devCode);

    const created = createWorkflowTemplate({
      userId: user.id,
      name: 'Launch review',
      description: 'Summarize launch progress and blockers.',
      intent: 'Review launch progress and surface blockers.',
      deliverToNotion: true,
      notifyInSlack: false,
    });

    const templates = listWorkflowTemplates(user.id);
    expect(templates.some((template) => template.id === created.id && template.name === 'Launch review')).toBe(true);

    expect(deleteWorkflowTemplate(created.id, user.id)).toBe(true);
    expect(listWorkflowTemplates(user.id).some((template) => template.id === created.id)).toBe(false);
  });
});
