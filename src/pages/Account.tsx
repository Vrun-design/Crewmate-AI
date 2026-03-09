import React, { useState } from 'react';
import { Keyboard, User, Cpu, Settings2, Sparkles, Image as ImageIcon, MessageSquare } from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {EmptyStateCard} from '../components/shared/EmptyStateCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Toggle } from '../components/ui/Toggle';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import {useAuth} from '../hooks/useAuth';
import {usePreferences} from '../hooks/usePreferences';
import {authService, authStorage} from '../services/authService';

export function Account() {
  const [activeTab, setActiveTab] = useState('profile');
  const {user, isLoading, error} = useAuth();
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id 
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
                <p className="text-sm text-muted-foreground mb-6">Configure the underlying models powering your agent.</p>
              </div>

              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  <div className="p-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                        <Sparkles size={18} />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-medium text-foreground block mb-1">Reasoning & Logic Model</label>
                        <p className="text-xs text-muted-foreground mb-3">Used for coding, math, and complex multi-step tasks.</p>
                        <Select 
                          value={currentPreferences.textModel}
                          onChange={(value) => void updatePreferences({textModel: value})}
                          options={[
                            { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (Recommended)' },
                            { value: 'gemini-3-flash', label: 'Gemini 3 Flash (Faster)' },
                            { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' }
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                        <ImageIcon size={18} />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-medium text-foreground block mb-1">Image Generation Model</label>
                        <p className="text-xs text-muted-foreground mb-3">Used for generating UI mockups, assets, and visual content.</p>
                        <Select 
                          value={currentPreferences.imageModel}
                          onChange={(value) => void updatePreferences({imageModel: value})}
                          options={[
                            { value: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image' },
                            { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
                            { value: 'imagen-4.0', label: 'Imagen 4.0' }
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 bg-green-500/10 text-green-500 rounded-lg">
                        <MessageSquare size={18} />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-medium text-foreground block mb-1">Voice Personality</label>
                        <p className="text-xs text-muted-foreground mb-3">The voice used during live multimodal screen-sharing sessions.</p>
                        <Select 
                          value={currentPreferences.voiceModel}
                          onChange={(value) => void updatePreferences({voiceModel: value})}
                          options={[
                            { value: 'alex', label: 'Alex (Professional)' },
                            { value: 'sam', label: 'Sam (Casual)' },
                            { value: 'taylor', label: 'Taylor (Direct)' },
                            { value: 'kore', label: 'Kore (Warm)' }
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                        <Cpu size={18} />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-medium text-foreground block mb-1">Thinking Level</label>
                        <p className="text-xs text-muted-foreground mb-3">Controls the model's reasoning depth before responding.</p>
                        <Select 
                          value={currentPreferences.reasoningLevel}
                          onChange={(value) => void updatePreferences({reasoningLevel: value})}
                          options={[
                            { value: 'high', label: 'High (Maximum reasoning)' },
                            { value: 'low', label: 'Low (Faster response)' }
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                      onChange={(value) => void updatePreferences({proactiveSuggestions: value})}
                    />
                  </div>
                  
                  <div className="p-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">Auto-start Screen Share</div>
                      <div className="text-xs text-muted-foreground mt-1">Begin capturing when dashboard opens.</div>
                    </div>
                    <Toggle
                      checked={currentPreferences.autoStartScreenShare}
                      onChange={(value) => void updatePreferences({autoStartScreenShare: value})}
                    />
                  </div>
                  
                  <div className="p-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">Blur Sensitive Fields</div>
                      <div className="text-xs text-muted-foreground mt-1">Automatically obfuscate passwords and API keys.</div>
                    </div>
                    <Toggle
                      checked={currentPreferences.blurSensitiveFields}
                      onChange={(value) => void updatePreferences({blurSensitiveFields: value})}
                    />
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
                      <div className="text-sm font-medium text-foreground">Toggle Microphone</div>
                      <div className="text-xs text-muted-foreground mt-1">Mute or unmute during a live session.</div>
                    </div>
                    <div className="flex gap-1.5">
                      <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">⌘</kbd>
                      <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">Shift</kbd>
                      <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">M</kbd>
                    </div>
                  </div>
                  
                  <div className="p-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">Summon Agent Overlay</div>
                      <div className="text-xs text-muted-foreground mt-1">Open the command palette anywhere.</div>
                    </div>
                    <div className="flex gap-1.5">
                      <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">⌘</kbd>
                      <kbd className="px-2.5 py-1.5 bg-secondary rounded-md text-xs font-mono border border-border text-foreground shadow-sm">K</kbd>
                    </div>
                  </div>

                  <div className="p-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">Cancel Current Task</div>
                      <div className="text-xs text-muted-foreground mt-1">Stop the agent from executing the active task.</div>
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
