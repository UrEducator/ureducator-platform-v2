'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getBackend } from './backend';
import { assertClientEnv } from './env';
import { asApiError, type AuthUser, type Backend } from './types';
import { Spinner, Alert } from '@/components/ui';

type State = { status: 'loading' | 'out' | 'in'; user: AuthUser | null; backend: Backend | null; envError: string | null };
type Ctx = State & { refresh: () => Promise<AuthUser | null>; signOut: () => Promise<void> };
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>({ status: 'loading', user: null, backend: null, envError: null });
  const profileFor = useRef<string | null>(null);

  useEffect(() => {
    const envError = assertClientEnv();
    if (envError) { setS({ status: 'out', user: null, backend: null, envError }); return; }
    let off = () => {}; let dead = false;
    getBackend().then((b) => {
      if (dead) return;
      off = b.auth.onChange((u) => {
        setS({ status: u ? 'in' : 'out', user: u, backend: b, envError: null });
        // Create the profile document once per account on this device; the endpoint is idempotent.
        if (u && profileFor.current !== u.uid) { profileFor.current = u.uid; void b.call('ensureProfile', {}).catch(() => { profileFor.current = null; }); }
        if (!u) profileFor.current = null;
      });
    }).catch((e) => { if (!dead) setS({ status: 'out', user: null, backend: null, envError: asApiError(e).message }); });
    return () => { dead = true; off(); };
  }, []);

  const refresh = useCallback(async () => (s.backend ? s.backend.auth.refresh() : null), [s.backend]);
  const signOut = useCallback(async () => { await s.backend?.auth.signOut(); }, [s.backend]);
  const value = useMemo(() => ({ ...s, refresh, signOut }), [s, refresh, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export function useAuth(): Ctx { const c = useContext(AuthCtx); if (!c) throw new Error('useAuth outside AuthProvider'); return c; }

export const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'content_editor', 'subject_reviewer', 'support_agent', 'analyst'];

/** Client-side convenience only. Every privileged action is re-checked on the server from the signed token. */
export function RequireAuth({ children, verified = false, staff = false }: { children: ReactNode; verified?: boolean; staff?: boolean }) {
  const a = useAuth(); const router = useRouter(); const path = usePathname();
  const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : path;
  useEffect(() => {
    if (a.status === 'out' && !a.envError) router.replace(`/login?next=${encodeURIComponent(next)}`);
    else if (a.status === 'in' && verified && !a.user?.emailVerified) router.replace(`/verify-email?next=${encodeURIComponent(next)}`);
  }, [a.status, a.user, a.envError, router, next, verified]);
  if (a.envError) return <div className="mx-auto max-w-xl p-6"><Alert tone="error" title="This build is not configured correctly">{a.envError}</Alert></div>;
  if (a.status !== 'in' || (verified && !a.user?.emailVerified)) return <Spinner label="Checking your account" />;
  if (staff && !(a.user?.role && STAFF_ROLES.includes(a.user.role))) return <div className="mx-auto grid max-w-xl gap-4 p-6"><Alert tone="warn" title="Staff access only">Your account does not have a staff role. If you should have access, ask the owner to assign one.</Alert><p><a className="font-semibold text-pen-700 underline" href="/app">Go to your dashboard</a></p></div>;
  return <>{children}</>;
}
