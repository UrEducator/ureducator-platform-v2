/**
 * Behavioural tests for firestore.rules, run against the LOCAL Firestore emulator with a demo-* project id.
 * Never touches a real Firebase project: the runner (scripts/test-rules.mjs) uses `firebase emulators:exec --project demo-ureducator`
 * and the emulator listens on 127.0.0.1 only (see firebase.json).
 *
 * These tests FAIL (they are never skipped) when no emulator is available, so a green run always means the rules were exercised.
 *
 * Design of the rules under test: browsers may read only (a) the public catalogue, (b) published tests and published prices,
 * and (c) the signed-in student's own documents. No browser write is allowed anywhere. Staff operate through Cloud Functions
 * (Admin SDK), so staff role claims must grant NOTHING extra in rules.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { P } from '../../functions/src/domain/paths';

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(HOST);
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-ureducator';
const ROLES = ['owner', 'super_admin', 'admin', 'content_editor', 'subject_reviewer', 'support_agent', 'analyst'] as const;

/** Every top-level collection, classified. A new collection must be added here on purpose (see the drift guard below). */
const PUBLIC_OPEN = ['subjects', 'units', 'topics', 'examBlueprints'];
const PUBLIC_FILTERED = ['mockTests', 'plans'];
const OWNER_BY_ID = ['users', 'performanceSnapshots', 'studyPlans', 'subscriptions'];
const OWNER_BY_FIELD = ['examSessions', 'results', 'orders', 'supportTickets'];
const SERVER_ONLY = [
  'publishedPapers', 'answerKeys', 'questions', 'examResponses', 'errorNotebook', 'learningNotes', 'reports', 'leads', 'consentRecords',
  'auditLogs', 'paymentEvents', 'coupons', 'roles', 'rateLimits', 'systemSettings', 'resources',
];
const ALL_ROOTS = [...PUBLIC_OPEN, ...PUBLIC_FILTERED, ...OWNER_BY_ID, ...OWNER_BY_FIELD, ...SERVER_ONLY];

let env: RulesTestEnvironment;
const anon = () => env.unauthenticatedContext().firestore();
const as = (uid: string, claims: Record<string, unknown> = {}) => env.authenticatedContext(uid, { email_verified: true, ...claims }).firestore();
const alice = () => as('alice');
const bob = () => as('bob');
const staff = (role: string) => as(`staff-${role}`, { role });

