import { api } from '../lib/api';
import type { WorkflowTemplate } from '../types';

interface WorkflowTemplateInput {
  name: string;
  description: string;
  intent: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
}

export const workflowTemplateService = {
  list(): Promise<WorkflowTemplate[]> {
    return api.get('/api/workflow-templates');
  },
  create(input: WorkflowTemplateInput): Promise<WorkflowTemplate> {
    return api.post('/api/workflow-templates', input);
  },
  delete(id: string): Promise<{ success: boolean }> {
    return api.delete(`/api/workflow-templates/${id}`);
  },
};
