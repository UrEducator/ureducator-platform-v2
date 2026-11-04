import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../domain/memoryStore';
import { dispatch } from '../infra/dispatch';
import { ENDPOINTS as E } from '../endpoints';
import { seed } from './fixtures';

const T0 = 1_800_000_000_000;
const auth = { setRole: async () => undefined };
const run = async (name: keyof typeof E, data: unknown, who: Parameters<typeof dispatch>[3], store?: MemoryStore) => {
  const s = store ?? (await seed());
  return dispatch(name, E[name], data, who, { d: { store: s, clock: () => T0 }, auth, ip: '203.0.113.5' });
};
const alice = { uid: 'alice', emailVerified: true };

describe('dispatch pipeline', () => {
  it('rejects unauthenticated calls to protected endpoints, but allows public ones', async () => {
    expect(await run('startExam', { mockTestId: 'mt1', clientRequestId: 'r1' }, null)).toMatchObject({ ok: false, error: { reason: 'SIGN_IN_REQUIRED' } });
    expect(await run('publicConfig', {}, null)).toMatchObject({ ok: true });
  });
  it('requires a verified email for "verified" endpoints', async () => {
    expect(await run('startExam', { mockTestId: 'mt1', clientRequestId: 'r1' }, { uid: 'x', emailVerified: false })).toMatchObject({ ok: false, error: { reason: 'EMAIL_NOT_VERIFIED' } });
  });
  it('validates input before doing anything else, with a safe message', async () => {
    const r = await run('startExam', { mockTestId: '../etc/passwd', clientRequestId: 'r1' }, alice);
    expect(r).toMatchObject({ ok: false, error: { code: 'invalid-argument', reason: 'INVALID_INPUT' } });
    expect(JSON.stringify(r)).not.toMatch(/stack|node_modules/);
  });
  it('maps unexpected errors to an opaque message with a correlation id', async () => {
    const boom = { ...E.ensureProfile, run: async () => { throw new Error('secret connection string leaked'); } };
    const seen: string[] = [];
    const r = await dispatch('boom', boom, {}, alice, { d: { store: new MemoryStore(), clock: () => T0 }, auth, ip: 'x', cid: 'abcdef1234567890', onError: (cid) => seen.push(cid) });
    expect(r).toMatchObject({ ok: false, error: { code: 'internal', reason: 'INTERNAL', correlationId: 'abcdef1234567890' } });
    expect(JSON.stringify(r)).not.toContain('secret connection string');
    expect(seen).toEqual(['abcdef1234567890']);
  });
  it('rate limits per caller', async () => {
    const store = new MemoryStore();
    for (let i = 0; i < 5; i++) expect(await run('captureLead', { name: 'A', email: `a${i}@x.test`, consent: true }, null, store)).toMatchObject({ ok: true });
    expect(await run('captureLead', { name: 'A', email: 'z@x.test', consent: true }, null, store)).toMatchObject({ ok: false, error: { reason: 'RATE_LIMITED' } });
  });
  it('payments endpoints are inert while disabled (default config)', async () => {
    expect(await run('createOrder', { planId: 'pro' }, alice)).toMatchObject({ ok: false, error: { reason: 'PAYMENTS_DISABLED' } });
    expect(await run('verifyPayment', { orderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 'a'.repeat(64) }, alice)).toMatchObject({ ok: false, error: { reason: 'PAYMENTS_DISABLED' } });
  });
  it('every staff endpoint refuses a plain student', async () => {
    const staffEndpoints = (Object.keys(E) as (keyof typeof E)[]).filter((n) => n.startsWith('admin') || n === 'assignRole');
    expect(staffEndpoints.length).toBeGreaterThanOrEqual(11);
    for (const n of staffEndpoints) {
      const r = await run(n, {}, alice);
      // either schema validation or authorization rejects it; it must never succeed
      expect(r.ok, n).toBe(false);
    }
  });
  it('declares the expected set of endpoints (guards against accidental removal)', () => {
    expect(Object.keys(E).sort()).toEqual(['adminList', 'adminPublishMockTest', 'adminSaveQuestion', 'adminTransitionQuestion', 'adminUnpublishMockTest', 'adminUpdateLead', 'adminUpdateTicket', 'adminUpsertCatalogue', 'adminUpsertMockTest', 'adminUpsertPlan', 'askMentor', 'assignRole', 'captureLead', 'claimOwner', 'createOrder', 'createTicket', 'ensureProfile', 'generatePlan', 'generateReport', 'getExamResult', 'getExamSession', 'listNotebook', 'notebookQuestion', 'publicConfig', 'reviewNotebook', 'saveResponses', 'startExam', 'submitExam', 'updateProfile', 'verifyPayment', 'verifyReport'].sort());
  });
});
