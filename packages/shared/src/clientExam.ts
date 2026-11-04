import type { ExamResponse } from './schemas';
import { paletteCounts, paletteStatus } from './session';
import type { PaletteStatus } from './constants';

/**
 * Pure state helpers for the exam screen. They contain no browser APIs so they can be unit tested.
 * The server remains the authority for time, validation and scoring; these only shape what the client sends.
 */
export type ClientResponses = Record<string, ExamResponse>;
const blank = (qid: string): ExamResponse => ({ qid, selected: [], visited: false, marked: false, timeSpentMs: 0 });
const get = (m: ClientResponses, qid: string) => m[qid] ?? blank(qid);

export function visitQuestion(m: ClientResponses, qid: string): ClientResponses {
  const r = get(m, qid); return r.visited ? m : { ...m, [qid]: { ...r, visited: true } };
}
export function chooseOption(m: ClientResponses, qid: string, optionId: string, multi: boolean): ClientResponses {
  const r = get(m, qid);
  const selected = multi ? (r.selected.includes(optionId) ? r.selected.filter((x) => x !== optionId) : [...r.selected, optionId].sort()) : [optionId];
  return { ...m, [qid]: { ...r, selected, visited: true } };
}
export function clearResponse(m: ClientResponses, qid: string): ClientResponses { return { ...m, [qid]: { ...get(m, qid), selected: [], visited: true } }; }
export function setMarked(m: ClientResponses, qid: string, marked: boolean): ClientResponses { return { ...m, [qid]: { ...get(m, qid), marked, visited: true } }; }
export function addTime(m: ClientResponses, qid: string, ms: number): ClientResponses {
  if (!(ms > 0)) return m; const r = get(m, qid); return { ...m, [qid]: { ...r, timeSpentMs: r.timeSpentMs + Math.round(ms) } };
}
/** Every response that changed since the last confirmed save, as full objects (the server merges by qid). */
export function dirtyBatch(m: ClientResponses, dirty: ReadonlySet<string>): ExamResponse[] { return [...dirty].map((q) => m[q]).filter((r): r is ExamResponse => !!r); }

export type SaveAck = { ok: boolean; status: string; lastSeq: number };
/**
 * Decide what to do after the server answers an autosave.
 *  - 'saved': our sequence number was applied (or already applied), clear the dirty set that was sent.
 *  - 'resync': the server is ahead of our counter (another tab or a restored draft). Adopt its number and send again.
 *  - 'ended': the attempt is over; stop saving and go to the result.
 */
export function interpretSave(sentSeq: number, ack: SaveAck): { kind: 'saved' | 'resync' | 'ended'; nextSeq: number } {
  if (ack.status !== 'in_progress' || !ack.ok) return { kind: 'ended', nextSeq: sentSeq };
  if (ack.lastSeq === sentSeq) return { kind: 'saved', nextSeq: sentSeq + 1 };
  return { kind: 'resync', nextSeq: Math.max(ack.lastSeq, sentSeq) + 1 };
}

export function remainingWithOffset(deadlineMs: number, nowMs: number, offsetMs: number): number { return Math.max(0, deadlineMs - (nowMs + offsetMs)); }
export type TimeWarning = 'none' | 'ten_minutes' | 'one_minute' | 'ended';
export function timeWarning(remaining: number): TimeWarning { return remaining <= 0 ? 'ended' : remaining <= 60_000 ? 'one_minute' : remaining <= 600_000 ? 'ten_minutes' : 'none'; }

export function paletteSummary(order: string[], m: ClientResponses): Record<PaletteStatus, number> { return paletteCounts(order.map((q) => paletteStatus(m[q]))); }
export function countAnswered(c: Record<PaletteStatus, number>): number { return c.answered + c.answered_marked; }
