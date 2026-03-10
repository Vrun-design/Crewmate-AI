import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Brain, Search, RefreshCw, Clock, Tag, Filter,
  ChevronDown, Zap, BookOpen, Star, Trash2, Plus, Sparkles
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../lib/api';
import type { MemoryNode } from '../types';

// ── Extended type with Phase 8 fields ─────────────────────────────────────────

interface MemoryNodeExtended extends MemoryNode {
  personaId?: string;
  source?: string;
  createdAt?: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useMemoryNodes(searchQuery: string, personaFilter: string, sourceFilter: string) {
  const [nodes, setNodes] = useState<MemoryNodeExtended[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = useCallback(async (q: string, persona: string, source: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (persona) params.set('personaId', persona);
      if (source) params.set('source', source);
      const data = await api.get<MemoryNodeExtended[]>(`/api/memory?${params.toString()}`);
      setNodes(data ?? []);
    } catch {
      setNodes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetch(searchQuery, personaFilter, sourceFilter);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, personaFilter, sourceFilter, fetch]);

  const refresh = () => void fetch(searchQuery, personaFilter, sourceFilter);
  return { nodes, isLoading, refresh };
}

// ── Source badge ──────────────────────────────────────────────────────────────

const SOURCE_STYLES: Record<string, { label: string; className: string }> = {
  live_turn: { label: 'Live', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  skill_run: { label: 'Skill', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  agent_task: { label: 'Agent', className: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
  manual: { label: 'Manual', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  integration: { label: 'Integration', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  core: <Brain size={12} className="text-blue-400" />,
  preference: <Star size={12} className="text-amber-400" />,
  skill: <Zap size={12} className="text-green-400" />,
  document: <BookOpen size={12} className="text-purple-400" />,
  persona: <Sparkles size={12} className="text-pink-400" />,
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 1) return `${Math.floor(diffH * 60)}m ago`;
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    if (diffH < 168) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// ── Memory Card ───────────────────────────────────────────────────────────────

const MemoryCard: React.FC<{ node: MemoryNodeExtended; onToggle: (id: string, current: boolean) => void }> = ({ node, onToggle }) => {
  const sourceStyle = SOURCE_STYLES[node.source ?? 'live_turn'] ?? SOURCE_STYLES.live_turn;

  return (
    <div className={`group rounded-xl border p-4 transition-all ${node.active
      ? 'border-border bg-card hover:border-foreground/20'
      : 'border-border/40 bg-card/40 opacity-50'
      }`}>
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
          onClick={() => onToggle(node.id, node.active)}
          className={`shrink-0 mt-0.5 w-8 h-4 rounded-full transition-colors ${node.active ? 'bg-primary' : 'bg-secondary border border-border'
            }`}
          title={node.active ? 'Deactivate' : 'Activate'}
        >
          <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${node.active ? 'translate-x-4' : 'translate-x-0'
            }`} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const SOURCES = [
  { value: '', label: 'All Sources' },
  { value: 'live_turn', label: 'Live Sessions' },
  { value: 'skill_run', label: 'Skill Runs' },
  { value: 'agent_task', label: 'Agent Tasks' },
  { value: 'manual', label: 'Manual Notes' },
];

export function MemoryBase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [personaFilter, setPersonaFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const { nodes, isLoading, refresh } = useMemoryNodes(searchQuery, personaFilter, sourceFilter);

  async function handleToggle(id: string, currentActive: boolean) {
    // Optimistic update via API
    try {
      await api.patch(`/api/memory/${id}`, { active: !currentActive });
      refresh();
    } catch {
      // no-op
    }
  }

  const activeCount = nodes.filter((n) => n.active).length;
  const totalTokens = nodes.reduce((acc, n) => {
    const k = parseFloat(n.tokens?.replace('k', '') ?? '0');
    return acc + (isNaN(k) ? 0 : k);
  }, 0);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Memory Base"
        description="Persistent agent memory — semantic search, persona awareness, and timeline view."
      />

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Memories', value: nodes.length, icon: Brain, color: 'text-blue-500' },
          { label: 'Active', value: activeCount, icon: Zap, color: 'text-green-500' },
          { label: 'Context', value: `${totalTokens.toFixed(1)}k`, icon: Sparkles, color: 'text-violet-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center">
              <Icon size={16} className={color} />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
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

        <div className="relative">
          <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="pl-8 pr-6 py-2 rounded-xl border border-border bg-secondary text-sm text-foreground focus:outline-none focus:border-ring appearance-none"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        <button
          onClick={refresh}
          className="p-2 rounded-xl border border-border bg-secondary hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Memory timeline */}
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

      {/* Source legend */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <span className="text-xs text-muted-foreground">Sources:</span>
        {Object.entries(SOURCE_STYLES).map(([key, { label, className }]) => (
          <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full border ${className}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}
