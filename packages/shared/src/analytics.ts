import type { Bucket, ScoreResult } from './scoring';

export type Rate = { value: number; numerator: number; denominator: number };
const rate = (n: number, d: number): Rate => ({ value: d ? n / d : 0, numerator: n, denominator: d });

/** Metric definitions are shown to students next to every number. */
export const METRIC_DEFINITIONS = {
  score: 'Marks obtained under the marking scheme of the test (correct, incorrect and unattempted values come from the test blueprint).',
  percentage: 'Marks obtained ÷ maximum marks. Negative totals are shown as 0%.',
  accuracy: 'Correct answers ÷ questions attempted. Unattempted questions are excluded.',
  attemptRate: 'Questions attempted ÷ total questions.',
  timeUtilisation: 'Time spent on questions ÷ time allowed for the test.',
  avgTimePerQuestion: 'Total time spent on attempted questions ÷ number of attempted questions.',
  weakArea: 'A topic with at least 4 attempted questions and accuracy below 50% across your recent tests.',
  strongArea: 'A topic with at least 4 attempted questions and accuracy of 75% or more across your recent tests.',
  consistency: 'Days with at least one completed test or revision task in the last 14 days ÷ 14.',
} as const;

export function summarise(score: ScoreResult, durationMs: number) {
  const spent = Object.values(score.perQuestion).reduce((s, q) => s + q.timeMs, 0);
  return {
    score: score.marks, maxMarks: score.maxMarks,
    percentage: rate(Math.max(0, score.marks), score.maxMarks),
    accuracy: rate(score.correct, score.attempted),
    attemptRate: rate(score.attempted, score.correct + score.incorrect + score.unattempted),
    unattempted: score.unattempted,
    timeUtilisation: rate(Math.min(spent, durationMs), durationMs),
    avgTimePerQuestionMs: score.attempted ? spent / score.attempted : 0,
  };
}

export type TopicAggregate = { topicId: string; attempted: number; correct: number; total: number; timeMs: number; tests: number };

/** Merge per-test topic buckets into a running aggregate (used for performanceSnapshots). */
export function mergeTopics(prev: Record<string, TopicAggregate>, byTopic: Record<string, Bucket>): Record<string, TopicAggregate> {
  const out = { ...prev };
  for (const [topicId, b] of Object.entries(byTopic)) {
    const p = out[topicId] ?? { topicId, attempted: 0, correct: 0, total: 0, timeMs: 0, tests: 0 };
    out[topicId] = { topicId, attempted: p.attempted + b.correct + b.incorrect, correct: p.correct + b.correct, total: p.total + b.total, timeMs: p.timeMs + b.timeMs, tests: p.tests + 1 };
  }
  return out;
}

export function classifyTopics(agg: Record<string, TopicAggregate>, minAttempts = 4) {
  const weak: TopicAggregate[] = []; const strong: TopicAggregate[] = [];
  for (const t of Object.values(agg)) {
    if (t.attempted < minAttempts) continue;
    const acc = t.correct / t.attempted;
    if (acc < 0.5) weak.push(t); else if (acc >= 0.75) strong.push(t);
  }
  weak.sort((a, b) => a.correct / a.attempted - b.correct / b.attempted);
  strong.sort((a, b) => b.correct / b.attempted - a.correct / a.attempted);
  return { weak, strong };
}

export function consistency(activeDayKeys: string[], todayKey: string, windowDays = 14): Rate {
  const today = Date.parse(todayKey + 'T00:00:00Z');
  const set = new Set(activeDayKeys.filter((k) => { const d = (today - Date.parse(k + 'T00:00:00Z')) / 86_400_000; return d >= 0 && d < windowDays; }));
  return rate(set.size, windowDays);
}

export function trend(scores: number[]): { direction: 'up' | 'down' | 'flat' | 'insufficient'; delta: number } {
  if (scores.length < 2) return { direction: 'insufficient', delta: 0 };
  const half = Math.floor(scores.length / 2);
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const delta = avg(scores.slice(-half)) - avg(scores.slice(0, half));
  return { direction: Math.abs(delta) < 0.02 ? 'flat' : delta > 0 ? 'up' : 'down', delta };
}

export type Insight = { id: string; severity: 'info' | 'action'; text: string; topicId?: string };
export function insights(summary: ReturnType<typeof summarise>, weak: TopicAggregate[]): Insight[] {
  const out: Insight[] = [];
  if (summary.attemptRate.value < 0.7) out.push({ id: 'low-attempt', severity: 'action', text: `You attempted ${summary.attemptRate.numerator} of ${summary.attemptRate.denominator} questions. Practise timed sets to raise your attempt rate.` });
  if (summary.attemptRate.value >= 0.7 && summary.accuracy.value < 0.6) out.push({ id: 'low-accuracy', severity: 'action', text: `Accuracy was ${Math.round(summary.accuracy.value * 100)}%. Slow down on questions you are unsure about and review your errors in the Error Notebook.` });
  if (summary.timeUtilisation.value < 0.6) out.push({ id: 'unused-time', severity: 'info', text: 'You used less than 60% of the time. Use leftover time to revisit marked questions.' });
  for (const t of weak.slice(0, 3)) out.push({ id: `weak-${t.topicId}`, severity: 'action', topicId: t.topicId, text: `Revise this topic: ${t.correct}/${t.attempted} correct so far.` });
  return out;
}

export type QuadrantId = 'mastered' | 'deep_thinker' | 'speed_demon' | 'needs_review';

export interface DiagnosticQuadrant {
  id: QuadrantId;
  label: string;
  badge: string;
  description: string;
  recommendation: string;
  color: string;
  tone: 'ok' | 'info' | 'warn' | 'bad';
}

/**
 * Diagnostic Quadrant Analysis (Speed vs. Accuracy) for UGC NET Paper 1.
 * Benchmark thresholds: 65% accuracy (qualifying standard) and 60 seconds / question.
 */
export function classifyDiagnosticQuadrant(accuracy: number, avgTimeSec: number): DiagnosticQuadrant {
  const isAccurate = accuracy >= 65;
  const isFast = avgTimeSec <= 60;

  if (isAccurate && isFast) {
    return {
      id: 'mastered',
      label: 'Mastered / High Accuracy & Fast',
      badge: 'Mastered',
      description: 'Quick recall & accurate problem-solving.',
      recommendation: 'Maintain consistency with periodic revision tests.',
      color: '#10b981',
      tone: 'ok',
    };
  }
  if (isAccurate && !isFast) {
    return {
      id: 'deep_thinker',
      label: 'Deep Thinker / High Accuracy & Slow',
      badge: 'Deep Thinker',
      description: 'Solid concept grasp, but spending excess time.',
      recommendation: 'Target speed drills and elimination shortcuts to save test minutes.',
      color: '#3b82f6',
      tone: 'info',
    };
  }
  if (!isAccurate && isFast) {
    return {
      id: 'speed_demon',
      label: 'Speed Demon / Guessing',
      badge: 'Speed Demon',
      description: 'Answering too quickly with high error rate.',
      recommendation: 'Slow down. Read question stems and negative qualifiers carefully.',
      color: '#f59e0b',
      tone: 'warn',
    };
  }
  return {
    id: 'needs_review',
    label: 'Needs Review / Slow & Inaccurate',
    badge: 'Needs Review',
    description: 'Foundational gaps causing hesitation and mistakes.',
    recommendation: 'High priority topic: read notes and solve concept sets.',
    color: '#ef4444',
    tone: 'bad',
  };
}
