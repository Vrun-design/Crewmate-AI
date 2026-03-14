import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Code2, MessageSquare, Search, LayoutGrid, BarChart3, Globe,
  Clock, Zap, ArrowRight, CheckCircle2, Loader2, AlertCircle, Workflow,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Drawer } from '../components/ui/Drawer';
import { Button } from '../components/ui/Button';
import { useSkills } from '../hooks/useSkills';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { api } from '../lib/api';

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  code: { icon: <Code2 size={14} />, label: 'Code', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  communication: { icon: <MessageSquare size={14} />, label: 'Communication', color: 'bg-primary/10 text-primary border-primary/20' },
  research: { icon: <Search size={14} />, label: 'Research', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  productivity: { icon: <LayoutGrid size={14} />, label: 'Productivity', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  data: { icon: <BarChart3 size={14} />, label: 'Data', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  browser: { icon: <Globe size={14} />, label: 'Browser', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  automation: { icon: <Workflow size={14} />, label: 'Automation', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

const ALL_CATEGORIES = ['all', ...Object.keys(CATEGORY_META)];

type TryItStatus = 'idle' | 'loading' | 'success' | 'error';

function getSkillExamplePhrases(skill: {
  usageExamples?: string[];
  triggerPhrases?: string[];
}): string[] {
  if ((skill.usageExamples?.length ?? 0) > 0) {
    return skill.usageExamples ?? [];
  }

  if ((skill.triggerPhrases?.length ?? 0) > 0) {
    return skill.triggerPhrases ?? [];
  }

  return [];
}

export function Skills() {
  const { skills: systemSkills, isLoading: sysLoading, error } = useSkills();
  const { flags, isLoading: isFlagsLoading } = useFeatureFlags();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState<(typeof systemSkills)[0] | null>(null);

  const [tryItPrompt, setTryItPrompt] = useState('');
  const [tryItStatus, setTryItStatus] = useState<TryItStatus>('idle');
  const [tryItResult, setTryItResult] = useState<string | null>(null);
  const [tryItTaskId, setTryItTaskId] = useState<string | null>(null);

  const allSkills = systemSkills;
  const filtered = selectedCategory === 'all' ? allSkills : allSkills.filter((s) => s.category === selectedCategory);

  async function handleTryIt(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const prompt = tryItPrompt.trim();
    if (!prompt || tryItStatus === 'loading') return;

    setTryItStatus('loading');
    setTryItResult(null);
    setTryItTaskId(null);

    try {
      const res = await api.post<{ taskId?: string; result?: unknown; message?: string }>('/api/orchestrate', { intent: prompt });
      if (res?.taskId) {
        setTryItTaskId(res.taskId);
        setTryItResult(`Task dispatched! Track it in the Tasks page.\nID: ${res.taskId}`);
      } else if (res?.result) {
        setTryItResult(typeof res.result === 'string' ? res.result : JSON.stringify(res.result, null, 2));
      } else {
        setTryItResult(typeof res?.message === 'string' ? res.message : 'Done — no result body returned.');
      }
      setTryItStatus('success');
    } catch (err) {
      setTryItResult(err instanceof Error ? err.message : 'An error occurred.');
      setTryItStatus('error');
    }
  }

  function handleSelectSkill(skill: (typeof systemSkills)[0]): void {
    const examplePhrases = getSkillExamplePhrases(skill);
    setSelectedSkill(skill);
    setTryItPrompt(examplePhrases[0] ?? `Use ${skill.name} to `);
    setTryItStatus('idle');
    setTryItResult(null);
    setTryItTaskId(null);
  }

  if (sysLoading) {
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

  if (!isFlagsLoading && !flags.skillsHub) {
    return (
      <div className="space-y-6 pb-10">
        <PageHeader
          title="Skills Hub"
          description="This internal tool surface is disabled in the current environment to keep the demo path tighter and more reliable."
        />

        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Zap size={20} className="text-muted-foreground" />
          </div>
          <div className="mb-2 text-sm font-medium text-foreground">Skills Hub is disabled here</div>
          <div className="mx-auto max-w-lg text-sm text-muted-foreground">
            Re-enable `FEATURE_SKILLS_HUB` if you want to inspect the internal skill catalog in this environment.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Skills Hub"
        description={`${allSkills.length} unified skills — click any to explore and run it directly.`}
      />

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {allSkills.length === 0 && !sysLoading && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Zap size={20} className="text-muted-foreground" />
          </div>
          <div className="text-sm font-medium text-foreground mb-2">No skills registered yet</div>
          <div className="text-sm text-muted-foreground max-w-xs mx-auto">Skills are registered server-side and appear here automatically.</div>
        </div>
      )}

      {allSkills.length > 0 && (
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
                  : 'bg-card text-muted-foreground border-border hover:border-muted-foreground/50 hover:text-foreground'}`}
              >
                {meta?.icon}
                {meta?.label ?? 'All Skills'}
                {cat !== 'all' && <span className="opacity-60">{allSkills.filter((s) => s.category === cat).length}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((skill) => {
          const catMeta = CATEGORY_META[skill.category];
          return (
            <motion.div
              key={skill.id}
              layout
              onClick={() => handleSelectSkill(skill)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSelectSkill(skill); }
              }}
              role="button"
              tabIndex={0}
              className="bg-card text-left cursor-pointer border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-all shadow-sm group"
            >
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl ${catMeta?.color ?? 'bg-secondary text-muted-foreground border border-border'}`}>
                    {catMeta ? React.cloneElement(catMeta.icon as React.ReactElement<{ size: number }>, { size: 18 }) : <Zap size={18} />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14.5px] text-foreground truncate">{skill.name}</div>
                    <p className="text-[13px] text-muted-foreground truncate max-w-[180px] sm:max-w-[240px] md:max-w-xs xl:max-w-sm mt-0.5">{skill.description}</p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{skill.category}</span>
                  <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Drawer
        isOpen={selectedSkill !== null}
        onClose={() => { setSelectedSkill(null); setTryItStatus('idle'); setTryItResult(null); }}
        title="Skill Details"
      >
        {selectedSkill && (() => {
          const s = selectedSkill;
          const examplePhrases = getSkillExamplePhrases(s);
          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{s.name}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_META[s.category]?.color ?? 'bg-secondary text-muted-foreground border-border'}`}>
                    {CATEGORY_META[s.category]?.icon}
                    {CATEGORY_META[s.category]?.label ?? s.category}
                  </span>
                  {s.requiresIntegration?.map((int) => (
                    <span key={int} className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">{int}</span>
                  ))}
                  {s.exposeInLiveSession && (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 uppercase tracking-wider">Live Ready</span>
                  )}
                  {s.readOnlyHint && (
                    <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-400 uppercase tracking-wider">Read Only</span>
                  )}
                  {s.destructiveHint && (
                    <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 uppercase tracking-wider">Writes Data</span>
                  )}
                </div>
              </div>

              {/* Runtime metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="uppercase tracking-wider text-[10px] mb-1">Execution</div>
                  <div className="text-foreground">{s.executionMode ?? 'n/a'} · {s.latencyClass ?? 'n/a'}</div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="uppercase tracking-wider text-[10px] mb-1">Model</div>
                  <div className="text-foreground">{s.preferredModel ?? 'n/a'}</div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                <div className="text-sm text-foreground bg-secondary/50 border border-border rounded-xl p-4 leading-relaxed">{s.description}</div>
              </div>

              {s.invokingMessage && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Runtime Status</label>
                  <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-foreground">
                    <div>Starts with: {s.invokingMessage}</div>
                    <div className="mt-1 text-muted-foreground">Default completion: {s.invokedMessage ?? `${s.name} completed.`}</div>
                  </div>
                </div>
              )}

              {/* Examples — clickable to pre-fill */}
              {examplePhrases.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={12} /> Example Requests
                  </label>
                  <div className="space-y-1.5">
                    {examplePhrases.map((phrase) => (
                      <button
                        key={phrase}
                        type="button"
                        onClick={() => setTryItPrompt(phrase)}
                        className="w-full text-left text-[13px] text-primary bg-primary/5 hover:bg-primary/10 transition-colors border border-primary/20 rounded-lg px-3 py-2 font-medium font-mono"
                      >
                        "{phrase}"
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Try It Live */}
              <div className="space-y-3 rounded-2xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Send To Orchestrator</span>
                </div>
                <p className="text-xs text-muted-foreground">Send a prompt to the orchestrator. It may choose this skill or a different route based on the intent.</p>

                <form onSubmit={(e) => void handleTryIt(e)} className="space-y-2">
                  <textarea
                    value={tryItPrompt}
                    onChange={(e) => setTryItPrompt(e.target.value)}
                    placeholder={`e.g. "${examplePhrases[0] ?? `Use ${s.name} to...`}"`}
                    rows={3}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full flex items-center justify-center gap-2"
                    disabled={!tryItPrompt.trim() || tryItStatus === 'loading'}
                  >
                    {tryItStatus === 'loading' ? (
                      <><Loader2 size={14} className="animate-spin" />Running...</>
                    ) : (
                      <><Zap size={14} />Dispatch Prompt</>
                    )}
                  </Button>
                </form>

                {tryItResult && (
                  <div className={`rounded-xl border p-3 ${tryItStatus === 'error' ? 'border-destructive/30 bg-destructive/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
                    <div className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${tryItStatus === 'error' ? 'text-destructive' : 'text-emerald-400'}`}>
                      {tryItStatus === 'error' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                      {tryItStatus === 'error' ? 'Error' : tryItTaskId ? 'Task dispatched' : 'Result'}
                    </div>
                    <pre className="text-xs text-foreground/80 whitespace-pre-wrap break-words font-mono leading-relaxed">{tryItResult}</pre>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}
