/**
 * Firestore rules tests. They need the Firestore emulator:
 *   firebase emulators:exec --only firestore --project demo-ureducator "npm run test:rules"
 * Without FIRESTORE_EMULATOR_HOST every test is SKIPPED (not passed). In the build sandbox the emulator could not be downloaded.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where, deleteDoc, updateDoc } from 'firebase/firestore';

const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;

describe.skipIf(!hasEmulator)('firestore.rules', () => {
  beforeAll(async () => {
    const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST as string).split(':');
    env = await initializeTestEnvironment({ projectId: 'demo-ureducator', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: host as string, port: Number(port) } });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'subjects/s1'), { name: { en: 'Demo' } });
      await setDoc(doc(db, 'mockTests/pub'), { status: 'published', title: 'Pub' });
      await setDoc(doc(db, 'mockTests/draft'), { status: 'draft', title: 'Draft' });
      await setDoc(doc(db, 'plans/live'), { published: true, pricePaise: 100 });
      await setDoc(doc(db, 'plans/hidden'), { published: false, pricePaise: 100 });
      await setDoc(doc(db, 'users/alice'), { displayName: 'A' });
      await setDoc(doc(db, 'users/bob'), { displayName: 'B' });
      await setDoc(doc(db, 'examSessions/sa'), { uid: 'alice', status: 'in_progress' });
      await setDoc(doc(db, 'examSessions/sb'), { uid: 'bob', status: 'in_progress' });
      await setDoc(doc(db, 'results/ra'), { uid: 'alice', marks: 2 });
      await setDoc(doc(db, 'answerKeys/p1'), { q1: { correct: ['a'] } });
      await setDoc(doc(db, 'publishedPapers/p1'), { questions: [] });
      await setDoc(doc(db, 'questions/q1'), { status: 'draft' });
      await setDoc(doc(db, 'questions/q1/versions/1'), { correct: ['a'] });
      await setDoc(doc(db, 'systemSettings/_reportKey'), { key: 'k' });
      await setDoc(doc(db, 'errorNotebook/alice/entries/e1'), { qid: 'q1' });
      await setDoc(doc(db, 'leads/l1'), { name: 'Lead' });
      await setDoc(doc(db, 'auditLogs/a1'), { action: 'x' });
      await setDoc(doc(db, 'roles/alice'), { role: 'owner' });
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  const anon = () => env.unauthenticatedContext().firestore();
  const alice = () => env.authenticatedContext('alice', { email_verified: true }).firestore();

  it('lets anyone read the public catalogue but nobody write it', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'subjects/s1')));
    await assertFails(setDoc(doc(alice(), 'subjects/s2'), { name: 'x' }));
    await assertFails(deleteDoc(doc(alice(), 'subjects/s1')));
  });
  it('shows only published tests and published prices', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'mockTests/pub')));
    await assertFails(getDoc(doc(anon(), 'mockTests/draft')));
    await assertSucceeds(getDocs(query(collection(anon(), 'mockTests'), where('status', '==', 'published'))));
    await assertFails(getDocs(collection(anon(), 'mockTests')));
    await assertSucceeds(getDoc(doc(anon(), 'plans/live')));
    await assertFails(getDoc(doc(anon(), 'plans/hidden')));
  });
  it('lets a student read only their own profile, sessions and results', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'users/alice')));
    await assertFails(getDoc(doc(alice(), 'users/bob')));
    await assertFails(getDoc(doc(anon(), 'users/alice')));
    await assertSucceeds(getDoc(doc(alice(), 'examSessions/sa')));
    await assertFails(getDoc(doc(alice(), 'examSessions/sb')));
    await assertSucceeds(getDocs(query(collection(alice(), 'examSessions'), where('uid', '==', 'alice'))));
    await assertFails(getDocs(query(collection(alice(), 'examSessions'), where('uid', '==', 'bob'))));
    await assertFails(getDocs(collection(alice(), 'examSessions')));
    await assertSucceeds(getDoc(doc(alice(), 'results/ra')));
  });
  it('never lets a browser write sessions, results, profiles or entitlements', async () => {
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { role: 'owner' }));
    await assertFails(setDoc(doc(alice(), 'subscriptions/alice'), { status: 'active', entitlements: ['all'] }));
    await assertFails(updateDoc(doc(alice(), 'examSessions/sa'), { deadlineMs: 9e15 }));
    await assertFails(setDoc(doc(alice(), 'results/rx'), { uid: 'alice', marks: 300 }));
    await assertFails(setDoc(doc(alice(), 'roles/alice'), { role: 'owner' }));
  });
  it('keeps answer keys, papers, questions, keys, notebook, leads and audit logs unreadable', async () => {
    for (const p of ['answerKeys/p1', 'publishedPapers/p1', 'questions/q1', 'questions/q1/versions/1', 'systemSettings/_reportKey', 'errorNotebook/alice/entries/e1', 'leads/l1', 'auditLogs/a1', 'roles/alice']) {
      await assertFails(getDoc(doc(alice(), p)));
      await assertFails(getDoc(doc(anon(), p)));
    }
  });
  it('denies unknown collections by default', async () => {
    await assertFails(getDoc(doc(alice(), 'somethingNew/x')));
    await assertFails(setDoc(doc(alice(), 'somethingNew/x'), { a: 1 }));
  });
});

describe.skipIf(hasEmulator)('firestore.rules (emulator not available)', () => {
  it.skip('SKIPPED: set FIRESTORE_EMULATOR_HOST via firebase emulators:exec to run the rules tests', () => { expect(true).toBe(true); });
});
