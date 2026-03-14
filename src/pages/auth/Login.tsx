import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from '../../components/ui/Button';
import { authService, authStorage } from '../../services/authService';
import { firebaseAuthService } from '../../services/firebaseAuth';
import { onboardingFlowService } from '../../services/onboardingFlowService';
import { integrationsService } from '../../services/integrationsService';

function getSubmitLabel(isFirebaseMode: boolean, isLoading: boolean): string {
  if (isLoading) {
    return 'Sending link...';
  }

  return isFirebaseMode ? 'Send magic link' : 'Continue with Email';
}

export function Login(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const isFirebaseMode = firebaseAuthService.isConfigured();

  useEffect(() => {
    authStorage.clearSession();
    void firebaseAuthService.signOut().catch(() => undefined);
  }, []);

  function clearFeedback(): void {
    setError(null);
  }

  async function maybeRedirectToWorkspaceConnect(): Promise<boolean> {
    try {
      const integrations = await integrationsService.getIntegrations();
      const googleWorkspace = integrations.find((integration) => integration.id === 'google-workspace');
      const isConnected = googleWorkspace?.status === 'connected';

      if (!isConnected && googleWorkspace) {
        const { redirectUrl } = await integrationsService.startOAuthConnection(googleWorkspace.id, '/dashboard');
        window.location.assign(redirectUrl);
        return true;
      }
    } catch {
      // Fall back to the dashboard if integration discovery fails.
    }

    return false;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!email) {
      return;
    }

    setIsLoading(true);
    clearFeedback();

    try {
      if (isFirebaseMode) {
        return;
      }

      const response = await authService.requestCode(email);
      navigate('/verify', { state: { email: response.email, devCode: response.devCode } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request verification code');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn(): Promise<void> {
    setIsLoading(true);
    clearFeedback();

    try {
      const firebaseUser = await firebaseAuthService.signInWithGoogle();
      const token = await firebaseUser.getIdToken();
      authStorage.saveSession(token, firebaseUser.email ?? '');
      onboardingFlowService.markComplete();

      const redirectedToWorkspaceConnect = await maybeRedirectToWorkspaceConnect();
      if (redirectedToWorkspaceConnect) {
        return;
      }

      navigate('/dashboard');
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Unable to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 selection:bg-foreground/10 relative overflow-hidden">
      {/* Premium Linear-style background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-foreground opacity-[0.03] blur-[100px]"></div>

      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[380px] relative z-10"
      >
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-2xl shadow-black/5">
          <div className="flex flex-col items-center text-center space-y-5 mb-6">
            <img src="/Crewmate.svg" alt="Crewmate" className="h-14 w-14 object-contain shadow-[0_8px_20px_rgba(0,0,0,0.08)]" />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in to Crewmate</h1>
              <p className="text-sm text-muted-foreground">
                {isFirebaseMode
                  ? 'Sign in with your Google account to enter your workspace.'
                  : 'Enter your email to continue into the local workspace preview.'}
              </p>
            </div>
          </div>

          {isFirebaseMode ? (
            <Button
              variant="primary"
              className="mb-2 w-full justify-center py-5 text-sm font-semibold shadow-[0_14px_34px_rgba(233,84,32,0.28)]"
              disabled={isLoading}
              onClick={() => void handleGoogleSignIn()}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm">
                <img src="/Google.svg" alt="" className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              Continue with Google
            </Button>
          ) : null}
          {!isFirebaseMode ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition-all text-foreground placeholder:text-muted-foreground/50"
                  required
                />
              </div>
              <Button variant="primary" className="w-full justify-center py-5 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]" disabled={isLoading}>
                {getSubmitLabel(isFirebaseMode, isLoading)}
              </Button>
            </form>
          ) : null}
          {error ? <div className="mt-3 text-sm text-red-500">{error}</div> : null}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          {isFirebaseMode
            ? 'Google is the only sign-in method enabled for this deployment.'
            : 'Local preview mode stores auth state in your browser and the workspace database.'}
        </p>
      </motion.div>
    </div>
  );
}
