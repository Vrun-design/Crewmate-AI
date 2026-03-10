import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../../components/ui/Button';
import { authService, authStorage } from '../../services/authService';

export function Verify() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || 'you@example.com';
  const [devCode, setDevCode] = useState(location.state?.devCode || '');
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && code[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.join('').length !== 6) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.verifyCode(email, code.join(''));
      authStorage.saveSession(response.token, response.user.email);
      localStorage.setItem('crewmate_user_email', response.user.email);
      navigate('/onboarding');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    setError(null);
    setResendMessage(null);

    try {
      const response = await authService.requestCode(email);
      setDevCode(response.devCode);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setResendMessage('A fresh verification code is ready.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to resend code');
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
        <button onClick={() => navigate('/login')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors mb-6 -ml-2">
          <ArrowLeft size={18} />
        </button>

        <div className="flex flex-col items-center text-center space-y-5 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-foreground to-foreground/80 text-background flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_8px_20px_rgba(0,0,0,0.1)]">
            <Zap size={24} className="fill-current" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Check your email</h1>
            <p className="text-sm text-muted-foreground">Enter the 6-digit code for <span className="font-medium text-foreground">{email}</span></p>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-2xl shadow-black/5">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-xl font-medium bg-background/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition-all text-foreground shadow-sm"
                />
              ))}
            </div>
            <Button variant="primary" className="w-full justify-center py-5 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]" disabled={isLoading || code.join('').length !== 6}>
              {isLoading ? 'Verifying...' : 'Verify & Continue'}
            </Button>
            {error ? <div className="text-sm text-red-500">{error}</div> : null}
            {devCode ? (
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                Local preview code: <span className="font-mono text-foreground">{devCode}</span>
              </div>
            ) : null}
            {resendMessage ? <div className="text-sm text-emerald-500">{resendMessage}</div> : null}
          </form>
        </div>
        
        <p className="text-center text-sm text-muted-foreground mt-8">
          Didn't receive the code?{' '}
          <button
            type="button"
            onClick={() => void handleResend()}
            className="text-foreground font-medium hover:underline underline-offset-4 transition-colors"
            disabled={isLoading}
          >
            Click to resend
          </button>
        </p>
      </motion.div>
    </div>
  );
}
