import { describe, expect, it } from 'vitest';
import type { Role } from '@ureducator/shared';
import { MemoryStore } from '../domain/memoryStore';
import { P } from '../domain/paths';
import * as admin from '../services/admin';
import { startExam } from '../services/exam';
import { bp } from './fixtures';

const T0 = 1_800_000_000_000;
const as = (uid: string, role?: Role, extra: Partial<admin.StaffActor> = {}): admin.StaffActor => ({ uid, emailVerified: true, ...(role ? { role } : {}), email: `${uid}@example.test`, ...extra });
const owner = as('own', 'owner'); const superA = as('sup', 'super_admin'); const adm = as('adm', 'admin');
const editor = as('ed', 'content_editor'); const reviewer = as('rev', 'subject_reviewer'); const support = as('sp', 'support_agent'); const analyst = as('an', 'analyst');
const student = as('stu');

const mk = () => { let now = T0; const store = new MemoryStore(); return { d: { store, clock: () => now }, store, tick: (ms: number) => (now += ms) }; };
type Env = ReturnType<typeof mk>;
const authPort = () => { const calls: [string, Role | null][] = []; return { calls, setRole: async (uid: string, r: Role | null) => { calls.push([uid, r]); } }; };

const qInput = (n: number, over: Record<string, unknown> = {}) => ({
  meta: { subjectId: 's1', unitId: 'u1', topicId: `t${n}`, difficulty: 'medium' as const, languages: ['en' as const] },
  version: {
    content: { type: 'mcq_single' as const, stem: { en: `Synthetic demo question ${n}` }, options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: { en: `option ${id}` } })) },
    correct: ['b'], explanation: { en: `Because demo ${n}` },
    provenance: { kind: 'synthetic_demo' as const, copyrightStatus: 'own_work' as const, officialPyqVerified: false },
    ...over,
  },
});

/** create -> review -> approved (by a different person) -> published */
async function publishedQuestion(e: Env, n: number) {
  const { questionId, version } = await admin.saveQuestion(e.d, editor, qInput(n));
  await admin.transitionQuestion(e.d, editor, { questionId, version, to: 'review' });
  await admin.transitionQuestion(e.d, reviewer, { questionId, version, to: 'approved' });
  await admin.transitionQuestion(e.d, adm, { questionId, version, to: 'published' });
  return { qid: questionId, version };
}

