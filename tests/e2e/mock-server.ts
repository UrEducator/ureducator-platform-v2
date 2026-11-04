/**
 * LOCAL END-TO-END HARNESS. Never deployed. Binds 127.0.0.1 only.
 *
 * It runs the real endpoint table (functions/src/endpoints.ts) through the same dispatch pipeline Cloud Functions use,
 * against an in-memory store, with a fake identity provider and a controllable clock. Read endpoints mirror what the
 * Firestore rules allow a signed-in student to read. Nothing here talks to Google.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { ROLES, type Role } from '@ureducator/shared';
import { ENDPOINTS } from '../../functions/src/endpoints';
import { dispatch, type Identity } from '../../functions/src/infra/dispatch';
import { MemoryStore } from '../../functions/src/domain/memoryStore';
import { seedDemo } from '../../functions/src/devtools/demoSeed';
import type { AuthPort } from '../../functions/src/services/admin';

type User = { uid: string; email: string; password: string; name: string; emailVerified: boolean; role: Role | null };
type Tok = { uid: string; emailVerified: boolean; role: Role | null };

const PORT = Number(process.env.HARNESS_PORT ?? 4010);
let offset = 0; const now = () => Date.now() + offset;
let store = new MemoryStore(); const users = new Map<string, User>(); const tokens = new Map<string, Tok>();
const errors: { cid: string; message: string }[] = [];

const auth: AuthPort = { async setRole(uid, role) { const u = users.get(uid); if (u) u.role = role; /* claims reach a token only on refresh, as in Firebase */ } };
async function reset() { store = new MemoryStore(); users.clear(); tokens.clear(); offset = 0; errors.length = 0; await seedDemo(store, now()); }

const send = (res: ServerResponse, status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const body = (req: IncomingMessage) => new Promise<unknown>((ok) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 2_000_000) req.destroy(); }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { ok({}); } }); });
const issue = (u: User) => { const token = randomBytes(24).toString('hex'); tokens.set(token, { uid: u.uid, emailVerified: u.emailVerified, role: u.role }); return { token, user: { uid: u.uid, email: u.email, displayName: u.name, emailVerified: u.emailVerified, role: u.role } }; };
const identity = (req: IncomingMessage): Identity => { const t = tokens.get(String(req.headers['x-mock-token'] ?? '')); if (!t) return null; const u = users.get(t.uid); return { uid: t.uid, emailVerified: t.emailVerified, ...(t.role ? { role: t.role } : {}), ...(u ? { email: u.email } : {}) }; };

