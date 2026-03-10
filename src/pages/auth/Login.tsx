import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../../components/ui/Button';
import { authService, authStorage } from '../../services/authService';

export function Login() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    authStorage.clearSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.requestCode(email);
      navigate('/verify', { state: { email: response.email, devCode: response.devCode } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request verification code');
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="flex flex-col items-center text-center space-y-5 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-foreground to-foreground/80 text-background flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_8px_20px_rgba(0,0,0,0.1)]">
            <Zap size={24} className="fill-current" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Log in to Crewmate</h1>
            <p className="text-sm text-muted-foreground">Enter your email to continue into the local workspace preview.</p>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-2xl shadow-black/5">
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-foreground" />
            <div>
              This build uses local email-code auth for development. Hosted auth providers are not enabled here yet.
            </div>
          </div>
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
              {isLoading ? 'Sending code...' : 'Continue with Email'}
            </Button>
            {error ? <div className="text-sm text-red-500">{error}</div> : null}
          </form>
        </div>
        
        <p className="text-center text-xs text-muted-foreground mt-8">
          Local preview mode stores auth state in your browser and the workspace database.
        </p>
      </motion.div>
    </div>
  );
}
