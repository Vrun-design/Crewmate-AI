export type LiveTaskCueStatus = 'running' | 'completed' | 'failed';

export interface LiveTaskCue {
  title: string;
  status: LiveTaskCueStatus;
  summary?: string | null;
}
