import { createHash } from 'node:crypto';
import { ProfilePatchSchema, buildWeeklyPlan, classifyTopics, isDue, review, type ProfilePatch } from '@ureducator/shared';
import type { Actor, SessionDoc, SnapshotDoc } from '../domain/types';
import { P } from '../domain/paths';
import { err } from '../infra/errors';
import type { Deps } from './exam';

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function ensureProfile(d: Deps, a: Actor & { email?: string | undefined; name?: string | undefined }) {
  const path = P.user(a.uid);
  return d.store.transact(async (tx) => {
    const cur = await tx.get<{ createdAtMs: number }>(path);
    if (cur) return { created: false as const };
    tx.create(path, { email: a.email ?? null, displayName: (a.name ?? a.email?.split('@')[0] ?? 'Student').slice(0, 80), createdAtMs: d.clock(), onboardingComplete: false, studyMinutesPerDay: 60, preferredPaper2Subject: null, studyGoal: null, examTarget: null });
    return { created: true as const };
  });
}

export async function updateProfile(d: Deps, a: Actor, input: ProfilePatch) {
  const parsed = ProfilePatchSchema.safeParse(input); // strict: privileged fields (role, entitlements, email) are rejected
  if (!parsed.success) throw err('invalid-argument', 'INVALID_PROFILE', 'Invalid profile update.');
  const p = parsed.data;
  await d.store.merge(P.user(a.uid), { ...p, updatedAtMs: d.clock() });
  return { ok: true as const };
}

export async function generatePlan(d: Deps, a: Actor) {
  const [snap, user] = await Promise.all([d.store.get<SnapshotDoc>(P.snapshot(a.uid)), d.store.get<{ studyMinutesPerDay?: number }>(P.user(a.uid))]);
  const { weak } = classifyTopics(snap?.topics ?? {});
  const today = day(d.clock());
  const entries = await d.store.list<{ topicId: string; review: { dueDate: string; ease: number; intervalDays: number; reps: number } }>(`errorNotebook/${a.uid}/entries`, { limit: 100 });
  const due = [...new Set(entries.filter((e) => isDue(e.data.review, today)).map((e) => e.data.topicId))].slice(0, 7);
  const ids = [...new Set([...weak.map((w) => w.topicId), ...due])];
  const names: Record<string, string> = {};
  await Promise.all(ids.map(async (id) => { names[id] = (await d.store.get<{ name?: { en?: string } }>(P.topic(id)))?.name?.en ?? id; }));
  const tasks = buildWeeklyPlan({ startDate: today, minutesPerDay: user?.studyMinutesPerDay ?? 60, weak, topicNames: names, revisionDueTopicIds: due });
  await d.store.set(P.studyPlan(a.uid), { tasks, generatedAtMs: d.clock(), basedOnTests: snap?.testsTaken ?? 0 });
  return { tasks, basedOnTests: snap?.testsTaken ?? 0 };
}

export async function reviewNotebook(d: Deps, a: Actor, i: { entryId: string; quality: number }) {
  const path = P.notebookEntry(a.uid, i.entryId);
  const e = await d.store.get<{ review: { ease: number; intervalDays: number; reps: number; dueDate: string } }>(path);
  if (!e) throw err('not-found', 'ENTRY_NOT_FOUND', 'Entry not found.');
  const next = review(e.review, i.quality as 0 | 1 | 2 | 3 | 4 | 5, day(d.clock()));
  await d.store.merge(path, { review: next, lastReviewedAtMs: d.clock() });
  return { review: next };
}

export async function notebookQuestion(d: Deps, a: Actor, i: { entryId: string }) {
  const e = await d.store.get<{ qid: string; paperId: string; sessionId: string }>(P.notebookEntry(a.uid, i.entryId));
  if (!e) throw err('not-found', 'ENTRY_NOT_FOUND', 'Entry not found.');
  const s = await d.store.get<SessionDoc>(P.session(e.sessionId));
  if (!s || s.uid !== a.uid || s.status === 'in_progress' || d.clock() < (s.revealAvailableAtMs ?? Infinity)) throw err('failed-precondition', 'ANSWERS_LOCKED', 'Answers unlock after review opens.');
  const [paper, key] = await Promise.all([d.store.get<{ questions: { qid: string }[] }>(P.paper(e.paperId)), d.store.get<Record<string, { correct: string[]; explanation?: unknown }>>(P.answerKey(e.paperId))]);
  const q = paper?.questions.find((x) => x.qid === e.qid);
  if (!q || !key?.[e.qid]) throw err('not-found', 'QUESTION_NOT_FOUND', 'Question not found.');
  return { question: q, correct: key[e.qid]!.correct, explanation: key[e.qid]!.explanation ?? null };
}

export async function createTicket(d: Deps, a: Actor & { email?: string | undefined }, i: { subject: string; message: string; category: string }) {
  const id = 't_' + createHash('sha256').update(`${a.uid}:${d.clock()}:${i.subject}`).digest('hex').slice(0, 16);
  await d.store.set(`supportTickets/${id}`, { uid: a.uid, email: a.email ?? null, ...i, status: 'open', createdAtMs: d.clock() });
  return { ticketId: id };
}

/** Notebook entries become visible only when review opens, so 'reveal after close' does not leak which answers were wrong. */
export async function listNotebook(d: Deps, a: Actor) {
  const rows = await d.store.list<{ qid: string; topicId: string; unitId: string; sessionId: string; kind: string; createdAtMs: number; visibleAtMs?: number; review: unknown }>(`errorNotebook/${a.uid}/entries`, { limit: 200 });
  const now = d.clock();
  const entries = rows.filter((r) => (r.data.visibleAtMs ?? 0) <= now).map((r) => ({ id: r.id, qid: r.data.qid, topicId: r.data.topicId, unitId: r.data.unitId, sessionId: r.data.sessionId, kind: r.data.kind, createdAtMs: r.data.createdAtMs, review: r.data.review }));
  return { entries, hidden: rows.length - entries.length };
}
