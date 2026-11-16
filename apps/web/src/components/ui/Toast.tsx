'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastTone = 'info' | 'warn' | 'error' | 'ok';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  durationMs?: number;
}

type ToastContextType = {
  toast: (t: Omit<ToastItem, 'id'>) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

let globalToastFn: ((t: Omit<ToastItem, 'id'>) => string) | null = null;

export function toast(t: Omit<ToastItem, 'id'>) {
  if (globalToastFn) {
    return globalToastFn(t);
  }
  console.warn('[Toast] Toast called outside ToastProvider', t);
  return '';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { ...t, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = t.durationMs ?? 6000;
      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    globalToastFn = showToast;
    return () => {
      globalToastFn = null;
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toast: showToast, dismiss }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast,
      dismiss: () => {},
    };
  }
  return ctx;
}

export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm w-full flex-col gap-2.5 pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((item) => {
        const tone = item.tone ?? 'info';
        const Icon =
          tone === 'error'
            ? AlertCircle
            : tone === 'warn'
            ? AlertTriangle
            : tone === 'ok'
            ? CheckCircle2
            : Info;

        const borderBg =
          tone === 'error'
            ? 'border-bad/40 bg-bad-soft text-bad'
            : tone === 'warn'
            ? 'border-[#d9b640] bg-marker-soft text-ink'
            : tone === 'ok'
            ? 'border-[#8ccaae] bg-ok-soft text-ok'
            : 'border-pen-300 bg-surface text-ink shadow-lg';

        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pointer-events-auto relative flex items-start gap-3 rounded-sheet border p-4 shadow-xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-2',
              borderBg
            )}
          >
            <Icon className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-sm font-semibold text-ink leading-tight">{item.title}</h3>
              {item.description && (
                <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-3">
                  {item.description}
                </p>
              )}
              {item.action && (
                <div className="mt-2.5">
                  {item.action.href ? (
                    <Link
                      href={item.action.href}
                      onClick={() => onDismiss(item.id)}
                      className="inline-flex items-center text-xs font-bold text-pen-700 hover:text-pen-800 underline underline-offset-2"
                    >
                      {item.action.label} &rarr;
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        item.action?.onClick?.();
                        onDismiss(item.id);
                      }}
                      className="inline-flex items-center text-xs font-bold text-pen-700 hover:text-pen-800 underline underline-offset-2 cursor-pointer"
                    >
                      {item.action.label}
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="absolute top-3 right-3 text-muted hover:text-ink p-1 rounded-control transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
