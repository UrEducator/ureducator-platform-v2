import { describe, expect, it } from 'vitest';
import { getExamResult, getSession, saveResponses, startExam, submitExam, sessionIdFor } from '../services/exam';
import type { Actor, MockTestDoc } from '../domain/types';
import { P } from '../domain/paths';
import { alice, bob, resp, seed } from './fixtures';

const T0 = 1_800_000_000_000;
const mkDeps = async (o = {}) => { let now = T0; const store = await seed(o); return { d: { store, clock: () => now }, store, tick: (ms: number) => (now += ms), at: (ms: number) => (now = ms) }; };
const start = (d: Awaited<ReturnType<typeof mkDeps>>['d'], actor: Actor = alice, id = 'r1') => startExam(d, actor, { mockTestId: 'mt1', language: 'en', clientRequestId: id });

describe('startExam', () => {
  it('creates a server-timed session and never returns answers or explanations', async () => {
    const { d } = await mkDeps();
    const p = await start(d);
    expect(p.questions).toHaveLength(5);
    expect(p.deadlineMs).toBe(T0 + 10 * 60_000);
    const json = JSON.stringify(p);
    expect(json).not.toMatch(/"correct":\[|"correctOptions"|explanation|because q|_correct/);
    expect(p.blueprint.marking).toEqual({ correct: 2, incorrect: 0 });
  });
  it('is idempotent for the same client request id and resumes an open attempt', async () => {
    const { d, store } = await mkDeps();
    const a = await start(d, alice, 'r1');
    const b = await start(d, alice, 'r1');
    const c = await start(d, alice, 'r2'); // different request, same test, attempt still open -> resumed
    expect(b.sessionId).toBe(a.sessionId);
    expect(c.sessionId).toBe(a.sessionId);
    expect(await store.count('examSessions', [])).toBe(1);
  });
  it('requires a verified email, a published test and entitlement for paid tests', async () => {
    const { d } = await mkDeps();
    await expect(start(d, { uid: 'x', emailVerified: false })).rejects.toMatchObject({ reason: 'EMAIL_NOT_VERIFIED' });
    const draft = await mkDeps({ status: 'draft' });
    await expect(start(draft.d)).rejects.toMatchObject({ reason: 'TEST_NOT_AVAILABLE' });
    const paid = await mkDeps({ access: 'paid' });
    await expect(start(paid.d)).rejects.toMatchObject({ reason: 'NOT_ENTITLED' });
    await paid.store.set(P.subscription('alice'), { status: 'active', expiresAtMs: T0 + 1e9, entitlements: ['all'] });
    await expect(start(paid.d)).resolves.toBeTruthy();
    await paid.store.set(P.subscription('bob'), { status: 'active', expiresAtMs: T0 - 1, entitlements: ['all'] });
    await expect(start(paid.d, bob)).rejects.toMatchObject({ reason: 'NOT_ENTITLED' });
  });
  it('honours the schedule window', async () => {
    const { d } = await mkDeps({ opensAtMs: T0 + 1000 });
    await expect(start(d)).rejects.toMatchObject({ reason: 'TEST_NOT_OPEN' });
    const closed = await mkDeps({ closesAtMs: T0 - 1000 });
    await expect(start(closed.d)).rejects.toMatchObject({ reason: 'TEST_CLOSED' });
  });
  it('blocks the 7th attempt when 6 sessions started within the hour (rate limit)', async () => {
    const { d, tick } = await mkDeps();
    for (let i = 0; i < 6; i++) {
      const p = await start(d, alice, `r${i}`);
      await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: `s${i}`, finalSeq: 0, reason: 'manual' });
      tick(1000);
    }
    await expect(start(d, alice, 'r-extra')).rejects.toMatchObject({ reason: 'TOO_MANY_ATTEMPTS' });
  });
  it('allows starting exam when past sessions are older than 1 hour (verifying deployed index query pattern)', async () => {
    const { d, at } = await mkDeps();
    // Simulate 6 sessions started 2 hours ago
    at(T0 - 7_200_000);
    for (let i = 0; i < 6; i++) {
      const p = await start(d, alice, `r-old-${i}`);
      await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: `s-old-${i}`, finalSeq: 0, reason: 'manual' });
    }
    // Advance clock to T0
    at(T0);
    // User should be able to start a new test because all past sessions are older than 1 hour
    await expect(start(d, alice, 'r-fresh')).resolves.toMatchObject({ sessionId: expect.any(String) });
  });
  it('allows starting exam with mixture of old and recent sessions when recent count < 6, blocks when recent count reaches 6', async () => {
    const { d, at } = await mkDeps();
    // 4 sessions 2 hours ago
    at(T0 - 7_200_000);
    for (let i = 0; i < 4; i++) {
      const p = await start(d, alice, `r-mix-old-${i}`);
      await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: `s-mix-old-${i}`, finalSeq: 0, reason: 'manual' });
    }
    // 2 sessions 10 minutes ago
    at(T0 - 600_000);
    for (let i = 0; i < 2; i++) {
      const p = await start(d, alice, `r-mix-rec-${i}`);
      await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: `s-mix-rec-${i}`, finalSeq: 0, reason: 'manual' });
    }
    // Total 6 sessions in database, but only 2 within 1 hour: 3rd recent start should succeed
    at(T0);
    const pAllowed = await start(d, alice, 'r-mix-rec-2');
    await submitExam(d, alice, { sessionId: pAllowed.sessionId, clientRequestId: 's-mix-rec-2', finalSeq: 0, reason: 'manual' });

    // Add 3 more recent sessions (now 6 recent sessions: indices 0..5)
    for (let i = 3; i < 6; i++) {
      const p = await start(d, alice, `r-mix-rec-${i}`);
      await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: `s-mix-rec-${i}`, finalSeq: 0, reason: 'manual' });
    }
    // 7th recent attempt should be blocked
    await expect(start(d, alice, 'r-mix-rec-blocked')).rejects.toMatchObject({ reason: 'TOO_MANY_ATTEMPTS' });
  });
  it('guarantees correct descending ordering and bounded retrieval', async () => {
    const { d, at, store } = await mkDeps();
    // Simulate 10 historical sessions, spaced 2 hours apart starting 24 hours ago
    for (let i = 0; i < 10; i++) {
      at(T0 - (24 - i * 2) * 3_600_000);
      const p = await start(d, alice, `r-bound-hist-${i}`);
      await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: `s-bound-hist-${i}`, finalSeq: 0, reason: 'manual' });
    }
    expect(await store.count('examSessions', [['uid', '==', alice.uid]])).toBe(10);

    // Current time: bounded retrieval of limit 6 retrieves the 6 most recent historical sessions (6h to 16h ago) -> allowed
    at(T0);
    const p1 = await start(d, alice, 'r-bound-rec-0');
    await submitExam(d, alice, { sessionId: p1.sessionId, clientRequestId: 's-bound-rec-0', finalSeq: 0, reason: 'manual' });

    // Now add 5 more recent sessions within the last hour (total 6 recent: rec-0 through rec-5)
    for (let i = 1; i < 6; i++) {
      const p = await start(d, alice, `r-bound-rec-${i}`);
      await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: `s-bound-rec-${i}`, finalSeq: 0, reason: 'manual' });
    }

    // Now there are 16 total sessions in the store (10 historical + 6 recent).
    // Bounded query with desc: true retrieves the 6 recent sessions and correctly blocks the 7th attempt within the hour.
    // If order were asc, it would retrieve the oldest historical sessions and fail to enforce the limit.
    await expect(start(d, alice, 'r-bound-rec-7th')).rejects.toMatchObject({ reason: 'TOO_MANY_ATTEMPTS' });
  });
  it('refuses to open a paper that does not match its blueprint', async () => {
    const { d, store } = await mkDeps();
    const paper = (await store.get<{ questions: unknown[] }>(P.paper('p1')))!;
    await store.merge(P.paper('p1'), { questions: paper.questions.slice(0, 4) });
    await store.set(P.paper('p1'), { ...paper, questions: paper.questions.slice(0, 4) });
    await expect(start(d)).rejects.toMatchObject({ reason: 'PAPER_BLUEPRINT_MISMATCH' });
  });

  describe('A1 Pilot Access Gate', () => {
    it('fails closed and blocks access when no pilotCohort settings exist', async () => {
      const { d, store } = await mkDeps();
      await store.delete(P.setting('pilotCohort'));
      // Fails closed by default: non-allowlisted users are completely locked out
      await expect(start(d, alice)).rejects.toMatchObject({
        code: 'permission-denied',
        reason: 'PILOT_ACCESS_DENIED',
      });
      // Individual active document in pilotCohort collection can still grant access
      await store.set(P.pilotCohort('alice'), { active: true, uid: 'alice' });
      await expect(start(d, alice)).resolves.toMatchObject({ sessionId: expect.any(String) });
    });

    it('allows access when pilotCohort settings have enabled: false', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), { enabled: false, allowedEmails: ['pilot@example.com'] });
      await expect(start(d, alice)).resolves.toMatchObject({ sessionId: expect.any(String) });
    });

    it('forcefully blocks verified non-cohort accounts when pilotCohort is enabled', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), {
        enabled: true,
        allowedEmails: ['pilot1@example.com', 'pilot2@example.com'],
        allowedUids: ['uid_pilot_1'],
      });
      const nonCohort = { uid: 'eve_non_cohort', emailVerified: true, email: 'eve@random.com' };
      await expect(start(d, nonCohort)).rejects.toMatchObject({
        code: 'permission-denied',
        reason: 'PILOT_ACCESS_DENIED',
        message: expect.stringContaining('closed private pilot'),
      });
    });

    it('permits allowlisted account matching by email (case-insensitive)', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), {
        enabled: true,
        allowedEmails: ['Cohort.Student@Example.Com'],
      });
      const cohortUser = { uid: 'student_123', emailVerified: true, email: 'cohort.student@example.com' };
      await expect(start(d, cohortUser)).resolves.toMatchObject({ sessionId: expect.any(String) });
    });

    it('permits allowlisted account matching by UID', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), {
        enabled: true,
        allowedUids: ['uid_authorized_456'],
      });
      const cohortUser = { uid: 'uid_authorized_456', emailVerified: true, email: 'other@example.com' };
      await expect(start(d, cohortUser)).resolves.toMatchObject({ sessionId: expect.any(String) });
    });

    it('resolves email from user document when actor.email is omitted', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), {
        enabled: true,
        allowedEmails: ['lookup@example.com'],
      });
      await store.set(P.user('uid_lookup_user'), { email: 'lookup@example.com' });
      const actorWithoutEmail = { uid: 'uid_lookup_user', emailVerified: true };
      await expect(start(d, actorWithoutEmail)).resolves.toMatchObject({ sessionId: expect.any(String) });
    });

    it('permits account allowlisted via individual pilotCohort collection document by email or uid', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedEmails: [] });
      await store.set(P.pilotCohort('member1@example.com'), { active: true, email: 'member1@example.com' });
      await store.set(P.pilotCohort('uid_member2'), { active: true, uid: 'uid_member2' });

      await expect(start(d, { uid: 'uid_1', emailVerified: true, email: 'member1@example.com' })).resolves.toMatchObject({ sessionId: expect.any(String) });
      await expect(start(d, { uid: 'uid_member2', emailVerified: true, email: 'unknown@example.com' })).resolves.toMatchObject({ sessionId: expect.any(String) });
      await expect(start(d, { uid: 'uid_unauthorized', emailVerified: true, email: 'unauthorized@example.com' })).rejects.toMatchObject({ reason: 'PILOT_ACCESS_DENIED' });
    });

    it('bypasses pilot gate for staff and owner roles', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedEmails: [] });
      const adminActor = { uid: 'admin_1', emailVerified: true, role: 'admin' };
      const ownerActor = { uid: 'owner_1', emailVerified: true, role: 'owner' };
      await expect(start(d, adminActor)).resolves.toMatchObject({ sessionId: expect.any(String) });
      await expect(start(d, ownerActor)).resolves.toMatchObject({ sessionId: expect.any(String) });
    });

    it('honours appliesTo filters when pilot gate is scoped to specific test kinds or test IDs', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), {
        enabled: true,
        allowedEmails: ['pilot@example.com'],
        appliesTo: { kinds: ['paper1'] },
      });
      // mt1 in fixtures has kind: 'full' -> not scoped to paper1, so non-pilot user is allowed
      const nonPilot = { uid: 'non_pilot_user', emailVerified: true, email: 'eve@random.com' };
      await expect(start(d, nonPilot)).resolves.toMatchObject({ sessionId: expect.any(String) });

      // Change mt1 to kind: 'paper1' -> now scoped, non-pilot user is blocked
      const cur = (await store.get<MockTestDoc>(P.mockTest('mt1')))!;
      await store.set(P.mockTest('mt1'), { ...cur, kind: 'paper1' });
      await expect(start(d, nonPilot)).rejects.toMatchObject({ reason: 'PILOT_ACCESS_DENIED' });

      // Allowlisted user is permitted
      await expect(start(d, { uid: 'pilot_user', emailVerified: true, email: 'pilot@example.com' })).resolves.toMatchObject({ sessionId: expect.any(String) });
    });

    it('blocks member with active: false in individual pilotCohort doc', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedEmails: [] });
      await store.set(P.pilotCohort('inactive@example.com'), { active: false, email: 'inactive@example.com' });
      await expect(start(d, { uid: 'uid_inactive', emailVerified: true, email: 'inactive@example.com' }))
        .rejects.toMatchObject({ reason: 'PILOT_ACCESS_DENIED' });
    });

    it('blocks removed member when document is deleted from pilotCohort collection', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedEmails: [] });
      await store.set(P.pilotCohort('temp@example.com'), { active: true, email: 'temp@example.com' });
      await expect(start(d, { uid: 'uid_temp', emailVerified: true, email: 'temp@example.com' })).resolves.toBeTruthy();
      await store.delete(P.pilotCohort('temp@example.com'));
      await expect(start(d, { uid: 'uid_temp', emailVerified: true, email: 'temp@example.com' }, 'r_after_del'))
        .rejects.toMatchObject({ reason: 'PILOT_ACCESS_DENIED' });
    });

    it('exempts super_admin role from pilot access gate', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedEmails: [] });
      const superAdmin = { uid: 'super_admin_user', emailVerified: true, role: 'super_admin' };
      await expect(start(d, superAdmin)).resolves.toMatchObject({ sessionId: expect.any(String) });
    });

    it('blocks non-exempt staff roles (e.g., content_editor) if not on allowlist', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedEmails: [] });
      const editor = { uid: 'editor_1', emailVerified: true, role: 'content_editor', email: 'editor@example.com' };
      await expect(start(d, editor)).rejects.toMatchObject({ reason: 'PILOT_ACCESS_DENIED' });
    });

    it('returns existing session on same-clientRequestId retry even if test has closed, but blocks non-cohort retry', async () => {
      const { d, store } = await mkDeps();
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedEmails: ['pilot@example.com'] });
      const cohortUser = { uid: 'pilot_student', emailVerified: true, email: 'pilot@example.com' };
      const p = await start(d, cohortUser, 'req_idempotent_1');

      // Set closesAtMs in the past so new attempts would be closed
      const cur = (await store.get<MockTestDoc>(P.mockTest('mt1')))!;
      await store.set(P.mockTest('mt1'), { ...cur, closesAtMs: T0 - 1000 });

      // Same-clientRequestId retry succeeds and returns existing session despite test being closed
      const retry = await start(d, cohortUser, 'req_idempotent_1');
      expect(retry.sessionId).toBe(p.sessionId);

      // A different request id fails with TEST_CLOSED
      await expect(start(d, cohortUser, 'req_idempotent_different')).rejects.toMatchObject({ reason: 'TEST_CLOSED' });

      // If user is removed from allowlist, same-clientRequestId retry is blocked by pilot gate
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedEmails: [] });
      await expect(start(d, cohortUser, 'req_idempotent_1')).rejects.toMatchObject({ reason: 'PILOT_ACCESS_DENIED' });
    });

    it('rejects invalid pilotCohort settings schema with PILOT_CONFIG_INVALID', async () => {
      const { d, store } = await mkDeps();
      // allowedEmails contains non-email string
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedEmails: ['not-an-email'] });
      await expect(start(d, alice)).rejects.toMatchObject({ reason: 'PILOT_CONFIG_INVALID' });

      // allowedUids contains invalid characters (slashes)
      await store.set(P.setting('pilotCohort'), { enabled: true, allowedUids: ['invalid/uid/with/slashes'] });
      await expect(start(d, alice)).rejects.toMatchObject({ reason: 'PILOT_CONFIG_INVALID' });
    });
  });
});

