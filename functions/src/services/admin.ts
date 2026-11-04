import { randomUUID } from 'node:crypto';
import {
  LIMITS, QuestionVersionSchema, BlueprintSchema, can, canAssign, canTransition,
  type AnswerKey, type Permission, type PublishedPaper, type Role, type PaperQuestion, ROLES,
} from '@ureducator/shared';
import type { z } from 'zod';
import type { SaveQuestionInput, UpsertCatalogueInput, UpsertMockTestInput, AdminListInput, UpsertPlanInput } from '@ureducator/shared';
import type { Actor, MockTestDoc } from '../domain/types';
import { P } from '../domain/paths';
import { err } from '../infra/errors';
import { audit } from '../infra/audit';
import type { Deps } from './exam';

export type StaffActor = Actor & { email?: string | undefined };
export const roleOf = (a: StaffActor): Role | null => (ROLES as readonly string[]).includes(a.role ?? '') ? (a.role as Role) : null;

export function need(a: StaffActor, p: Permission) {
  if (!a.emailVerified) throw err('permission-denied', 'EMAIL_NOT_VERIFIED', 'Verify your email address first.');
  if (!can(roleOf(a), p)) throw err('permission-denied', 'FORBIDDEN', 'You do not have permission for this action.');
}
const log = (d: Deps, a: StaffActor, action: string, target: string, meta?: Record<string, string | number | boolean | null>) =>
  audit(d.store, d.clock, { actorUid: a.uid, actorRole: roleOf(a), action, target, ...(meta ? { meta } : {}) });

/* ------------------------------------------------------------ catalogue */
export async function upsertCatalogue(d: Deps, a: StaffActor, i: z.infer<typeof UpsertCatalogueInput>) {
  need(a, 'catalogue.write');
  return d.store.transact(async (tx) => {
    const path = i.kind === 'subject' ? P.subject(i.id) : i.kind === 'unit' ? P.unit(i.id) : P.topic(i.id);
    const prev = await tx.get<{ version?: number }>(path);
    const { kind: _k, ...rest } = i;
    if (i.kind === 'subject' && i.label === 'fully_verified' && !i.sourceRef) throw err('failed-precondition', 'VERIFICATION_SOURCE_REQUIRED', 'A fully verified subject needs an official source reference.');
    tx.set(path, { ...rest, version: (prev?.version ?? 0) + 1, updatedAtMs: d.clock(), updatedBy: a.uid });
    return { id: i.id, version: (prev?.version ?? 0) + 1 };
  }).then(async (r) => { await log(d, a, `catalogue.${i.kind}.upsert`, i.id); return r; });
}

/* ------------------------------------------------------------ questions */
const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

export async function saveQuestion(d: Deps, a: StaffActor, i: z.infer<typeof SaveQuestionInput>) {
  need(a, 'questions.write');
  const now = d.clock();
  return d.store.transact(async (tx) => {
    const qid = i.questionId ?? newId('q');
    const head = i.questionId ? await tx.get<{ currentVersion: number; status: string; publishedVersion?: number }>(P.question(qid)) : null;
    if (i.questionId && !head) throw err('not-found', 'QUESTION_NOT_FOUND', 'Question not found.');
    const cur = head ? await tx.get<{ status: string }>(P.questionVersion(qid, head.currentVersion)) : null;
    const reuse = cur?.status === 'draft';
    const version = head ? (reuse ? head.currentVersion : head.currentVersion + 1) : 1;
    const doc = { version, ...i.version, createdBy: a.uid };
    const parsed = QuestionVersionSchema.safeParse(doc);
    if (!parsed.success) throw err('invalid-argument', 'QUESTION_INVALID', parsed.error.issues[0]?.message ?? 'Invalid question.');
    tx.set(P.questionVersion(qid, version), { ...parsed.data, status: 'draft', createdAtMs: now });
    tx.set(P.question(qid), { ...i.meta, status: 'draft', currentVersion: version, ...(head?.publishedVersion ? { publishedVersion: head.publishedVersion } : {}), updatedAtMs: now });
    return { questionId: qid, version };
  }).then(async (r) => { await log(d, a, 'question.save', r.questionId, { version: r.version }); return r; });
}

