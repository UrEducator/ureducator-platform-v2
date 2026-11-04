import { createHash } from 'node:crypto';
import {
  BlueprintSchema, LIMITS, PublishedPaperSchema, applySave, mergeTopics, scoreAttempt, seededOrder,
  type AnswerKey, type Blueprint, type ExamResponse, type PaperQuestion, type PublishedPaper,
} from '@ureducator/shared';
import type { Actor, Clock, MockTestDoc, ResponsesDoc, ResultDoc, SessionDoc, SnapshotDoc } from '../domain/types';
import { P } from '../domain/paths';
import type { Store, TxStore } from '../domain/store';
import { err } from '../infra/errors';

export type Deps = { store: Store; clock: Clock };

export const sessionIdFor = (uid: string, clientRequestId: string) =>
  's_' + createHash('sha256').update(`${uid}:${clientRequestId}`).digest('hex').slice(0, 28);

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/* ---------------------------------------------------------------- start */
export async function startExam(d: Deps, actor: Actor, input: { mockTestId: string; language: 'en' | 'hi'; clientRequestId: string }) {
  if (!actor.emailVerified) throw err('failed-precondition', 'EMAIL_NOT_VERIFIED', 'Verify your email address before starting a test.');
  const now = d.clock();
  const sid = sessionIdFor(actor.uid, input.clientRequestId);

  const same = await d.store.get<SessionDoc>(P.session(sid));
  if (same) return sessionPayload(d, sid, same);

  const test = await d.store.get<MockTestDoc>(P.mockTest(input.mockTestId));
  if (!test || test.status !== 'published') throw err('not-found', 'TEST_NOT_AVAILABLE', 'This test is not available.');
  if (test.opensAtMs && now < test.opensAtMs) throw err('failed-precondition', 'TEST_NOT_OPEN', 'This test has not opened yet.');
  if (test.closesAtMs && now > test.closesAtMs) throw err('failed-precondition', 'TEST_CLOSED', 'This test window has closed.');
  if (test.access === 'paid' && !(await hasEntitlement(d, actor.uid, test, now))) throw err('permission-denied', 'NOT_ENTITLED', 'This test needs an active plan.');

  // Resume the learner's open attempt on the same test instead of creating a second one.
  const open = await d.store.list<SessionDoc>('examSessions', { where: [['uid', '==', actor.uid], ['mockTestId', '==', input.mockTestId], ['status', '==', 'in_progress']], limit: 5 });
  for (const row of open) {
    if (row.data.deadlineMs > now) return sessionPayload(d, row.id, row.data);
    await finaliseExpired(d, row.id); // an old attempt that ran out of time is closed before a new one starts
  }

  const recent = await d.store.count('examSessions', [['uid', '==', actor.uid], ['startedAtMs', '>=', now - 3_600_000]]);
  if (recent >= LIMITS.maxSessionsPerHourPerUser) throw err('resource-exhausted', 'TOO_MANY_ATTEMPTS', 'Too many tests started recently. Please try again later.');

  const bp = BlueprintSchema.parse(await d.store.get(P.blueprint(test.blueprintId)));
  const paper = await loadPaper(d, test.paperId);
  const bySection = new Map(bp.sections.map((s) => [s.id, [] as PaperQuestion[]]));
  for (const q of paper.questions) bySection.get(q.sectionId)?.push(q);
  for (const s of bp.sections) if ((bySection.get(s.id)?.length ?? 0) !== s.questionCount) throw err('failed-precondition', 'PAPER_BLUEPRINT_MISMATCH', 'This test is not ready.');
  const ordered: PaperQuestion[] = bp.sections.flatMap((s) => (test.shuffle ? seededOrder(bySection.get(s.id) ?? [], sid + s.id) : bySection.get(s.id) ?? []));

  const qmeta: SessionDoc['qmeta'] = {};
  for (const q of ordered) qmeta[q.qid] = { opts: q.content.options.map((o) => o.id).join(''), multi: q.content.type === 'mcq_multi' };

  const session: SessionDoc = {
    uid: actor.uid, mockTestId: input.mockTestId, paperId: test.paperId, paperVersion: test.paperVersion, testTitle: test.title,
    blueprint: bp, language: input.language, questionOrder: ordered.map((q) => q.qid), qmeta,
    startedAtMs: now, deadlineMs: now + bp.durationMinutes * 60_000, status: 'in_progress', lastSeq: 0, clientRequestId: input.clientRequestId,
  };
  await d.store.transact(async (tx) => { tx.create(P.session(sid), session); tx.create(P.responses(sid), { byQid: {} } satisfies ResponsesDoc); });
  return sessionPayload(d, sid, session);
}

