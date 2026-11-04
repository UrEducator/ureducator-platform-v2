import { describe, expect, it } from 'vitest';
import { addTime, chooseOption, clearResponse, dirtyBatch, interpretSave, paletteSummary, remainingWithOffset, setMarked, timeWarning, visitQuestion, type ClientResponses } from '../clientExam';

describe('client exam helpers', () => {
  it('single choice replaces; multi choice toggles and keeps a stable order', () => {
    let m: ClientResponses = {};
    m = chooseOption(m, 'q1', 'a', false); m = chooseOption(m, 'q1', 'c', false);
    expect(m.q1!.selected).toEqual(['c']);
    m = chooseOption(m, 'q2', 'd', true); m = chooseOption(m, 'q2', 'a', true); expect(m.q2!.selected).toEqual(['a', 'd']);
    m = chooseOption(m, 'q2', 'a', true); expect(m.q2!.selected).toEqual(['d']);
  });
  it('visiting, marking, clearing and timing never lose other fields and never mutate the input', () => {
    const base: ClientResponses = { q1: { qid: 'q1', selected: ['b'], visited: true, marked: false, timeSpentMs: 1000 } };
    const frozen = structuredClone(base);
    const m = addTime(setMarked(clearResponse(base, 'q1'), 'q1', true), 'q1', 2500.4);
    expect(m.q1).toEqual({ qid: 'q1', selected: [], visited: true, marked: true, timeSpentMs: 3500 });
    expect(base).toEqual(frozen);
    expect(visitQuestion({}, 'q9').q9!.visited).toBe(true);
    expect(addTime(base, 'q1', -5)).toBe(base);
  });
  it('builds a batch of only the dirty responses', () => {
    const m = chooseOption(chooseOption({}, 'q1', 'a', false), 'q2', 'b', false);
    expect(dirtyBatch(m, new Set(['q2', 'q404'])).map((r) => r.qid)).toEqual(['q2']);
  });
  it('interprets server acknowledgements', () => {
    expect(interpretSave(5, { ok: true, status: 'in_progress', lastSeq: 5 })).toEqual({ kind: 'saved', nextSeq: 6 });
    expect(interpretSave(3, { ok: true, status: 'in_progress', lastSeq: 9 })).toEqual({ kind: 'resync', nextSeq: 10 });
    expect(interpretSave(5, { ok: true, status: 'submitted', lastSeq: 5 })).toEqual({ kind: 'ended', nextSeq: 5 });
    expect(interpretSave(5, { ok: false, status: 'deadline_passed', lastSeq: 4 })).toEqual({ kind: 'ended', nextSeq: 5 });
  });
  it('follows server time and raises warnings at ten minutes and one minute', () => {
    expect(remainingWithOffset(10_000, 4_000, 1_000)).toBe(5_000);
    expect(remainingWithOffset(10_000, 20_000, 0)).toBe(0);
    expect([timeWarning(700_000), timeWarning(600_000), timeWarning(61_000), timeWarning(60_000), timeWarning(1), timeWarning(0)]).toEqual(['none', 'ten_minutes', 'ten_minutes', 'one_minute', 'one_minute', 'ended']);
  });
  it('summarises the palette', () => {
    let m: ClientResponses = chooseOption({}, 'a', 'a', false); m = setMarked(m, 'b', true); m = visitQuestion(m, 'c');
    expect(paletteSummary(['a', 'b', 'c', 'd'], m)).toEqual({ answered: 1, marked: 1, not_answered: 1, not_visited: 1, answered_marked: 0 });
  });
});
