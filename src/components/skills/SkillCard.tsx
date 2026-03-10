import React, { useCallback, useState } from 'react';
import { CheckCircle2, FlaskConical, Loader2, Play, Trash2, Webhook, XCircle, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import type { CustomSkill } from './types';

type SkillTestResult = {
  success: boolean;
  output?: unknown;
  message: string;
  durationMs: number;
};

type SkillCardProps = {
  skill: CustomSkill;
  onDelete: (id: string) => void;
};

export function SkillCard({ skill, onDelete }: SkillCardProps): React.JSX.Element {
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await api.post<SkillTestResult>(`/api/custom-skills/${skill.id}/test`, {
        args: { input: testInput },
      });
      setTestResult(response);
    } finally {
      setTesting(false);
    }
  }, [skill.id, testInput]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete skill "${skill.name}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/api/custom-skills/${skill.id}`);
      onDelete(skill.id);
    } finally {
      setDeleting(false);
    }
  }, [onDelete, skill.id, skill.name]);

  const renderedResult =
    typeof testResult?.output === 'string'
      ? testResult.output
      : testResult?.message || JSON.stringify(testResult?.output, null, 2);

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-soft overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-sm ${skill.mode === 'recipe' ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-amber-500/30 bg-amber-500/10'
              }`}
          >
            {skill.mode === 'recipe' ? (
              <FlaskConical size={14} className="text-indigo-400" />
            ) : (
              <Webhook size={14} className="text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <p className="text-[15px] font-semibold tracking-tight text-foreground/90">{skill.name}</p>
              <span
                className={`text-[10px] rounded-full px-2 py-0.5 border font-semibold tracking-wide uppercase ${skill.mode === 'recipe'
                  ? 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10'
                  : 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                  }`}
              >
                {skill.mode === 'recipe' ? 'LLM Recipe' : 'Webhook'}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground mt-1 line-clamp-2">{skill.description}</p>
            {skill.triggerPhrases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {skill.triggerPhrases.slice(0, 3).map((phrase) => (
                  <span key={phrase} className="text-[10px] tracking-wide font-medium bg-secondary/50 border border-border/50 rounded-md px-2 py-0.5 text-muted-foreground shadow-sm">
                    {phrase}
                  </span>
                ))}
                {skill.triggerPhrases.length > 3 && (
                  <span className="text-[10px] font-medium text-muted-foreground/70 py-0.5">+{skill.triggerPhrases.length - 3} more</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[10px] font-mono text-muted-foreground/80 bg-background border border-border/40 rounded px-1.5 py-0.5">
                custom.{skill.id}
              </span>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowTest((current) => !current)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Test this skill"
            >
              <Play size={13} className="text-emerald-400" />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-red-400"
              title="Delete skill"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>
      </div>

      {showTest && (
        <div className="border-t border-border/50 bg-muted/10 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Test this skill</p>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
              placeholder="Enter test input..."
              value={testInput}
              onChange={(event) => setTestInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleTest();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing}
              className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Run
            </button>
          </div>
          {testResult && (
            <div
              className={`rounded-lg border p-3 ${testResult.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {testResult.success ? (
                  <CheckCircle2 size={12} className="text-emerald-400" />
                ) : (
                  <XCircle size={12} className="text-red-400" />
                )}
                <span className="text-xs font-medium">{testResult.success ? 'Success' : 'Failed'}</span>
                <span className="text-[10px] text-muted-foreground">{testResult.durationMs}ms</span>
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto">
                {renderedResult}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
