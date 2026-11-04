export type ReviewState = { ease: number; intervalDays: number; reps: number; dueDate: string };
const addDays = (dateKey: string, n: number) => new Date(Date.parse(dateKey + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

export function initialState(todayKey: string): ReviewState {
  return { ease: 2.5, intervalDays: 0, reps: 0, dueDate: todayKey };
}
/** SM-2 style scheduler. quality: 0 (forgot) .. 5 (perfect recall). */
export function review(state: ReviewState, quality: 0 | 1 | 2 | 3 | 4 | 5, todayKey: string): ReviewState {
  if (quality < 3) return { ease: Math.max(1.3, state.ease - 0.2), intervalDays: 1, reps: 0, dueDate: addDays(todayKey, 1) };
  const ease = Math.max(1.3, state.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const reps = state.reps + 1;
  const intervalDays = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(state.intervalDays * ease);
  return { ease, intervalDays, reps, dueDate: addDays(todayKey, intervalDays) };
}
export function isDue(state: ReviewState, todayKey: string): boolean {
  return state.dueDate <= todayKey;
}