async function hasEntitlement(d: Deps, uid: string, test: MockTestDoc, now: number) {
  const sub = await d.store.get<{ status: string; expiresAtMs: number; entitlements: string[] }>(P.subscription(uid));
  if (!sub || sub.status !== 'active' || sub.expiresAtMs < now) return false;
  return sub.entitlements.includes('all') || (!!test.collectionId && sub.entitlements.includes(test.collectionId));
}

async function loadPaper(d: Deps, paperId: string): Promise<PublishedPaper> {
  const raw = await d.store.get(P.paper(paperId));
  const parsed = PublishedPaperSchema.safeParse(raw); // schema strips any stray fields such as answers
  if (!parsed.success) throw err('failed-precondition', 'PAPER_INVALID', 'This test is not ready.');
  return parsed.data;
}

/** Student-facing state. By construction it contains no answer keys or explanations. */
export async function sessionPayload(d: Deps, sid: string, s: SessionDoc) {
  const paper = await loadPaper(d, s.paperId);
  const byId = new Map(paper.questions.map((q) => [q.qid, q]));
  const responses = (await d.store.get<ResponsesDoc>(P.responses(sid)))?.byQid ?? {};
  return {
    sessionId: sid, serverNowMs: d.clock(), startedAtMs: s.startedAtMs, deadlineMs: s.deadlineMs, status: s.status, lastSeq: s.lastSeq,
    language: s.language, testTitle: s.testTitle,
    blueprint: { durationMinutes: s.blueprint.durationMinutes, sections: s.blueprint.sections, marking: { correct: s.blueprint.marking.correct, incorrect: s.blueprint.marking.incorrect }, languages: s.blueprint.languages },
    questions: s.questionOrder.map((id) => byId.get(id)).filter((q): q is PaperQuestion => !!q),
    responses,
  };
}

/* ---------------------------------------------------------------- resume */
export async function getSession(d: Deps, actor: Actor, sessionId: string) {
  const s = await d.store.get<SessionDoc>(P.session(sessionId));
  if (!s || s.uid !== actor.uid) throw err('not-found', 'SESSION_NOT_FOUND', 'Session not found.');
  if (s.status === 'in_progress' && d.clock() > s.deadlineMs + LIMITS.autosaveGraceMs) {
    await finaliseExpired(d, sessionId);
    throw err('failed-precondition', 'SESSION_ENDED', 'This test has ended. Your answers were submitted.');
  }
  if (s.status !== 'in_progress') throw err('failed-precondition', 'SESSION_ENDED', 'This test has ended.');
  return sessionPayload(d, sessionId, s);
}

/* ---------------------------------------------------------------- autosave */
export async function saveResponses(d: Deps, actor: Actor, input: { sessionId: string; seq: number; responses: ExamResponse[] }) {
  const now = d.clock();
  return d.store.transact(async (tx) => {
    const s = await tx.get<SessionDoc>(P.session(input.sessionId));
    if (!s || s.uid !== actor.uid) throw err('not-found', 'SESSION_NOT_FOUND', 'Session not found.');
    if (s.status !== 'in_progress') return { ok: true as const, status: s.status, lastSeq: s.lastSeq, serverNowMs: now };
    if (now > s.deadlineMs) return { ok: false as const, status: 'deadline_passed' as const, lastSeq: s.lastSeq, serverNowMs: now };
    const verdict = applySave(s.lastSeq, input.seq);
    if (verdict !== 'apply') return { ok: true as const, status: 'in_progress' as const, lastSeq: s.lastSeq, serverNowMs: now, duplicate: verdict === 'duplicate' };
    const clean = validateResponses(s, input.responses);
    tx.merge(P.responses(input.sessionId), { byQid: Object.fromEntries(clean.map((r) => [r.qid, r])) });
    tx.merge(P.session(input.sessionId), { lastSeq: input.seq, lastSavedAtMs: now });
    return { ok: true as const, status: 'in_progress' as const, lastSeq: input.seq, serverNowMs: now };
  });
}

