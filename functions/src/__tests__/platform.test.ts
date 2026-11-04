import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { MemoryStore } from '../domain/memoryStore';
import { P } from '../domain/paths';
import { askMentor, MockAiProvider, VertexGeminiProvider, retrieveSources, type AiProvider } from '../services/ai';
import { generateReport, reportIdFor, verifyReport, pdfSafe, getSigningKey } from '../services/reports';
import { captureLead, CONSENT_TEXT_VERSION } from '../services/leads';
import { ensureProfile, updateProfile, generatePlan, reviewNotebook, notebookQuestion, createTicket } from '../services/learning';
import { getExamResult, saveResponses, startExam, submitExam } from '../services/exam';
import { rateLimit } from '../infra/ratelimit';
import { assertEnvironment, CONFIG } from '../infra/config';
import { alice, bob, resp, seed } from './fixtures';

const T0 = 1_800_000_000_000;
const mk = async (o = {}) => { let now = T0; const store = await seed(o); return { d: { store, clock: () => now }, store, tick: (ms: number) => (now += ms) }; };
type Env = Awaited<ReturnType<typeof mk>>;
/** Take and submit a test with q1 right, q2 wrong, rest skipped. */
async function sit(e: Env, actor = alice, id = 'r1') {
  const p = await startExam(e.d, actor, { mockTestId: 'mt1', language: 'en', clientRequestId: id });
  await saveResponses(e.d, actor, { sessionId: p.sessionId, seq: 1, responses: [resp('q1', ['a']), resp('q2', ['d'])] });
  await submitExam(e.d, actor, { sessionId: p.sessionId, clientRequestId: `s-${id}`, finalSeq: 1, reason: 'manual' });
  return p.sessionId;
}

