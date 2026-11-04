import type { Blueprint } from './blueprint';
import type { AnswerKey, ExamResponse } from './schemas';

export type QuestionOutcome = 'correct' | 'incorrect' | 'unattempted' | 'partial';
export type Bucket = { total: number; correct: number; incorrect: number; unattempted: number; marks: number; timeMs: number };
export type ScoreResult = {
  marks: number; maxMarks: number; correct: number; incorrect: number; unattempted: number;
  attempted: number; accuracy: number; attemptRate: number; percentage: number;
  bySection: Record<string, Bucket>; byUnit: Record<string, Bucket>; byTopic: Record<string, Bucket>; byDifficulty: Record<string, Bucket>;
  perQuestion: Record<string, { outcome: QuestionOutcome; marks: number; timeMs: number }>;
};

const empty = (): Bucket => ({ total: 0, correct: 0, incorrect: 0, unattempted: 0, marks: 0, timeMs: 0 });
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export function scoreQuestion(marking: Blueprint['marking'], correct: string[], selected: string[]): { outcome: QuestionOutcome; marks: number } {
  const picked = [...new Set(selected)];
  if (picked.length === 0) return { outcome: 'unattempted', marks: marking.unattempted };
  if (sameSet(picked, correct)) return { outcome: 'correct', marks: marking.correct };
  if (marking.multiCorrectPolicy === 'partial_no_wrong' && correct.length > 1) {
    const anyWrong = picked.some((p) => !correct.includes(p));
    if (!anyWrong) return { outcome: 'partial', marks: Math.round((marking.correct * picked.length / correct.length) * 100) / 100 };
  }
  return { outcome: 'incorrect', marks: marking.incorrect };
}

/** Authoritative scoring. Runs on the server only; the client never supplies a score. */
export function scoreAttempt(bp: Blueprint, key: AnswerKey, responses: Record<string, ExamResponse>, questionIds: string[]): ScoreResult {
  const r: ScoreResult = {
    marks: 0, maxMarks: questionIds.length * bp.marking.correct, correct: 0, incorrect: 0, unattempted: 0, attempted: 0,
    accuracy: 0, attemptRate: 0, percentage: 0, bySection: {}, byUnit: {}, byTopic: {}, byDifficulty: {}, perQuestion: {},
  };
  for (const qid of questionIds) {
    const k = key[qid];
    if (!k) throw new Error(`answer key missing for ${qid}`);
    const resp = responses[qid];
    const { outcome, marks } = scoreQuestion(bp.marking, k.correct, resp?.selected ?? []);
    const timeMs = resp?.timeSpentMs ?? 0;
    r.perQuestion[qid] = { outcome, marks, timeMs };
    r.marks += marks;
    if (outcome === 'correct') r.correct++; else if (outcome === 'unattempted') r.unattempted++; else if (outcome === 'incorrect') r.incorrect++; else { r.incorrect++; }
    for (const [map, keyName] of [[r.bySection, k.sectionId], [r.byUnit, k.unitId], [r.byTopic, k.topicId], [r.byDifficulty, k.difficulty]] as const) {
      const b = (map[keyName] ??= empty());
      b.total++; b.marks += marks; b.timeMs += timeMs;
      if (outcome === 'correct') b.correct++; else if (outcome === 'unattempted') b.unattempted++; else b.incorrect++;
    }
  }
  r.marks = Math.round(r.marks * 100) / 100;
  r.attempted = r.correct + r.incorrect;
  r.accuracy = r.attempted ? r.correct / r.attempted : 0;
  r.attemptRate = questionIds.length ? r.attempted / questionIds.length : 0;
  r.percentage = r.maxMarks ? Math.max(0, r.marks) / r.maxMarks : 0;
  return r;
}
