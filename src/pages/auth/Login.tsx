import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, Github } from 'lucide-react';
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
            <p className="text-sm text-muted-foreground">Enter your email to continue</p>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-2xl shadow-black/5">
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

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" className="flex items-center justify-center gap-2 w-full bg-background/50 border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button type="button" className="flex items-center justify-center gap-2 w-full bg-background/50 border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              <Github size={16} />
              GitHub
            </button>
          </div>
        </div>
        
        <p className="text-center text-xs text-muted-foreground mt-8">
          By continuing, you agree to our <a href="#" className="text-foreground hover:underline underline-offset-4 transition-colors">Terms of Service</a> and <a href="#" className="text-foreground hover:underline underline-offset-4 transition-colors">Privacy Policy</a>.
        </p>
      </motion.div>
    </div>
  );
}
