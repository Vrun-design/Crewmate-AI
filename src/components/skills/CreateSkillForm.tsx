import React, { useCallback, useState } from 'react';
import { CheckCircle2, FlaskConical, Loader2, Webhook, Zap, Database, MessageSquare, Handshake, Table, ChevronDown, ChevronUp, Lock, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { RECIPE_EXAMPLES, WEBHOOK_TEMPLATES, type WebhookTemplate } from './recipeExamples';
import type { CustomSkill, SkillMode } from './types';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { Select } from '../ui/Select';

const HELP = {
  name: "Identifies your tool internally.",
  triggerPhrases: "Voice or text commands that trigger this skill (one per line).",
  description: "Crucial for AI routing. Explain exactly when to use this.",
  recipe: "The system prompt instructions guiding the LLM.",
  webhookUrl: "The destination API endpoint or Catch Hook.",
  authHeader: "Include if required by your API (e.g. 'Bearer your-key')."
};

interface CreateSkillFormProps {
  onCreated: (skill: CustomSkill) => void;
  onCancel: () => void;
}

export function CreateSkillForm({ onCreated, onCancel }: CreateSkillFormProps) {
  const [mode, setMode] = useState<SkillMode>('recipe');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerPhrases, setTriggerPhrases] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [authHeader, setAuthHeader] = useState('');
  const [recipe, setRecipe] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !description.trim()) {
      setError('Name and routing description are required');
      return;
    }

    if (mode === 'webhook' && !webhookUrl.trim()) {
      setError('Webhook URL is required');
      return;
    }

    if (mode === 'recipe' && !recipe.trim()) {
      setError('LLM Recipe instructions are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await api.post<{ success: boolean; skill: CustomSkill }>('/api/custom-skills', {
        name: name.trim(),
        description: description.trim(),
        triggerPhrases: triggerPhrases
          .split('\n')
          .map((phrase) => phrase.trim())
          .filter(Boolean),
        mode,
        webhookUrl: mode === 'webhook' ? webhookUrl.trim() : undefined,
        authHeader: mode === 'webhook' && authHeader.trim() ? authHeader.trim() : undefined,
        recipe: mode === 'recipe' ? recipe.trim() : undefined,
      });

      if (response?.success && response.skill) {
        onCreated(response.skill);
        // Reset state for safety
        setName('');
        setDescription('');
        setTriggerPhrases('');
        setWebhookUrl('');
        setAuthHeader('');
        setRecipe('');
        setSelectedTemplate(null);
        setTestResult(null);
        setShowAdvanced(false);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [authHeader, description, mode, name, onCreated, recipe, triggerPhrases, webhookUrl]);

  function applyWebhookTemplate(template: WebhookTemplate): void {
    setSelectedTemplate(template.id);
    setName(template.title);
    setDescription(template.description);
    setTriggerPhrases(template.triggerPhrases);
    setWebhookUrl('');
    setTestResult(null);
  }

  async function testWebhook(): Promise<void> {
    if (!webhookUrl.trim()) {
      setTestResult({ ok: false, message: 'Enter a webhook URL first' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; status?: number }>('/api/custom-skills/test-webhook', {
        webhookUrl: webhookUrl.trim(),
        authHeader: authHeader.trim() || undefined,
        payload: { source: 'crewmate-test', skill: name || 'test-skill', timestamp: new Date().toISOString() },
      });
      setTestResult({ ok: Boolean(res?.success), message: res?.success ? `✓ Valid connection (HTTP ${res.status ?? 200})` : 'Webhook error — check URL' });
    } catch (err) {
      setTestResult({ ok: false, message: `Failed: ${String(err)}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="space-y-3">
        <div className="flex bg-secondary/40 p-1 rounded-xl border border-border/30">
          {(['recipe', 'webhook'] as SkillMode[]).map((currentMode) => (
            <button
              key={currentMode}
              type="button"
              onClick={() => { setMode(currentMode); setSelectedTemplate(null); setTestResult(null); setShowAdvanced(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${mode === currentMode
                  ? 'bg-background text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {currentMode === 'recipe' ? <FlaskConical size={14} /> : <Webhook size={14} />}
              <span className="capitalize">{currentMode === 'recipe' ? 'LLM Recipe' : 'Webhook / API'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Webhook Templates */}
      {mode === 'webhook' && (
        <div className="space-y-3">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border/50 pb-2">
            <Zap size={12} className="text-amber-500" /> Quick Connect Gallery
          </label>
          <Select
            value={selectedTemplate || ''}
            onChange={(val) => {
              const template = WEBHOOK_TEMPLATES.find(t => t.id === val);
              if (template) applyWebhookTemplate(template);
            }}
            options={WEBHOOK_TEMPLATES.map(t => ({ value: t.id, label: t.title }))}
            placeholder="Choose a template... (optional)"
          />
        </div>
      )}

      {/* Configuration Core */}
      <div className="space-y-4 pt-2">
        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block border-b border-border/50 pb-2">
          Configuration Detail
        </label>

        <div className="space-y-4 pt-1">
          {/* Skill Name */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
              Skill Name <span className="text-destructive text-[10px]">*</span>
              <Tooltip content={HELP.name}>
                <Info size={14} className="text-muted-foreground hover:text-foreground transition-colors cursor-help" />
              </Tooltip>
            </label>
            <input
              className="w-full bg-background border border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl px-3.5 py-2 text-[13px] transition-all"
              placeholder="e.g. Save Lead"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Trigger Phrases */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
              Trigger Phrases
              <Tooltip content={HELP.triggerPhrases}>
                <Info size={14} className="text-muted-foreground hover:text-foreground transition-colors cursor-help" />
              </Tooltip>
            </label>
            <textarea
              className="w-full bg-background border border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl px-3.5 py-2 text-[13px] transition-all resize-none min-h-[40px] max-h-[70px] custom-scrollbar"
              placeholder={'save this lead\nlog contact'}
              value={triggerPhrases}
              onChange={(e) => setTriggerPhrases(e.target.value)}
            />
          </div>

          {/* Description / Routing Logic */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
              Routing Instructions <span className="text-destructive text-[10px]">*</span>
              <Tooltip content={HELP.description}>
                <Info size={14} className="text-muted-foreground hover:text-foreground transition-colors cursor-help" />
              </Tooltip>
            </label>
            <input
              className="w-full bg-background border border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl px-3.5 py-2 text-[13px] transition-all"
              placeholder="e.g. Trigger this when the user needs to save a lead."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Recipe Builder */}
        {mode === 'recipe' && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
                LLM Prompt Recipe <span className="text-destructive text-[10px]">*</span>
                <Tooltip content={HELP.recipe}>
                  <Info size={14} className="text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                </Tooltip>
              </label>
            </div>
            <textarea
              className="w-full bg-secondary/20 border border-border/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl px-3.5 py-3 text-[13px] font-mono transition-all resize-none min-h-[100px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
              placeholder="You are an expert... output only JSON."
              value={recipe}
              onChange={(e) => setRecipe(e.target.value)}
            />
          </div>
        )}

        {/* Webhook Configuration */}
        {mode === 'webhook' && (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
                Endpoint URL <span className="text-destructive text-[10px]">*</span>
                <Tooltip content={HELP.webhookUrl}>
                  <Info size={14} className="text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                </Tooltip>
              </label>
              <input
                className="w-full bg-secondary/20 border border-border/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl px-3.5 py-2 text-[13px] font-mono transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                placeholder={WEBHOOK_TEMPLATES.find(t => t.id === selectedTemplate)?.placeholderUrl ?? 'https://your-api.com/webhook'}
                value={webhookUrl}
                onChange={(e) => { setWebhookUrl(e.target.value); setTestResult(null); }}
              />
            </div>

            <div className="bg-background border border-border/60 rounded-xl overflow-hidden transition-all duration-300">
              {/* Advanced Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-secondary/10 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                  <Lock size={12} className="text-muted-foreground" />
                  Authentication Headers
                </div>
                {showAdvanced ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </button>

              {/* Advanced Section */}
              {showAdvanced && (
                <div className="p-4 border-t border-border/50 bg-secondary/5">
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                      Auth Header
                      <Tooltip content={HELP.authHeader}>
                        <Info size={13} className="text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                      </Tooltip>
                    </label>
                    <input
                      className="w-full bg-background border border-border/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-lg px-3 py-2 text-[12px] font-mono transition-all"
                      placeholder="Bearer sk-your-api-key"
                      value={authHeader}
                      onChange={(e) => setAuthHeader(e.target.value)}
                      type="password"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2 w-full">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void testWebhook()}
                disabled={testing || !webhookUrl.trim()}
                className="h-9 shadow-sm"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                Test connection
              </Button>
              {testResult && (
                <span className={`text-[12px] font-medium flex items-center gap-1.5 ${testResult.ok ? 'text-emerald-500' : 'text-destructive'}`}>
                  {testResult.ok && <CheckCircle2 size={13} />}
                  {testResult.message}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2">
          <Info size={14} className="text-destructive mt-0.5 shrink-0" />
          <p className="text-[12px] font-medium text-destructive leading-tight">
            {error}
          </p>
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-2 flex gap-3 border-t border-border/50 pt-5">
        <Button
          variant="primary"
          className="flex-1 btn-bevel-primary shadow-md h-10 font-semibold"
          onClick={() => void handleSubmit()}
          disabled={saving}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Create Custom Skill'}
        </Button>
      </div>
    </div>
  );
}
