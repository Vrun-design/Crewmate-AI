import { useEffect, useState } from 'react';
import { jobsService } from '../services/jobsService';
import { useLiveEvents } from './useLiveEvents';
import type { Job } from '../types';

interface UseJobsResult {
  jobs: Job[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createResearchBrief: (input: {
    topic: string;
    goal: string;
    audience: string;
    deliverToNotion: boolean;
    notifyInSlack: boolean;
  }) => Promise<void>;
}

export function useJobs(): UseJobsResult {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const next = await jobsService.list();
      setJobs(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load jobs');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useLiveEvents({
    onJobUpdate: () => {
      void refresh();
    }
  });

  async function createResearchBrief(input: {
    topic: string;
    goal: string;
    audience: string;
    deliverToNotion: boolean;
    notifyInSlack: boolean;
  }): Promise<void> {
    setIsSubmitting(true);
    setError(null);

    try {
      const created = await jobsService.createResearchBrief(input);
      setJobs((current) => [created, ...current]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to queue job');
    } finally {
      setIsSubmitting(false);
    }
  }

  return { jobs, isLoading, isSubmitting, error, refresh, createResearchBrief };
}