describe('permissions', () => {
  it('denies unverified emails and students for every staff action', async () => {
    const e = mk();
    await expect(admin.saveQuestion(e.d, { ...editor, emailVerified: false }, qInput(1))).rejects.toMatchObject({ reason: 'EMAIL_NOT_VERIFIED' });
    await expect(admin.saveQuestion(e.d, student, qInput(1))).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await expect(admin.upsertCatalogue(e.d, student, { kind: 'unit', id: 'u1', subjectId: 's1', name: { en: 'U' }, order: 0, objectives: [] })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await expect(admin.adminList(e.d, student, { collection: 'users', limit: 10 })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
  });
  it('is never driven by the email address (only the verified role claim)', async () => {
    const e = mk();
    const sneaky = as('x', undefined, { email: 'owner@example.test' });
    await expect(admin.saveQuestion(e.d, sneaky, qInput(1))).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    const garbage = as('y', 'root' as Role);
    await expect(admin.saveQuestion(e.d, garbage, qInput(1))).rejects.toMatchObject({ reason: 'FORBIDDEN' });
  });
  it('limits each role to its own collections', async () => {
    const e = mk();
    await expect(admin.adminList(e.d, support, { collection: 'orders', limit: 5 })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await expect(admin.adminList(e.d, support, { collection: 'supportTickets', limit: 5 })).resolves.toBeTruthy();
    await expect(admin.adminList(e.d, editor, { collection: 'leads', limit: 5 })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await expect(admin.adminList(e.d, analyst, { collection: 'leads', limit: 5 })).resolves.toBeTruthy();
    await expect(admin.adminList(e.d, adm, { collection: 'auditLogs', limit: 5 })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await expect(admin.adminList(e.d, superA, { collection: 'auditLogs', limit: 5 })).resolves.toBeTruthy();
  });
  it('lists only whitelisted user fields for support staff', async () => {
    const e = mk();
    await e.store.set(P.user('u1'), { displayName: 'A', email: 'a@x.test', createdAtMs: 1, secretNote: 'nope', onboardingComplete: true });
    const r = await admin.adminList(e.d, support, { collection: 'users', limit: 5 });
    expect(JSON.stringify(r)).not.toContain('secretNote');
    expect(r.items[0]).toMatchObject({ id: 'u1', displayName: 'A' });
  });
});

describe('question workflow', () => {
  it('walks Draft -> Review -> Approved -> Published with the right people', async () => {
    const e = mk();
    const { qid, version } = await publishedQuestion(e, 1);
    expect(await e.store.get(P.questionVersion(qid, version))).toMatchObject({ status: 'published', reviewedBy: 'rev' });
    expect(await e.store.get(P.question(qid))).toMatchObject({ status: 'published', publishedVersion: 1 });
  });
  it('blocks skipping steps and wrong roles', async () => {
    const e = mk();
    const { questionId, version } = await admin.saveQuestion(e.d, editor, qInput(1));
    await expect(admin.transitionQuestion(e.d, editor, { questionId, version, to: 'published' })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await expect(admin.transitionQuestion(e.d, reviewer, { questionId, version, to: 'review' })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await admin.transitionQuestion(e.d, editor, { questionId, version, to: 'review' });
    await expect(admin.transitionQuestion(e.d, editor, { questionId, version, to: 'approved' })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
  });
  it('enforces separation of duties: nobody approves their own question', async () => {
    const e = mk();
    const { questionId, version } = await admin.saveQuestion(e.d, adm, qInput(1)); // admin can write AND review
    await admin.transitionQuestion(e.d, adm, { questionId, version, to: 'review' });
    await expect(admin.transitionQuestion(e.d, adm, { questionId, version, to: 'approved' })).rejects.toMatchObject({ reason: 'SEPARATION_OF_DUTIES' });
    await expect(admin.transitionQuestion(e.d, reviewer, { questionId, version, to: 'approved' })).resolves.toBeTruthy();
  });
  it('refuses to publish when copyright status is unknown', async () => {
    const e = mk();
    const { questionId, version } = await admin.saveQuestion(e.d, editor, qInput(1, { provenance: { kind: 'original', copyrightStatus: 'unknown', officialPyqVerified: false } }));
    await admin.transitionQuestion(e.d, editor, { questionId, version, to: 'review' });
    await admin.transitionQuestion(e.d, reviewer, { questionId, version, to: 'approved' });
    await expect(admin.transitionQuestion(e.d, adm, { questionId, version, to: 'published' })).rejects.toMatchObject({ reason: 'COPYRIGHT_UNKNOWN' });
  });
  it('validates content: correct answer must be an option; single answer means one key', async () => {
    const e = mk();
    await expect(admin.saveQuestion(e.d, editor, qInput(1, { correct: ['f'] }))).rejects.toMatchObject({ reason: 'QUESTION_INVALID' });
    await expect(admin.saveQuestion(e.d, editor, qInput(1, { correct: ['a', 'b'] }))).rejects.toMatchObject({ reason: 'QUESTION_INVALID' });
    await expect(admin.saveQuestion(e.d, editor, qInput(1, { provenance: { kind: 'official_pyq', copyrightStatus: 'licensed', officialPyqVerified: false } }))).rejects.toMatchObject({ reason: 'QUESTION_INVALID' });
  });
  it('creates a new immutable version when a reviewed question is edited, keeping the published one intact', async () => {
    const e = mk();
    const { qid } = await publishedQuestion(e, 1);
    const r = await admin.saveQuestion(e.d, editor, { ...qInput(1, { correct: ['c'] }), questionId: qid });
    expect(r.version).toBe(2);
    expect(await e.store.get(P.questionVersion(qid, 1))).toMatchObject({ status: 'published', correct: ['b'] });
    expect(await e.store.get(P.question(qid))).toMatchObject({ currentVersion: 2, publishedVersion: 1, status: 'draft' });
    const again = await admin.saveQuestion(e.d, editor, { ...qInput(1, { correct: ['d'] }), questionId: qid }); // still a draft: edited in place
    expect(again.version).toBe(2);
  });
  it('writes an audit entry for each change without storing the answer', async () => {
    const e = mk();
    await publishedQuestion(e, 1);
    const logs = await e.store.list<Record<string, unknown>>('auditLogs', { limit: 50 });
    expect(logs.map((l) => l.data.action)).toEqual(expect.arrayContaining(['question.save', 'question.review', 'question.approved', 'question.published']));
    expect(JSON.stringify(logs)).not.toMatch(/"correct"/);
  });
});

describe('catalogue', () => {
  it('requires an official source reference before a subject can be "fully verified"', async () => {
    const e = mk();
    const base = { kind: 'subject' as const, id: 's1', paper: 'paper2' as const, name: { en: 'Demo' }, label: 'fully_verified' as const, order: 0 };
    await expect(admin.upsertCatalogue(e.d, editor, base)).rejects.toMatchObject({ reason: 'VERIFICATION_SOURCE_REQUIRED' });
    await expect(admin.upsertCatalogue(e.d, editor, { ...base, sourceRef: 'NTA syllabus PDF, accessed 2026-11-01' })).resolves.toMatchObject({ version: 1 });
    await expect(admin.upsertCatalogue(e.d, editor, { ...base, label: 'sample' })).resolves.toMatchObject({ version: 2 });
  });
});

describe('mock test publishing', () => {
  async function setup(e: Env, label: 'sample' | 'under_development' | 'fully_verified' = 'under_development') {
    await e.store.set(P.blueprint('mini'), bp);
    const refs: { qid: string; version: number; sectionId: string }[] = [];
    for (let n = 1; n <= 5; n++) { const q = await publishedQuestion(e, n); refs.push({ ...q, sectionId: n <= 3 ? 'paper1' : 'paper2' }); }
    const { mockTestId } = await admin.upsertMockTest(e.d, editor, { title: 'Demo full test', kind: 'full', blueprintId: 'mini', access: 'free', timed: true, shuffle: false, revealPolicy: 'immediate', contentLabel: label, questionRefs: refs });
    return { mockTestId, refs };
  }
  it('publishes a sanitised paper and a separate server-only answer key, and students can sit the exam', async () => {
    const e = mk(); const { mockTestId } = await setup(e);
    await e.store.set(P.setting('pilotCohort'), { enabled: true, allowedUids: ['stu'] });
    const r = await admin.publishMockTest(e.d, adm, mockTestId);
    expect(r).toMatchObject({ paperVersion: 1, paperId: `${mockTestId}_v1` });
    const paper = await e.store.get<{ questions: object[] }>(P.paper(r.paperId));
    expect(paper!.questions).toHaveLength(5);
    expect(JSON.stringify(paper)).not.toMatch(/correct|explanation|Because demo/);
    const key = await e.store.get<Record<string, { correct: string[]; explanation?: { en: string } }>>(P.answerKey(r.paperId));
    expect(Object.values(key!)[0]).toMatchObject({ correct: ['b'], explanation: { en: expect.stringContaining('Because demo') } });
    const p = await startExam(e.d, { uid: 'stu', emailVerified: true }, { mockTestId, language: 'en', clientRequestId: 'r1' });
    expect(p.questions).toHaveLength(5);
    expect(JSON.stringify(p)).not.toMatch(/"correct":\[|Because demo/);
  });
  it('is editable only while unpublished, and a republish makes a new immutable paper version', async () => {
    const e = mk(); const { mockTestId, refs } = await setup(e);
    await admin.publishMockTest(e.d, adm, mockTestId);
    await expect(admin.upsertMockTest(e.d, editor, { mockTestId, title: 'Renamed test', kind: 'full', blueprintId: 'mini', access: 'free', timed: true, shuffle: false, revealPolicy: 'immediate', contentLabel: 'sample', questionRefs: refs })).rejects.toMatchObject({ reason: 'UNPUBLISH_FIRST' });
    await admin.unpublishMockTest(e.d, adm, mockTestId);
    await admin.upsertMockTest(e.d, editor, { mockTestId, title: 'Renamed test', kind: 'full', blueprintId: 'mini', access: 'free', timed: true, shuffle: false, revealPolicy: 'immediate', contentLabel: 'sample', questionRefs: refs });
    const second = await admin.publishMockTest(e.d, adm, mockTestId);
    expect(second.paperVersion).toBe(2);
    expect(await e.store.get(P.paper(`${mockTestId}_v1`))).toBeTruthy(); // earlier attempts keep their paper
  });
  it('blocks publication with wrong section counts, unpublished questions, or duplicates', async () => {
    const e = mk(); const { mockTestId, refs } = await setup(e);
    await admin.upsertMockTest(e.d, editor, { mockTestId, title: 'Short test', kind: 'full', blueprintId: 'mini', access: 'free', timed: true, shuffle: false, revealPolicy: 'immediate', contentLabel: 'sample', questionRefs: refs.slice(1) });
    await expect(admin.publishMockTest(e.d, adm, mockTestId)).rejects.toMatchObject({ reason: 'SECTION_COUNT_MISMATCH' });
    await expect(admin.upsertMockTest(e.d, editor, { mockTestId, title: 'Dup test', kind: 'full', blueprintId: 'mini', access: 'free', timed: true, shuffle: false, revealPolicy: 'immediate', contentLabel: 'sample', questionRefs: [...refs, refs[0]!] })).rejects.toMatchObject({ reason: 'DUPLICATE_QUESTION' });
    const draftQ = await admin.saveQuestion(e.d, editor, qInput(9));
    await admin.upsertMockTest(e.d, editor, { mockTestId, title: 'Unready test', kind: 'full', blueprintId: 'mini', access: 'free', timed: true, shuffle: false, revealPolicy: 'immediate', contentLabel: 'sample', questionRefs: [...refs.slice(0, 4), { qid: draftQ.questionId, version: 1, sectionId: 'paper2' }] });
    await expect(admin.publishMockTest(e.d, adm, mockTestId)).rejects.toMatchObject({ reason: 'QUESTION_NOT_PUBLISHED' });
  });
  it('never lets synthetic content, or an unverified blueprint, be published as "fully verified"', async () => {
    const e = mk(); const { mockTestId } = await setup(e, 'fully_verified');
    await expect(admin.publishMockTest(e.d, adm, mockTestId)).rejects.toMatchObject({ reason: 'NOT_VERIFIABLE' });
  });
  it('needs the publish permission', async () => {
    const e = mk(); const { mockTestId } = await setup(e);
    await expect(admin.publishMockTest(e.d, editor, mockTestId)).rejects.toMatchObject({ reason: 'FORBIDDEN' });
  });
});

describe('roles', () => {
  it('lets only the owner assign privileged roles, never to themselves, never "owner"', async () => {
    const e = mk(); const auth = authPort();
    await expect(admin.assignRole(e.d, auth, owner, { uid: 'new1', role: 'admin' })).resolves.toBeTruthy();
    expect(auth.calls).toEqual([['new1', 'admin']]);
    await expect(admin.assignRole(e.d, auth, owner, { uid: 'own', role: 'analyst' })).rejects.toMatchObject({ reason: 'SELF_ROLE_CHANGE' });
    await expect(admin.assignRole(e.d, auth, owner, { uid: 'new2', role: 'owner' })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    for (const a of [superA, adm, editor, reviewer, support, analyst, student]) await expect(admin.assignRole(e.d, authPort(), a, { uid: 'new3', role: 'analyst' })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    expect(auth.calls).toHaveLength(1);
  });
  it('protects an existing owner from being demoted by anyone', async () => {
    const e = mk(); const auth = authPort();
    await e.store.set('roles/own2', { role: 'owner' });
    await expect(admin.assignRole(e.d, auth, owner, { uid: 'own2', role: null })).rejects.toMatchObject({ reason: 'OWNER_PROTECTED' });
    expect(auth.calls).toHaveLength(0);
  });
  it('removes a role and its record when set to null', async () => {
    const e = mk(); const auth = authPort();
    await admin.assignRole(e.d, auth, owner, { uid: 'new1', role: 'support_agent' });
    await admin.assignRole(e.d, auth, owner, { uid: 'new1', role: null });
    expect(await e.store.get('roles/new1')).toBeNull();
    expect(auth.calls.at(-1)).toEqual(['new1', null]);
  });
  describe('claimOwner resumable bootstrap', () => {
    it('rejects when bootstrap is disabled', async () => {
      const e = mk(); const auth = authPort();
      const me = as('me', undefined, { email: 'Founder@Example.test' });
      await expect(admin.claimOwner(e.d, auth, me, '')).rejects.toMatchObject({ reason: 'BOOTSTRAP_DISABLED' });
    });

    it('rejects unverified email', async () => {
      const e = mk(); const auth = authPort();
      const me = as('me', undefined, { email: 'founder@example.test', emailVerified: false });
      await expect(admin.claimOwner(e.d, auth, me, 'founder@example.test')).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    });

    it('rejects wrong email address', async () => {
      const e = mk(); const auth = authPort();
      const other = as('other', undefined, { email: 'other@example.test' });
      await expect(admin.claimOwner(e.d, auth, other, 'founder@example.test')).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    });

    it('first claim completes successfully, writes claim record, role doc and audit log', async () => {
      const e = mk(); const auth = authPort();
      const me = as('me', undefined, { email: 'Founder@Example.test' });
      const res = await admin.claimOwner(e.d, auth, me, 'founder@example.test');
      expect(res).toEqual({ uid: 'me', role: 'owner' });
      expect(auth.calls).toEqual([['me', 'owner']]);

      // Check ownerClaim record has status complete
      const claim = await e.store.get<admin.OwnerClaimRecord>(P.setting('ownerClaim'));
      expect(claim).toMatchObject({
        uid: 'me',
        email: 'founder@example.test',
        status: 'complete',
      });
      expect(claim?.completedAtMs).toBeDefined();

      // Check role document
      const roleDoc = await e.store.get<{ role: Role; assignedBy: string }>('roles/me');
      expect(roleDoc).toMatchObject({ role: 'owner', assignedBy: 'me' });
    });

    it('duplicate completed claim is rejected with OWNER_ALREADY_CLAIMED', async () => {
      const e = mk(); const auth = authPort();
      const me = as('me', undefined, { email: 'founder@example.test' });
      await admin.claimOwner(e.d, auth, me, 'founder@example.test');

      // Retry by same UID
      await expect(admin.claimOwner(e.d, auth, me, 'founder@example.test')).rejects.toMatchObject({ reason: 'OWNER_ALREADY_CLAIMED' });
      // Retry by different UID with same email
      const me2 = as('me2', undefined, { email: 'founder@example.test' });
      await expect(admin.claimOwner(e.d, auth, me2, 'founder@example.test')).rejects.toMatchObject({ reason: 'OWNER_ALREADY_CLAIMED' });
      expect(auth.calls).toHaveLength(1);
    });

    it('handles legacy claim document without status field', async () => {
      const e = mk(); const auth = authPort();
      await e.store.set(P.setting('ownerClaim'), { uid: 'me', atMs: 12345 });
      const me = as('me', undefined, { email: 'founder@example.test' });
      await expect(admin.claimOwner(e.d, auth, me, 'founder@example.test')).rejects.toMatchObject({ reason: 'OWNER_ALREADY_CLAIMED' });
    });

    it('recovers when role assignment fails: leaves status pending, allows same UID to resume', async () => {
      const e = mk();
      let fail = true;
      const flappyAuth = {
        calls: [] as [string, Role | null][],
        setRole: async (uid: string, r: Role | null) => {
          if (fail) throw new Error('Auth service network glitch');
          flappyAuth.calls.push([uid, r]);
        },
      };

      const me = as('me', undefined, { email: 'founder@example.test' });

      // First attempt fails during auth.setRole
      await expect(admin.claimOwner(e.d, flappyAuth, me, 'founder@example.test')).rejects.toThrow('Auth service network glitch');

      // Claim record must be in pending status
      const pendingClaim = await e.store.get<admin.OwnerClaimRecord>(P.setting('ownerClaim'));
      expect(pendingClaim).toMatchObject({
        uid: 'me',
        email: 'founder@example.test',
        status: 'pending',
      });
      expect(pendingClaim?.completedAtMs).toBeUndefined();

      // Another UID cannot take over pending claim
      const attacker = as('attacker', undefined, { email: 'founder@example.test' });
      await expect(admin.claimOwner(e.d, flappyAuth, attacker, 'founder@example.test')).rejects.toMatchObject({ reason: 'OWNER_ALREADY_CLAIMED' });

      // Same UID retries when auth recovers: succeeds
      fail = false;
      const res = await admin.claimOwner(e.d, flappyAuth, me, 'founder@example.test');
      expect(res).toEqual({ uid: 'me', role: 'owner' });
      expect(flappyAuth.calls).toEqual([['me', 'owner']]);

      // Claim is now marked complete
      const completedClaim = await e.store.get<admin.OwnerClaimRecord>(P.setting('ownerClaim'));
      expect(completedClaim).toMatchObject({
        uid: 'me',
        status: 'complete',
      });
      expect(completedClaim?.completedAtMs).toBeDefined();
    });

    it('rejects concurrent claim attempts, allowing only one winner', async () => {
      const e = mk(); const auth = authPort();
      const me1 = as('me1', undefined, { email: 'founder@example.test' });
      const me2 = as('me2', undefined, { email: 'founder@example.test' });

      const results = await Promise.allSettled([
        admin.claimOwner(e.d, auth, me1, 'founder@example.test'),
        admin.claimOwner(e.d, auth, me2, 'founder@example.test'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ reason: 'OWNER_ALREADY_CLAIMED' });
    });

    it('rethrows unrelated transaction failure without masking as OWNER_ALREADY_CLAIMED', async () => {
      const e = mk(); const auth = authPort();
      const me = as('me', undefined, { email: 'founder@example.test' });
      // Inject unexpected error in store.transact
      e.store.transact = async () => {
        const err = new Error('Firestore connection unavailable');
        (err as unknown as { code: number }).code = 14; // UNAVAILABLE, not 6
        throw err;
      };

      await expect(admin.claimOwner(e.d, auth, me, 'founder@example.test')).rejects.toThrow('Firestore connection unavailable');
    });
  });
});

describe('pricing', () => {
  const plan = { planId: 'pro', name: 'Pro plan', pricePaise: 49900, durationDays: 90, entitlements: ['all'], published: false };
  it('lets an admin draft a plan but only a super admin/owner publish a price', async () => {
    const e = mk();
    await expect(admin.upsertPlan(e.d, adm, plan)).rejects.toMatchObject({ reason: 'FORBIDDEN' }); // admin has no pricing.write
    await expect(admin.upsertPlan(e.d, superA, plan)).resolves.toBeTruthy();
    await expect(admin.upsertPlan(e.d, superA, { ...plan, published: true })).resolves.toBeTruthy();
    expect(await e.store.get(P.plan('pro'))).toMatchObject({ published: true, currency: 'INR' });
  });
});

describe('question detail, blueprints and overview', () => {
  it('shows the full question (with the answer) only to authors and reviewers', async () => {
    const e = mk(); const { questionId } = await admin.saveQuestion(e.d, editor, qInput(1));
    const r = await admin.getQuestion(e.d, reviewer, { questionId });
    expect((r.version as { correct: string[] }).correct).toEqual(['b']); expect(r.versions).toHaveLength(1);
    await expect(admin.getQuestion(e.d, student, { questionId })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await expect(admin.getQuestion(e.d, support, { questionId })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await expect(admin.getQuestion(e.d, editor, { questionId: 'nope' })).rejects.toMatchObject({ reason: 'QUESTION_NOT_FOUND' });
    expect((await e.store.get<{ preview: string }>(P.question(questionId)))?.preview).toBe('Synthetic demo question 1');
  });
  it('only a super admin or the owner can mark a blueprint as the official pattern, and a used blueprint cannot change', async () => {
    const e = mk(); const input = { blueprint: { ...bp, officialPatternVerified: true } };
    const byEditor = await admin.upsertBlueprint(e.d, editor, input); expect(byEditor.officialPatternVerified).toBe(false);
    const byOwner = await admin.upsertBlueprint(e.d, owner, input); expect(byOwner.officialPatternVerified).toBe(true); expect(byOwner.version).toBe(2);
    await expect(admin.upsertBlueprint(e.d, student, input)).rejects.toMatchObject({ reason: 'FORBIDDEN' });
    await e.store.set(P.mockTest('live'), { blueprintId: bp.id, status: 'published' });
    await expect(admin.upsertBlueprint(e.d, owner, input)).rejects.toMatchObject({ reason: 'BLUEPRINT_IN_USE' });
  });
  it('overview returns only the counts a role may see', async () => {
    const e = mk(); await admin.saveQuestion(e.d, editor, qInput(1)); await e.store.set('leads/l1', { status: 'new' }); await e.store.set('users/u1', { displayName: 'A' });
    const forEditor = await admin.overview(e.d, editor); expect(forEditor.counts.questionsDraft).toBe(1); expect(forEditor.counts).not.toHaveProperty('leadsNew'); expect(forEditor.counts).not.toHaveProperty('students');
    const forOwner = await admin.overview(e.d, owner); expect(forOwner.counts.leadsNew).toBe(1); expect(forOwner.counts.students).toBe(1);
    await expect(admin.overview(e.d, student)).rejects.toMatchObject({ reason: 'FORBIDDEN' });
  });
  it('lists staff roles only for people who may assign roles', async () => {
    const e = mk(); await e.store.set('roles/x', { role: 'admin' });
    await expect(admin.adminList(e.d, owner, { collection: 'roles', limit: 10 })).resolves.toMatchObject({ items: [{ id: 'x', role: 'admin' }] });
    await expect(admin.adminList(e.d, adm, { collection: 'roles', limit: 10 })).rejects.toMatchObject({ reason: 'FORBIDDEN' });
  });
});