function validateResponses(s: SessionDoc, rs: ExamResponse[]): ExamResponse[] {
  const maxMs = s.blueprint.durationMinutes * 60_000;
  return rs.map((r) => {
    const meta = s.qmeta[r.qid];
    if (!meta) throw err('invalid-argument', 'UNKNOWN_QUESTION', 'Unknown question in request.');
    const sel = [...new Set(r.selected)];
    if (sel.some((o) => !meta.opts.includes(o))) throw err('invalid-argument', 'UNKNOWN_OPTION', 'Unknown option in request.');
    if (!meta.multi && sel.length > 1) throw err('invalid-argument', 'TOO_MANY_OPTIONS', 'Only one option may be selected.');
    return { qid: r.qid, selected: sel, visited: r.visited || sel.length > 0, marked: r.marked, timeSpentMs: Math.min(r.timeSpentMs, maxMs) };
  });
}

/* ---------------------------------------------------------------- submit */
export async function submitExam(d: Deps, actor: Actor, input: { sessionId: string; clientRequestId: string; finalSeq: number; responses?: ExamResponse[] | undefined; reason: 'manual' | 'deadline' }) {
  const out = await finalise(d, input.sessionId, actor.uid, { provided: input.responses, finalSeq: input.finalSeq, claimed: input.reason });
  return out;
}
export async function finaliseExpired(d: Deps, sessionId: string) {
  return finalise(d, sessionId, null, { provided: undefined, finalSeq: 0, claimed: 'expired' });
}

async function finalise(d: Deps, sid: string, uid: string | null, o: { provided: ExamResponse[] | undefined; finalSeq: number; claimed: 'manual' | 'deadline' | 'expired' }) {
  const now = d.clock();
  return d.store.transact(async (tx) => {
    const s = await tx.get<SessionDoc>(P.session(sid));
    if (!s || (uid !== null && s.uid !== uid)) throw err('not-found', 'SESSION_NOT_FOUND', 'Session not found.');
    if (s.status !== 'in_progress') {
      const existing = await tx.get<ResultDoc>(P.result(sid));
      if (!existing) throw err('internal', 'RESULT_MISSING');
      return { resultId: sid, alreadySubmitted: true as const, summary: publicSummary(existing) };
    }
    const stored = (await tx.get<ResponsesDoc>(P.responses(sid)))?.byQid ?? {};
    let responses = stored;
    const late = now > s.deadlineMs + LIMITS.autosaveGraceMs;
    if (o.provided && !late && o.finalSeq >= s.lastSeq) responses = { ...stored, ...Object.fromEntries(validateResponses(s, o.provided).map((r) => [r.qid, r])) };

    const key = await tx.get<AnswerKey>(P.answerKey(s.paperId));
    if (!key) throw err('failed-precondition', 'ANSWER_KEY_MISSING', 'This test cannot be scored.');
    const test = await tx.get<MockTestDoc>(P.mockTest(s.mockTestId));
    const score = scoreAttempt(s.blueprint, key, responses, s.questionOrder);
    const submittedAtMs = Math.min(now, s.deadlineMs);
    const status = now >= s.deadlineMs || o.claimed === 'expired' ? (o.claimed === 'expired' ? 'expired_finalised' : 'auto_submitted') : 'submitted';
    const spent = Object.values(score.perQuestion).reduce((n, q) => n + q.timeMs, 0);
    const reveal = test?.revealPolicy === 'after_close' && test.closesAtMs ? test.closesAtMs : now;
    const result: ResultDoc = {
      sessionId: sid, uid: s.uid, mockTestId: s.mockTestId, testTitle: s.testTitle, submittedAtMs,
      reason: o.claimed === 'expired' ? 'expired' : now >= s.deadlineMs ? 'deadline' : 'manual',
      marks: score.marks, maxMarks: score.maxMarks, correct: score.correct, incorrect: score.incorrect, unattempted: score.unattempted, attempted: score.attempted,
      accuracy: score.accuracy, attemptRate: score.attemptRate, percentage: score.percentage,
      durationMs: s.blueprint.durationMinutes * 60_000, timeSpentMs: spent,
      bySection: score.bySection, byUnit: score.byUnit, byTopic: score.byTopic, byDifficulty: score.byDifficulty,
      revealAvailableAtMs: reveal, contentLabel: test?.contentLabel ?? 'under_development',
    };

    const snap = (await tx.get<SnapshotDoc>(P.snapshot(s.uid))) ?? { topics: {}, recentScores: [], activeDays: [], testsTaken: 0, updatedAtMs: 0 };
    const topics = mergeTopics(snap.topics, score.byTopic);
    const next: SnapshotDoc = {
      topics, testsTaken: snap.testsTaken + 1, updatedAtMs: now,
      recentScores: [...snap.recentScores, { sessionId: sid, percentage: score.percentage, atMs: submittedAtMs }].slice(-30),
      activeDays: [...new Set([...snap.activeDays, dayKey(now)])].slice(-60),
    };
    tx.set(P.result(sid), result);
    tx.set(P.snapshot(s.uid), next);
    tx.merge(P.responses(sid), { byQid: Object.fromEntries(Object.entries(responses)) });
    tx.merge(P.session(sid), { status, submittedAtMs, revealAvailableAtMs: reveal, ...(o.provided && !late ? { lastSeq: Math.max(s.lastSeq, o.finalSeq) } : {}) });
    writeNotebook(tx, sid, s, key, score.perQuestion, responses, now);
    return { resultId: sid, alreadySubmitted: false as const, summary: publicSummary(result) };
  });
}

