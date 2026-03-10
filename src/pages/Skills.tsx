import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Code2, MessageSquare, Search, Wand2, LayoutGrid, BarChart3, Globe,
  Play, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { useSkills } from '../hooks/useSkills';

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  code: { icon: <Code2 size={14} />, label: 'Code', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  communication: { icon: <MessageSquare size={14} />, label: 'Communication', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  research: { icon: <Search size={14} />, label: 'Research', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  creative: { icon: <Wand2 size={14} />, label: 'Creative', color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
  productivity: { icon: <LayoutGrid size={14} />, label: 'Productivity', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  data: { icon: <BarChart3 size={14} />, label: 'Data', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  browser: { icon: <Globe size={14} />, label: 'Browser', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
};

const ALL_CATEGORIES = ['all', ...Object.keys(CATEGORY_META)];

export function Skills() {
  const { skills, isLoading, error, runSkill } = useSkills();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<Record<string, { success: boolean; message?: string }>>({});

  const filtered = selectedCategory === 'all'
    ? skills
    : skills.filter((s) => s.category === selectedCategory);

  async function handleRun(skillId: string) {
    setRunningId(skillId);
    try {
      const result = await runSkill(skillId, {});
      setRunResults((prev) => ({ ...prev, [skillId]: result }));
    } catch (err) {
      setRunResults((prev) => ({
        ...prev,
        [skillId]: { success: false, message: err instanceof Error ? err.message : 'Failed' },
      }));
    } finally {
      setRunningId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Skills Hub" description="Loading available skills..." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills Hub"
        description={`${skills.length} skills available. Each skill is a discrete, executable capability your agent can run.`}
      />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {skills.length === 0 && !isLoading && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Zap size={20} className="text-muted-foreground" />
          </div>
          <div className="text-sm font-medium text-foreground mb-2">No skills registered yet</div>
          <div className="text-sm text-muted-foreground max-w-xs mx-auto">
            Skills are registered server-side. Add integrations in Settings to unlock skills.
          </div>
        </div>
      )}

      {/* Category filter */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-muted-foreground border-border hover:border-muted-foreground/50 hover:text-foreground'
                  }`}
              >
                {meta?.icon}
                {meta?.label ?? 'All Skills'}
                {cat !== 'all' && (
                  <span className="opacity-60">
                    {skills.filter((s) => s.category === cat).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Skill cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((skill) => {
          const catMeta = CATEGORY_META[skill.category];
          const isExpanded = expandedId === skill.id;
          const runResult = runResults[skill.id];
          const isRunning = runningId === skill.id;

          return (
            <motion.div
              key={skill.id}
              layout
              className="bg-card border border-border rounded-2xl overflow-hidden hover:border-muted-foreground/40 transition-colors"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${catMeta?.color ?? 'bg-secondary text-muted-foreground border-border'}`}>
                        {catMeta?.icon}
                        {catMeta?.label ?? skill.category}
                      </span>
                      {skill.requiresIntegration.map((int) => (
                        <span key={int} className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                          {int}
                        </span>
                      ))}
                    </div>
                    <div className="font-medium text-foreground text-sm">{skill.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRun(skill.id)}
                    disabled={isRunning}
                    title={`Run ${skill.name}`}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl bg-foreground/5 border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-foreground hover:text-background transition-all disabled:opacity-50"
                  >
                    {isRunning ? (
                      <div className="w-3 h-3 rounded-full border-2 border-foreground/30 border-t-foreground animate-spin" />
                    ) : (
                      <Play size={12} />
                    )}
                    {isRunning ? 'Running' : 'Run'}
                  </button>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{skill.description}</p>

                {/* Run result */}
                {runResult && (
                  <div className={`rounded-xl px-3 py-2.5 flex items-start gap-2 text-xs ${runResult.success
                      ? 'bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-500'
                    }`}>
                    {runResult.success ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> : <AlertCircle size={12} className="mt-0.5 shrink-0" />}
                    <span>{runResult.message ?? (runResult.success ? 'Completed successfully' : 'Run failed')}</span>
                  </div>
                )}
              </div>

              {/* Expandable trigger phrases */}
              {skill.triggerPhrases.length > 0 && (
                <div className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                    className="w-full flex items-center justify-between px-5 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Clock size={11} />
                      Example voice commands
                    </div>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 space-y-1.5">
                        {skill.triggerPhrases.map((phrase) => (
                          <div key={phrase} className="text-xs text-muted-foreground font-mono bg-secondary/50 border border-border rounded-lg px-3 py-2">
                            "{phrase}"
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
