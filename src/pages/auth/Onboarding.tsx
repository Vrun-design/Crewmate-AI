import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, FileText, Mic, Settings2, ShieldCheck, Sparkles, Volume2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useIntegrations } from '../../hooks/useIntegrations';
import { onboardingService } from '../../services/onboardingService';
import { workspaceService } from '../../services/workspaceService';

interface StepOneProps {
  agentName: string;
  setAgentName: React.Dispatch<React.SetStateAction<string>>;
  voice: string;
  setVoice: React.Dispatch<React.SetStateAction<string>>;
  onNext: () => void;
}

interface StepTwoProps {
  onManual: () => void;
  onVoice: () => void;
}

interface StepThreeProps {
  agentName: string;
  voice: string;
  onComplete: () => void;
}

interface StepManualUploadProps {
  onComplete: () => void;
}

export function Onboarding() {
  const [step, setStep] = useState(1);
  const [agentName, setAgentName] = useState('Crewmate');
  const [voice, setVoice] = useState('alex');
  const navigate = useNavigate();

  function completeOnboarding(): void {
    navigate('/dashboard');
  }

  function handleStartGuidedSetup(): void {
    onboardingService.queueGuidedSetup({ agentName, voiceModel: voice });
    completeOnboarding();
  }

  function handleFinishManualSetup(): void {
    onboardingService.saveProfile({ agentName, voiceModel: voice });
    completeOnboarding();
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-foreground/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-foreground opacity-[0.03] blur-[100px]"></div>

      <div className="h-[2px] w-full bg-secondary fixed top-0 left-0 z-50">
        <motion.div
          className="h-full bg-foreground"
          initial={{ width: '0%' }}
          animate={{ width: `${(Math.min(step, 3) / 3) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <StepOne
              agentName={agentName}
              setAgentName={setAgentName}
              voice={voice}
              setVoice={setVoice}
              onNext={() => setStep(2)}
            />
          ) : null}

          {step === 2 ? (
            <StepTwo
              onManual={() => setStep(4)}
              onVoice={() => setStep(3)}
            />
          ) : null}

          {step === 3 ? (
            <StepThree
              agentName={agentName}
              voice={voice}
              onComplete={handleStartGuidedSetup}
            />
          ) : null}

          {step === 4 ? (
            <StepManualUpload
              onComplete={handleFinishManualSetup}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepOne({ agentName, setAgentName, voice, setVoice, onNext }: StepOneProps) {
  const voices = [
    { id: 'alex', name: 'Alex', desc: 'Professional and clear' },
    { id: 'taylor', name: 'Taylor', desc: 'Warm and empathetic' },
    { id: 'sam', name: 'Sam', desc: 'Direct and concise' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-xl space-y-10"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Create your agent</h1>
        <p className="text-muted-foreground">Set the identity Crewmate should use when it talks, summarizes, and asks for permission.</p>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/5 space-y-8">
        <div className="space-y-3">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Agent Name</label>
          <input
            type="text"
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
            className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition-all shadow-sm"
          />
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Voice Personality</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {voices.map((voiceOption) => (
              <button
                type="button"
                key={voiceOption.id}
                onClick={() => setVoice(voiceOption.id)}
                className={`p-4 rounded-xl border text-left transition-all duration-200 relative overflow-hidden ${
                  voice === voiceOption.id
                    ? 'border-foreground bg-foreground/5 shadow-sm'
                    : 'border-border bg-background/50 hover:border-muted-foreground/50'
                }`}
              >
                {voice === voiceOption.id ? (
                  <motion.div layoutId="voice-active" className="absolute inset-0 border-2 border-foreground rounded-xl pointer-events-none" />
                ) : null}
                <div className="flex items-center justify-between mb-1 relative z-10">
                  <div className="font-medium text-sm text-foreground">{voiceOption.name}</div>
                  {voice === voiceOption.id ? <CheckCircle2 size={16} className="text-foreground" /> : null}
                </div>
                <div className="text-xs text-muted-foreground relative z-10">{voiceOption.desc}</div>
                <div className="mt-4 text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground relative z-10 uppercase tracking-wider">
                  <Volume2 size={12} />
                  Voice preview next
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={onNext} className="px-8 py-5 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
          Continue
        </Button>
      </div>
    </motion.div>
  );
}

function StepTwo({ onManual, onVoice }: StepTwoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl space-y-10"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Choose setup method</h1>
        <p className="text-muted-foreground">Pick the path that matches how much you want to configure right now.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onVoice}
          className="group relative p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-xl hover:border-foreground transition-all duration-300 shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-black/10 flex flex-col h-full overflow-hidden text-left"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="space-y-6 flex-1 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-foreground to-foreground/80 text-background flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_8px_20px_rgba(0,0,0,0.1)]">
              <Mic size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-medium tracking-tight">Guided Live Setup</h3>
                <span className="px-2 py-0.5 rounded-full bg-foreground/10 text-foreground text-[10px] font-semibold tracking-widest uppercase border border-foreground/20 flex items-center gap-1">
                  <Sparkles size={10} />
                  Real-time
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Start a real Gemini Live session from the dashboard. Crewmate will ask onboarding questions and summarize what still needs manual setup.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onManual}
          className="group relative p-8 rounded-2xl border border-border bg-background/50 backdrop-blur-xl hover:border-muted-foreground transition-all duration-300 shadow-sm hover:shadow-md flex flex-col h-full text-left"
        >
          <div className="space-y-6 flex-1 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border">
              <Settings2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-medium tracking-tight mb-3">Manual Setup</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add one piece of context now, review integration readiness, and continue with an honest setup state instead of simulated automation.
              </p>
            </div>
          </div>
        </button>
      </div>
    </motion.div>
  );
}

function StepThree({ agentName, voice, onComplete }: StepThreeProps) {
  const prompts = [
    `Hi, I'm ${agentName}.`,
    'What should I call you when we work together?',
    'What product or workspace should I help with first?',
    'Which tools should I learn first: GitHub, Slack, Notion, or ClickUp?',
    'What should I avoid doing without explicit approval?',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="w-full max-w-4xl space-y-8"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Guided live setup</h1>
        <p className="text-muted-foreground">
          This launches a real live session from the dashboard. Crewmate will ask questions and listen. It will not claim tools or memory are configured unless they are actually ready.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl border border-border bg-card/60 p-8 shadow-2xl shadow-black/5 backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
              <Mic size={24} />
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">{agentName}</div>
              <div className="text-sm text-muted-foreground">Voice personality: {voice}</div>
            </div>
          </div>
          <div className="space-y-3">
            {prompts.map((prompt, index) => (
              <div key={prompt} className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground">
                <span className="mr-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Prompt {index + 1}</span>
                {prompt}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-border bg-secondary/30 p-8">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-foreground" />
            <div>
              Guided setup learns your preferences through conversation. It does not silently connect tools or fabricate memory imports.
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-foreground" />
            <div>
              After the live Q&amp;A, use Integrations and Memory Base to finish anything that remains unconfigured.
            </div>
          </div>
          <Button variant="primary" onClick={onComplete} className="w-full justify-center py-4 text-sm font-medium">
            Start guided live setup
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function StepManualUpload({ onComplete }: StepManualUploadProps) {
  const { integrations, isLoading, error } = useIntegrations();
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryContent, setMemoryContent] = useState('');
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [memoryMessage, setMemoryMessage] = useState<string | null>(null);

  const readyIntegrations = integrations.filter((integration) => integration.status === 'connected').length;

  async function handleSaveMemory(): Promise<void> {
    if (!memoryTitle.trim() || !memoryContent.trim()) {
      return;
    }

    setIsSavingMemory(true);
    setMemoryMessage(null);

    try {
      await workspaceService.ingestMemory({
        title: memoryTitle.trim(),
        type: 'document',
        searchText: memoryContent.trim(),
      });
      setMemoryTitle('');
      setMemoryContent('');
      setMemoryMessage('Context added to your Memory Base.');
    } catch (saveError) {
      setMemoryMessage(saveError instanceof Error ? saveError.message : 'Unable to add context right now.');
    } finally {
      setIsSavingMemory(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-5xl space-y-10"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Prepare your workspace</h1>
        <p className="text-muted-foreground">Add one piece of real context now, then review which integrations are already ready.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/5 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText size={16} />
              Add starter context
            </div>
            <p className="text-sm text-muted-foreground">
              Paste a PRD, handoff note, brief, or project summary so Crewmate starts with actual context instead of inferred context.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground/80">Context title</label>
            <input
              value={memoryTitle}
              onChange={(event) => setMemoryTitle(event.target.value)}
              placeholder="Checkout revamp brief"
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground focus:outline-none focus:border-ring"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground/80">Paste source text</label>
            <textarea
              value={memoryContent}
              onChange={(event) => setMemoryContent(event.target.value)}
              rows={8}
              placeholder="Paste a project summary, spec excerpt, or operating instructions here..."
              className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground focus:outline-none focus:border-ring resize-none"
            />
          </div>

          {memoryMessage ? <div className="text-sm text-muted-foreground">{memoryMessage}</div> : null}

          <Button
            variant="secondary"
            onClick={() => void handleSaveMemory()}
            disabled={isSavingMemory || !memoryTitle.trim() || !memoryContent.trim()}
            className="w-full justify-center"
          >
            {isSavingMemory ? 'Adding context...' : 'Add context to Memory Base'}
          </Button>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/5 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">Integration readiness</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {readyIntegrations} of {integrations.length} integrations are ready for action.
              </div>
            </div>
            <div className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              Finish setup later from Integrations
            </div>
          </div>

          <div className="space-y-4">
            {isLoading || error ? (
              <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
                {isLoading ? 'Checking integration readiness...' : `Integration status: ${error}`}
              </div>
            ) : integrations.map((integration) => (
              <div key={integration.id} className="rounded-xl border border-border bg-background/50 px-4 py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${integration.bgColor} ${integration.color}`}>
                    <integration.icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-foreground">{integration.name}</div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          integration.status === 'connected'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {integration.status === 'connected' ? 'Ready' : 'Needs setup'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{integration.desc}</div>
                    {integration.missingKeys?.length ? (
                      <div className="mt-2 text-[11px] font-mono text-muted-foreground">
                        Missing: {integration.missingKeys.join(', ')}
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-600 dark:text-green-400">
                        <Check size={12} />
                        Workspace is ready
                      </div>
                    )}
                  </div>
                </div>
                {integration.docsUrl ? (
                  <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    Docs
                    <ArrowUpRight size={12} />
                  </a>
                ) : null}
              </div>
            ))}

            <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5 text-sm text-muted-foreground">
              The app will only claim tools are ready when they are actually connected. You can continue now without losing the context you added above.
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button type="button" onClick={onComplete} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Skip for now
        </button>
        <Button variant="primary" onClick={onComplete} className="px-8 py-5 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
          Continue to dashboard
        </Button>
      </div>
    </motion.div>
  );
}
