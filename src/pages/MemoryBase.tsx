import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain, Clock3, FileText, Link as LinkIcon, Loader2, Plus, RefreshCw, Search, Sparkles, ExternalLink, Activity, Trash2, AlertTriangle
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { Select } from '../components/ui/Select';
import { api } from '../lib/api';
import { getUserFacingErrorMessage } from '../utils/errorHandling';

type MemoryKind = 'session' | 'knowledge' | 'artifact';
type MemorySource = 'live_turn' | 'skill_run' | 'agent_task' | 'manual' | 'integration' | 'meeting' | 'system';

interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  sourceType: MemorySource;
  title: string;
  summary?: string | null;
  contentText?: string | null;
  artifactUrl?: string | null;
  tokens: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MemoryOverview {
  recentContext: MemoryRecord[];
  knowledge: MemoryRecord[];
  artifacts: MemoryRecord[];
  totals: {
    recentContext: number;
    knowledge: number;
    artifacts: number;
    active: number;
  };
}

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'live_turn', label: 'Live Sessions' },
  { value: 'skill_run', label: 'Skill Runs' },
  { value: 'agent_task', label: 'Agent Tasks' },
  { value: 'integration', label: 'Integrations' },
  { value: 'manual', label: 'Manual' },
];

const KIND_META: Record<MemoryKind, { label: string; icon: typeof Clock3; colorClass: string }> = {
  session: { label: 'Context', icon: Clock3, colorClass: 'text-blue-500 bg-blue-500/10' },
  knowledge: { label: 'Knowledge', icon: Brain, colorClass: 'text-purple-500 bg-purple-500/10' },
  artifact: { label: 'Artifact', icon: LinkIcon, colorClass: 'text-emerald-500 bg-emerald-500/10' },
};

const EMPTY_TOTALS = { recentContext: 0, knowledge: 0, artifacts: 0, active: 0 };
const TAB_OPTIONS: Array<{ id: TabFilter; label: string }> = [
  { id: 'all', label: 'All Memory' },
  { id: 'session', label: 'Context' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'artifact', label: 'Artifacts' },
];
const TOP_STATS = [
  { label: 'Active Memories', key: 'active', icon: Activity, color: 'text-emerald-500' },
  { label: 'Recent Context', key: 'recentContext', icon: Clock3, color: 'text-blue-500' },
  { label: 'Knowledge Base', key: 'knowledge', icon: Brain, color: 'text-purple-500' },
  { label: 'Linked Artifacts', key: 'artifacts', icon: LinkIcon, color: 'text-amber-500' },
] as const;

