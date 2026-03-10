import { useCallback, useEffect, useState } from 'react';
import { workflowTemplateService } from '../services/workflowTemplateService';
import type { WorkflowTemplate } from '../types';

interface UseWorkflowTemplatesResult {
  templates: WorkflowTemplate[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  createTemplate: (input: {
    name: string;
    description: string;
    intent: string;
    deliverToNotion: boolean;
    notifyInSlack: boolean;
  }) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

export function useWorkflowTemplates(enabled: boolean): UseWorkflowTemplatesResult {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled) {
      setTemplates([]);
      setIsLoading(false);
      return;
    }

    try {
      const payload = await workflowTemplateService.list();
      setTemplates(payload);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workflow templates');
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTemplate = useCallback(async (input: {
    name: string;
    description: string;
    intent: string;
    deliverToNotion: boolean;
    notifyInSlack: boolean;
  }) => {
    setIsSaving(true);
    try {
      const created = await workflowTemplateService.create(input);
      setTemplates((current) => [created, ...current]);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save workflow template');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    setIsSaving(true);
    try {
      await workflowTemplateService.delete(id);
      setTemplates((current) => current.filter((template) => template.id !== id));
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete workflow template');
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { templates, isLoading, isSaving, error, createTemplate, deleteTemplate };
}
