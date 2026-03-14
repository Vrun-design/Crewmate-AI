import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authStorage } from '../../services/authService';
import { onboardingFlowService } from '../../services/onboardingFlowService';
import { integrationsService } from '../../services/integrationsService';
import { applyTheme, getInitialTheme } from '../../services/themeService';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BrowserSessionPiP } from '../ui/BrowserSessionPiP';
import { ScreenSharePiP } from '../ui/ScreenSharePiP';
import { MiniSessionBar } from '../ui/MiniSessionBar';
import { GoogleWorkspaceOnboardingModal } from '../onboarding/GoogleWorkspaceOnboardingModal';
import { useLiveSessionContext } from '../../contexts/LiveSessionContext';
import { useBrowserSessionActivation } from '../../hooks/useBrowserSessionActivation';

export function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => getInitialTheme() === 'dark');
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const {
    isOverlayOpen,
    previewStream,
    screenShareStatus,
    microphoneStatus,
    isMicrophoneSupported,
    toggleMicrophone,
    stopScreenShare,
    setIsOverlayOpen,
  } = useLiveSessionContext();
  const showScreenSharePiP = !isOverlayOpen;
  const searchParams = new URLSearchParams(location.search);
  const hasOnboardingQuery = searchParams.get('onboarding') === 'google-workspace';
  const oauthError = searchParams.get('error_description');
  const wasJustConnected = searchParams.get('connected') === 'true';

  useBrowserSessionActivation();

  useEffect(() => {
    if (!isLoading && !user && !authStorage.isAuthenticated()) {
      navigate('/login');
    }
  }, [isLoading, navigate, user]);

  useEffect(() => {
    if (isLoading || !user || !authStorage.isAuthenticated()) {
      return;
    }

    if (!onboardingFlowService.shouldRequireIntegrationOnboarding()) {
      onboardingFlowService.markComplete();
      setIsOnboardingModalOpen(false);
      return;
    }

    if (onboardingFlowService.isComplete() && !hasOnboardingQuery) {
      setIsOnboardingModalOpen(false);
      return;
    }

    let isCancelled = false;

    void integrationsService.getIntegrations()
      .then((integrations) => {
        if (isCancelled) {
          return;
        }

        const googleWorkspace = integrations.find((integration) => integration.id === 'google-workspace');
        if (googleWorkspace?.status === 'connected' && !hasOnboardingQuery) {
          onboardingFlowService.markComplete();
          setIsOnboardingModalOpen(false);
          return;
        }

        setIsOnboardingModalOpen(true);
      })
      .catch(() => {
        if (!isCancelled) {
          setIsOnboardingModalOpen(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [hasOnboardingQuery, isLoading, user]);

  useEffect(() => {
    function handleAuthExpired(): void {
      navigate('/login');
    }

    window.addEventListener('crewmate:auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('crewmate:auth-expired', handleAuthExpired);
    };
  }, [navigate]);

  useEffect(() => {
    applyTheme(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  function clearOnboardingQuery(): void {
    if (!hasOnboardingQuery && !oauthError && !wasJustConnected) {
      return;
    }

    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete('onboarding');
    nextSearchParams.delete('connected');
    nextSearchParams.delete('error');
    nextSearchParams.delete('error_description');
    const nextSearch = nextSearchParams.toString();

    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
    }, { replace: true });
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden selection:bg-blue-500/30">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        user={user}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header setIsMobileMenuOpen={setIsMobileMenuOpen} />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0"></div>

          <div className="max-w-6xl mx-auto relative z-10 h-full">
            <Outlet />
          </div>
        </div>
      </main>
      {showScreenSharePiP && (
        <ScreenSharePiP
          previewStream={previewStream}
          screenShareStatus={screenShareStatus}
          microphoneStatus={microphoneStatus}
          isMicrophoneSupported={isMicrophoneSupported}
          onToggleMicrophone={toggleMicrophone}
          onStopScreenShare={stopScreenShare}
          onOpenOverlay={() => setIsOverlayOpen(true)}
        />
      )}
      <BrowserSessionPiP />
      <MiniSessionBar />
      <GoogleWorkspaceOnboardingModal
        isOpen={isOnboardingModalOpen}
        hasOnboardingQuery={hasOnboardingQuery}
        oauthError={oauthError}
        wasJustConnected={wasJustConnected}
        onClose={() => setIsOnboardingModalOpen(false)}
        onClearOnboardingQuery={clearOnboardingQuery}
      />
    </div>
  );
}
