import type { PaletteStatus } from './constants';
import type { ExamResponse } from './schemas';

export function computeDeadline(startedAtMs: number, durationMinutes: number): number {
  return startedAtMs + durationMinutes * 60_000;
}
export function remainingMs(nowMs: number, deadlineMs: number): number {
  return Math.max(0, deadlineMs - nowMs);
}
export function isPastDeadline(nowMs: number, deadlineMs: number, graceMs = 0): boolean {
  return nowMs > deadlineMs + graceMs;
}
/** Client clock offset from a server timestamp so the countdown follows server time, not the device clock. */
export function clockOffset(serverNowMs: number, clientNowMs: number): number {
  return serverNowMs - clientNowMs;
}

export function paletteStatus(r: Pick<ExamResponse, 'selected' | 'visited' | 'marked'> | undefined): PaletteStatus {
  if (!r || !r.visited) return 'not_visited';
  const answered = r.selected.length > 0;
  if (r.marked) return answered ? 'answered_marked' : 'marked';
  return answered ? 'answered' : 'not_answered';
}

export function paletteCounts(statuses: PaletteStatus[]): Record<PaletteStatus, number> {
  const c: Record<PaletteStatus, number> = { not_visited: 0, not_answered: 0, answered: 0, marked: 0, answered_marked: 0 };
  for (const s of statuses) c[s]++;
  return c;
}

/** Merge a save batch. Monotonic sequence numbers make retries and duplicates harmless. */
export function applySave(lastSeq: number, incomingSeq: number): 'apply' | 'duplicate' | 'stale' {
  if (incomingSeq === lastSeq) return 'duplicate';
  if (incomingSeq < lastSeq) return 'stale';
  return 'apply';
}

/** Deterministic per-session question order (stable across refresh). */
export function seededOrder<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j] as T, a[i] as T]; }
  return a;
}