describe('firestore.rules (local emulator, demo project)', () => {
  beforeAll(async () => {
    if (!HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set. Run `npm run test:rules` (it starts the emulator). These tests are never skipped.');
    if (!LOOPBACK) throw new Error(`Refusing to run: emulator host "${HOST}" is not a loopback address.`);
    if (!/^demo-/.test(PROJECT_ID)) throw new Error(`Refusing to run: project id "${PROJECT_ID}" is not a demo-* project.`);
    const [host, port] = HOST.split(':') as [string, string];
    env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'), host, port: Number(port) } });
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const c of PUBLIC_OPEN) await setDoc(doc(db, `${c}/probe`), { name: { en: 'Demo' } });
      await setDoc(doc(db, 'mockTests/pub'), { status: 'published', title: 'Pub' });
      await setDoc(doc(db, 'mockTests/draft'), { status: 'draft', title: 'Draft' });
      await setDoc(doc(db, 'mockTests/review'), { status: 'review', title: 'Review' });
      await setDoc(doc(db, 'mockTests/caps'), { status: 'Published', title: 'Wrong case' });
      await setDoc(doc(db, 'mockTests/nostatus'), { title: 'No status field' });
      await setDoc(doc(db, 'plans/live'), { published: true, pricePaise: 100 });
      await setDoc(doc(db, 'plans/hidden'), { published: false, pricePaise: 100 });
      await setDoc(doc(db, 'plans/stringy'), { published: 'true', pricePaise: 100 });
      for (const c of OWNER_BY_ID) { await setDoc(doc(db, `${c}/alice`), { note: 'A' }); await setDoc(doc(db, `${c}/bob`), { note: 'B' }); }
      for (const c of OWNER_BY_FIELD) { await setDoc(doc(db, `${c}/a1`), { uid: 'alice' }); await setDoc(doc(db, `${c}/b1`), { uid: 'bob' }); }
      // Server-only probes carry every field that a permissive rule might key on, so a mistaken rule would let them through.
      for (const c of SERVER_ONLY) await setDoc(doc(db, `${c}/probe`), { uid: 'alice', status: 'published', published: true, role: 'owner' });
      await setDoc(doc(db, 'answerKeys/p1'), { q1: { correct: ['a'] } });
      await setDoc(doc(db, 'publishedPapers/p1'), { questions: [] });
      await setDoc(doc(db, 'examResponses/sa'), { uid: 'alice', responses: {} });
      await setDoc(doc(db, 'questions/q1'), { status: 'draft' });
      await setDoc(doc(db, 'questions/q1/versions/1'), { correct: ['a'], explanation: { en: 'secret' } });
      await setDoc(doc(db, 'systemSettings/_reportKey'), { key: 'k' });
      await setDoc(doc(db, 'errorNotebook/alice/entries/e1'), { qid: 'q1', uid: 'alice' });
      await setDoc(doc(db, 'errorNotebook/bob/entries/e2'), { qid: 'q1', uid: 'bob' });
      // Nested paths under student-owned collections that the rules do not mention.
      await setDoc(doc(db, 'users/alice/private/secret'), { v: 1 });
      await setDoc(doc(db, 'users/alice/purchases/p1'), { v: 1 });
      await setDoc(doc(db, 'subscriptions/alice/history/h1'), { v: 1 });
      await setDoc(doc(db, 'orders/a1/refunds/r1'), { uid: 'alice' });
      await setDoc(doc(db, 'results/a1/answers/x'), { uid: 'alice', correct: ['a'] });
      await setDoc(doc(db, 'examSessions/a1/keys/k'), { uid: 'alice', correct: ['a'] });
      await setDoc(doc(db, 'users/carol'), { note: 'C' });
      for (const r of ROLES) await setDoc(doc(db, `users/staff-${r}`), { note: r });
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  /* ------------------------------------------------------------------ safety and drift guards */
  describe('test safety', () => {
    it('runs only against a loopback emulator and a demo-* project', () => {
      expect(LOOPBACK).toBe(true);
      expect(PROJECT_ID).toMatch(/^demo-/);
    });
    it('classifies every collection that the server writes or the rules mention (drift guard)', () => {
      const fromPaths = new Set(Object.values(P).map((fn) => (fn as unknown as (a: string, b: string) => string)('x', 'y').split('/')[0] as string));
      for (const c of fromPaths) expect(ALL_ROOTS, `collection "${c}" is used by the server but not classified in this test`).toContain(c);
      const rulesText = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
      const fromRules = [...rulesText.matchAll(/^\s*match \/(\w+)\//gm)].map((m) => m[1] as string).filter((c) => c !== 'databases');
      for (const c of fromRules) expect(ALL_ROOTS, `collection "${c}" is in firestore.rules but not classified in this test`).toContain(c);
    });
  });

  /* ------------------------------------------------------------------ unauthenticated */
  describe('unauthenticated visitors', () => {
    it('can read the public catalogue and blueprints, and nothing can write them', async () => {
      for (const c of PUBLIC_OPEN) {
        await assertSucceeds(getDoc(doc(anon(), `${c}/probe`)));
        await assertSucceeds(getDocs(collection(anon(), c)));
        await assertFails(setDoc(doc(anon(), `${c}/new`), { name: 'x' }));
        await assertFails(updateDoc(doc(anon(), `${c}/probe`), { name: 'x' }));
        await assertFails(deleteDoc(doc(anon(), `${c}/probe`)));
      }
    });
    it('cannot read any student-owned document or list student-owned collections', async () => {
      for (const c of OWNER_BY_ID) { await assertFails(getDoc(doc(anon(), `${c}/alice`))); await assertFails(getDocs(collection(anon(), c))); }
      for (const c of OWNER_BY_FIELD) {
        await assertFails(getDoc(doc(anon(), `${c}/a1`)));
        await assertFails(getDocs(collection(anon(), c)));
        await assertFails(getDocs(query(collection(anon(), c), where('uid', '==', 'alice'))));
      }
    });
    it('cannot read any server-only collection', async () => {
      for (const c of SERVER_ONLY) { await assertFails(getDoc(doc(anon(), `${c}/probe`))); await assertFails(getDocs(collection(anon(), c))); }
    });
    it('cannot write anywhere', async () => {
      for (const c of ALL_ROOTS) {
        await assertFails(setDoc(doc(anon(), `${c}/anon-new`), { a: 1 }));
        await assertFails(deleteDoc(doc(anon(), `${c}/probe`)));
      }
    });
  });

  /* ------------------------------------------------------------------ published / unpublished */
  describe('published and unpublished content', () => {
    it('shows only published tests, and only to queries that prove it', async () => {
      await assertSucceeds(getDoc(doc(anon(), 'mockTests/pub')));
      for (const id of ['draft', 'review', 'caps', 'nostatus']) await assertFails(getDoc(doc(anon(), `mockTests/${id}`)));
      await assertSucceeds(getDocs(query(collection(anon(), 'mockTests'), where('status', '==', 'published'))));
      await assertFails(getDocs(collection(anon(), 'mockTests')));
      await assertFails(getDocs(query(collection(anon(), 'mockTests'), where('status', '==', 'draft'))));
      await assertFails(getDocs(query(collection(alice(), 'mockTests'), where('status', 'in', ['published', 'draft']))));
    });
    it('shows only prices an admin has published, and only to queries that prove it', async () => {
      await assertSucceeds(getDoc(doc(anon(), 'plans/live')));
      await assertFails(getDoc(doc(anon(), 'plans/hidden')));
      await assertFails(getDoc(doc(anon(), 'plans/stringy')));
      await assertSucceeds(getDocs(query(collection(anon(), 'plans'), where('published', '==', true))));
      await assertFails(getDocs(collection(anon(), 'plans')));
      await assertFails(getDocs(query(collection(alice(), 'plans'), where('published', '==', false))));
    });
    it('does not let a student publish, unpublish or reprice anything', async () => {
      await assertFails(updateDoc(doc(alice(), 'mockTests/draft'), { status: 'published' }));
      await assertFails(updateDoc(doc(alice(), 'mockTests/pub'), { status: 'draft' }));
      await assertFails(setDoc(doc(alice(), 'mockTests/self'), { status: 'published', title: 'Mine' }));
      await assertFails(updateDoc(doc(alice(), 'plans/live'), { pricePaise: 1 }));
      await assertFails(updateDoc(doc(alice(), 'plans/hidden'), { published: true }));
      await assertFails(setDoc(doc(alice(), 'plans/free'), { published: true, pricePaise: 0 }));
    });
  });

  /* ------------------------------------------------------------------ authenticated student */
  describe('authenticated student', () => {
    it('can read own profile, plan, snapshot and subscription by id', async () => {
      for (const c of OWNER_BY_ID) await assertSucceeds(getDoc(doc(alice(), `${c}/alice`)));
    });
    it('can never list those collections', async () => {
      for (const c of OWNER_BY_ID) await assertFails(getDocs(collection(alice(), c)));
    });
    it('can read own sessions, results, orders and tickets, by id and by an owner-filtered query', async () => {
      for (const c of OWNER_BY_FIELD) {
        await assertSucceeds(getDoc(doc(alice(), `${c}/a1`)));
        await assertSucceeds(getDocs(query(collection(alice(), c), where('uid', '==', 'alice'))));
      }
    });
    it('cannot list those collections without the owner filter', async () => {
      for (const c of OWNER_BY_FIELD) await assertFails(getDocs(collection(alice(), c)));
    });
    it('can read the public catalogue and published tests', async () => {
      await assertSucceeds(getDoc(doc(alice(), 'subjects/probe')));
      await assertSucceeds(getDoc(doc(alice(), 'mockTests/pub')));
    });
    it('still has no write access to its own documents', async () => {
      for (const c of [...OWNER_BY_ID, ...OWNER_BY_FIELD]) {
        const id = OWNER_BY_ID.includes(c) ? 'alice' : 'a1';
        await assertFails(setDoc(doc(alice(), `${c}/${id}`), { uid: 'alice', note: 'edited' }));
        await assertFails(setDoc(doc(alice(), `${c}/${id}`), { note: 'edited' }, { merge: true }));
        await assertFails(updateDoc(doc(alice(), `${c}/${id}`), { note: 'edited' }));
        await assertFails(deleteDoc(doc(alice(), `${c}/${id}`)));
        await assertFails(setDoc(doc(alice(), `${c}/new-${c}`), { uid: 'alice' }));
      }
    });
    it('can read its own documents even before email verification (rules do not gate on it; the functions do)', async () => {
      await assertSucceeds(getDoc(doc(as('carol', { email_verified: false }), 'users/carol')));
    });
  });

  /* ------------------------------------------------------------------ cross-student */
  describe('cross-student access', () => {
    it('denies reading another student by id', async () => {
      for (const c of OWNER_BY_ID) await assertFails(getDoc(doc(alice(), `${c}/bob`)));
      for (const c of OWNER_BY_FIELD) await assertFails(getDoc(doc(alice(), `${c}/b1`)));
      for (const c of OWNER_BY_ID) await assertFails(getDoc(doc(bob(), `${c}/alice`)));
    });
    it('denies querying another student\'s documents, including claiming to be them in the query', async () => {
      for (const c of OWNER_BY_FIELD) {
        await assertFails(getDocs(query(collection(alice(), c), where('uid', '==', 'bob'))));
        await assertFails(getDocs(query(collection(alice(), c), where('uid', 'in', ['alice', 'bob']))));
      }
    });
    it('denies writing into another student\'s documents', async () => {
      for (const c of OWNER_BY_ID) await assertFails(updateDoc(doc(alice(), `${c}/bob`), { note: 'hacked' }));
      for (const c of OWNER_BY_FIELD) { await assertFails(updateDoc(doc(alice(), `${c}/b1`), { uid: 'alice' })); await assertFails(deleteDoc(doc(alice(), `${c}/b1`))); }
    });
    it('denies reading another student\'s notebook', async () => {
      await assertFails(getDoc(doc(alice(), 'errorNotebook/bob/entries/e2')));
      await assertFails(getDocs(collection(alice(), 'errorNotebook/bob/entries')));
    });
  });

  /* ------------------------------------------------------------------ admin and owner roles */
  describe('staff roles get no extra access in rules (staff work through Cloud Functions)', () => {
    for (const role of ROLES) {
      it(`${role}: public data and own profile only; no server-only data; no writes`, async () => {
        const s = () => staff(role);
        await assertSucceeds(getDoc(doc(s(), 'subjects/probe')));
        await assertSucceeds(getDoc(doc(s(), 'mockTests/pub')));
        await assertSucceeds(getDoc(doc(s(), `users/staff-${role}`)));
        await assertFails(getDoc(doc(s(), 'users/alice')));
        await assertFails(getDoc(doc(s(), 'examSessions/a1')));
        await assertFails(getDoc(doc(s(), 'results/a1')));
        await assertFails(getDoc(doc(s(), 'orders/a1')));
        await assertFails(getDoc(doc(s(), 'supportTickets/a1')));
        await assertFails(getDoc(doc(s(), 'mockTests/draft')));
        for (const c of SERVER_ONLY) await assertFails(getDoc(doc(s(), `${c}/probe`)));
        await assertFails(getDoc(doc(s(), 'answerKeys/p1')));
        await assertFails(setDoc(doc(s(), 'subjects/probe'), { name: 'x' }));
        await assertFails(updateDoc(doc(s(), 'mockTests/pub'), { status: 'draft' }));
        await assertFails(updateDoc(doc(s(), 'plans/live'), { pricePaise: 1 }));
        await assertFails(setDoc(doc(s(), 'roles/anyone'), { role: 'owner' }));
        await assertFails(setDoc(doc(s(), 'auditLogs/forged'), { action: 'x' }));
        await assertFails(setDoc(doc(s(), 'questions/q2'), { status: 'published' }));
      });
    }
    it('a forged client-side role claim grants nothing', async () => {
      const mallory = as('mallory', { role: 'owner', admin: true, super_admin: true, isAdmin: true });
      await assertFails(getDoc(doc(mallory, 'answerKeys/p1')));
      await assertFails(getDoc(doc(mallory, 'roles/probe')));
      await assertFails(getDoc(doc(mallory, 'users/alice')));
      await assertFails(setDoc(doc(mallory, 'roles/mallory'), { role: 'owner' }));
      await assertFails(setDoc(doc(mallory, 'systemSettings/x'), { v: 1 }));
    });
  });

  /* ------------------------------------------------------------------ privileged fields */
  describe('privileged-field modification', () => {
    const attempts: [string, string, Record<string, unknown>][] = [
      ['users/alice', 'role', { role: 'owner' }],
      ['users/alice', 'custom claims mirror', { claims: { role: 'owner' } }],
      ['users/alice', 'entitlements', { entitlements: ['all'] }],
      ['users/alice', 'email verified flag', { emailVerified: true }],
      ['subscriptions/alice', 'status', { status: 'active' }],
      ['subscriptions/alice', 'expiry', { expiresAtMs: 9e15 }],
      ['examSessions/a1', 'deadline', { deadlineMs: 9e15 }],
      ['examSessions/a1', 'status', { status: 'submitted' }],
      ['results/a1', 'marks', { marks: 300 }],
      ['results/a1', 'percentage', { percentage: 100 }],
      ['orders/a1', 'status', { status: 'paid' }],
      ['orders/a1', 'amount', { amountPaise: 1 }],
      ['performanceSnapshots/alice', 'aggregate', { testsTaken: 999 }],
      ['studyPlans/alice', 'plan', { weeks: [] }],
      ['supportTickets/a1', 'status', { status: 'closed' }],
      ['errorNotebook/alice/entries/e1', 'visibleAtMs', { visibleAtMs: 0 }],
      ['rateLimits/probe', 'counter reset', { count: 0 }],
      ['systemSettings/_reportKey', 'signing key', { key: 'attacker' }],
    ];
    for (const [path, label, patch] of attempts) {
      it(`denies ${path}: ${label}`, async () => {
        await assertFails(updateDoc(doc(alice(), path), patch));
        await assertFails(setDoc(doc(alice(), path), patch, { merge: true }));
        await assertFails(setDoc(doc(alice(), path), patch));
      });
    }
    it('denies forging server-written records from a browser', async () => {
      await assertFails(setDoc(doc(alice(), 'auditLogs/forged'), { action: 'role.assign', by: 'alice' }));
      await assertFails(setDoc(doc(alice(), 'consentRecords/c1'), { uid: 'alice', consent: true }));
      await assertFails(setDoc(doc(alice(), 'leads/l1'), { email: 'a@b.test' }));
      await assertFails(setDoc(doc(alice(), 'paymentEvents/e1'), { type: 'payment.captured' }));
      await assertFails(setDoc(doc(alice(), 'reports/r1'), { uid: 'alice' }));
      await assertFails(setDoc(doc(alice(), 'coupons/FREE100'), { percentOff: 100 }));
    });
  });

  /* ------------------------------------------------------------------ server-only and answer keys */
  describe('server-only collections and answer-key confidentiality', () => {
    it('denies every read of every server-only collection to anonymous, student and owner-claim users', async () => {
      for (const who of [anon(), alice(), staff('owner')]) {
        for (const c of SERVER_ONLY) {
          await assertFails(getDoc(doc(who, `${c}/probe`)));
          await assertFails(getDocs(collection(who, c)));
          await assertFails(getDocs(query(collection(who, c), where('uid', '==', 'alice'))));
          await assertFails(getDocs(query(collection(who, c), where('status', '==', 'published'))));
        }
      }
    });
    it('keeps answer keys, papers, questions and their versions unreadable, even for a student who is mid-exam', async () => {
      await assertSucceeds(getDoc(doc(alice(), 'examSessions/a1'))); // the student owns a session...
      for (const p of ['answerKeys/p1', 'publishedPapers/p1', 'questions/q1', 'questions/q1/versions/1', 'examResponses/sa']) {
        await assertFails(getDoc(doc(alice(), p))); // ...yet cannot reach the key, the paper source or their raw responses
        await assertFails(getDoc(doc(anon(), p)));
      }
      await assertFails(getDocs(collection(alice(), 'answerKeys')));
      await assertFails(getDocs(collection(alice(), 'questions/q1/versions')));
    });
    it('blocks collection-group queries that could bypass per-collection rules', async () => {
      await assertFails(getDocs(collectionGroup(alice(), 'versions')));
      await assertFails(getDocs(collectionGroup(alice(), 'entries')));
      await assertFails(getDocs(collectionGroup(anon(), 'versions')));
      await assertFails(getDocs(collectionGroup(staff('owner'), 'versions')));
      await assertFails(getDocs(collectionGroup(alice(), 'keys')));
    });
    it('denies unknown collections by default', async () => {
      await assertFails(getDoc(doc(alice(), 'somethingNew/x')));
      await assertFails(setDoc(doc(alice(), 'somethingNew/x'), { a: 1 }));
      await assertFails(getDocs(collection(anon(), 'somethingNew')));
    });
  });

  /* ------------------------------------------------------------------ nested user and purchase paths */
  describe('nested user, notebook and purchase paths', () => {
    it('denies notebook entries to everyone, including their owner (they are served by a function that honours the reveal policy)', async () => {
      await assertFails(getDoc(doc(alice(), 'errorNotebook/alice/entries/e1')));
      await assertFails(getDocs(collection(alice(), 'errorNotebook/alice/entries')));
      await assertFails(setDoc(doc(alice(), 'errorNotebook/alice/entries/e9'), { qid: 'q1' }));
      await assertFails(getDoc(doc(anon(), 'errorNotebook/alice/entries/e1')));
    });
    it('denies sub-collections that the rules never mention, even to the owner of the parent document', async () => {
      for (const p of ['users/alice/private/secret', 'users/alice/purchases/p1', 'subscriptions/alice/history/h1', 'orders/a1/refunds/r1', 'results/a1/answers/x', 'examSessions/a1/keys/k']) {
        await assertFails(getDoc(doc(alice(), p)));
        await assertFails(setDoc(doc(alice(), p), { v: 2 }));
        await assertFails(getDoc(doc(anon(), p)));
      }
    });
    it('handles purchase data: own orders readable, subscriptions by id only, events and coupons never', async () => {
      await assertSucceeds(getDoc(doc(alice(), 'orders/a1')));
      await assertFails(getDoc(doc(alice(), 'orders/b1')));
      await assertSucceeds(getDoc(doc(alice(), 'subscriptions/alice')));
      await assertFails(getDocs(collection(alice(), 'subscriptions')));
      await assertFails(getDoc(doc(alice(), 'paymentEvents/probe')));
      await assertFails(getDoc(doc(alice(), 'coupons/probe')));
      await assertFails(setDoc(doc(alice(), 'orders/o9'), { uid: 'alice', status: 'paid', amountPaise: 0 }));
    });
  });

  /* ------------------------------------------------------------------ invalid and oversized input */
  describe('invalid and oversized input', () => {
    // The rules contain no client write path, so every payload, however malformed or large, must be refused for permission reasons.
    // Payloads stay under Firestore's 1 MiB limit so the request reaches the rules instead of failing in the client.
    const big = 'x'.repeat(800_000);
    it('refuses a near-limit payload on student-owned and server-only paths', async () => {
      await assertFails(setDoc(doc(alice(), 'users/alice'), { bio: big }));
      await assertFails(setDoc(doc(alice(), 'results/rbig'), { uid: 'alice', blob: big }));
      await assertFails(setDoc(doc(alice(), 'answerKeys/big'), { blob: big }));
      await assertFails(setDoc(doc(anon(), 'leads/big'), { blob: big }));
    });
    it('refuses malformed documents', async () => {
      await assertFails(setDoc(doc(alice(), 'results/bad1'), { uid: 12345, marks: 'lots' }));
      await assertFails(setDoc(doc(alice(), 'examSessions/bad2'), { uid: { nested: true }, status: ['x'] }));
      await assertFails(setDoc(doc(alice(), 'users/alice'), { role: null, entitlements: { all: true } }));
      await assertFails(setDoc(doc(alice(), 'mockTests/bad3'), { status: 'published', questions: Array.from({ length: 500 }, (_, i) => ({ i })) }));
    });
    it('refuses unusual document ids and deep paths', async () => {
      await assertFails(setDoc(doc(alice(), `users/${'a'.repeat(1000)}`), { v: 1 }));
      await assertFails(setDoc(doc(alice(), 'users/alice/a/b/c/d/e/f'), { v: 1 }));
      await assertFails(getDoc(doc(alice(), 'users/alice/a/b/c/d/e/f')));
    });
  });
});