export async function transitionQuestion(d: Deps, a: StaffActor, i: { questionId: string; version: number; to: 'draft' | 'review' | 'approved' | 'published' }) {
  return d.store.transact(async (tx) => {
    const v = await tx.get<{ status: string; createdBy: string; provenance: { copyrightStatus: string } }>(P.questionVersion(i.questionId, i.version));
    const head = await tx.get<{ currentVersion: number; publishedVersion?: number }>(P.question(i.questionId));
    if (!v || !head) throw err('not-found', 'QUESTION_NOT_FOUND', 'Question not found.');
    if (!a.emailVerified || !canTransition(roleOf(a), v.status, i.to)) throw err('permission-denied', 'FORBIDDEN', 'This status change is not allowed for your role.');
    if (i.to === 'approved' && v.createdBy === a.uid) throw err('permission-denied', 'SEPARATION_OF_DUTIES', 'A different reviewer must approve your question.');
    if (i.to === 'published' && v.provenance.copyrightStatus === 'unknown') throw err('failed-precondition', 'COPYRIGHT_UNKNOWN', 'Set the copyright status before publishing.');
    tx.merge(P.questionVersion(i.questionId, i.version), { status: i.to, ...(i.to === 'approved' ? { reviewedBy: a.uid } : {}), statusChangedAtMs: d.clock() });
    if (i.version === head.currentVersion) tx.merge(P.question(i.questionId), { status: i.to });
    if (i.to === 'published') tx.merge(P.question(i.questionId), { publishedVersion: i.version });
    return { questionId: i.questionId, version: i.version, status: i.to };
  }).then(async (r) => { await log(d, a, `question.${i.to}`, i.questionId, { version: i.version }); return r; });
}

/* ------------------------------------------------------------ mock tests */
export async function upsertMockTest(d: Deps, a: StaffActor, i: z.infer<typeof UpsertMockTestInput>) {
  need(a, 'tests.write');
  const id = i.mockTestId ?? newId('mt');
  return d.store.transact(async (tx) => {
    const prev = await tx.get<MockTestDoc>(P.mockTest(id));
    if (prev?.status === 'published') throw err('failed-precondition', 'UNPUBLISH_FIRST', 'Unpublish this test before editing it.');
    if (new Set(i.questionRefs.map((r) => r.qid)).size !== i.questionRefs.length) throw err('invalid-argument', 'DUPLICATE_QUESTION', 'A question appears twice in this test.');
    const { mockTestId: _m, ...rest } = i;
    tx.set(P.mockTest(id), { ...rest, status: 'draft', paperId: '', paperVersion: prev?.paperVersion ?? 0, version: (prev?.version ?? 0) + 1, updatedAtMs: d.clock(), updatedBy: a.uid });
    return { mockTestId: id };
  }).then(async (r) => { await log(d, a, 'mocktest.save', r.mockTestId); return r; });
}