function getRecordPreview(record: MemoryRecord): string {
  return record.summary || record.contentText || 'No preview available';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / 3600000;
    if (diffHours < 1) return `${Math.max(1, Math.floor(diffHours * 60))}m ago`;
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function useMemoryOverview(searchQuery: string, sourceFilter: string) {
  const [overview, setOverview] = useState<MemoryOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOverview = useCallback(async (q: string, source: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (source) params.set('source', source);
      const data = await api.get<MemoryOverview>(`/api/memory?${params.toString()}`);
      setOverview(data);
      setError(null);
    } catch (loadError) {
      setOverview(null);
      setError(getUserFacingErrorMessage(loadError, 'Unable to load memory right now'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchOverview(searchQuery, sourceFilter);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchOverview, searchQuery, sourceFilter]);

  const refresh = useCallback(() => void fetchOverview(searchQuery, sourceFilter), [fetchOverview, searchQuery, sourceFilter]);

  return { overview, isLoading, error, refresh };
}

type TabFilter = 'all' | MemoryKind;

export function MemoryBase(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [createKind, setCreateKind] = useState<'knowledge' | 'artifact'>('knowledge');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedRecord, setSelectedRecord] = useState<MemoryRecord | null>(null);

  const { overview, isLoading, error, refresh } = useMemoryOverview(searchQuery, sourceFilter);

  async function handleToggle(id: string, currentActive: boolean, event?: React.MouseEvent) {
    event?.stopPropagation();
    try {
      await api.patch(`/api/memory/${id}`, { active: !currentActive });
      if (selectedRecord?.id === id) {
        setSelectedRecord({ ...selectedRecord, active: !currentActive });
      }
      await refresh();
    } catch (toggleError) {
      console.error('Unable to update memory state', toggleError);
    }
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/memory/${id}`);
      setSelectedRecord(null);
      setConfirmDeleteId(null);
      await refresh();
    } catch (deleteError) {
      console.error('Unable to delete memory record', deleteError);
    }
  }

  async function handleSubmit() {
    if (isSubmitting || !title.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post('/api/memory/ingest', {
        title: title.trim(),
        kind: createKind,
        type: createKind === 'artifact' ? 'integration' : 'preference',
        searchText: summary.trim(),
        url: createKind === 'artifact' ? url.trim() : '',
      });
      setTitle('');
      setSummary('');
      setUrl('');
      setIsAddOpen(false);
      await refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const totals = overview?.totals ?? EMPTY_TOTALS;

  const flattenedRecords = useMemo(() => {
    if (!overview) return [];
    let all = [...overview.recentContext, ...overview.knowledge, ...overview.artifacts];
    if (activeTab !== 'all') {
      all = all.filter((record) => record.kind === activeTab);
    }
    return all.sort((firstRecord, secondRecord) => (
      new Date(secondRecord.updatedAt || secondRecord.createdAt).getTime()
      - new Date(firstRecord.updatedAt || firstRecord.createdAt).getTime()
    ));
  }, [overview, activeTab]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Memory"
        description="Persistent context, durable knowledge, and artifacts that Crewmate can recall automatically."
      >
        <Button variant="primary" className="btn-bevel btn-bevel-primary" onClick={() => setIsAddOpen(true)}>
          <Plus size={16} />
          Add Memory
        </Button>
      </PageHeader>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {TOP_STATS.map((stat) => (
          <div key={stat.key} className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4 transition-all hover:border-border/80">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">{totals[stat.key]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {error ? (
          <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="secondary" onClick={refresh}>Retry</Button>
            </div>
          </div>
        ) : null}

        {/* Filters Top Bar */}
        <div className="border-b border-border p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-secondary/30">
          
          {/* Segmented Tabs */}
          <div className="flex bg-secondary p-1 rounded-xl border border-border">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabFilter)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories..."
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="w-40">
              <Select value={sourceFilter} onChange={setSourceFilter} options={SOURCE_OPTIONS} placeholder="All Sources" />
            </div>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center justify-center rounded-xl border border-border bg-background px-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Refresh table"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="font-medium px-6 py-3 w-10 text-center">Type</th>
                <th className="font-medium px-6 py-3">Title & Source</th>
                <th className="font-medium px-6 py-3 w-full hidden md:table-cell">Preview</th>
                <th className="font-medium px-6 py-3 text-right">
                  <span title="Approximate token size. Larger values consume more context in live sessions.">Size</span>
                </th>
                <th className="font-medium px-6 py-3 text-right">Updated</th>
                <th className="font-medium px-6 py-3 text-right">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading && flattenedRecords.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-4 bg-border rounded-full mx-auto" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-48 bg-border rounded" /></td>
                    <td className="px-6 py-4 hidden md:table-cell"><div className="h-4 w-full max-w-md bg-border rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-12 bg-border rounded ml-auto" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-border rounded ml-auto" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-8 bg-border rounded-full ml-auto" /></td>
                  </tr>
                ))
              ) : flattenedRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Brain className="h-10 w-10 opacity-20" />
                        <p>No memories found matching your criteria.</p>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSearchQuery('');
                            setSourceFilter('');
                            setActiveTab('all');
                          }}
                        >
                          Clear Filters
                        </Button>
                      </div>
                    </td>
                </tr>
              ) : (
                flattenedRecords.map((record) => {
                  const meta = KIND_META[record.kind];
                  const Icon = meta.icon;
                  return (
                    <tr 
                      key={record.id} 
                      onClick={() => setSelectedRecord(record)}
                      className={`group cursor-pointer transition-colors hover:bg-secondary/40 ${!record.active ? 'opacity-50 hover:opacity-100 grayscale hover:grayscale-0' : ''}`}
                    >
                      <td className="px-6 py-4 text-center align-middle">
                        <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg ${meta.colorClass}`}>
                          <Icon size={14} />
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate">
                        <div className="font-medium text-foreground truncate">{record.title}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 border border-border/50">
                          {record.sourceType.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden max-w-[300px] truncate text-muted-foreground md:table-cell">
                        {getRecordPreview(record)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex rounded-full bg-secondary border border-border/50 px-2 py-0.5 text-xs text-muted-foreground">
                          {record.tokens}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground tabular-nums">
                        {formatDate(record.updatedAt || record.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right align-middle">
                        <button
                          type="button"
                          onClick={(e) => handleToggle(record.id, record.active, e)}
                          className={`inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${record.active ? 'bg-primary' : 'bg-secondary border-border/50'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${record.active ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep-Dive Details Drawer */}
      <Drawer isOpen={!!selectedRecord} onClose={() => setSelectedRecord(null)} title="Memory Details">
        {selectedRecord && (
          <div className="space-y-6">
            
            {/* Header Block */}
            <div className="space-y-3 pb-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border text-foreground`}>
                  {(() => {
                    const SelectedIcon = KIND_META[selectedRecord.kind].icon;
                    return <SelectedIcon size={18} />;
                  })()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground leading-tight">{selectedRecord.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 rounded bg-secondary border border-border px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {selectedRecord.sourceType.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock3 size={10} /> {formatDate(selectedRecord.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-secondary/50 p-4">
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${selectedRecord.active ? 'text-primary' : 'text-muted-foreground'}`}>
                    {selectedRecord.active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggle(selectedRecord.id, selectedRecord.active)}
                    className={`inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors ${selectedRecord.active ? 'bg-primary' : 'bg-secondary border border-border'}`}
                  >
                    <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${selectedRecord.active ? 'translate-x-3.5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-secondary/50 p-4">
                <div className="text-xs text-muted-foreground mb-1" title="Approximate token size. Larger values consume more context in live sessions.">Size (tokens)</div>
                <div className="text-sm font-medium text-foreground">{selectedRecord.tokens}</div>
              </div>
            </div>

            {/* Content Payload */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Content</h4>
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {selectedRecord.summary || selectedRecord.contentText || 'No content available.'}
                </p>
              </div>
            </div>

            {/* Artifact Link Button */}
            {selectedRecord.artifactUrl && (
              <div className="pt-2">
                <a
                  href={selectedRecord.artifactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors py-3 px-4 text-sm font-medium"
                >
                  Open External Artifact
                  <ExternalLink size={16} />
                </a>
              </div>
            )}

            {/* Delete */}
            <div className="pt-2 border-t border-border/50">
              {confirmDeleteId === selectedRecord.id ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                    <AlertTriangle size={15} />
                    Permanently delete this memory?
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDelete(selectedRecord.id)}
                      className="flex-1 rounded-lg bg-destructive text-destructive-foreground py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 rounded-lg border border-border bg-secondary py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(selectedRecord.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 text-destructive py-2.5 text-sm font-medium hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete Memory
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Add Memory Drawer */}
      <Drawer isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Manual Memory">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary p-1 border border-border">
            <button
              type="button"
              onClick={() => setCreateKind('knowledge')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${createKind === 'knowledge' ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <span className="inline-flex items-center gap-2"><Sparkles size={14} /> Knowledge</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateKind('artifact')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${createKind === 'artifact' ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <span className="inline-flex items-center gap-2"><LinkIcon size={14} /> Artifact</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={createKind === 'artifact' ? 'Q1 Revenue Model' : 'User prefers dark mode'}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">{createKind === 'artifact' ? 'Context' : 'Summary'}</label>
              <span className={`text-xs ${summary.length > 5000 ? 'text-amber-500' : 'text-muted-foreground'}`}>{summary.length}/6000</span>
            </div>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={8}
              maxLength={6000}
              placeholder={createKind === 'artifact'
                ? 'Why this artifact matters and how to find it.'
                : 'Write the context you want Crewmate to recall — facts, decisions, preferences, background. Up to ~1000 words.'}
              className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {createKind === 'artifact' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">URL</label>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border/50">
            <Button variant="primary" className="flex-1" onClick={() => void handleSubmit()} disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save Core Memory'}
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