describe('saveResponses', () => {
  it('persists answers, ignores duplicate and stale sequence numbers', async () => {
    const { d } = await mkDeps(); const p = await start(d);
    expect(await saveResponses(d, alice, { sessionId: p.sessionId, seq: 1, responses: [resp('q1', ['a'])] })).toMatchObject({ ok: true, lastSeq: 1 });
    expect(await saveResponses(d, alice, { sessionId: p.sessionId, seq: 1, responses: [resp('q1', ['b'])] })).toMatchObject({ duplicate: true, lastSeq: 1 });
    expect(await saveResponses(d, alice, { sessionId: p.sessionId, seq: 3, responses: [resp('q2', ['b'])] })).toMatchObject({ lastSeq: 3 });
    expect(await saveResponses(d, alice, { sessionId: p.sessionId, seq: 2, responses: [resp('q2', ['d'])] })).toMatchObject({ lastSeq: 3 });
    const got = await getSession(d, alice, p.sessionId);
    expect(got.responses['q1']?.selected).toEqual(['a']);
    expect(got.responses['q2']?.selected).toEqual(['b']);
  });
  it('rejects unknown questions and options, multiple picks on single-answer questions, and foreign sessions', async () => {
    const { d } = await mkDeps(); const p = await start(d);
    await expect(saveResponses(d, alice, { sessionId: p.sessionId, seq: 1, responses: [resp('nope', ['a'])] })).rejects.toMatchObject({ reason: 'UNKNOWN_QUESTION' });
    await expect(saveResponses(d, alice, { sessionId: p.sessionId, seq: 1, responses: [resp('q1', ['z'])] })).rejects.toMatchObject({ reason: 'UNKNOWN_OPTION' });
    await expect(saveResponses(d, alice, { sessionId: p.sessionId, seq: 1, responses: [resp('q1', ['a', 'b'])] })).rejects.toMatchObject({ reason: 'TOO_MANY_OPTIONS' });
    await expect(saveResponses(d, bob, { sessionId: p.sessionId, seq: 1, responses: [resp('q1', ['a'])] })).rejects.toMatchObject({ reason: 'SESSION_NOT_FOUND' });
    await expect(saveResponses(d, alice, { sessionId: p.sessionId, seq: 1, responses: [resp('q4', ['a', 'c'])] })).resolves.toMatchObject({ ok: true });
  });
  it('rejects saves after the deadline (timer tampering cannot extend the exam)', async () => {
    const { d, tick } = await mkDeps(); const p = await start(d);
    tick(10 * 60_000 + 1);
    expect(await saveResponses(d, alice, { sessionId: p.sessionId, seq: 1, responses: [resp('q1', ['a'])] })).toMatchObject({ ok: false, status: 'deadline_passed' });
  });
});