export async function publishMockTest(d: Deps, a: StaffActor, mockTestId: string) {
  need(a, 'tests.publish');
  const test = await d.store.get<MockTestDoc & { questionRefs: { qid: string; version: number; sectionId: string }[] }>(P.mockTest(mockTestId));
  if (!test) throw err('not-found', 'TEST_NOT_FOUND', 'Test not found.');
  const bp = BlueprintSchema.safeParse(await d.store.get(P.blueprint(test.blueprintId)));
  if (!bp.success) throw err('failed-precondition', 'BLUEPRINT_INVALID', 'The blueprint for this test is missing or invalid.');
  const counts = new Map<string, number>();
  for (const r of test.questionRefs) counts.set(r.sectionId, (counts.get(r.sectionId) ?? 0) + 1);
  for (const s of bp.data.sections) if ((counts.get(s.id) ?? 0) !== s.questionCount) throw err('failed-precondition', 'SECTION_COUNT_MISMATCH', `Section "${s.id}" needs exactly ${s.questionCount} questions.`);
  if (test.questionRefs.some((r) => !bp.data.sections.some((s) => s.id === r.sectionId))) throw err('failed-precondition', 'UNKNOWN_SECTION', 'A question points to an unknown section.');

  const questions: PaperQuestion[] = []; const key: AnswerKey = {}; let hasSynthetic = false;
  for (const r of test.questionRefs) {
    const [head, v] = await Promise.all([
      d.store.get<{ unitId: string; topicId: string; difficulty: 'easy' | 'medium' | 'hard' }>(P.question(r.qid)),
      d.store.get<{ status: string; content: PaperQuestion['content']; correct: string[]; explanation?: { en: string; hi?: string }; provenance: { kind: string } }>(P.questionVersion(r.qid, r.version)),
    ]);
    if (!head || !v) throw err('failed-precondition', 'QUESTION_MISSING', `Question ${r.qid} v${r.version} not found.`);
    if (v.status !== 'published') throw err('failed-precondition', 'QUESTION_NOT_PUBLISHED', `Question ${r.qid} v${r.version} is not published.`);
    if (v.provenance.kind === 'synthetic_demo') hasSynthetic = true;
    questions.push({ qid: r.qid, version: r.version, sectionId: r.sectionId, unitId: head.unitId, topicId: head.topicId, difficulty: head.difficulty, content: v.content });
    key[r.qid] = { correct: v.correct, sectionId: r.sectionId, unitId: head.unitId, topicId: head.topicId, difficulty: head.difficulty, ...(v.explanation ? { explanation: v.explanation } : {}) };
  }
  if (test.contentLabel === 'fully_verified' && (hasSynthetic || !bp.data.officialPatternVerified)) throw err('failed-precondition', 'NOT_VERIFIABLE', 'Synthetic questions or an unverified blueprint cannot be published as fully verified.');
  const paperVersion = (test.paperVersion ?? 0) + 1;
  const paperId = `${mockTestId}_v${paperVersion}`;
  const paper: PublishedPaper = { paperId, mockTestId, version: paperVersion, questions, contentLabel: test.contentLabel };
  if (JSON.stringify(paper).length > LIMITS.maxPaperDocBytes) throw err('failed-precondition', 'PAPER_TOO_LARGE', 'This paper is too large for one document. Remove images or long passages.');
  await d.store.transact(async (tx) => {
    tx.create(P.paper(paperId), paper); tx.create(P.answerKey(paperId), key);
    tx.merge(P.mockTest(mockTestId), { status: 'published', paperId, paperVersion, publishedAtMs: d.clock(), publishedBy: a.uid });
  });
  await log(d, a, 'mocktest.publish', mockTestId, { paperVersion, questions: questions.length });
  return { mockTestId, paperId, paperVersion };
}

export async function unpublishMockTest(d: Deps, a: StaffActor, mockTestId: string) {
  need(a, 'tests.publish');
  await d.store.merge(P.mockTest(mockTestId), { status: 'draft' });
  await log(d, a, 'mocktest.unpublish', mockTestId);
  return { mockTestId };
}

/* ------------------------------------------------------------ roles */
export interface AuthPort { setRole(uid: string, role: Role | null): Promise<void> }

export async function assignRole(d: Deps, auth: AuthPort, a: StaffActor, i: { uid: string; role: Role | null }) {
  if (!a.emailVerified) throw err('permission-denied', 'EMAIL_NOT_VERIFIED', 'Verify your email address first.');
  if (i.uid === a.uid) throw err('permission-denied', 'SELF_ROLE_CHANGE', 'You cannot change your own role.');
  if (!canAssign(roleOf(a), i.role)) throw err('permission-denied', 'FORBIDDEN', 'You cannot assign this role.');
  const existing = await d.store.get<{ role: Role }>(`roles/${i.uid}`);
  if (existing?.role === 'owner') throw err('permission-denied', 'OWNER_PROTECTED', 'The owner role cannot be changed here.');
  await auth.setRole(i.uid, i.role);
  if (i.role) await d.store.set(`roles/${i.uid}`, { role: i.role, assignedBy: a.uid, assignedAtMs: d.clock() }); else await d.store.delete(`roles/${i.uid}`);
  await log(d, a, 'role.assign', i.uid, { role: i.role });
  return { uid: i.uid, role: i.role };
}

