import React from 'react';
import { CopyPlus, Trash2 } from 'lucide-react';
import { EmptyStateCard } from '../shared/EmptyStateCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import type { WorkflowTemplate } from '../../types';

interface WorkflowTemplatePanelProps {
  templates: WorkflowTemplate[];
  isLoading: boolean;
  isSaving: boolean;
  onApply: (template: WorkflowTemplate) => void;
  onDelete: (id: string) => void;
}

export function WorkflowTemplatePanel({
  templates,
  isLoading,
  isSaving,
  onApply,
  onDelete,
}: WorkflowTemplatePanelProps): React.JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-foreground">Workflow templates</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Save reusable off-shift instructions, then apply them back into the queue form with one click.
            </div>
          </div>
          <Badge variant="info">{templates.length} saved</Badge>
        </div>

        {isLoading ? (
          <div className="py-8 text-sm text-muted-foreground">Loading saved templates...</div>
        ) : templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{template.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{template.description}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onApply(template)}>
                      <CopyPlus size={14} />
                      Apply
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void onDelete(template.id)} disabled={isSaving}>
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyStateCard
            title="No templates yet"
            description="Save any off-shift workflow below as a reusable template instead of retyping the same intent every time."
          />
        )}
      </CardContent>
    </Card>
  );
}
