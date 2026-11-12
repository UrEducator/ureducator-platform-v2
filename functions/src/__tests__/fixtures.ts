import { DEFAULT_BLUEPRINT, type AnswerKey, type Blueprint, type PublishedPaper } from '@ureducator/shared';
import { MemoryStore } from '../domain/memoryStore';
import { P } from '../domain/paths';
import type { MockTestDoc } from '../domain/types';

export const bp: Blueprint = {
  ...DEFAULT_BLUEPRINT, id: 'mini', durationMinutes: 10,
  sections: [
    { id: 'paper1', title: { en: 'Paper I' }, paper: 'paper1', questionCount: 3 },
    { id: 'paper2', title: { en: 'Paper II' }, paper: 'paper2', questionCount: 2 },
  ],
};
const mk = (qid: string, sectionId: string, correct: string[], multi = false) => ({
  qid, version: 1, sectionId, unitId: `u-${sectionId}`, topicId: `t-${qid}`, difficulty: 'medium' as const,
  content: { type: multi ? ('mcq_multi' as const) : ('mcq_single' as const), stem: { en: `Demo ${qid}` }, options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: { en: `opt ${id}` } })) },
  _correct: correct,
});
const qs = [mk('q1', 'paper1', ['a']), mk('q2', 'paper1', ['b']), mk('q3', 'paper1', ['c']), mk('q4', 'paper2', ['a', 'c'], true), mk('q5', 'paper2', ['d'])];
export const paper: PublishedPaper = { paperId: 'p1', mockTestId: 'mt1', version: 1, contentLabel: 'sample', questions: qs.map(({ _correct, ...q }) => q) };
export const key: AnswerKey = Object.fromEntries(qs.map((q) => [q.qid, { correct: q._correct, sectionId: q.sectionId, unitId: q.unitId, topicId: q.topicId, difficulty: q.difficulty, explanation: { en: `because ${q.qid}` } }]));

export const test: MockTestDoc = {
  title: 'Demo full test', kind: 'full', blueprintId: 'mini', paperId: 'p1', paperVersion: 1, access: 'free', status: 'published',
  timed: true, shuffle: false, revealPolicy: 'immediate', contentLabel: 'sample', version: 1,
};

export async function seed(overrides: Partial<MockTestDoc> = {}) {
  const store = new MemoryStore();
  await store.set(P.blueprint('mini'), bp);
  await store.set(P.paper('p1'), paper);
  await store.set(P.answerKey('p1'), key);
  await store.set(P.mockTest('mt1'), { ...test, ...overrides });
  await store.set(P.setting('pilotCohort'), { enabled: true, allowedUids: ['alice', 'bob'] });
  return store;
}
export const alice = { uid: 'alice', emailVerified: true };
export const bob = { uid: 'bob', emailVerified: true };
export const resp = (qid: string, selected: string[], extra: Partial<{ marked: boolean; timeSpentMs: number }> = {}) => ({ qid, selected, visited: true, marked: extra.marked ?? false, timeSpentMs: extra.timeSpentMs ?? 5000 });
