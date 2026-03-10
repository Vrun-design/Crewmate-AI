import { ChangeEvent, useMemo, useState } from 'react';
import { FileText, Loader2, UploadCloud } from 'lucide-react';
import { Button } from '../ui/Button';
import { StepShell } from './StepShell';
import { workspaceService } from '../../services/workspaceService';

type ManualSetupStepProps = {
  onNext: () => void;
};

type StarterMemoryInput = {
  title: string;
  searchText: string;
};

const SUPPORTED_FILE_EXTENSIONS = '.txt,.md,.markdown,.json,.csv';

function normalizeFileToMemory(file: File): Promise<StarterMemoryInput | null> {
  return file.text().then((content) => {
    const searchText = content.trim();
    if (!searchText) {
      return null;
    }

    return {
      title: file.name,
      searchText,
    };
  });
}

export function ManualSetupStep({ onNext }: ManualSetupStepProps): React.JSX.Element {
  const [title, setTitle] = useState('Workspace brief');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileLabel = useMemo(() => {
    if (files.length === 0) {
      return 'Upload text, markdown, CSV, or JSON files';
    }

    return `${files.length} file${files.length > 1 ? 's' : ''} ready`;
  }, [files]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    setFiles(Array.from(event.target.files ?? []));
  }

  async function handleContinue(): Promise<void> {
    const trimmedNotes = notes.trim();
    const hasStarterContext = trimmedNotes.length > 0 || files.length > 0;

    if (!hasStarterContext) {
      onNext();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const memoryEntries: StarterMemoryInput[] = [];

      if (trimmedNotes) {
        memoryEntries.push({
          title: title.trim() || 'Workspace brief',
          searchText: trimmedNotes,
        });
      }

      const uploadedEntries = await Promise.all(files.map((file) => normalizeFileToMemory(file)));
      memoryEntries.push(...uploadedEntries.filter((entry): entry is StarterMemoryInput => entry !== null));

      for (const entry of memoryEntries) {
        await workspaceService.ingestMemory({
          title: entry.title,
          type: 'document',
          searchText: entry.searchText,
        });
      }

      onNext();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save starter context');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <StepShell className="w-full max-w-5xl space-y-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Add starter context</h1>
        <p className="text-muted-foreground">Upload a few memory docs or paste a workspace brief. Skip this if you want to start with a blank memory base.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-6 shadow-xl shadow-black/5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Memory title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Checkout revamp brief"
              className="w-full rounded-lg border border-border bg-background/50 px-4 py-3 text-sm text-foreground transition-all focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Paste starter context</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Paste a project summary, spec excerpt, or operating instructions here..."
              rows={10}
              className="w-full resize-none rounded-lg border border-border bg-background/50 px-4 py-3 text-sm text-foreground transition-all focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-6 shadow-xl shadow-black/5">
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Upload memory docs</div>
            <p className="text-sm text-muted-foreground">Supported now: plain text, markdown, CSV, and JSON. Each uploaded file is ingested as a separate memory node.</p>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/40 px-6 py-10 text-center transition-colors hover:border-foreground/40 hover:bg-background/60">
            <UploadCloud size={28} className="text-muted-foreground" />
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">{fileLabel}</div>
              <div className="text-xs text-muted-foreground">{SUPPORTED_FILE_EXTENSIONS}</div>
            </div>
            <input
              type="file"
              multiple
              accept={SUPPORTED_FILE_EXTENSIONS}
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.name} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground">
                  <FileText size={14} className="text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onNext} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Skip for now
        </button>
        <Button variant="primary" onClick={() => void handleContinue()} disabled={isSubmitting} className="px-8 py-5 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
          Continue to integrations
        </Button>
      </div>
    </StepShell>
  );
}
