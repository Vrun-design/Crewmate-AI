import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from '../utils/cn';

type ToastVariant = 'success' | 'info' | 'warning' | 'error';

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastRecord extends Required<Omit<ToastInput, 'durationMs'>> {
  id: string;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastStyles(variant: ToastVariant): {
  containerClassName: string;
  icon: React.ReactNode;
} {
  if (variant === 'success') {
    return {
      containerClassName: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
      icon: <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />,
    };
  }

  if (variant === 'warning') {
    return {
      containerClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-50',
      icon: <TriangleAlert size={16} className="shrink-0 text-amber-300" />,
    };
  }

  if (variant === 'error') {
    return {
      containerClassName: 'border-red-500/30 bg-red-500/10 text-red-50',
      icon: <XCircle size={16} className="shrink-0 text-red-300" />,
    };
  }

  return {
    containerClassName: 'border-primary/30 bg-primary/10 text-foreground',
    icon: <Info size={16} className="shrink-0 text-primary" />,
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeoutIdsRef = useRef(new Map<string, number>());

  const dismissToast = useCallback((id: string): void => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }

    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(({
    title,
    description = '',
    variant = 'info',
    durationMs = 5000,
    actionLabel = '',
    onAction = () => {},
  }: ToastInput): void => {
    const id = crypto.randomUUID();
    setToasts((currentToasts) => [...currentToasts, { id, title, description, variant, actionLabel, onAction }]);

    const timeoutId = window.setTimeout(() => {
      dismissToast(id);
    }, durationMs);
    timeoutIdsRef.current.set(id, timeoutId);
  }, [dismissToast]);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutIdsRef.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    showToast,
  }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.variant);

          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl',
                styles.containerClassName,
              )}
            >
              <div className="flex items-start gap-3">
                {styles.icon}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-xs text-current/80">{toast.description}</p>
                  ) : null}
                  {toast.actionLabel ? (
                    <button
                      type="button"
                      onClick={() => {
                        toast.onAction();
                        dismissToast(toast.id);
                      }}
                      className="mt-2 text-xs font-medium text-current underline decoration-current/40 underline-offset-4 transition hover:decoration-current"
                    >
                      {toast.actionLabel}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full p-1 text-current/70 transition hover:bg-white/10 hover:text-current"
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
