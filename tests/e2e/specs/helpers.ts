import { expect, type Page } from '@playwright/test';

export const HARNESS = 'http://127.0.0.1:4010';
export const reset = () => fetch(`${HARNESS}/__reset`, { method: 'POST' });
export const advanceClock = (ms: number) => fetch(`${HARNESS}/__clock`, { method: 'POST', body: JSON.stringify({ advanceMs: ms }) });
export const serverErrors = async () => ((await (await fetch(`${HARNESS}/__health`)).json()) as { errors: unknown[] }).errors;

let n = 0;
/** Creates (and optionally verifies) a user directly against the harness and returns a session the page can adopt. */
export async function makeUser(o: { verified?: boolean; role?: string | null; name?: string } = {}) {
  const email = `student${Date.now()}${n++}@example.test`; const password = 'correct-horse-9';
  const r = await (await fetch(`${HARNESS}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, name: o.name ?? 'Asha Verma' }) })).json() as { token: string };
  if (o.verified !== false || o.role) await fetch(`${HARNESS}/__setRole`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role: o.role ?? null, verified: o.verified !== false }) });
  const s = await (await fetch(`${HARNESS}/auth/refresh`, { method: 'POST', headers: { 'x-mock-token': r.token } })).json() as { token: string; user: unknown };
  return { email, password, session: { token: s.token, user: s.user } };
}
export async function signInAs(page: Page, u: Awaited<ReturnType<typeof makeUser>>) {
  await page.addInitScript((s) => { try { if (!localStorage.getItem('ur_mock_session')) localStorage.setItem('ur_mock_session', JSON.stringify(s)); } catch { /* ignore */ } }, u.session);
}
/** Calls a callable on behalf of a user, bypassing the UI (used to set up state quickly). */
export async function call(u: Awaited<ReturnType<typeof makeUser>>, name: string, data: unknown) {
  const res = await fetch(`${HARNESS}/call/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mock-token': u.session.token }, body: JSON.stringify(data) });
  return { status: res.status, body: (await res.json()) as { data?: any; error?: { reason: string } } };
}
export async function expectNoConsoleErrors(page: Page, fn: () => Promise<void>) {
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await fn(); expect(errs, 'browser console errors').toEqual([]);
}
