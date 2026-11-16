import { describe, expect, it } from 'vitest';
import { classifyDiagnosticQuadrant, classifyTopics, consistency, insights, mergeTopics, summarise, trend } from '../analytics';
import { initialState, isDue, review } from '../spacedRepetition';
import { buildWeeklyPlan } from '../studyPlan';
import { DEFAULT_BLUEPRINT } from '../blueprint';
import { scoreAttempt } from '../scoring';

describe('analytics', () => {
  it('merges topic buckets and classifies weak and strong areas with minimum attempts', () => {
    const a = mergeTopics({}, { t1: { total: 5, correct: 1, incorrect: 4, unattempted: 0, marks: 2, timeMs: 1 }, t2: { total: 5, correct: 5, incorrect: 0, unattempted: 0, marks: 10, timeMs: 1 }, t3: { total: 2, correct: 0, incorrect: 2, unattempted: 0, marks: 0, timeMs: 1 } });
    const { weak, strong } = classifyTopics(a);
    expect(weak.map((t) => t.topicId)).toEqual(['t1']);
    expect(strong.map((t) => t.topicId)).toEqual(['t2']);
  });
  it('computes consistency over a 14 day window', () => {
    expect(consistency(['2026-11-04', '2026-11-03', '2026-10-01'], '2026-11-04').numerator).toBe(2);
  });
  it('detects score trends', () => {
    expect(trend([0.2, 0.3, 0.5, 0.6]).direction).toBe('up');
    expect(trend([0.6, 0.6]).direction).toBe('flat');
    expect(trend([0.5]).direction).toBe('insufficient');
  });
  it('produces actionable insights tied to the numbers', () => {
    const bp = DEFAULT_BLUEPRINT;
    const key = { q1: { correct: ['a'], sectionId: 'paper1', unitId: 'u', topicId: 't', difficulty: 'easy' as const } };
    const s = summarise(scoreAttempt(bp, key, {}, ['q1']), 1000);
    expect(insights(s, []).some((i) => i.id === 'low-attempt')).toBe(true);
  });
  it('classifies topics into the four diagnostic quadrants based on accuracy and speed', () => {
    // 1. Mastered: High Accuracy (>=65%) & Fast (<=60s)
    const mastered = classifyDiagnosticQuadrant(85, 45);
    expect(mastered.id).toBe('mastered');
    expect(mastered.tone).toBe('ok');

    // 2. Deep Thinker: High Accuracy (>=65%) & Slow (>60s)
    const deepThinker = classifyDiagnosticQuadrant(75, 75);
    expect(deepThinker.id).toBe('deep_thinker');
    expect(deepThinker.tone).toBe('info');

    // 3. Speed Demon: Low Accuracy (<65%) & Fast (<=60s)
    const speedDemon = classifyDiagnosticQuadrant(50, 40);
    expect(speedDemon.id).toBe('speed_demon');
    expect(speedDemon.tone).toBe('warn');

    // 4. Needs Review: Low Accuracy (<65%) & Slow (>60s)
    const needsReview = classifyDiagnosticQuadrant(45, 80);
    expect(needsReview.id).toBe('needs_review');
    expect(needsReview.tone).toBe('bad');
  });
});

describe('spaced repetition', () => {
  it('lengthens intervals on recall and resets on failure', () => {
    let s = initialState('2026-11-04');
    expect(isDue(s, '2026-11-04')).toBe(true);
    s = review(s, 5, '2026-11-04'); expect(s.intervalDays).toBe(1);
    s = review(s, 5, '2026-11-05'); expect(s.intervalDays).toBe(6);
    s = review(s, 4, '2026-11-11'); expect(s.intervalDays).toBeGreaterThan(6);
    const failed = review(s, 1, '2026-11-20'); expect(failed.intervalDays).toBe(1); expect(failed.reps).toBe(0);
    expect(failed.ease).toBeGreaterThanOrEqual(1.3);
  });
});

describe('study plan', () => {
  it('is deterministic, covers 7 days and ends with a mock', () => {
    const opts = { startDate: '2026-11-04', minutesPerDay: 120, weak: [{ topicId: 't1', attempted: 8, correct: 2, total: 10, timeMs: 0, tests: 2 }], topicNames: { t1: 'Topic 1' } };
    const p1 = buildWeeklyPlan(opts); const p2 = buildWeeklyPlan(opts);
    expect(p1).toEqual(p2);
    expect(new Set(p1.map((t) => t.date)).size).toBe(7);
    expect(p1.at(-1)?.kind).toBe('mock');
    for (const day of new Set(p1.map((t) => t.date))) {
      const mins = p1.filter((t) => t.date === day).reduce((s, t) => s + t.minutes, 0);
      expect(mins).toBeLessThanOrEqual(120);
    }
  });
  it('still builds a plan with no weak topics', () => {
    expect(buildWeeklyPlan({ startDate: '2026-11-04', minutesPerDay: 60, weak: [], topicNames: {} }).length).toBe(7);
  });
});