/** One-time owner bootstrap: only the verified email configured at deploy time can claim it, and only once. */
export async function claimOwner(d: Deps, auth: AuthPort, a: StaffActor, configuredEmail: string) {
  if (!configuredEmail) throw err('failed-precondition', 'BOOTSTRAP_DISABLED', 'Owner bootstrap is not configured.');
  if (!a.emailVerified || !a.email || a.email.toLowerCase() !== configuredEmail.toLowerCase()) throw err('permission-denied', 'FORBIDDEN', 'This account cannot claim ownership.');
  await d.store.transact(async (tx) => { tx.create(P.setting('ownerClaim'), { uid: a.uid, atMs: d.clock() }); }).catch(() => { throw err('already-exists', 'OWNER_ALREADY_CLAIMED', 'Ownership has already been claimed.'); });
  await auth.setRole(a.uid, 'owner');
  await d.store.set(`roles/${a.uid}`, { role: 'owner', assignedBy: a.uid, assignedAtMs: d.clock() });
  await log(d, { ...a, role: 'owner' }, 'role.owner_claimed', a.uid);
  return { uid: a.uid, role: 'owner' as const };
}

/* ------------------------------------------------------------ listing */
const LIST_RULES: Record<z.infer<typeof AdminListInput>['collection'], { perm: Permission[]; pick?: string[]; order?: string }> = {
  users: { perm: ['students.read'], pick: ['displayName', 'email', 'createdAtMs', 'preferredPaper2Subject', 'onboardingComplete'], order: 'createdAtMs' },
  subjects: { perm: ['catalogue.write', 'questions.write', 'questions.review'] }, units: { perm: ['catalogue.write', 'questions.write', 'questions.review'] }, topics: { perm: ['catalogue.write', 'questions.write', 'questions.review'] },
  questions: { perm: ['questions.write', 'questions.review'], order: 'updatedAtMs' },
  mockTests: { perm: ['tests.write', 'tests.publish'], order: 'updatedAtMs' }, examBlueprints: { perm: ['tests.write', 'tests.publish'] },
  leads: { perm: ['leads.read'], order: 'createdAtMs' }, supportTickets: { perm: ['support.read'], order: 'createdAtMs' },
  auditLogs: { perm: ['audit.read'], order: 'atMs' }, orders: { perm: ['payments.read'], order: 'createdAtMs' }, paymentEvents: { perm: ['payments.read'], order: 'atMs' },
  plans: { perm: ['pricing.write', 'payments.read'] }, coupons: { perm: ['coupons.write'] }, resources: { perm: ['resources.write'] },
};
export async function adminList(d: Deps, a: StaffActor, i: z.infer<typeof AdminListInput>) {
  const rule = LIST_RULES[i.collection];
  if (!a.emailVerified || !rule.perm.some((p) => can(roleOf(a), p))) throw err('permission-denied', 'FORBIDDEN', 'You do not have permission to view this.');
  const rows = await d.store.list<Record<string, unknown>>(i.collection, {
    limit: i.limit, ...(i.startAfter ? { startAfter: i.startAfter } : {}), ...(i.status ? { where: [['status', '==', i.status]] } : {}),
    ...(rule.order && !i.status ? { orderBy: rule.order, desc: true } : {}),
  });
  const items = rows.map((r) => ({ id: r.id, ...(rule.pick ? Object.fromEntries(rule.pick.filter((k) => k in r.data).map((k) => [k, r.data[k]])) : r.data) }));
  return { items, next: rows.length === i.limit ? rows.at(-1)?.id ?? null : null };
}

/* ------------------------------------------------------------ pricing */
export async function upsertPlan(d: Deps, a: StaffActor, i: z.infer<typeof UpsertPlanInput>) {
  need(a, 'pricing.write');
  if (i.published && !can(roleOf(a), 'settings.write')) throw err('permission-denied', 'FORBIDDEN', 'Only a super administrator or the owner can publish a price.');
  await d.store.set(P.plan(i.planId), { name: i.name, pricePaise: i.pricePaise, currency: 'INR', durationDays: i.durationDays, entitlements: i.entitlements, published: i.published, updatedAtMs: d.clock() });
  await log(d, a, 'plan.upsert', i.planId, { published: i.published });
  return { planId: i.planId };
}
