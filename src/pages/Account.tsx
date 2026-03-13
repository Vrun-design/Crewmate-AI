import React, { useState, useEffect } from 'react';
import { Cpu, Keyboard, Settings2, User } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyStateCard } from '../components/shared/EmptyStateCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { DEFAULT_LIVE_VOICE } from '../constants/liveVoices';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { authService, authStorage } from '../services/authService';
import { AccountSidebar } from '../components/account/AccountSidebar';
import { ProfilePanel } from '../components/account/ProfilePanel';
import { RuntimeConfigPanel } from '../components/account/RuntimeConfigPanel';
import { ShortcutsPanel } from '../components/account/ShortcutsPanel';
import type { AccountPreferences, AccountTab, AccountTabId } from '../components/account/accountTypes';

const DEFAULT_PREFERENCES: AccountPreferences = {
  voiceModel: DEFAULT_LIVE_VOICE,
  textModel: 'gemini-3.1-pro-preview',
  imageModel: 'gemini-3.1-flash-image-preview',
  reasoningLevel: 'high',
  proactiveSuggestions: true,
  autoStartScreenShare: false,
  blurSensitiveFields: true,
};

const ACCOUNT_TABS: AccountTab[] = [
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'ai-models', label: 'AI Models', icon: Cpu },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

export function Account(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') as AccountTabId | null;
  const validTab = initialTab && ACCOUNT_TABS.some((t) => t.id === initialTab) ? initialTab : 'profile';

  const [activeTab, setActiveTabState] = useState<AccountTabId>(validTab);

  const setActiveTab = (tab: AccountTabId) => {
    setActiveTabState(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (initialTab && initialTab !== activeTab && ACCOUNT_TABS.some((t) => t.id === initialTab)) {
      setActiveTabState(initialTab);
    }
  }, [initialTab, activeTab]);

  const { user, isLoading, error } = useAuth();
  const {
    preferences,
    isLoading: isPreferencesLoading,
    isSaving: isPreferencesSaving,
    error: preferencesError,
    savePreferences,
  } = usePreferences();
  const navigate = useNavigate();

  const initials =
    user?.name
      .split(' ')
      .filter(Boolean)
      .map((segment) => segment[0]?.toUpperCase())
      .join('')
      .slice(0, 2) || 'CM';

  async function handleLogout(): Promise<void> {
    try {
      await authService.logout();
    } finally {
      authStorage.clearSession();
      navigate('/login');
    }
  }

  const currentPreferences = preferences ?? DEFAULT_PREFERENCES;

  async function updatePreferences(patch: Partial<AccountPreferences>): Promise<void> {
    await savePreferences({
      ...currentPreferences,
      ...patch,
    });
  }

  function renderActivePanel(): React.JSX.Element | null {
    if (!user) {
      return null;
    }

    switch (activeTab) {
      case 'profile':
        return <ProfilePanel initials={initials} user={user} onLogout={() => void handleLogout()} />;
      case 'ai-models':
        return (
          <RuntimeConfigPanel
            currentPreferences={currentPreferences}
            isPreferencesLoading={isPreferencesLoading}
            isPreferencesSaving={isPreferencesSaving}
            updatePreferences={updatePreferences}
          />
        );
      case 'shortcuts':
        return <ShortcutsPanel />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Account & Settings" description="Manage your profile, live voice, and workspace preferences." />

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
          <AccountSidebar activeTab={activeTab} tabs={ACCOUNT_TABS} onSelect={setActiveTab} />
          <div className="flex-1 max-w-2xl">{renderActivePanel()}</div>
        </div>
      ) : null}
    </div>
  );
}
