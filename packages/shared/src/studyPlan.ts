import type { TopicAggregate } from './analytics';

export type PlanTask = { id: string; date: string; kind: 'learn' | 'practice' | 'revise' | 'mock'; topicId?: string; minutes: number; title: string };

const addDays = (dateKey: string, n: number) => new Date(Date.parse(dateKey + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Deterministic weekly plan: weakest topics first, one revision slot per day,
 * and a full mock on day 7. No randomness, so the same inputs give the same plan.
 */
export function buildWeeklyPlan(opts: { startDate: string; minutesPerDay: number; weak: TopicAggregate[]; topicNames: Record<string, string>; revisionDueTopicIds?: string[] }): PlanTask[] {
  const tasks: PlanTask[] = [];
  const m = Math.max(15, Math.min(720, Math.floor(opts.minutesPerDay)));
  const weak = opts.weak.length ? opts.weak : [];
  const due = opts.revisionDueTopicIds ?? [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(opts.startDate, d);
    if (d === 6) { tasks.push({ id: `${date}-mock`, date, kind: 'mock', minutes: Math.min(m, 180), title: 'Weekly timed mock test and error review' }); continue; }
    const rev = due[d % Math.max(1, due.length)];
    const t = weak[d % Math.max(1, weak.length)];
    const revMin = rev ? Math.round(m * 0.25) : 0;
    if (rev) tasks.push({ id: `${date}-rev`, date, kind: 'revise', topicId: rev, minutes: revMin, title: `Revise: ${opts.topicNames[rev] ?? rev}` });
    if (t) {
      const rest = m - revMin;
      tasks.push({ id: `${date}-learn`, date, kind: 'learn', topicId: t.topicId, minutes: Math.round(rest * 0.5), title: `Learn: ${opts.topicNames[t.topicId] ?? t.topicId}` });
      tasks.push({ id: `${date}-practice`, date, kind: 'practice', topicId: t.topicId, minutes: rest - Math.round(rest * 0.5), title: `Practise questions: ${opts.topicNames[t.topicId] ?? t.topicId}` });
    } else {
      tasks.push({ id: `${date}-practice`, date, kind: 'practice', minutes: m - revMin, title: 'Mixed practice set (take a test to personalise your plan)' });
    }
  }
  return tasks;
}