describe('submitExam', () => {
  it('scores on the server and ignores any client-side notion of score', async () => {
    const { d } = await mkDeps(); const p = await start(d);
    const out = await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: 's1', finalSeq: 1, reason: 'manual', responses: [resp('q1', ['a']), resp('q2', ['a']), resp('q4', ['a', 'c'])] });
    expect(out.summary).toMatchObject({ marks: 4, maxMarks: 10, correct: 2, incorrect: 1, unattempted: 2 });
  });
  it('is idempotent: duplicate submissions return the same result and write once', async () => {
    const { d, store } = await mkDeps(); const p = await start(d);
    const a = await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: 's1', finalSeq: 0, reason: 'manual', responses: [resp('q1', ['a'])] });
    const writes = store.writes;
    const b = await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: 's2', finalSeq: 0, reason: 'manual', responses: [resp('q1', ['b'])] });
    expect(b.alreadySubmitted).toBe(true);
    expect(b.summary).toEqual(a.summary);
    expect(store.writes).toBe(writes);
    const snap = await store.get<{ testsTaken: number }>(P.snapshot('alice'));
    expect(snap?.testsTaken).toBe(1);
  });
  it('handles concurrent duplicate submissions exactly once', async () => {
    const { d, store } = await mkDeps(); const p = await start(d);
    const input = { sessionId: p.sessionId, clientRequestId: 's', finalSeq: 0, reason: 'manual' as const, responses: [resp('q1', ['a'])] };
    const all = await Promise.all([submitExam(d, alice, input), submitExam(d, alice, input), submitExam(d, alice, input)]);
    expect(all.filter((x) => !x.alreadySubmitted)).toHaveLength(1);
    expect((await store.get<{ testsTaken: number }>(P.snapshot('alice')))?.testsTaken).toBe(1);
  });
  it('uses only stored answers when the final request arrives long after the deadline', async () => {
    const { d, tick } = await mkDeps(); const p = await start(d);
    await saveResponses(d, alice, { sessionId: p.sessionId, seq: 1, responses: [resp('q1', ['a'])] });
    tick(10 * 60_000 + 31_000);
    const out = await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: 's', finalSeq: 2, reason: 'deadline', responses: [resp('q2', ['b']), resp('q3', ['c'])] });
    expect(out.summary).toMatchObject({ correct: 1, reason: 'deadline' });
  });
  it('accepts the final autosave inside the grace window and marks it as deadline submission', async () => {
    const { d, tick } = await mkDeps(); const p = await start(d);
    tick(10 * 60_000 + 5_000);
    const out = await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: 's', finalSeq: 1, reason: 'deadline', responses: [resp('q2', ['b'])] });
    expect(out.summary).toMatchObject({ correct: 1, reason: 'deadline' });
  });
  it('lets only the owner submit', async () => {
    const { d } = await mkDeps(); const p = await start(d);
    await expect(submitExam(d, bob, { sessionId: p.sessionId, clientRequestId: 's', finalSeq: 0, reason: 'manual' })).rejects.toMatchObject({ reason: 'SESSION_NOT_FOUND' });
  });
  it('creates Error Notebook entries for wrong and flagged answers only', async () => {
    const { d, store } = await mkDeps(); const p = await start(d);
    await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: 's', finalSeq: 0, reason: 'manual', responses: [resp('q1', ['a']), resp('q2', ['a']), resp('q3', [], { marked: true })] });
    const rows = await store.list('errorNotebook/alice/entries', { limit: 50 });
    expect(rows.map((r) => r.id).sort()).toEqual(['p1_q2', 'p1_q3']);
  });
});

