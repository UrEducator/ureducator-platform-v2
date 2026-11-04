'use client';
import { useEffect, useState } from 'react';
import { Bubble, PaletteLegend, type PaletteState } from '@/components/brand';
import { fmtClock } from '@/lib/hooks';
import { cn } from '@/lib/cn';

const OPTIONS = ['A survey the researcher designs and runs', 'A census report published last year', 'A review article in a journal', 'An entry in an encyclopaedia'];
const START: PaletteState[] = ['answered', 'answered', 'marked', 'answered', 'not_answered', 'answered_marked', 'answered', 'not_visited', 'not_visited', 'not_visited', 'not_visited', 'not_visited', 'not_visited', 'not_visited', 'not_visited', 'not_visited', 'not_visited', 'not_visited', 'not_visited', 'not_visited'];

/** A small, working copy of the real exam screen. It uses a demo question and keeps nothing; it exists so visitors can feel the interaction. */
export function HeroExam() {
  const [cur, setCur] = useState(4); const [states, setStates] = useState<PaletteState[]>(START); const [picked, setPicked] = useState<Record<number, number>>({});
  const [left, setLeft] = useState(2 * 3600 + 41 * 60 + 8);
  useEffect(() => { const t = setInterval(() => setLeft((x) => (x > 0 ? x - 1 : 0)), 1000); return () => clearInterval(t); }, []);

  const set = (i: number, s: PaletteState) => setStates((p) => p.map((x, k) => (k === i ? s : x)));
  const select = (o: number) => { setPicked((p) => ({ ...p, [cur]: o })); set(cur, states[cur] === 'marked' || states[cur] === 'answered_marked' ? 'answered_marked' : 'answered'); };
  const toggleMark = () => { const s = states[cur]!; set(cur, s === 'answered' ? 'answered_marked' : s === 'answered_marked' ? 'answered' : s === 'marked' ? 'not_answered' : 'marked'); };
  const go = (i: number) => { setCur(i); if (states[i] === 'not_visited') set(i, 'not_answered'); };
  const isMarked = states[cur] === 'marked' || states[cur] === 'answered_marked';
  const answered = states.filter((s) => s === 'answered' || s === 'answered_marked').length;

  return (
    <section aria-label="Interactive demo of the exam screen" className="overflow-hidden rounded-sheet border border-line-strong bg-surface shadow-[6px_6px_0_0_var(--color-pen-200)]">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-pen-900 px-4 py-2.5 text-white">
        <p className="text-sm font-semibold">Demo test · Paper I</p>
        <p className="text-sm tabular-nums" aria-label="Time left in the demo">Time left <span className="ml-1 rounded bg-white/15 px-2 py-0.5 font-semibold">{fmtClock(left * 1000)}</span></p>
      </div>
      <div className="grid sm:grid-cols-[1fr_13.5rem]">
        <div className="border-b border-line p-5 sm:border-b-0 sm:border-r">
          <p className="text-sm font-semibold text-muted">Question {cur + 1}</p>
          <p className="read mt-2 text-[1.0625rem]">Which of these is a primary source of data for a researcher?</p>
          <fieldset className="mt-4 grid gap-2"><legend className="sr-only">Options</legend>
            {OPTIONS.map((o, i) => (
              <label key={o} className={cn('flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 text-[15px] transition-colors', picked[cur] === i ? 'border-pen-600 bg-pen-50' : 'border-line hover:border-line-strong')}>
                <input type="radio" name="hero-q" className="mt-1 size-4 accent-pen-700" checked={picked[cur] === i} onChange={() => select(i)} /><span><span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {o}</span>
              </label>
            ))}
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={toggleMark} aria-pressed={isMarked} className={cn('h-9 rounded-control border px-3 text-sm font-semibold', isMarked ? 'border-review bg-review-soft text-review' : 'border-line-strong hover:bg-pen-50')}>{isMarked ? 'Marked for review' : 'Mark for review'}</button>
            <button type="button" onClick={() => go(Math.min(19, cur + 1))} className="h-9 rounded-control bg-pen-700 px-4 text-sm font-semibold text-white hover:bg-pen-900">Save and next</button>
          </div>
          <p className="mt-4 text-xs text-muted">Demo question written for this page. It is not saved and not from a previous paper.</p>
        </div>
        <div className="p-4">
          <p className="mb-2 text-sm font-semibold">Question palette <span className="font-normal text-muted">({answered} answered)</span></p>
          <div className="grid grid-cols-5 gap-2">{states.map((s, i) => <Bubble key={i} n={i + 1} state={s} current={i === cur} onClick={() => go(i)} size="sm" />)}</div>
        </div>
      </div>
      <details className="border-t border-line px-4 py-2.5 text-sm"><summary className="cursor-pointer font-semibold">What the shapes mean</summary><div className="mt-3 pb-1"><PaletteLegend /></div></details>
    </section>
  );
}
