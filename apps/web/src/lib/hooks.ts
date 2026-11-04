'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { asApiError, type ApiError, type Backend } from './types';

export type Async<T> = { data: T | null; error: ApiError | null; loading: boolean; reload: () => void };
/** Loads data once the backend is ready. `fn` must be stable for the same inputs (pass deps). */
export function useLoad<T>(fn: (b: Backend) => Promise<T>, deps: unknown[] = [], enabled = true): Async<T> {
  const { backend } = useAuth();
  const [st, setSt] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  const fnRef = useRef(fn); fnRef.current = fn;
  useEffect(() => {
    if (!backend || !enabled) return;
    let cancelled = false; setSt((p) => ({ ...p, loading: true, error: null }));
    fnRef.current(backend).then((data) => { if (!cancelled) setSt({ data, error: null, loading: false }); }).catch((e) => { if (!cancelled) setSt({ data: null, error: asApiError(e), loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, enabled, n, ...deps]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { ...st, reload };
}
export function useBackendReady(): Backend | null { return useAuth().backend; }

export function useDocumentTitle(t: string) { useEffect(() => { document.title = `${t} | UrEducator`; }, [t]); }

export const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (ms: number) => new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtClock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
export const fmtDuration = (ms: number) => {
  const sec = Math.max(0, Math.round(ms / 1000)); if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60); if (m < 60) return sec % 60 && m < 10 ? `${m} min ${sec % 60} s` : `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
};
export const pct = (x: number) => `${Math.round(x * 100)}%`;
