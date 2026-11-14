'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CloudOff, Expand, Flag, Loader2, Check } from 'lucide-react';
import { countAnswered, paletteStatus, pickText, type Lang, type PaperQuestion } from '@ureducator/shared';
import { Bubble, PaletteLegend } from '@/components/brand';
import { Alert, Button, Dialog, Drawer, Spinner } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtClock } from '@/lib/hooks';
import { useExam, type ExamData } from './useExam';
import { QuestionBody } from './QuestionBody';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function Options({ q, lang, selected, onChoose }: { q: PaperQuestion; lang: Lang; selected: string[]; onChoose: (id: string) => void }) {
  const multi = q.content.type === 'mcq_multi';
  return (
    <fieldset className="mt-6 grid gap-2.5" key={q.qid}>
      <legend className="sr-only">{multi ? 'Choose all correct options' : 'Choose one option'}</legend>
      {multi && <p className="font-sans text-sm text-muted">Select all options that are correct.</p>}
      {q.content.options.map((o, i) => {
        const on = selected.includes(o.id);
        return (
          <label
            key={o.id}
            className={cn(
              'group flex cursor-pointer items-start gap-4 rounded-sheet border px-4 py-3.5 transition-colors',
              on ? 'border-pen-600 bg-pen-50' : 'border-line bg-surface hover:border-line-strong'
            )}
          >
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={`opt-${q.qid}`}
              value={o.id}
              checked={on}
              onChange={() => onChoose(o.id)}
              className="peer sr-only"
              data-testid={`option-${o.id}`}
            />
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid size-8 shrink-0 place-items-center border-2 font-sans text-sm font-semibold transition-colors peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pen-500',
                multi ? 'rounded-md' : 'rounded-full',
                on ? 'border-ink bg-ink text-paper' : 'border-line-strong text-muted group-hover:border-pen-500'
              )}
            >
              {LETTERS[i]}
            </span>
            <span className="pt-0.5 text-[1.075rem] text-ink" lang={lang}>
              {pickText(o.text, lang)}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function PalettePanel({ d, ex, onPick }: { d: ExamData; ex: ReturnType<typeof useExam>; onPick?: () => void }) {
  const bySection = d.blueprint.sections.map((s) => ({ s, items: d.questions.map((q, i) => ({ q, i })).filter((x) => x.q.sectionId === s.id) }));
  return (
    <div className="grid gap-4">
      {bySection.map(({ s, items }) => (
        <section key={s.id} aria-label={pickText(s.title, ex.lang)}>
          <h3 className="mb-2 font-sans text-sm font-semibold text-ink">{pickText(s.title, ex.lang)}</h3>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
            {items.map(({ q, i }) => (
              <Bubble
                key={q.qid}
                n={i + 1}
                state={paletteStatus(ex.resp[q.qid])}
                current={i === ex.cur}
                onClick={() => {
                  ex.goTo(i);
                  onPick?.();
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ExamScreen({ sessionId }: { sessionId: string }) {
  const { user } = useAuth();
  const ex = useExam(sessionId);
  const [confirm, setConfirm] = useState(false);
  const [palette, setPalette] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    document.title = 'Test in progress | UrEducator';
    const h = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const d = ex.data;
  const q = ex.q;
  const sectionOf = useMemo(() => (d && q ? d.blueprint.sections.find((s) => s.id === q.sectionId) : undefined), [d, q]);

  if (ex.phase === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Opening your test" />
      </div>
    );
  }

  if (ex.phase === 'error' || !d || !q) {
    return (
      <main className="mx-auto grid min-h-screen max-w-lg place-content-center gap-4 px-6">
        <Alert tone={ex.error?.ended ? 'info' : 'error'} title={ex.error?.ended ? 'This test has ended' : 'We could not open the test'}>
          {ex.error?.message ?? 'Try again from your dashboard.'}
        </Alert>
        <div className="flex gap-3">
          {ex.error?.ended && (
            <Link className="font-semibold text-pen-700 underline" href={`/app/results?s=${sessionId}`}>
              View your result
            </Link>
          )}
          <Link className="font-semibold text-pen-700 underline" href="/app">
            Go to the dashboard
          </Link>
        </div>
      </main>
    );
  }

  const r = ex.resp[q.qid];
  const marked = !!r?.marked;
  const answered = countAnswered(ex.counts);
  const total = d.questions.length;
  const next = () => ex.goTo(Math.min(total - 1, ex.cur + 1));
  const timerTone =
    ex.warning === 'one_minute' || ex.warning === 'ended'
      ? 'bg-[#b91c1c] text-white border border-[#991b1b]'
      : ex.warning === 'ten_minutes'
        ? 'bg-marker text-[#1b2130] border border-[#c9a21f]'
        : 'border border-current/30 bg-current/8 text-pen-surface-ink';
  const submitting = ex.phase === 'submitting';

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="sticky top-0 z-30 border-b border-pen-surface bg-pen-surface text-pen-surface-ink">
        <div
          role="status"
          className="border-b border-[#f59e0b] bg-[#fef3c7] dark:bg-[#78350f] dark:text-[#fef3c7] dark:border-[#92400e] px-4 py-1.5 text-center text-xs sm:text-sm font-semibold text-[#92400e]"
        >
          UrEducator Pilot Study — Practice Content Only — Not an Official NTA/UGC Publication
        </div>
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-semibold">{d.testTitle}</p>
            <p className="truncate text-xs opacity-80">{user?.displayName ?? user?.email}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme switcher */}
            <ThemeToggle className="text-pen-surface-ink hover:bg-current/10 border-current/20" />
            {/* Language switcher temporarily hidden for English-only pilot (T-1) */}
            <button
              type="button"
              className="hidden size-9 place-items-center rounded-control border border-current/30 hover:bg-current/10 sm:grid cursor-pointer"
              aria-label={full ? 'Exit full screen' : 'Enter full screen'}
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else void document.documentElement.requestFullscreen?.();
              }}
            >
              <Expand className="size-4" />
            </button>
            <div
              role="timer"
              aria-label="Time left"
              className={cn('rounded-control px-3 py-1.5 text-lg font-semibold tabular-nums', timerTone, ex.warning === 'one_minute' && 'motion-safe:animate-pulse')}
              data-testid="timer"
            >
              {fmtClock(ex.remaining)}
            </div>
            <Button
              variant="marker"
              size="sm"
              onClick={() => {
                ex.flush();
                setConfirm(true);
              }}
              disabled={submitting}
              data-testid="open-submit"
            >
              Submit test
            </Button>
          </div>
        </div>
        <div className="border-t border-current/15 bg-current/8 text-pen-surface-ink">
          <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3 px-4 py-1 text-xs">
            <p aria-live="polite" data-testid="save-state" className="flex items-center gap-1.5">
              {ex.saveState === 'saving' && (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Saving…
                </>
              )}
              {ex.saveState === 'saved' && (
                <>
                  <Check className="size-3.5" aria-hidden />
                  All answers saved
                  {ex.lastSavedAt
                    ? ` at ${new Date(ex.lastSavedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : ''}
                </>
              )}
              {ex.saveState === 'unsaved' && <>Changes will save in a moment</>}
              {ex.saveState === 'offline' && (
                <>
                  <CloudOff className="size-3.5" aria-hidden />
                  Offline. Your answers are kept on this device and will sync when you reconnect.
                </>
              )}
            </p>
            <p className="tabular-nums">
              {answered} of {total} answered
            </p>
          </div>
        </div>
      </header>
      <p className="sr-only" aria-live="assertive" role="status">
        {ex.announce}
      </p>

      <div className="mx-auto grid w-full max-w-[90rem] flex-1 gap-5 px-4 py-5 lg:grid-cols-[1fr_20rem]">
        <main id="main" className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Sections">
            {d.blueprint.sections.map((s) => {
              const first = d.questions.findIndex((x) => x.sectionId === s.id);
              const active = s.id === q.sectionId;
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => ex.goTo(first)}
                  className={cn(
                    'rounded-control border px-4 py-2 text-sm font-semibold transition-colors',
                    active ? 'border-pen-surface bg-pen-surface text-pen-surface-ink' : 'border-line-strong bg-surface hover:bg-pen-50 hover:text-ink'
                  )}
                >
                  {pickText(s.title, ex.lang)} <span className="font-normal opacity-80">({s.questionCount})</span>
                </button>
              );
            })}
          </div>

          <article className="rounded-sheet border border-line bg-surface p-5 sm:p-7 shadow-xs transition-colors" aria-labelledby="qhead">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <h1 id="qhead" className="font-sans text-lg font-semibold text-ink">
                Question {ex.cur + 1} <span className="font-normal text-muted">of {total}</span>
                {sectionOf && <span className="font-normal text-muted"> · {pickText(sectionOf.title, ex.lang)}</span>}
              </h1>
              <p className="text-sm text-muted">
                +{d.blueprint.marking.correct} for a correct answer
                {d.blueprint.marking.incorrect < 0 ? `, ${d.blueprint.marking.incorrect} for a wrong one` : ', no negative marking'}
              </p>
            </div>
            <QuestionBody q={q} lang={ex.lang}>
              {ex.lang === 'hi' && !q.content.stem.hi && (
                <p className="mt-2 font-sans text-sm text-muted">This question has no Hindi version yet. Showing English.</p>
              )}
              <Options q={q} lang={ex.lang} selected={r?.selected ?? []} onChoose={ex.choose} />
            </QuestionBody>
          </article>

          {/* Clean, ergonomic action bar: 2-column mobile grid without wrapping or clipping, flex row on sm:screens */}
          <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-paper/95 p-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
              <Button
                variant="secondary"
                onClick={() => ex.goTo(ex.cur - 1)}
                disabled={ex.cur === 0}
                className="min-h-[44px] col-span-1 sm:col-auto"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={ex.clear}
                disabled={!r?.selected.length}
                data-testid="clear"
                className="min-h-[44px] col-span-1 sm:col-auto"
              >
                Clear response
              </Button>
              <Button
                variant="secondary"
                className="min-h-[44px] col-span-2 lg:hidden sm:col-auto"
                onClick={() => setPalette(true)}
              >
                Question palette
              </Button>
              <Button
                variant={marked ? 'marker' : 'secondary'}
                onClick={() => {
                  ex.mark(!marked);
                }}
                aria-pressed={marked}
                data-testid="mark"
                className="min-h-[44px] col-span-1 sm:col-auto"
              >
                <Flag className="size-4" aria-hidden />
                {marked ? 'Remove review mark' : 'Mark for review'}
              </Button>
              <Button
                className="min-h-[44px] col-span-1 sm:col-auto sm:ml-auto"
                onClick={next}
                disabled={ex.cur === total - 1}
                data-testid="save-next"
              >
                Save and next
              </Button>
            </div>
          </div>
        </main>

        <aside className="hidden lg:block" aria-label="Question palette">
          <div className="sticky top-28 grid gap-5 rounded-sheet border border-line bg-surface p-4">
            <PalettePanel d={d} ex={ex} />
            <div className="border-t border-line pt-4">
              <PaletteLegend counts={ex.counts} />
            </div>
          </div>
        </aside>
      </div>

      {/* Slide-out / Bottom-sheet Drawer for Question Palette on mobile & tablet */}
      <Drawer
        open={palette}
        onClose={() => setPalette(false)}
        title="Question palette"
        side="bottom"
        footer={
          <Button className="w-full sm:w-auto" onClick={() => setPalette(false)}>
            Close
          </Button>
        }
      >
        <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-5 custom-scrollbar">
          <PalettePanel d={d} ex={ex} onPick={() => setPalette(false)} />
          <div className="mt-5 border-t border-line pt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Legend</h4>
            <PaletteLegend counts={ex.counts} />
          </div>
        </div>
      </Drawer>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit your test?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Go back to the test
            </Button>
            <Button
              onClick={() => {
                setConfirm(false);
                void ex.submit('manual');
              }}
              busy={submitting}
              data-testid="confirm-submit"
            >
              Submit test
            </Button>
          </>
        }
      >
        <p>You cannot change your answers after you submit.</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 tabular-nums" data-testid="submit-summary">
          <dt>Answered</dt>
          <dd className="font-semibold">{ex.counts.answered + ex.counts.answered_marked}</dd>
          <dt>Not answered</dt>
          <dd className="font-semibold">{ex.counts.not_answered + ex.counts.marked}</dd>
          <dt>Marked for review</dt>
          <dd className="font-semibold">{ex.counts.marked + ex.counts.answered_marked}</dd>
          <dt>Not visited</dt>
          <dd className="font-semibold">{ex.counts.not_visited}</dd>
        </dl>
        {ex.saveState === 'offline' && (
          <Alert tone="warn" className="mt-4">
            You appear to be offline. Submitting needs a connection. Your answers are safe on this device.
          </Alert>
        )}
      </Dialog>

      {(ex.submitError || submitting) && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4">
          <div className="mx-auto max-w-xl">
            {submitting ? (
              <Alert tone="info">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Submitting your test…
                </span>
              </Alert>
            ) : (
              <Alert tone="error" title="Your test has not been submitted yet">
                {ex.submitError}
              </Alert>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
