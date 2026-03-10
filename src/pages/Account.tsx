import React, { useState } from 'react';
import { Keyboard, User, Cpu, Settings2, Sparkles, Image as ImageIcon, MessageSquare, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyStateCard } from '../components/shared/EmptyStateCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Toggle } from '../components/ui/Toggle';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { authService, authStorage } from '../services/authService';

export function Account() {
  const [activeTab, setActiveTab] = useState('profile');
  const { user, isLoading, error } = useAuth();
  const {
    preferences,
    isLoading: isPreferencesLoading,
    isSaving: isPreferencesSaving,
    error: preferencesError,
    savePreferences,
  } = usePreferences();
  const navigate = useNavigate();
  const initials = user?.name
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase())
    .join('')
    .slice(0, 2) || 'CM';

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      authStorage.clearSession();
      navigate('/login');
    }
  };

  const currentPreferences = preferences ?? {
    voiceModel: 'alex',
    textModel: 'gemini-3.1-pro',
    imageModel: 'gemini-3.1-flash-image',
    reasoningLevel: 'high',
    proactiveSuggestions: true,
    autoStartScreenShare: false,
    blurSensitiveFields: true,
  };

  const updatePreferences = async (patch: Partial<typeof currentPreferences>): Promise<void> => {
    await savePreferences({
      ...currentPreferences,
      ...patch,
    });
  };

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'ai-models', label: 'AI Models', icon: Cpu },
    { id: 'preferences', label: 'Preferences', icon: Settings2 },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  ];

  return (
    <div className="space-y-8 max-w-5xl pb-10">
      <PageHeader
        title="Account & Settings"
        description="Manage your profile, AI models, and workspace preferences."
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading account details...</CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Account API status: {error}</CardContent>
        </Card>
      ) : null}

      {preferencesError ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Preferences API status: {preferencesError}</CardContent>
        </Card>
      ) : null}

      {!isLoading && !user ? (
        <EmptyStateCard
          title="No active account session"
          description="Sign in again to manage your workspace identity and runtime preferences."
          actionLabel="Go to login"
          onAction={() => navigate('/login')}
        />
      ) : null}

      {user ? (
        <div className="flex flex-col md:flex-row gap-8">
          {/* Settings Sidebar */}
          <div className="w-full md:w-64 shrink-0 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  }`}
              >
                <tab.icon size={18} className={activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Settings Content */}
          <div className="flex-1 max-w-2xl">
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">My Profile</h2>
                  <p className="text-sm text-muted-foreground mb-6">Manage your personal information and subscription.</p>
                </div>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="w-24 h-24 rounded-full bg-secondary border-4 border-background shadow-sm overflow-hidden flex items-center justify-center shrink-0 text-2xl font-semibold text-foreground">
                        {initials}
                      </div>
                      <div className="flex-1 text-center sm:text-left space-y-1">
                        <h3 className="text-xl font-semibold text-foreground">{user.name}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="pt-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {user.plan} Plan
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                        <Button variant="secondary" disabled>Avatar sync soon</Button>
                        <Button variant="danger" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-transparent" onClick={() => void handleLogout()}>
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Full Name</label>
                      <input type="text" value={user.name} readOnly className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Email Address</label>
                      <input type="email" value={user.email} readOnly className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ring text-foreground" />
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                      Profile editing is intentionally disabled in local MVP mode. Identity comes from the active auth session.
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'ai-models' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">AI Models</h2>
                  <p className="text-sm text-muted-foreground mb-1">Configure which Gemini model powers each role in your crew.</p>
                  <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 px-3 py-2 text-xs text-blue-400 mb-6">
                    Tip: Model overrides can also be set per-environment via GEMINI_* env vars in <code>.env</code>
                  </div>
                </div>

                <Card>
                  <CardContent className="p-0 divide-y divide-border">

                    {/* Orchestration / Routing */}
                    <div className="p-5 flex items-start gap-4">
                      <div className="mt-0.5 p-2 bg-blue-500/10 text-blue-500 rounded-lg shrink-0">
                        <Cpu size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <label className="text-sm font-medium text-foreground">Orchestration</label>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/15">ROUTING</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Intent classification, agent routing, task planning. Pro recommended.</p>
                        <Select
                          value={currentPreferences.textModel}
                          onChange={(value) => void updatePreferences({ textModel: value })}
                          options={[
                            { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview  ★ Recommended' },
                            { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
                            { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite  (faster)' },
                            { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite  (fastest)' },
                          ]}
                        />
                      </div>
                    </div>

                    {/* Research / Content */}
                    <div className="p-5 flex items-start gap-4">
                      <div className="mt-0.5 p-2 bg-purple-500/10 text-purple-500 rounded-lg shrink-0">
                        <Sparkles size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <label className="text-sm font-medium text-foreground">Research & Content</label>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/15">DEEP WORK</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Research agent, content writing, legal analysis, finance reports.</p>
                        <Select
                          value={currentPreferences.imageModel}
                          onChange={(value) => void updatePreferences({ imageModel: value })}
                          options={[
                            { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview  ★ Recommended' },
                            { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
                            { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite  (faster)' },
                          ]}
                        />
                      </div>
                    </div>

                    {/* Creative / Image */}
                    <div className="p-5 flex items-start gap-4">
                      <div className="mt-0.5 p-2 bg-rose-500/10 text-rose-500 rounded-lg shrink-0">
                        <ImageIcon size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <label className="text-sm font-medium text-foreground">Creative Studio (Image)</label>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/15">VISUAL</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Social media images, banners, UI mockups, product visuals.</p>
                        <Select
                          value="gemini-3.1-flash-image-preview"
                          onChange={() => undefined}
                          options={[
                            { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image Preview  ★ Only option' },
                          ]}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1.5">Image generation model is fixed — set via GEMINI_CREATIVE_MODEL env var.</p>
                      </div>
                    </div>

                    {/* Voice — Live API */}
                    <div className="p-5 flex items-start gap-4">
                      <div className="mt-0.5 p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                        <MessageSquare size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <label className="text-sm font-medium text-foreground">Live Voice (Gemini Live API)</label>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/15">VOICE</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Voice used during real-time screen-share sessions via Gemini Live.</p>
                        <Select
                          value={currentPreferences.voiceModel}
                          onChange={(value) => void updatePreferences({ voiceModel: value })}
                          options={[
                            { value: 'Aoede', label: 'Aoede — Warm & Expressive  ★ Recommended' },
                            { value: 'Charon', label: 'Charon — Deep & Authoritative' },
                            { value: 'Fenrir', label: 'Fenrir — Clear & Energetic' },
                            { value: 'Kore', label: 'Kore — Calm & Confident' },
                            { value: 'Puck', label: 'Puck — Lively & Playful' },
                          ]}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          Voices are official Gemini Live API voices. All support native audio.
                        </p>
                      </div>
                    </div>

                  </CardContent>
                </Card>

                <div className="rounded-xl border border-border bg-card/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground">How model routing works</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { tier: 'live', model: 'gemini-2.5-flash-native-audio-preview', note: 'Real-time voice' },
                      { tier: 'orchestration', model: 'gemini-3.1-pro-preview', note: 'Intent routing' },
                      { tier: 'research', model: 'gemini-3.1-pro-preview', note: 'Deep analysis' },
                      { tier: 'creative', model: 'gemini-3.1-flash-image-preview', note: 'Image gen' },
                      { tier: 'quick', model: 'gemini-3.1-flash-lite-preview', note: 'Fast tasks' },
                      { tier: 'lite', model: 'gemini-3.1-flash-lite-preview', note: 'Ultra-fast' },
                    ].map(({ tier, model, note }) => (
                      <div key={tier} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{tier}</span>
                        <div className="text-right">
                          <p className="text-[10px] font-mono text-foreground">{model.replace('gemini-', '')}</p>
                          <p className="text-[9px] text-muted-foreground">{note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {isPreferencesLoading || isPreferencesSaving ? (
                  <div className="text-sm text-muted-foreground">
                    {isPreferencesLoading ? 'Loading preferences…' : 'Saving…'}
                  </div>
                ) : null}
              </div>
            )}


            {activeTab === 'preferences' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Preferences & Privacy</h2>
                  <p className="text-sm text-muted-foreground mb-6">Customize how the agent interacts with your workspace.</p>
                </div>

                <Card>
                  <CardContent className="p-0 divide-y divide-border">
                    <div className="p-6 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-foreground">Proactive Suggestions</div>
                        <div className="text-xs text-muted-foreground mt-1">Agent will suggest tasks based on screen context.</div>
                      </div>
                      <Toggle
                        checked={currentPreferences.proactiveSuggestions}
                        onChange={(value) => void updatePreferences({ proactiveSuggestions: value })}
                      />
                    </div>
                    <div className="p-6 space-y-3">
                      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-4">
                        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-foreground" />
                        <div>
                          <div className="text-sm font-medium text-foreground">Capture safeguards</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Screen share and microphone access are always user-initiated in this build. Automatic capture start and sensitive-field redaction are intentionally not exposed as live toggles until the underlying behavior exists.
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {isPreferencesLoading || isPreferencesSaving ? (
                  <div className="text-sm text-muted-foreground">
                    {isPreferencesLoading ? 'Loading preferences...' : 'Saving preferences...'}
                  </div>
                ) : null}
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Keyboard Shortcuts</h2>
                  <p className="text-sm text-muted-foreground mb-6">Speed up your workflow with these quick actions.</p>
                </div>

                <Card>
                  <CardContent className="p-0 divide-y divide-border">
                    <div className="p-6 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-foreground">Open command palette</div>
                        <div className="text-xs text-muted-foreground mt-1">Jump to key product surfaces from anywhere in the app.</div>
                      </div>
                      <div className="flex gap-1.5">
                        <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">⌘</kbd>
                        <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">K</kbd>
                      </div>
                    </div>

                    <div className="p-6 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-foreground">Close open overlays</div>
                        <div className="text-xs text-muted-foreground mt-1">Dismiss the command palette and similar overlays when they are open.</div>
                      </div>
                      <div className="flex gap-1.5">
                        <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">Esc</kbd>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