function writeNotebook(tx: TxStore, sid: string, s: SessionDoc, key: AnswerKey, per: Record<string, { outcome: string }>, responses: Record<string, ExamResponse>, now: number) {
  for (const qid of s.questionOrder) {
    const o = per[qid]?.outcome; const r = responses[qid]; const k = key[qid];
    if (!k) continue;
    const wrong = o === 'incorrect' || o === 'partial';
    const flagged = r?.marked && o !== 'correct';
    if (!wrong && !flagged) continue;
    tx.set(P.notebookEntry(s.uid, `${s.paperId}_${qid}`), {
      qid, paperId: s.paperId, sessionId: sid, unitId: k.unitId, topicId: k.topicId,
      kind: wrong ? 'incorrect' : 'flagged', createdAtMs: now, review: { ease: 2.5, intervalDays: 0, reps: 0, dueDate: dayKey(now) },
    });
  }
}

const publicSummary = (r: ResultDoc) => ({
  marks: r.marks, maxMarks: r.maxMarks, correct: r.correct, incorrect: r.incorrect, unattempted: r.unattempted,
  attempted: r.attempted, accuracy: r.accuracy, attemptRate: r.attemptRate, percentage: r.percentage, reason: r.reason, submittedAtMs: r.submittedAtMs,
});

/* ---------------------------------------------------------------- result */
export async function getExamResult(d: Deps, actor: Actor, sessionId: string) {
  let s = await d.store.get<SessionDoc>(P.session(sessionId));
  if (!s || s.uid !== actor.uid) throw err('not-found', 'SESSION_NOT_FOUND', 'Session not found.');
  if (s.status === 'in_progress') {
    if (d.clock() <= s.deadlineMs) throw err('failed-precondition', 'EXAM_IN_PROGRESS', 'Finish the test to see results.');
    await finaliseExpired(d, sessionId);
    s = await d.store.get<SessionDoc>(P.session(sessionId));
    if (!s) throw err('internal', 'SESSION_LOST');
  }
  const result = await d.store.get<ResultDoc>(P.result(sessionId));
  if (!result) throw err('not-found', 'RESULT_NOT_FOUND', 'Result not found.');
  const unlocked = d.clock() >= result.revealAvailableAtMs;
  if (!unlocked) return { summary: { ...publicSummary(result), bySection: result.bySection, byUnit: result.byUnit, byTopic: result.byTopic, byDifficulty: result.byDifficulty }, testTitle: result.testTitle, review: null, reviewAvailableAtMs: result.revealAvailableAtMs };

  const [paper, key, resp] = await Promise.all([loadPaper(d, s.paperId), d.store.get<AnswerKey>(P.answerKey(s.paperId)), d.store.get<ResponsesDoc>(P.responses(sessionId))]);
  const byId = new Map(paper.questions.map((q) => [q.qid, q]));
  const responses = resp?.byQid ?? {};
  const score = scoreAttempt(s.blueprint, key ?? {}, responses, s.questionOrder);
  const review = s.questionOrder.map((qid) => ({
    question: byId.get(qid), selected: responses[qid]?.selected ?? [], marked: responses[qid]?.marked ?? false,
    correct: key?.[qid]?.correct ?? [], explanation: key?.[qid]?.explanation ?? null,
    outcome: score.perQuestion[qid]?.outcome ?? 'unattempted', marks: score.perQuestion[qid]?.marks ?? 0, timeMs: score.perQuestion[qid]?.timeMs ?? 0,
  }));
  return { summary: { ...publicSummary(result), bySection: result.bySection, byUnit: result.byUnit, byTopic: result.byTopic, byDifficulty: result.byDifficulty }, testTitle: result.testTitle, review, reviewAvailableAtMs: result.revealAvailableAtMs };
}

export type { Blueprint };
