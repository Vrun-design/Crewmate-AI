import {api} from '../lib/api';
import type {Job} from '../types';

interface ResearchBriefInput {
  topic: string;
  goal: string;
  audience: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
}

interface WorkflowRunInput {
  title: string;
  intent: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
}

export const jobsService = {
  list(): Promise<Job[]> {
    return api.get('/api/jobs');
  },
  createResearchBrief(input: ResearchBriefInput): Promise<Job> {
    return api.post('/api/jobs/research-brief', input);
  },
  createWorkflowRun(input: WorkflowRunInput): Promise<Job> {
    return api.post('/api/jobs/workflow-run', input);
  },
};
