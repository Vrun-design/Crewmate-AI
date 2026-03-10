import { randomUUID } from 'node:crypto';
import { db } from '../db';

export interface WorkflowTemplateRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  intent: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapWorkflowTemplate(row: Record<string, unknown>): WorkflowTemplateRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    description: String(row.description),
    intent: String(row.intent),
    deliverToNotion: Boolean(row.deliver_to_notion),
    notifyInSlack: Boolean(row.notify_in_slack),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listWorkflowTemplates(userId: string): WorkflowTemplateRecord[] {
  const rows = db.prepare(`
    SELECT *
    FROM workflow_templates
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(userId) as Record<string, unknown>[];

  return rows.map(mapWorkflowTemplate);
}

export function createWorkflowTemplate(input: {
  userId: string;
  name: string;
  description: string;
  intent: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
}): WorkflowTemplateRecord {
  const now = new Date().toISOString();
  const record: WorkflowTemplateRecord = {
    id: `wft_${randomUUID()}`,
    userId: input.userId,
    name: input.name.trim(),
    description: input.description.trim(),
    intent: input.intent.trim(),
    deliverToNotion: input.deliverToNotion,
    notifyInSlack: input.notifyInSlack,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO workflow_templates (
      id,
      user_id,
      name,
      description,
      intent,
      deliver_to_notion,
      notify_in_slack,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.userId,
    record.name,
    record.description,
    record.intent,
    record.deliverToNotion ? 1 : 0,
    record.notifyInSlack ? 1 : 0,
    record.createdAt,
    record.updatedAt,
  );

  return record;
}

export function deleteWorkflowTemplate(id: string, userId: string): boolean {
  const result = db.prepare(`
    DELETE FROM workflow_templates
    WHERE id = ? AND user_id = ?
  `).run(id, userId);

  return result.changes > 0;
}
