import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Brain, Search, RefreshCw, Zap, BookOpen, Star, WandSparkles, Plus, Link as LinkIcon, FileText, Loader2, Upload
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { api } from '../lib/api';
import type { MemoryNode } from '../types';

interface MemoryNodeExtended extends MemoryNode {
  personaId?: string;
  source?: string;
  createdAt?: string;
}

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'live_turn', label: 'Live Sessions' },
  { value: 'skill_run', label: 'Skill Runs' },
  { value: 'agent_task', label: 'Agent Tasks' },
  { value: 'manual', label: 'Manual Notes' },
];

const MEMORY_STATS = [
  { label: 'Total Memories', icon: Brain, color: 'text-primary' },
  { label: 'Active', icon: Zap, color: 'text-emerald-500' },
  { label: 'Context', icon: WandSparkles, color: 'text-violet-500' },
] as const;

function useMemoryNodes(searchQuery: string, personaFilter: string, sourceFilter: string) {
  const [nodes, setNodes] = useState<MemoryNodeExtended[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNodes = useCallback(async (q: string, persona: string, source: string) => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (q) {
        params.set('q', q);
      }
      if (persona) {
        params.set('personaId', persona);
      }
      if (source) {
        params.set('source', source);
      }

      const data = await api.get<MemoryNodeExtended[]>(`/api/memory?${params.toString()}`);
      setNodes(data ?? []);
    } catch {
      setNodes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void fetchNodes(searchQuery, personaFilter, sourceFilter);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [fetchNodes, personaFilter, searchQuery, sourceFilter]);

  const refresh = useCallback(() => {
    void fetchNodes(searchQuery, personaFilter, sourceFilter);
  }, [fetchNodes, personaFilter, searchQuery, sourceFilter]);

  return { nodes, isLoading, refresh };
}

const SOURCE_STYLES: Record<string, { label: string; className: string }> = {
  live_turn: { label: 'Live', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  skill_run: { label: 'Skill', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  agent_task: { label: 'Agent', className: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
  manual: { label: 'Manual', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  integration: { label: 'Integration', className: 'bg-primary/10 text-primary border-primary/20' },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  core: <Brain size={12} className="text-blue-400" />,
  preference: <Star size={12} className="text-amber-400" />,
  skill: <Zap size={12} className="text-green-400" />,
  document: <BookOpen size={12} className="text-purple-400" />,
  persona: <WandSparkles size={12} className="text-pink-400" />,
};

function formatDate(dateStr?: string): string {
  if (!dateStr) {
    return '';
  }

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / 3600000;

    if (diffHours < 1) {
      return `${Math.floor(diffHours * 60)}m ago`;
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    }
    if (diffHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

interface MemoryCardProps {
  node: MemoryNodeExtended;
  onToggle: (id: string, current: boolean) => void;
}

function MemoryCard({ node, onToggle }: MemoryCardProps): React.JSX.Element {
  const sourceStyle = SOURCE_STYLES[node.source ?? 'live_turn'] ?? SOURCE_STYLES.live_turn;

  return (
    <div
      className={`group rounded-xl border p-4 transition-all ${node.active
        ? 'border-border bg-card hover:border-foreground/20'
        : 'border-border/40 bg-card/40 opacity-50'
        }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {TYPE_ICON[node.type] ?? <Brain size={12} className="text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">{node.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${sourceStyle.className}`}>
              {sourceStyle.label}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground capitalize">
              {node.type}
            </span>
            {node.personaId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                {node.personaId}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{node.tokens}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(node.createdAt)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(node.id, node.active)}
          className={`mt-0.5 h-4 w-8 shrink-0 rounded-full transition-colors ${node.active ? 'bg-primary' : 'border border-border bg-secondary'}`}
          title={node.active ? 'Deactivate' : 'Activate'}
        >
          <div className={`mx-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${node.active ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  );
}

function getTokenCountLabel(nodes: MemoryNodeExtended[]): string {
  const totalTokens = nodes.reduce((sum, node) => {
    const normalizedValue = parseFloat(node.tokens?.replace('k', '') ?? '0');
    return sum + (Number.isNaN(normalizedValue) ? 0 : normalizedValue);
  }, 0);

  return `${totalTokens.toFixed(1)}k`;
}

export function MemoryBase(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [personaFilter, setPersonaFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const { nodes, isLoading, refresh } = useMemoryNodes(searchQuery, personaFilter, sourceFilter);

  // Add Memory State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<'note' | 'links' | 'files'>('note');
  const [addTitle, setAddTitle] = useState('');
  const [addContent, setAddContent] = useState('');
  const [addFiles, setAddFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddSubmit() {
    if (isSubmitting) return;
    if (addTab !== 'files' && !addTitle.trim() && !addContent.trim()) return;
    if (addTab === 'files' && addFiles.length === 0) return;

    setIsSubmitting(true);
    try {
      if (addTab === 'files') {
        await Promise.all(
          addFiles.map((f) =>
            api.post('/api/memory/ingest', {
              title: addTitle.trim() ? `${addTitle.trim()} - ${f.name}` : f.name,
              type: 'document',
            })
          )
        );
      } else if (addTab === 'links') {
        const urls = addContent.split('\n').map((u) => u.trim()).filter(Boolean);
        if (urls.length === 0 && addTitle.trim()) {
          await api.post('/api/memory/ingest', { title: addTitle.trim(), type: 'document' });
        } else {
          await Promise.all(
            urls.map((url) =>
              api.post('/api/memory/ingest', {
                title: addTitle.trim() ? `${addTitle.trim()} (${url})` : url,
                type: 'document',
              })
            )
          );
        }
      } else {
        await api.post('/api/memory/ingest', {
          title: addTitle.trim() + (addContent.trim() ? `\n\n${addContent.trim()}` : ''),
          type: 'manual',
        });
      }

      setIsAddOpen(false);
      setAddTitle('');
      setAddContent('');
      setAddFiles([]);
      refresh();
    } catch {
      // Ignored for now
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    try {
      await api.patch(`/api/memory/${id}`, { active: !currentActive });
      refresh();
    } catch {
    }
  }

  const activeCount = nodes.filter((n) => n.active).length;
  const statValues = {
    'Total Memories': nodes.length,
    Active: activeCount,
    Context: getTokenCountLabel(nodes),
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Memory Base"
        description="Persistent agent memory — semantic search, persona awareness, and timeline view."
      >
        <Button variant="primary" className="btn-bevel btn-bevel-primary" onClick={() => setIsAddOpen(true)}>
          <Plus size={16} />
          Add Memory
        </Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        {MEMORY_STATS.map(({ label, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center">
              <Icon size={16} className={color} />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{statValues[label]}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memory…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
          />
        </div>

        <Select
          value={sourceFilter}
          onChange={setSourceFilter}
          options={SOURCE_OPTIONS}
          placeholder="All Sources"
        />

        <button
          type="button"
          onClick={refresh}
          className="p-2 rounded-xl border border-border bg-secondary hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading && nodes.length === 0 ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse border border-border" />
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center">
            <Brain size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No memories yet</p>
          <p className="text-xs text-muted-foreground">Start a live session to build your first memory nodes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <MemoryCard key={node.id} node={node} onToggle={(id, cur) => void handleToggle(id, cur)} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <span className="text-xs text-muted-foreground">Sources:</span>
        {Object.entries(SOURCE_STYLES).map(([key, { label, className }]) => (
          <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full border ${className}`}>{label}</span>
        ))}
      </div>

      <Drawer isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add to Memory">
        <div className="space-y-5">
          <div className="flex bg-secondary p-1 rounded-lg">
            {(['note', 'links', 'files'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAddTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${addTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {tab === 'note' && <FileText size={14} />}
                {tab === 'links' && <LinkIcon size={14} />}
                {tab === 'files' && <Upload size={14} />}
                <span className="capitalize">{tab}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {addTab === 'links' ? 'Group Title (Optional)' : addTab === 'files' ? 'Batch Title (Optional)' : 'Note Title'}
            </label>
            <input
              type="text"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder={addTab === 'links' ? 'e.g., References' : addTab === 'files' ? 'e.g., Q3 Planning' : 'e.g., User feedback'}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {addTab === 'links' ? 'URLs (one per line)' : addTab === 'files' ? 'Upload Files' : 'Content (optional)'}
            </label>
            {addTab === 'files' ? (
              <input
                type="file"
                multiple
                onChange={(e) => setAddFiles(Array.from(e.target.files ?? []))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            ) : addTab === 'links' ? (
              <textarea
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                placeholder="https://...&#10;https://..."
                rows={5}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground resize-none"
              />
            ) : (
              <textarea
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                placeholder="Write your note..."
                rows={5}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground resize-none"
              />
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => void handleAddSubmit()}
              disabled={isSubmitting || (addTab === 'files' ? addFiles.length === 0 : !addTitle.trim() && !addContent.trim())}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save Memory'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
