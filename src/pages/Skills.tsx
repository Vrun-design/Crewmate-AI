import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Code2, MessageSquare, Search, Wand2, LayoutGrid, BarChart3, Globe,
  Clock, Zap, Plus, Cpu
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { CreateSkillForm } from '../components/skills/CreateSkillForm';
import { useSkills } from '../hooks/useSkills';
import type { CustomSkill } from '../components/skills/types';
import { api } from '../lib/api';

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  code: { icon: <Code2 size={14} />, label: 'Code', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  communication: { icon: <MessageSquare size={14} />, label: 'Communication', color: 'bg-primary/10 text-primary border-primary/20' },
  research: { icon: <Search size={14} />, label: 'Research', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  creative: { icon: <Wand2 size={14} />, label: 'Creative', color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
  productivity: { icon: <LayoutGrid size={14} />, label: 'Productivity', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  data: { icon: <BarChart3 size={14} />, label: 'Data', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  browser: { icon: <Globe size={14} />, label: 'Browser', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  custom: { icon: <Cpu size={14} />, label: 'My Skills', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
};

const ALL_CATEGORIES = ['all', ...Object.keys(CATEGORY_META)];

export function Skills() {
  const { skills: systemSkills, isLoading: sysLoading, error } = useSkills();
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([]);
  const [customSkillsError, setCustomSkillsError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<(typeof systemSkills)[0] | CustomSkill | null>(null);

  useEffect(() => {
    void api.get<CustomSkill[]>('/api/custom-skills')
      .then((data) => {
        setCustomSkills(data ?? []);
      })
      .catch((loadError) => {
        setCustomSkills([]);
        setCustomSkillsError(loadError instanceof Error ? loadError.message : 'Unable to load custom skills');
      });
  }, []);

  const isLoading = sysLoading;
  const allSkills = [
    ...systemSkills,
    ...customSkills.map((cs) => ({
      ...cs,
      category: 'custom',
      requiresIntegration: cs.mode === 'webhook' ? ['Webhook'] : ['LLM'],
      triggerPhrases: cs.triggerPhrases ?? [],
    })),
  ];

  const filtered = selectedCategory === 'all'
    ? allSkills
    : allSkills.filter((s) => s.category === selectedCategory);

  function handleCreateFinished(skill: CustomSkill) {
    setCustomSkills((prev) => [skill, ...prev]);
    setIsCreateOpen(false);
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
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Skills Hub"
        description={`${allSkills.length} unified skills. Enable discrete agent capabilities to handle complex routing workflows.`}
      >
        <Button variant="primary" className="btn-bevel btn-bevel-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          New Skill
        </Button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {customSkillsError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
          Custom skills are temporarily unavailable. System skills are still ready to use.
        </div>
      )}

      {allSkills.length === 0 && !isLoading && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Zap size={20} className="text-muted-foreground" />
          </div>
          <div className="text-sm font-medium text-foreground mb-2">No skills registered yet</div>
          <div className="text-sm text-muted-foreground max-w-xs mx-auto">
            Skills are registered server-side or built securely. Click New Skill to get started.
          </div>
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
                  : 'bg-card text-muted-foreground border-border hover:border-muted-foreground/50 hover:text-foreground'
                  }`}
              >
                {meta?.icon}
                {meta?.label ?? 'All Skills'}
                {cat !== 'all' && (
                  <span className="opacity-60">
                    {allSkills.filter((s) => s.category === cat).length}
                  </span>
                )}
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
              onClick={() => setSelectedSkill(skill)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedSkill(skill);
                }
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
                    <div className="font-semibold text-[14.5px] text-foreground truncate flex items-center gap-2">
                      {skill.name}
                    </div>
                    <p className="text-[13px] text-muted-foreground truncate max-w-[180px] sm:max-w-[240px] md:max-w-xs xl:max-w-sm mt-0.5">{skill.description}</p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {skill.category}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Drawer isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Custom Skill">
        <div className="pb-4">
          <CreateSkillForm onCreated={handleCreateFinished} onCancel={() => setIsCreateOpen(false)} />
        </div>
      </Drawer>

      <Drawer
        isOpen={selectedSkill !== null}
        onClose={() => setSelectedSkill(null)}
        title="Skill Information"
      >
        {selectedSkill && (() => {
          const detailSkill = selectedSkill as typeof allSkills[0];
          return (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{detailSkill.name}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_META[detailSkill.category]?.color ?? 'bg-secondary text-muted-foreground border-border'}`}>
                    {CATEGORY_META[detailSkill.category]?.icon}
                    {CATEGORY_META[detailSkill.category]?.label ?? detailSkill.category}
                  </span>
                  {detailSkill.requiresIntegration && detailSkill.requiresIntegration.map((int) => (
                    <span key={int} className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                      {int}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                <div className="text-sm text-foreground bg-secondary/50 border border-border rounded-xl p-4 leading-relaxed">
                  {detailSkill.description}
                </div>
              </div>

              {detailSkill.triggerPhrases && detailSkill.triggerPhrases.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={12} /> Default Activation Phrases
                  </label>
                  <div className="space-y-1.5">
                    {detailSkill.triggerPhrases.map((phrase) => (
                      <div key={phrase} className="text-[13px] text-primary bg-primary/5 hover:bg-primary/10 transition-colors border border-primary/20 rounded-lg px-3 py-2 cursor-copy font-medium font-mono">
                        "{phrase}"
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      </Drawer>
    </div>
  );
}
