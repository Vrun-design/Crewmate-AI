/**
 * Skill Builder — Phase 13 (Custom Skill UI)
 *
 * No-code interface to create your own skills in two modes:
 * - Webhook: Point to your own API endpoint
 * - LLM Recipe: Describe what you want the AI to do in natural language
 *
 * Skills created here are registered in the skill registry instantly and
 * are available to all 14 crew agents as tools.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    Plus, Webhook, FlaskConical, Trash2, Play, ChevronDown, ChevronUp,
    CheckCircle2, XCircle, Loader2, Zap, Code2, BookOpen, ArrowRight,
    Copy, ExternalLink,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomSkill {
    id: string;
    userId: string;
    name: string;
    description: string;
    triggerPhrases: string[];
    mode: 'webhook' | 'recipe';
    webhookUrl?: string;
    authHeader?: string;
    recipe?: string;
    createdAt: string;
}

type Mode = 'webhook' | 'recipe';

const RECIPE_EXAMPLES = [
    {
        title: 'Translate to Spanish',
        recipe: 'You are a professional translator. Translate the input text to Spanish. Output only the translation, nothing else.',
    },
    {
        title: 'Summarize in 3 bullets',
        recipe: 'Summarize the following text in exactly 3 bullet points. Be concise. Start each bullet with •',
    },
    {
        title: 'Write a cold email',
        recipe: 'You are a sales expert. Write a personalized cold outreach email based on the input. Include SUBJECT: and BODY: sections. Keep it under 150 words.',
    },
    {
        title: 'Generate SQL query',
        recipe: 'You are a SQL expert. Write an efficient SQL SELECT query based on the user\'s description. Return only the SQL query inside a ```sql code block. Explain briefly after.',
    },
    {
        title: 'Action items from notes',
        recipe: 'Extract action items from the notes below. Format as a numbered list. Prefix each item with "→". Add assignee if mentioned.',
    },
];

// ── Create form component ─────────────────────────────────────────────────────

const CreateSkillForm: React.FC<{ onCreated: (skill: CustomSkill) => void }> = ({ onCreated }) => {
    const [mode, setMode] = useState<Mode>('recipe');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [triggerPhrases, setTriggerPhrases] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [authHeader, setAuthHeader] = useState('');
    const [recipe, setRecipe] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(true);

    const handleSubmit = useCallback(async () => {
        if (!name.trim() || !description.trim()) { setError('Name and description are required'); return; }
        if (mode === 'webhook' && !webhookUrl.trim()) { setError('Webhook URL is required'); return; }
        if (mode === 'recipe' && !recipe.trim()) { setError('Recipe instructions are required'); return; }

        setSaving(true);
        setError('');
        try {
            const res = await api.post<{ success: boolean; skill: CustomSkill }>('/api/custom-skills', {
                name: name.trim(),
                description: description.trim(),
                triggerPhrases: triggerPhrases.split('\n').map((s) => s.trim()).filter(Boolean),
                mode,
                webhookUrl: mode === 'webhook' ? webhookUrl.trim() : undefined,
                authHeader: mode === 'webhook' && authHeader.trim() ? authHeader.trim() : undefined,
                recipe: mode === 'recipe' ? recipe.trim() : undefined,
            });
            if (res?.success && res.skill) {
                onCreated(res.skill);
                setName(''); setDescription(''); setTriggerPhrases(''); setWebhookUrl(''); setAuthHeader(''); setRecipe('');
                setOpen(false);
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setSaving(false);
        }
    }, [mode, name, description, triggerPhrases, webhookUrl, authHeader, recipe, onCreated]);

    return (
        <div className="rounded-xl border border-foreground/20 bg-card/50 overflow-hidden">
            {/* Header */}
            <button
                type="button"
                className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-foreground/10 border border-foreground/20 flex items-center justify-center">
                        <Plus size={16} className="text-foreground" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold">Create a New Skill</p>
                        <p className="text-xs text-muted-foreground">Webhook or LLM Recipe — instantly available to all 14 crew agents</p>
                    </div>
                </div>
                {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>

            {open && (
                <div className="border-t border-border p-5 space-y-5">
                    {/* Mode selector */}
                    <div className="grid grid-cols-2 gap-3">
                        {(['recipe', 'webhook'] as Mode[]).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`p-3.5 rounded-xl border text-left transition-all ${mode === m
                                        ? 'border-foreground/40 bg-foreground/5 shadow-sm'
                                        : 'border-border bg-card/30 hover:border-foreground/20'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    {m === 'recipe'
                                        ? <FlaskConical size={15} className={mode === m ? 'text-indigo-400' : 'text-muted-foreground'} />
                                        : <Webhook size={15} className={mode === m ? 'text-amber-400' : 'text-muted-foreground'} />
                                    }
                                    <span className="text-sm font-medium capitalize">{m === 'recipe' ? 'LLM Recipe' : 'Webhook'}</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {m === 'recipe'
                                        ? 'Describe what you want AI to do in natural language. No code needed.'
                                        : 'Connect to your own API endpoint. Crewmate calls it with args and uses the response.'}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* Basic info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Skill Name *</label>
                            <input
                                id="skill-name-input"
                                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
                                placeholder="e.g. Translate to Spanish"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Trigger Phrases (one per line)</label>
                            <textarea
                                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30 resize-none h-[60px]"
                                placeholder="translate to Spanish&#10;translate this&#10;en español"
                                value={triggerPhrases}
                                onChange={(e) => setTriggerPhrases(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Description * (shown to agents to understand when to use this skill)</label>
                        <input
                            id="skill-description-input"
                            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
                            placeholder="e.g. Translates any text to Spanish. Use when the user wants Spanish translation."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Mode-specific fields */}
                    {mode === 'recipe' && (
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-medium text-muted-foreground">LLM Recipe Instructions *</label>
                                <div className="flex gap-1.5 flex-wrap justify-end">
                                    {RECIPE_EXAMPLES.map((ex) => (
                                        <button
                                            key={ex.title}
                                            type="button"
                                            onClick={() => { setName(ex.title); setRecipe(ex.recipe); setDescription(`Custom skill: ${ex.title}`); }}
                                            className="text-[10px] text-muted-foreground border border-border rounded-full px-2.5 py-1 hover:border-foreground/30 hover:text-foreground transition-all flex items-center gap-1"
                                        >
                                            <ArrowRight size={8} />
                                            {ex.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <textarea
                                id="skill-recipe-input"
                                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30 resize-none font-mono"
                                rows={5}
                                placeholder="You are a professional translator. When given text, translate it to Spanish. Output only the translation."
                                value={recipe}
                                onChange={(e) => setRecipe(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                                💡 Tip: Write this as you would a system prompt. The user's input + any args will be appended automatically.
                            </p>
                        </div>
                    )}

                    {mode === 'webhook' && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Webhook URL *</label>
                                <input
                                    id="skill-webhook-url-input"
                                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-foreground/30"
                                    placeholder="https://your-api.com/webhook"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Crewmate will POST <code className="bg-muted rounded px-1">{'{"args": {...}}'}</code> to this URL. Expects JSON response.
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Auth Header (optional)</label>
                                <input
                                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-foreground/30"
                                    placeholder="Bearer sk-your-api-key"
                                    value={authHeader}
                                    onChange={(e) => setAuthHeader(e.target.value)}
                                    type="password"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <button
                        id="create-skill-btn"
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-foreground text-background rounded-xl py-2.5 text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {saving ? 'Creating...' : 'Create Skill'}
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Skill card component ──────────────────────────────────────────────────────

const SkillCard: React.FC<{ skill: CustomSkill; onDelete: (id: string) => void }> = ({ skill, onDelete }) => {
    const [testing, setTesting] = useState(false);
    const [testInput, setTestInput] = useState('');
    const [testResult, setTestResult] = useState<{ success: boolean; output?: unknown; message: string; durationMs: number } | null>(null);
    const [showTest, setShowTest] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleTest = useCallback(async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await api.post<{ success: boolean; output?: unknown; message: string; durationMs: number }>(
                `/api/custom-skills/${skill.id}/test`,
                { args: { input: testInput } }
            );
            setTestResult(res);
        } finally {
            setTesting(false);
        }
    }, [skill.id, testInput]);

    const handleDelete = useCallback(async () => {
        if (!confirm(`Delete skill "${skill.name}"?`)) return;
        setDeleting(true);
        try {
            await api.delete(`/api/custom-skills/${skill.id}`);
            onDelete(skill.id);
        } finally {
            setDeleting(false);
        }
    }, [skill.id, skill.name, onDelete]);

    return (
        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${skill.mode === 'recipe'
                            ? 'border-indigo-500/30 bg-indigo-500/10'
                            : 'border-amber-500/30 bg-amber-500/10'
                        }`}>
                        {skill.mode === 'recipe'
                            ? <FlaskConical size={14} className="text-indigo-400" />
                            : <Webhook size={14} className="text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{skill.name}</p>
                            <span className={`text-[10px] rounded-full px-2 py-0.5 border font-medium ${skill.mode === 'recipe'
                                    ? 'text-indigo-400 border-indigo-500/30 bg-indigo-500/5'
                                    : 'text-amber-400 border-amber-500/30 bg-amber-500/5'
                                }`}>
                                {skill.mode === 'recipe' ? 'LLM Recipe' : 'Webhook'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.description}</p>
                        {skill.triggerPhrases.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {skill.triggerPhrases.slice(0, 3).map((p) => (
                                    <span key={p} className="text-[10px] bg-secondary rounded px-1.5 py-0.5 text-muted-foreground">{p}</span>
                                ))}
                                {skill.triggerPhrases.length > 3 && <span className="text-[10px] text-muted-foreground">+{skill.triggerPhrases.length - 3} more</span>}
                            </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-mono text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                                custom.{skill.id}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowTest(!showTest)}
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

            {/* Test panel */}
            {showTest && (
                <div className="border-t border-border/50 bg-muted/10 p-4 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">Test this skill</p>
                    <div className="flex gap-2">
                        <input
                            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
                            placeholder="Enter test input..."
                            value={testInput}
                            onChange={(e) => setTestInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') void handleTest(); }}
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
                        <div className={`rounded-lg border p-3 ${testResult.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {testResult.success
                                    ? <CheckCircle2 size={12} className="text-emerald-400" />
                                    : <XCircle size={12} className="text-red-400" />}
                                <span className="text-xs font-medium">{testResult.success ? 'Success' : 'Failed'}</span>
                                <span className="text-[10px] text-muted-foreground">{testResult.durationMs}ms</span>
                            </div>
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto">
                                {typeof testResult.output === 'string'
                                    ? testResult.output
                                    : (testResult.message || JSON.stringify(testResult.output, null, 2))}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export function SkillBuilder(): React.JSX.Element {
    const [skills, setSkills] = useState<CustomSkill[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void api.get<CustomSkill[]>('/api/custom-skills').then((data) => {
            setSkills(data ?? []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const handleCreated = useCallback((skill: CustomSkill) => {
        setSkills((prev) => [skill, ...prev]);
    }, []);

    const handleDelete = useCallback((id: string) => {
        setSkills((prev) => prev.filter((s) => s.id !== id));
    }, []);

    return (
        <div className="flex flex-col h-full">
            <PageHeader
                title="Skill Builder"
                description={`${skills.length} custom skill${skills.length !== 1 ? 's' : ''} · instantly available to all 14 agents`}
            />

            <div className="flex-1 overflow-auto">
                <div className="max-w-3xl mx-auto px-6 pb-16 space-y-6 mt-2">

                    {/* Info banner */}
                    <div className="rounded-xl border border-border bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-transparent p-4 flex items-start gap-4">
                        <div className="flex-shrink-0 mt-0.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <Code2 size={16} className="text-indigo-400" />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-semibold mb-1">Build Your Own Skills</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Skills you create here are registered instantly and used by all 14 crew agents.
                                Use <strong>LLM Recipe</strong> for AI-powered tasks (no code needed) or
                                <strong> Webhook</strong> to connect to your own APIs.
                            </p>
                            <div className="flex gap-3 mt-2">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <FlaskConical size={11} className="text-indigo-400" />
                                    LLM Recipe — Describe it in English
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Webhook size={11} className="text-amber-400" />
                                    Webhook — Connect your own API
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Create form */}
                    <CreateSkillForm onCreated={handleCreated} />

                    {/* Skill list */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Your Custom Skills</h3>
                            {skills.length > 0 && (
                                <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2.5 py-1">{skills.length} skills</span>
                            )}
                        </div>

                        {loading && (
                            <div className="text-center py-8">
                                <Loader2 size={20} className="mx-auto animate-spin text-muted-foreground opacity-40" />
                            </div>
                        )}

                        {!loading && skills.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                                <FlaskConical size={28} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No custom skills yet.</p>
                                <p className="text-xs mt-1">Create your first skill above — it takes 30 seconds.</p>
                            </div>
                        )}

                        {skills.map((skill) => (
                            <SkillCard key={skill.id} skill={skill} onDelete={handleDelete} />
                        ))}
                    </div>

                    {/* Docs callout */}
                    {skills.length > 0 && (
                        <div className="rounded-xl border border-border bg-card/30 p-4 flex items-center gap-3">
                            <BookOpen size={16} className="text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium">Using custom skills</p>
                                <p className="text-xs text-muted-foreground">
                                    Say or type your trigger phrase in Live Session, or dispatch from Agents tab.
                                    Agents automatically pick up your skills based on their description.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