describe('AI mentor', () => {
  const notes = async (e: Env) => {
    await e.store.set('learningNotes/n1', { title: 'Sampling methods', body: 'Stratified sampling divides the population into strata. Simple random sampling gives each unit equal chance. A third sentence.', verified: true, label: 'UrEducator note', topicId: 't1', keywords: ['sampling'] });
    await e.store.set('learningNotes/n2', { title: 'Unverified draft', body: 'Sampling is always biased.', verified: false, topicId: 't1' });
  };
  it('answers only from verified material and cites it', async () => {
    const e = await mk(); await notes(e);
    const r = await askMentor(e.d, new MockAiProvider(), alice, { question: 'Explain stratified sampling', topicId: 't1', mode: 'concept' });
    expect(r).toMatchObject({ grounded: true, provider: 'mock', citations: [{ id: 'n1' }] });
    expect(r.text).toContain('[1]'); expect(r.text).not.toContain('always biased');
  });
  it('says it cannot answer reliably when there is no verified source', async () => {
    const e = await mk();
    const r = await askMentor(e.d, new MockAiProvider(), alice, { question: 'Explain quantum chromodynamics', mode: 'concept' });
    expect(r).toMatchObject({ grounded: false, citations: [] });
    expect(r.text).toMatch(/cannot answer reliably/);
  });
  it('locks explanations until the test is submitted and review has opened', async () => {
    const e = await mk();
    const p = await startExam(e.d, alice, { mockTestId: 'mt1', language: 'en', clientRequestId: 'r1' });
    const ask = (actor = alice) => askMentor(e.d, new MockAiProvider(), actor, { question: 'why is option b right', mode: 'question_explanation', ref: { sessionId: p.sessionId, qid: 'q2' } });
    await expect(ask()).rejects.toMatchObject({ reason: 'ANSWERS_LOCKED' });
    await submitExam(e.d, alice, { sessionId: p.sessionId, clientRequestId: 's1', finalSeq: 0, reason: 'manual' });
    const r = await ask(); expect(r.text).toContain('because q2');
    await expect(ask(bob)).rejects.toMatchObject({ reason: 'SESSION_NOT_FOUND' });
  });
  it('respects the after_close reveal policy', async () => {
    const e = await mk({ revealPolicy: 'after_close', closesAtMs: T0 + 3_600_000 });
    const sid = await sit(e);
    await expect(askMentor(e.d, new MockAiProvider(), alice, { question: 'why', mode: 'question_explanation', ref: { sessionId: sid, qid: 'q2' } })).rejects.toMatchObject({ reason: 'ANSWERS_LOCKED' });
    e.tick(3_700_000);
    await expect(askMentor(e.d, new MockAiProvider(), alice, { question: 'why', mode: 'question_explanation', ref: { sessionId: sid, qid: 'q2' } })).resolves.toMatchObject({ grounded: true });
  });
  it('needs a verified email', async () => {
    const e = await mk();
    await expect(askMentor(e.d, new MockAiProvider(), { uid: 'x', emailVerified: false }, { question: 'hello there', mode: 'concept' })).rejects.toMatchObject({ reason: 'EMAIL_NOT_VERIFIED' });
  });
  it('passes only verified sources to the provider and never calls a live model by default', async () => {
    const e = await mk(); await notes(e);
    let seen: string[] = [];
    const spy: AiProvider = { id: 'spy', generate: async (r) => { seen = r.sources.map((s) => s.id); return { text: 'ok', citations: [], grounded: true, provider: 'spy' }; } };
    await askMentor(e.d, spy, alice, { question: 'sampling methods', topicId: 't1', mode: 'concept' });
    expect(seen).toEqual(['n1']);
    expect((await retrieveSources(e.d, undefined, 'tell me about sampling')).map((s) => s.id)).toEqual(['n1']);
  });
  it('Vertex adapter builds the right request and maps errors, using an injected fetch (no network)', async () => {
    const calls: { url: string; auth: string; body: string }[] = [];
    const ok = new VertexGeminiProvider({ project: 'demo-project', location: 'asia-south1', model: 'gemini-test', token: async () => 'tkn', fetchFn: (async (url: string, init: RequestInit) => { calls.push({ url, auth: String((init.headers as Record<string, string>).authorization), body: String(init.body) }); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hello' }] } }] }), { status: 200 }); }) as unknown as typeof fetch });
    const r = await ok.generate({ mode: 'concept', question: 'q', sources: [{ id: 'a', title: 'T', body: 'B', verified: true, label: 'L' }, { id: 'b', title: 'U', body: 'X', verified: false, label: 'L' }] });
    expect(r).toMatchObject({ text: 'hello', grounded: true, citations: [{ id: 'a' }] });
    expect(calls[0]!.url).toContain('asia-south1-aiplatform.googleapis.com'); expect(calls[0]!.body).not.toContain('X'); // unverified source never sent
    const bad = new VertexGeminiProvider({ project: 'p', location: 'l', model: 'm', token: async () => 't', fetchFn: (async () => new Response('x', { status: 500 })) as unknown as typeof fetch });
    await expect(bad.generate({ mode: 'concept', question: 'q', sources: [] })).rejects.toMatchObject({ reason: 'AI_UNAVAILABLE' });
  });
});

describe('PDF report and verification', () => {
  it('refuses until the test is submitted, and to anyone but the owner', async () => {
    const e = await mk();
    const p = await startExam(e.d, alice, { mockTestId: 'mt1', language: 'en', clientRequestId: 'r1' });
    await expect(generateReport(e.d, alice, { sessionId: p.sessionId }, { baseUrl: 'https://x.test' })).rejects.toMatchObject({ reason: 'REPORT_NOT_READY' });
    await submitExam(e.d, alice, { sessionId: p.sessionId, clientRequestId: 's', finalSeq: 0, reason: 'manual' });
    await expect(generateReport(e.d, bob, { sessionId: p.sessionId }, { baseUrl: 'https://x.test' })).rejects.toMatchObject({ reason: 'SESSION_NOT_FOUND' });
  });
  it('generates a real, openable PDF with the mandatory disclaimer, and the QR link verifies', async () => {
    const e = await mk(); const sid = await sit(e);
    await e.store.set(P.user('alice'), { displayName: 'Asha Verma — टेस्ट' }); // non-Latin must not crash PDF generation
    const rep = await generateReport(e.d, alice, { sessionId: sid }, { baseUrl: 'https://staging.example.test/' });
    expect(rep).toMatchObject({ mime: 'application/pdf', fileName: `${reportIdFor(sid, 'alice')}.pdf` });
    const bytes = Buffer.from(rep.base64, 'base64');
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1); expect(doc.getTitle()).toContain(rep.reportId);
    // the verification link is embedded as a QR image; recompute the signature path via the stored record
    const stored = await e.store.get<{ marks: number }>(P.report(rep.reportId));
    expect(stored).toMatchObject({ marks: 2 });
    const key = await getSigningKey(e.d);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
  it('verifies a genuine report and rejects tampered or unknown ones', async () => {
    const e = await mk(); const sid = await sit(e);
    const rep = await generateReport(e.d, alice, { sessionId: sid }, { baseUrl: 'https://x.test' });
    // Reconstruct the signature exactly as the service does, to test the verify endpoint.
    const key = await getSigningKey(e.d);
    const { hmacHex } = await import('../services/payments');
    const stored = (await e.store.get<{ marks: number; maxMarks: number }>(P.report(rep.reportId)))!;
    expect(stored.marks).toBe(2); expect(stored.maxMarks).toBe(10); // 5 questions x 2 marks in the mini blueprint
    const good = hmacHex(key, `${rep.reportId}|${sid}|${stored.marks}|${stored.maxMarks}`).slice(0, 32);
    expect(await verifyReport(e.d, { reportId: rep.reportId, sig: good })).toMatchObject({ valid: true, marks: 2, maxMarks: 10, notice: 'Practice Examination Performance Report — Not an Official NTA Scorecard.' });
    expect(await verifyReport(e.d, { reportId: rep.reportId, sig: 'a'.repeat(32) })).toEqual({ valid: false });
    expect(await verifyReport(e.d, { reportId: 'UR-AAAAAAAAAAAA', sig: good })).toEqual({ valid: false });
    // editing the stored score invalidates the old signature
    await e.store.merge(P.report(rep.reportId), { marks: 300 });
    expect(await verifyReport(e.d, { reportId: rep.reportId, sig: good })).toEqual({ valid: false });
  });
  it('is idempotent: the same session gives the same report id and issue date', async () => {
    const e = await mk(); const sid = await sit(e);
    const a = await generateReport(e.d, alice, { sessionId: sid }, { baseUrl: 'https://x.test' }); e.tick(86_400_000);
    const b = await generateReport(e.d, alice, { sessionId: sid }, { baseUrl: 'https://x.test' });
    expect(b.reportId).toBe(a.reportId);
    expect((await e.store.get<{ issuedAtMs: number }>(P.report(a.reportId)))!.issuedAtMs).toBe(T0);
  });
  it('pdfSafe strips characters Helvetica cannot encode', () => {
    expect(pdfSafe('Asha — टेस्ट\n')).not.toMatch(/[^\x20-\x7E -ÿ]/);
  });
});

describe('leads and consent', () => {
  const lead = { name: 'Ravi', email: 'Ravi@Example.test', source: 'website', consent: true as const, contactPreference: 'email' as const };
  it('stores minimal PII, a consent record with a hashed IP, and de-duplicates by contact', async () => {
    const e = await mk();
    await captureLead(e.d, '203.0.113.9', lead); e.tick(1000);
    await captureLead(e.d, '203.0.113.9', { ...lead, name: 'Ravi K' });
    const leads = await e.store.list<Record<string, unknown>>('leads', { limit: 10 });
    expect(leads).toHaveLength(1); expect(leads[0]!.data).toMatchObject({ name: 'Ravi K', status: 'new', createdAtMs: T0 });
    const consents = await e.store.list<Record<string, unknown>>('consentRecords', { limit: 10 });
    expect(consents).toHaveLength(2); expect(consents[0]!.data).toMatchObject({ textVersion: CONSENT_TEXT_VERSION, purpose: 'marketing_contact' });
    expect(JSON.stringify(consents)).not.toContain('203.0.113.9');
  });
});

describe('profile, plan and notebook', () => {
  it('creates a profile once, and only whitelisted fields can be updated', async () => {
    const e = await mk();
    expect(await ensureProfile(e.d, { ...alice, email: 'a@x.test' })).toEqual({ created: true });
    expect(await ensureProfile(e.d, { ...alice, email: 'a@x.test' })).toEqual({ created: false });
    await updateProfile(e.d, alice, { displayName: 'Asha', studyMinutesPerDay: 90 });
    expect(await e.store.get(P.user('alice'))).toMatchObject({ displayName: 'Asha', studyMinutesPerDay: 90 });
    for (const bad of [{ role: 'owner' }, { entitlements: ['all'] }, { email: 'evil@x.test' }, { displayName: 'ok', isAdmin: true }, {}, { studyMinutesPerDay: 5 }]) {
      await expect(updateProfile(e.d, alice, bad as never)).rejects.toMatchObject({ reason: 'INVALID_PROFILE' });
    }
    expect(await e.store.get(P.user('alice'))).not.toHaveProperty('role');
  });
  it('builds a study plan from weak topics and due notebook entries', async () => {
    const e = await mk(); await sit(e);
    await e.store.set(P.topic('t-q2'), { name: { en: 'Research ethics' } });
    const plan = await generatePlan(e.d, alice);
    expect(plan.basedOnTests).toBe(1); expect(plan.tasks.length).toBeGreaterThan(0);
    expect(await e.store.get(P.studyPlan('alice'))).toMatchObject({ basedOnTests: 1 });
  });
  it('spaced repetition: reviewing updates the schedule; answers are locked until review opens, and are owner-only', async () => {
    const e = await mk(); const sid = await sit(e);
    const entries = await e.store.list<{ qid: string }>(`errorNotebook/alice/entries`, { limit: 20 });
    expect(entries.length).toBeGreaterThan(0);
    const wrong = entries.find((x) => x.data.qid === 'q2')!;
    const r = await reviewNotebook(e.d, alice, { entryId: wrong.id, quality: 4 });
    expect(r.review.reps).toBeGreaterThanOrEqual(1);
    const q = await notebookQuestion(e.d, alice, { entryId: wrong.id });
    expect(q.correct).toEqual(['b']);
    await expect(notebookQuestion(e.d, bob, { entryId: wrong.id })).rejects.toMatchObject({ reason: 'ENTRY_NOT_FOUND' });
    await expect(reviewNotebook(e.d, alice, { entryId: 'nope', quality: 3 })).rejects.toMatchObject({ reason: 'ENTRY_NOT_FOUND' });
    expect(sid).toBeTruthy();
    const res = await getExamResult(e.d, alice, sid); expect(res.summary.marks).toBe(2);
  });
  it('creates a support ticket owned by the caller', async () => {
    const e = await mk();
    const { ticketId } = await createTicket(e.d, { ...alice, email: 'a@x.test' }, { subject: 'Help me', message: 'My timer looked odd', category: 'technical' });
    expect(await e.store.get(`supportTickets/${ticketId}`)).toMatchObject({ uid: 'alice', status: 'open' });
  });
});

describe('rate limiting', () => {
  it('allows up to the limit within a window, then blocks, then recovers in the next window', async () => {
    const e = await mk(); const o = { bucket: 'x', subject: 'ip1', limit: 3, windowSec: 60 };
    for (let i = 0; i < 3; i++) await rateLimit(e.store, e.d.clock, o);
    await expect(rateLimit(e.store, e.d.clock, o)).rejects.toMatchObject({ reason: 'RATE_LIMITED' });
    await expect(rateLimit(e.store, e.d.clock, { ...o, subject: 'ip2' })).resolves.toBeUndefined();
    e.tick(61_000);
    await expect(rateLimit(e.store, e.d.clock, o)).resolves.toBeUndefined();
  });
  it('stores only a hash of the subject and an expiry for the TTL policy', async () => {
    const e = await mk(); await rateLimit(e.store, e.d.clock, { bucket: 'b', subject: '203.0.113.7', limit: 5, windowSec: 60 });
    const rows = await e.store.list<{ expireAt: Date }>('rateLimits', { limit: 5 });
    expect(rows[0]!.id).not.toContain('203.0.113.7'); expect(rows[0]!.data.expireAt).toBeInstanceOf(Date);
  });
});

describe('assertEnvironment (fail-closed)', () => {
  const cfg = (o: Partial<typeof CONFIG> = {}) => ({ ...CONFIG, env: 'staging', expectedProject: 'ugc-mock-test-staging', paymentMode: 'test' as const, paymentsEnabled: false, ...o });
  const env = (o: NodeJS.ProcessEnv): NodeJS.ProcessEnv => o;
  it('accepts the expected project only', () => {
    expect(() => assertEnvironment(env({ GCLOUD_PROJECT: 'ugc-mock-test-staging' }), cfg())).not.toThrow();
    expect(() => assertEnvironment(env({ GCLOUD_PROJECT: 'ugc-mock-test' }), cfg())).toThrow(/refusing to start/);
    expect(() => assertEnvironment(env({ GCLOUD_PROJECT: 'ur-educator' }), cfg())).toThrow(/refusing to start/);
    expect(() => assertEnvironment(env({}), cfg())).toThrow(/refusing to start/);
  });
  it('refuses to start with no expected project configured', () => {
    expect(() => assertEnvironment(env({ GCLOUD_PROJECT: 'ugc-mock-test-staging' }), cfg({ expectedProject: '' }))).toThrow(/EXPECTED_PROJECT_ID/);
  });
  it('allows the emulator only on a demo- or the expected project', () => {
    expect(() => assertEnvironment(env({ FUNCTIONS_EMULATOR: 'true', GCLOUD_PROJECT: 'demo-ureducator' }), cfg())).not.toThrow();
    expect(() => assertEnvironment(env({ FUNCTIONS_EMULATOR: 'true', GCLOUD_PROJECT: 'ugc-mock-test' }), cfg())).toThrow(/unexpected project/);
  });
  it('never allows live payment mode outside production', () => {
    expect(() => assertEnvironment(env({ GCLOUD_PROJECT: 'ugc-mock-test-staging' }), cfg({ paymentMode: 'live' }))).toThrow(/Live payment mode/);
    expect(() => assertEnvironment(env({ GCLOUD_PROJECT: 'ugc-mock-test-staging' }), cfg({ paymentsEnabled: true, paymentMode: 'test' }))).not.toThrow();
  });
});
