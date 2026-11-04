import { describe, expect, it } from 'vitest';
import { applySave, clockOffset, computeDeadline, isPastDeadline, paletteCounts, paletteStatus, remainingMs, seededOrder } from '../session';

describe('session math', () => {
  it('computes deadlines and remaining time from server timestamps', () => {
    const d = computeDeadline(1_000_000, 180);
    expect(d).toBe(1_000_000 + 180 * 60_000);
    expect(remainingMs(d - 5000, d)).toBe(5000);
    expect(remainingMs(d + 5000, d)).toBe(0);
    expect(isPastDeadline(d + 1, d)).toBe(true);
    expect(isPastDeadline(d + 10_000, d, 30_000)).toBe(false);
    expect(clockOffset(2000, 1500)).toBe(500);
  });
  it('derives palette status for all five states', () => {
    expect(paletteStatus(undefined)).toBe('not_visited');
    expect(paletteStatus({ selected: [], visited: false, marked: false })).toBe('not_visited');
    expect(paletteStatus({ selected: [], visited: true, marked: false })).toBe('not_answered');
    expect(paletteStatus({ selected: ['a'], visited: true, marked: false })).toBe('answered');
    expect(paletteStatus({ selected: [], visited: true, marked: true })).toBe('marked');
    expect(paletteStatus({ selected: ['a'], visited: true, marked: true })).toBe('answered_marked');
    expect(paletteCounts(['answered', 'answered', 'marked']).answered).toBe(2);
  });
  it('treats save sequence numbers idempotently', () => {
    expect(applySave(5, 6)).toBe('apply');
    expect(applySave(5, 5)).toBe('duplicate');
    expect(applySave(5, 3)).toBe('stale');
  });
  it('shuffles deterministically per seed without losing items', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const a = seededOrder(items, 'session-1');
    expect(seededOrder(items, 'session-1')).toEqual(a);
    expect(seededOrder(items, 'session-2')).not.toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});