describe('expiry and results', () => {
  it('auto-finalises an abandoned attempt when read after the deadline', async () => {
    const { d, tick, store } = await mkDeps(); const p = await start(d);
    await saveResponses(d, alice, { sessionId: p.sessionId, seq: 1, responses: [resp('q1', ['a'])] });
    tick(10 * 60_000 + 60_000);
    await expect(getSession(d, alice, p.sessionId)).rejects.toMatchObject({ reason: 'SESSION_ENDED' });
    const res = await getExamResult(d, alice, p.sessionId);
    expect(res.summary.correct).toBe(1);
    expect((await store.get<{ status: string }>(P.session(p.sessionId)))?.status).toBe('expired_finalised');
  });
  it('hides the result while the exam is running and reveals answers afterwards', async () => {
    const { d } = await mkDeps(); const p = await start(d);
    await expect(getExamResult(d, alice, p.sessionId)).rejects.toMatchObject({ reason: 'EXAM_IN_PROGRESS' });
    await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: 's', finalSeq: 1, reason: 'manual', responses: [resp('q1', ['a'])] });
    const res = await getExamResult(d, alice, p.sessionId);
    expect(res.review).toHaveLength(5);
    expect(res.review?.[0]).toMatchObject({ correct: ['a'], outcome: 'correct' });
    await expect(getExamResult(d, bob, p.sessionId)).rejects.toMatchObject({ reason: 'SESSION_NOT_FOUND' });
  });
  it('keeps answers locked until the window closes when the test uses after_close reveal', async () => {
    const { d, tick } = await mkDeps({ revealPolicy: 'after_close', closesAtMs: T0 + 3_600_000 });
    const p = await start(d);
    await submitExam(d, alice, { sessionId: p.sessionId, clientRequestId: 's', finalSeq: 0, reason: 'manual' });
    const locked = await getExamResult(d, alice, p.sessionId);
    expect(locked.review).toBeNull();
    expect(JSON.stringify(locked)).not.toMatch(/"correct":\[|because/);
    tick(3_600_001);
    expect((await getExamResult(d, alice, p.sessionId)).review).not.toBeNull();
  });
  it('derives session ids deterministically per user and request', () => {
    expect(sessionIdFor('a', 'x')).toBe(sessionIdFor('a', 'x'));
    expect(sessionIdFor('a', 'x')).not.toBe(sessionIdFor('b', 'x'));
  });
});
