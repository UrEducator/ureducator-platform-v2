/* LOCAL TEST HARNESS CLIENT. Compiled only when NEXT_PUBLIC_BACKEND=mock (NEXT_PUBLIC_APP_ENV=local-test). UR_MOCK_BACKEND_MARKER */
import { ENV } from './env';
import { ApiError, type AuthService, type AuthUser, type Backend, type Reads } from './types';

const KEY = 'ur_mock_session';
const load = (): { token: string; user: AuthUser } | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
const store = (s: { token: string; user: AuthUser } | null) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

async function http(path: string, init: { body?: unknown; token?: string } = {}) {
  let res: Response;
  try { res = await fetch(`${ENV.harnessUrl}${path}`, { method: init.body !== undefined ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(init.token ? { 'x-mock-token': init.token } : {}) }, ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}) }); }
  catch { throw new ApiError('unavailable', 'NETWORK', 'Network problem. Check your connection and try again.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) { const e = j.error ?? {}; throw new ApiError(e.code ?? 'unknown', e.reason ?? 'UNKNOWN', e.message ?? 'Something went wrong. Please try again.', e.correlationId); }
  return j;
}

export function createMockBackend(): Backend {
  const listeners = new Set<(u: AuthUser | null) => void>();
  const emit = () => { const s = load(); listeners.forEach((l) => l(s?.user ?? null)); };
  const auth: AuthService = {
    onChange(cb) { listeners.add(cb); cb(load()?.user ?? null); return () => { listeners.delete(cb); }; },
    async signUp(email, password, name) { const j = await http('/auth/signup', { body: { email, password, name } }); store(j); emit(); },
    async signIn(email, password) { const j = await http('/auth/signin', { body: { email, password } }); store(j); emit(); },
    async signOut() { store(null); emit(); },
    async sendReset() { /* the harness sends nothing */ },
    async resendVerification() { /* nothing is sent in the harness */ },
    async refresh() { const s = load(); if (!s) return null; const j = await http('/auth/refresh', { token: s.token }); store(j); emit(); return j.user; },
  };
  const tok = () => load()?.token;
  const read = async <T,>(name: string, uid?: string): Promise<T> => (await http(`/read/${name}${uid ? `?uid=${encodeURIComponent(uid)}` : ''}`, tok() ? { token: tok() as string } : {})).data as T;
  const reads: Reads = {
    catalogue: () => read('catalogue'), publishedTests: () => read('publishedTests'), publishedPlans: () => read('publishedPlans'), blueprints: () => read('blueprints'),
    profile: (uid) => read('profile', uid), attempts: (uid) => read('attempts', uid), results: (uid) => read('results', uid),
    snapshot: (uid) => read('snapshot', uid), studyPlan: (uid) => read('studyPlan', uid), subscription: (uid) => read('subscription', uid),
  };
  return { kind: 'mock', auth, reads, async call(name, data) { return (await http(`/call/${name}`, { body: data ?? {}, ...(tok() ? { token: tok() as string } : {}) })).data; } };
}
