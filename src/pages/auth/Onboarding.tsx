import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, ArrowRight, CheckCircle2, Volume2, Settings2, Sparkles, Upload, Check, ArrowUpRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useIntegrations } from '../../hooks/useIntegrations';

export function Onboarding() {
  const [step, setStep] = useState(1);
  const [agentName, setAgentName] = useState('Crewmate');
  const [voice, setVoice] = useState('alex');
  const navigate = useNavigate();

  const completeOnboarding = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-foreground/10 relative overflow-hidden">
      {/* Premium Linear-style background for steps 1 and 2 */}
      {step < 3 && (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-foreground opacity-[0.03] blur-[100px]"></div>
        </>
      )}

      {/* Minimalist Progress Bar */}
      <div className="h-[2px] w-full bg-secondary fixed top-0 left-0 z-50">
        <motion.div 
          className="h-full bg-foreground"
          initial={{ width: '0%' }}
          animate={{ width: `${(Math.min(step, 3) / 3) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <StepOne 
              key="step1" 
              agentName={agentName} setAgentName={setAgentName} 
              voice={voice} setVoice={setVoice} 
              onNext={() => setStep(2)} 
            />
          )}
          {step === 2 && (
            <StepTwo 
              key="step2" 
              onManual={() => setStep(4)} 
              onVoice={() => setStep(3)} 
            />
          )}
          {step === 3 && (
            <StepThree 
              key="step3" 
              agentName={agentName} 
              onComplete={() => completeOnboarding()} 
            />
          )}
          {step === 4 && (
            <StepManualUpload 
              key="step4" 
              onComplete={() => completeOnboarding()} 
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepOne({ agentName, setAgentName, voice, setVoice, onNext }: any) {
  const voices = [
    { id: 'alex', name: 'Alex', desc: 'Professional & Clear' },
    { id: 'taylor', name: 'Taylor', desc: 'Warm & Empathetic' },
    { id: 'sam', name: 'Sam', desc: 'Direct & Concise' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-xl space-y-10"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Create your agent</h1>
        <p className="text-muted-foreground">Configure the basic identity of your AI co-worker.</p>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/5 space-y-8">
        <div className="space-y-3">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Agent Name</label>
          <input 
            type="text" 
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition-all shadow-sm"
          />
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Voice Personality</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {voices.map(v => (
              <div 
                key={v.id}
                onClick={() => setVoice(v.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden ${voice === v.id ? 'border-foreground bg-foreground/5 shadow-sm' : 'border-border bg-background/50 hover:border-muted-foreground/50'}`}
              >
                {voice === v.id && (
                  <motion.div layoutId="voice-active" className="absolute inset-0 border-2 border-foreground rounded-xl pointer-events-none" />
                )}
                <div className="flex items-center justify-between mb-1 relative z-10">
                  <div className="font-medium text-sm text-foreground">{v.name}</div>
                  {voice === v.id && <CheckCircle2 size={16} className="text-foreground" />}
                </div>
                <div className="text-xs text-muted-foreground relative z-10">{v.desc}</div>
                <button className="mt-4 text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors relative z-10 uppercase tracking-wider">
                  <Volume2 size={12} /> Play sample
                </button>
              </div>
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

function StepTwo({ onManual, onVoice }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl space-y-10"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Choose setup method</h1>
        <p className="text-muted-foreground">Select how you want to configure your workspace and integrations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={onVoice}
          className="group relative p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-xl cursor-pointer hover:border-foreground transition-all duration-300 shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-black/10 flex flex-col h-full overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="space-y-6 flex-1 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-foreground to-foreground/80 text-background flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_8px_20px_rgba(0,0,0,0.1)]">
              <Mic size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-medium tracking-tight">Live Voice Setup</h3>
                <span className="px-2 py-0.5 rounded-full bg-foreground/10 text-foreground text-[10px] font-semibold tracking-widest uppercase border border-foreground/20 flex items-center gap-1">
                  <Sparkles size={10} /> Magic
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The fastest way. Just talk to your agent for 2 minutes. They will ask you a few questions and configure everything automatically based on your workflow.
              </p>
            </div>
          </div>
        </div>

        <div 
          onClick={onManual}
          className="group relative p-8 rounded-2xl border border-border bg-background/50 backdrop-blur-xl cursor-pointer hover:border-muted-foreground transition-all duration-300 shadow-sm hover:shadow-md flex flex-col h-full"
        >
          <div className="space-y-6 flex-1 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border">
              <Settings2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-medium tracking-tight mb-3">Manual Setup</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Traditional setup. Go to the dashboard and manually connect your integrations, set up your memory base, and configure preferences.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StepThree({ agentName, onComplete }: any) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    const timers = [
      setTimeout(() => setPhase(1), 3500),
      setTimeout(() => setPhase(2), 8000),
      setTimeout(() => setPhase(3), 13000),
      setTimeout(() => setPhase(4), 16000),
    ];
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: "easeInOut" }}
      className="fixed inset-0 bg-[#000000] text-[#ffffff] flex flex-col items-center justify-center z-[100] overflow-hidden"
    >
      {/* OpenAI/Siri style voice visualizer background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60 mix-blend-screen">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-[40%] border border-white/20"
            style={{ width: `${300 + i * 100}px`, height: `${300 + i * 100}px` }}
            animate={{
              rotate: [0, 360],
              scale: [1, 1.05, 1],
              borderRadius: ["40%", "45%", "35%", "40%"]
            }}
            transition={{ 
              rotate: { duration: 20 + i * 5, repeat: Infinity, ease: "linear" },
              scale: { duration: 5 + i, repeat: Infinity, ease: "easeInOut" },
              borderRadius: { duration: 8 + i, repeat: Infinity, ease: "easeInOut" }
            }}
          />
        ))}
        <div className="absolute w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-6 h-full justify-center">
        {/* Central Core */}
        <div className="relative w-24 h-24 mb-24 flex items-center justify-center">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full bg-white/20 blur-2xl"
          />
          <div className="absolute inset-0 rounded-full border border-white/30 bg-black/50 backdrop-blur-md flex items-center justify-center">
            <Mic size={24} className="text-white/80" />
          </div>
          
          {/* Audio reactive rings */}
          <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            className="absolute inset-0 rounded-full border border-white/40"
          />
        </div>

        {/* Transcripts / Status */}
        <div className="h-40 flex items-center justify-center text-center w-full max-w-3xl">
          <AnimatePresence mode="wait">
            {phase === 0 && (
              <motion.div key="p0" initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="text-3xl md:text-5xl font-light tracking-tight text-white/90 leading-tight">
                "Hi, I'm {agentName}. It's great to meet you."
              </motion.div>
            )}
            {phase === 1 && (
              <motion.div key="p1" initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="text-3xl md:text-5xl font-light tracking-tight text-white/90 leading-tight">
                "I see you're setting up a product workspace. I'm connecting your tools and syncing the operator stack now..."
              </motion.div>
            )}
            {phase === 2 && (
              <motion.div key="p2" initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="text-3xl md:text-5xl font-light tracking-tight text-white/90 leading-tight">
                "I've set up your Memory Base with your recent PRDs. I'll proactively suggest tasks when you're writing specs."
              </motion.div>
            )}
            {phase === 3 && (
              <motion.div key="p3" initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="text-3xl md:text-5xl font-light tracking-tight text-white/90 leading-tight">
                "All set! Your workspace is fully configured."
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {phase >= 4 && (
            <motion.div 
              initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-16"
            >
              <button 
                onClick={onComplete} 
                className="bg-white text-black hover:bg-white/90 rounded-full px-8 py-4 text-base font-medium transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95"
              >
                Go to Dashboard <ArrowRight size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function StepManualUpload({ onComplete }: any) {
  const { integrations, isLoading, error } = useIntegrations();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-xl space-y-10"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Set up integrations</h1>
        <p className="text-muted-foreground">Optional for now. Connect the tools Crewmate will use when it takes actions for you.</p>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/5 space-y-8">
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
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      integration.status === 'connected'
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-secondary text-muted-foreground'
                    }`}>
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
                      Local environment is ready
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
                  Docs <ArrowUpRight size={12} />
                </a>
              ) : null}
            </div>
          ))}

          <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5 text-sm text-muted-foreground">
            You can skip this now and keep using the app. The integrations page will still show exact setup steps and readiness later.
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button onClick={onComplete} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Skip for now
        </button>
        <Button variant="primary" onClick={onComplete} className="px-8 py-5 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
          Continue to dashboard
        </Button>
      </div>
    </motion.div>
  );
}
