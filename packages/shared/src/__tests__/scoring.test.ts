import { describe, expect, it } from 'vitest';
import { DEFAULT_BLUEPRINT, BlueprintSchema, maxMarks, totalQuestions } from '../blueprint';
import { scoreAttempt, scoreQuestion } from '../scoring';
import type { AnswerKey, ExamResponse } from '../schemas';

const key: AnswerKey = {
  q1: { correct: ['a'], sectionId: 'paper1', unitId: 'u1', topicId: 't1', difficulty: 'easy' },
  q2: { correct: ['b'], sectionId: 'paper1', unitId: 'u1', topicId: 't1', difficulty: 'medium' },
  q3: { correct: ['a', 'c'], sectionId: 'paper2', unitId: 'u2', topicId: 't2', difficulty: 'hard' },
  q4: { correct: ['d'], sectionId: 'paper2', unitId: 'u2', topicId: 't2', difficulty: 'hard' },
};
const r = (qid: string, selected: string[], timeSpentMs = 1000): ExamResponse => ({ qid, selected, visited: true, marked: false, timeSpentMs });

describe('blueprint', () => {
  it('default blueprint matches the owner requirements and is not marked as officially verified', () => {
    expect(totalQuestions(DEFAULT_BLUEPRINT)).toBe(150);
    expect(maxMarks(DEFAULT_BLUEPRINT)).toBe(300);
    expect(DEFAULT_BLUEPRINT.durationMinutes).toBe(180);
    expect(DEFAULT_BLUEPRINT.marking).toMatchObject({ correct: 2, incorrect: 0 });
    expect(DEFAULT_BLUEPRINT.officialPatternVerified).toBe(false);
  });
  it('rejects duplicate section ids and positive negative-marking', () => {
    expect(() => BlueprintSchema.parse({ ...DEFAULT_BLUEPRINT, sections: [DEFAULT_BLUEPRINT.sections[0], DEFAULT_BLUEPRINT.sections[0]] })).toThrow();
    expect(() => BlueprintSchema.parse({ ...DEFAULT_BLUEPRINT, marking: { ...DEFAULT_BLUEPRINT.marking, incorrect: 1 } })).toThrow();
  });
});

describe('scoring', () => {
  const bp = { ...DEFAULT_BLUEPRINT };
  it('scores correct, incorrect and unattempted with 2 marks and no negative marking', () => {
    const res = scoreAttempt(bp, key, { q1: r('q1', ['a']), q2: r('q2', ['c']), q3: r('q3', ['a', 'c']) }, ['q1', 'q2', 'q3', 'q4']);
    expect(res.marks).toBe(4);
    expect(res).toMatchObject({ correct: 2, incorrect: 1, unattempted: 1, attempted: 3, maxMarks: 8 });
    expect(res.accuracy).toBeCloseTo(2 / 3);
    expect(res.attemptRate).toBeCloseTo(0.75);
    expect(res.bySection['paper1']).toMatchObject({ total: 2, correct: 1, incorrect: 1 });
    expect(res.byDifficulty['hard']).toMatchObject({ total: 2, correct: 1, unattempted: 1 });
  });
  it('applies configurable negative marking', () => {
    const neg = { ...bp, marking: { ...bp.marking, incorrect: -0.5 } };
    expect(scoreAttempt(neg, key, { q1: r('q1', ['b']) }, ['q1']).marks).toBe(-0.5);
  });
  it('multi-correct is all-or-nothing by default and order independent', () => {
    expect(scoreQuestion(bp.marking, ['a', 'c'], ['c', 'a']).outcome).toBe('correct');
    expect(scoreQuestion(bp.marking, ['a', 'c'], ['a']).outcome).toBe('incorrect');
  });
  it('supports partial credit only when configured and no wrong option is chosen', () => {
    const partial = { ...bp.marking, multiCorrectPolicy: 'partial_no_wrong' as const };
    expect(scoreQuestion(partial, ['a', 'c'], ['a'])).toEqual({ outcome: 'partial', marks: 1 });
    expect(scoreQuestion(partial, ['a', 'c'], ['a', 'b']).outcome).toBe('incorrect');
  });
  it('ignores duplicate selections and refuses to score without an answer key', () => {
    expect(scoreQuestion(bp.marking, ['a'], ['a', 'a']).outcome).toBe('correct');
    expect(() => scoreAttempt(bp, key, {}, ['missing'])).toThrow(/answer key missing/);
  });
  it('percentage never goes below zero', () => {
    const neg = { ...bp, marking: { ...bp.marking, incorrect: -2 } };
    expect(scoreAttempt(neg, key, { q1: r('q1', ['b']) }, ['q1']).percentage).toBe(0);
  });
});