/** Mirrors firestore.rules for the reads the client performs. */
async function read(name: string, uid: string | null, who: Identity) {
  const own = () => { if (!who || !uid || who.uid !== uid) throw Object.assign(new Error('permission-denied'), { status: 403 }); return uid; };
  const rows = async (c: string, where: [string, '==', unknown][] = [], o: { orderBy?: string; limit?: number } = {}) => (await store.list<Record<string, unknown>>(c, { where, limit: o.limit ?? 500, ...(o.orderBy ? { orderBy: o.orderBy, desc: true } : {}) })).map((r) => ({ id: r.id, ...r.data }));
  switch (name) {
    case 'catalogue': return { subjects: await rows('subjects'), units: await rows('units'), topics: await rows('topics') };
    case 'publishedTests': return rows('mockTests', [['status', '==', 'published']]);
    case 'publishedPlans': return rows('plans', [['published', '==', true]]);
    case 'blueprints': return Object.fromEntries((await rows('examBlueprints')).map(({ id, ...r }) => [id, r]));
    case 'profile': return store.get(`users/${own()}`);
    case 'snapshot': return store.get(`performanceSnapshots/${own()}`);
    case 'studyPlan': return store.get(`studyPlans/${own()}`);
    case 'subscription': return store.get(`subscriptions/${own()}`);
    case 'attempts': return rows('examSessions', [['uid', '==', own()]], { orderBy: 'startedAtMs', limit: 50 });
    case 'results': return rows('results', [['uid', '==', own()]], { orderBy: 'submittedAtMs', limit: 50 });
    default: throw Object.assign(new Error('unknown read'), { status: 404 });
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', 'content-type,x-mock-token'); res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1'); const path = url.pathname;
  try {
    if (path === '/__health') return send(res, 200, { ok: true, now: now(), offsetMs: offset, errors });
    if (path === '/__reset') { await reset(); return send(res, 200, { ok: true }); }
    if (path === '/__clock') { const b = (await body(req)) as { advanceMs?: number }; offset += Number(b.advanceMs ?? 0); return send(res, 200, { now: now() }); }
    if (path === '/__setRole') { const b = (await body(req)) as { email: string; role: Role | null; verified?: boolean }; const u = [...users.values()].find((x) => x.email === b.email); if (!u) return send(res, 404, { error: { message: 'no such user' } }); if (b.role !== null && !ROLES.includes(b.role)) return send(res, 400, { error: { message: 'bad role' } }); u.role = b.role; if (b.verified !== undefined) u.emailVerified = b.verified; return send(res, 200, { ok: true }); }

    if (path === '/auth/signup') {
      const b = (await body(req)) as { email?: string; password?: string; name?: string };
      if (!b.email || !b.password || b.password.length < 8) return send(res, 400, { error: { code: 'invalid-argument', reason: 'WEAK_PASSWORD', message: 'Use a password with at least 8 characters.' } });
      if ([...users.values()].some((u) => u.email === b.email!.toLowerCase())) return send(res, 400, { error: { code: 'already-exists', reason: 'EMAIL_IN_USE', message: 'An account with this email already exists. Try signing in.' } });
      const u: User = { uid: 'u_' + randomUUID().slice(0, 12), email: b.email.toLowerCase(), password: b.password, name: b.name ?? '', emailVerified: false, role: null }; users.set(u.uid, u);
      return send(res, 200, issue(u));
    }
    if (path === '/auth/signin') {
      const b = (await body(req)) as { email?: string; password?: string }; const u = [...users.values()].find((x) => x.email === (b.email ?? '').toLowerCase());
      if (!u || u.password !== b.password) return send(res, 400, { error: { code: 'unauthenticated', reason: 'BAD_CREDENTIALS', message: 'Email or password is incorrect.' } });
      return send(res, 200, issue(u));
    }
    if (path === '/auth/refresh') { const t = tokens.get(String(req.headers['x-mock-token'] ?? '')); const u = t && users.get(t.uid); return u ? send(res, 200, issue(u)) : send(res, 401, { error: { code: 'unauthenticated', reason: 'SIGN_IN_REQUIRED', message: 'Please sign in.' } }); }
    if (path === '/auth/verify') { const t = tokens.get(String(req.headers['x-mock-token'] ?? '')); const u = t && users.get(t.uid); if (u) u.emailVerified = true; return send(res, 200, { ok: true }); }

    if (path.startsWith('/read/')) {
      try { return send(res, 200, { data: await read(path.slice(6), url.searchParams.get('uid'), identity(req)) }); }
      catch (e) { return send(res, (e as { status?: number }).status ?? 500, { error: { code: 'permission-denied', reason: 'DENIED', message: 'You do not have access to this.' } }); }
    }
    if (path.startsWith('/call/')) {
      const name = path.slice(6) as keyof typeof ENDPOINTS; const def = ENDPOINTS[name];
      if (!def) return send(res, 404, { error: { code: 'not-found', reason: 'NO_SUCH_FUNCTION', message: 'Not found.' } });
      const out = await dispatch(name, def as never, await body(req), identity(req), { d: { store, clock: now }, auth, ip: '127.0.0.1', secret: () => null, onError: (cid, e) => errors.push({ cid, message: String((e as Error)?.stack ?? e) }) });
      return out.ok ? send(res, 200, { data: out.data }) : send(res, 400, { error: out.error });
    }
    return send(res, 404, { error: { message: 'not found' } });
  } catch (e) { errors.push({ cid: '-', message: String((e as Error)?.stack ?? e) }); return send(res, 500, { error: { code: 'internal', reason: 'INTERNAL', message: 'Harness error.' } }); }
});

void reset().then(() => server.listen(PORT, '127.0.0.1', () => console.log(`harness listening on http://127.0.0.1:${PORT}`)));
