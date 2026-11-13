'use client';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { DISCLAIMERS, METRIC_DEFINITIONS, classifyTopics, insights, pickText, type Bucket, type Lang, type TopicAggregate } from '@ureducator/shared';
import { QuestionBody } from '@/components/exam/QuestionBody';
import { Meter } from '@/components/charts';
import { Alert, Button, PageHeader, Pill, Sheet, Spinner, Stat, Table, Td } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDateTime, fmtDuration, pct, useDocumentTitle, useLoad } from '@/lib/hooks';
import { useNames } from '@/lib/names';
import { asApiError, type Out } from '@/lib/types';

type Result = Out<'getExamResult'>;
const buckets = (x: unknown) => (x ?? {}) as Record<string, Bucket>;
const rate = (n: number, d: number) => ({ value: d ? n / d : 0, numerator: n, denominator: d });
const GLYPH: Record<string, { sym: string; label: string; cls: string }> = {
  correct: { sym: '✓', label: 'Correct', cls: 'border-ok bg-ok-soft text-ok' },
  incorrect: { sym: '✕', label: 'Incorrect', cls: 'border-bad bg-bad-soft text-bad' },
  partial: { sym: '½', label: 'Partly correct', cls: 'border-review bg-review-soft text-review' },
  unattempted: { sym: '–', label: 'Not attempted', cls: 'border-line-strong bg-surface text-muted' },
};

function BucketTable({ caption, rows, nameOf }: { caption: string; rows: [string, Bucket][]; nameOf: (id: string) => string }) {
  if (rows.length === 0) return null;
  return (
    <Table caption={caption} head={['', 'Correct', 'Wrong', 'Skipped', 'Marks', 'Accuracy']}>
      {rows.map(([id, b]) => { const att = b.correct + b.incorrect; return (
        <tr key={id}><Td className="font-medium">{nameOf(id)}</Td><Td className="tabular-nums">{b.correct}</Td><Td className="tabular-nums">{b.incorrect}</Td><Td className="tabular-nums">{b.unattempted}</Td><Td className="tabular-nums">{b.marks}</Td><Td className="min-w-36">{att ? <Meter value={b.correct / att} label={`${nameOf(id)} accuracy`} /> : <span className="text-muted">–</span>}</Td></tr>
      ); })}
    </Table>
  );
}

function Body() {
  useDocumentTitle('Result');
  const sid = useSearchParams().get('s') ?? ''; const { backend, user } = useAuth(); const { name } = useNames(); const uid = user?.uid ?? '';
  const [data, setData] = useState<Result | null>(null); const [err, setErr] = useState<{ reason: string; message: string } | null>(null); const [lang] = useState<Lang>('en');
  const [pdfBusy, setPdfBusy] = useState(false); const [pdfErr, setPdfErr] = useState('');
  const row = useLoad((b) => b.reads.results(uid), [uid]); const tests = useLoad((b) => b.reads.publishedTests()); const bps = useLoad((b) => b.reads.blueprints());

  const load = useCallback(async () => {
    if (!backend || !sid) return;
    try { setData(await backend.call('getExamResult', { sessionId: sid })); setErr(null); } catch (e) { const a = asApiError(e); setErr({ reason: a.reason, message: a.message }); }
  }, [backend, sid]);
  useEffect(() => { void load(); }, [load]);

  async function pdf() {
    if (!backend) return; setPdfBusy(true); setPdfErr('');
    try {
      const r = await backend.call('generateReport', { sessionId: sid });
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
      const a = document.createElement('a'); a.href = url; a.download = r.fileName; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { setPdfErr(asApiError(e).message); } finally { setPdfBusy(false); }
  }

  if (err?.reason === 'EXAM_IN_PROGRESS') return (
    <>
      <div role="status" className="mb-6 rounded-sheet border border-[#f59e0b] bg-[#fef3c7] px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-[#92400e]">
        UrEducator Pilot Study — Practice Content Only — Not an Official NTA/UGC Publication
      </div>
      <Alert tone="info" title="This test is still running"><Link className="font-semibold underline" href={`/app/exam?s=${sid}`}>Go back to the test</Link></Alert>
    </>
  );
  if (err) return (
    <>
      <div role="status" className="mb-6 rounded-sheet border border-[#f59e0b] bg-[#fef3c7] px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-[#92400e]">
        UrEducator Pilot Study — Practice Content Only — Not an Official NTA/UGC Publication
      </div>
      <Alert tone="error" title="Result not available">{err.message}</Alert>
    </>
  );
  if (!data) return <Spinner label="Loading your result" />;

  const s = data.summary; const stored = row.data?.find((x) => x.id === sid); const test = tests.data?.find((t) => t.id === stored?.mockTestId); const bp = test ? bps.data?.[test.blueprintId] : undefined;
  const secName = (id: string) => bp ? pickText(bp.sections.find((x) => x.id === id)?.title ?? { en: id }, 'en') : id;
  const bySec = Object.entries(buckets(s.bySection)); const byUnit = Object.entries(buckets(s.byUnit)); const byTopic = Object.entries(buckets(s.byTopic)); const byDiff = Object.entries(buckets(s.byDifficulty));
  const total = s.correct + s.incorrect + s.unattempted;
  const agg: Record<string, TopicAggregate> = Object.fromEntries(byTopic.map(([topicId, b]) => [topicId, { topicId, attempted: b.correct + b.incorrect, correct: b.correct, total: b.total, timeMs: b.timeMs, tests: 1 }]));
  const { weak, strong } = classifyTopics(agg, 2);
  const spent = stored?.timeSpentMs ?? 0; const dur = stored?.durationMs ?? 0;
  const tips = insights({ score: s.marks, maxMarks: s.maxMarks, percentage: rate(Math.max(0, s.marks), s.maxMarks), accuracy: rate(s.correct, s.attempted), attemptRate: rate(s.attempted, total), unattempted: s.unattempted, timeUtilisation: rate(Math.min(spent, dur), dur || 1), avgTimePerQuestionMs: s.attempted ? spent / s.attempted : 0 }, weak);
  const review = data.review;

  return (
    <>
      <div role="status" className="mb-6 rounded-sheet border border-[#f59e0b] bg-[#fef3c7] px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-[#92400e]">
        UrEducator Pilot Study — Practice Content Only — Not an Official NTA/UGC Publication
      </div>
      <PageHeader title={data.testTitle} intro={<>Submitted {fmtDateTime(s.submittedAtMs)}{s.reason !== 'manual' ? ', automatically when time ran out' : ''}.</>} actions={<Button variant="secondary" onClick={pdf} busy={pdfBusy}><Download aria-hidden className="size-4" /> Download report (PDF)</Button>} />
      {pdfErr && <Alert tone="error" className="mb-4">{pdfErr}</Alert>}
      {test && test.contentLabel !== 'fully_verified' && <Alert tone="warn" className="mb-6" title="Practice content">This score is for practice only. The test’s questions are labelled “{test.contentLabel === 'sample' ? 'sample content' : test.contentLabel.replace('_', ' ')}”. {DISCLAIMERS.notNta}</Alert>}

      <Sheet className="p-6" data-testid="score-card">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div><p className="text-sm text-muted">Your score</p><p className="font-display text-6xl font-semibold tabular-nums" data-testid="score">{s.marks}<span className="text-3xl text-muted"> / {s.maxMarks}</span></p><p className="text-lg">{pct(s.percentage)} of the maximum marks</p></div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <Stat label="Correct" value={s.correct} /><Stat label="Wrong" value={s.incorrect} /><Stat label="Skipped" value={s.unattempted} /><Stat label="Accuracy" value={pct(s.accuracy)} note={`${s.correct} of ${s.attempted} attempted`} />
          </dl>
        </div>
        <details className="mt-5 text-sm text-muted"><summary className="cursor-pointer font-semibold text-ink">How these numbers are worked out</summary>
          <dl className="mt-2 grid gap-1.5">{(['score', 'percentage', 'accuracy', 'attemptRate'] as const).map((k) => <div key={k}><dt className="inline font-semibold text-ink">{k === 'attemptRate' ? 'Attempt rate' : k[0]!.toUpperCase() + k.slice(1)}: </dt><dd className="inline">{METRIC_DEFINITIONS[k]}</dd></div>)}</dl>
        </details>
      </Sheet>

      {tips.length > 0 && <Sheet className="mt-6 p-6"><h2 className="text-xl">What to do next</h2><ul className="mt-3 grid gap-2">{tips.map((t) => <li key={t.id} className="flex gap-3"><Pill tone={t.severity === 'action' ? 'warn' : 'neutral'}>{t.severity === 'action' ? 'Do this' : 'Note'}</Pill><span>{t.topicId ? `${name(t.topicId)}. ${t.text}` : t.text}</span></li>)}</ul><div className="mt-4 flex gap-3"><Link className="text-sm font-semibold text-pen-700 underline" href="/app/notebook">Open error notebook</Link><Link className="text-sm font-semibold text-pen-700 underline" href="/app/planner">Update my plan</Link></div></Sheet>}

      <div className="mt-6 grid gap-6">
        <section aria-labelledby="h-sec"><h2 id="h-sec" className="mb-3 text-xl">By section</h2><BucketTable caption="Results by section" rows={bySec} nameOf={secName} /></section>
        <section aria-labelledby="h-unit"><h2 id="h-unit" className="mb-3 text-xl">By unit</h2><BucketTable caption="Results by unit" rows={byUnit} nameOf={name} /></section>
        <section aria-labelledby="h-topic"><h2 id="h-topic" className="mb-3 text-xl">By topic</h2><BucketTable caption="Results by topic" rows={byTopic} nameOf={name} />
          {(strong.length > 0 || weak.length > 0) && <p className="mt-2 text-sm text-muted">Within this test only: {strong.length ? `strong in ${strong.map((t) => name(t.topicId)).join(', ')}` : ''}{strong.length && weak.length ? '; ' : ''}{weak.length ? `needs work in ${weak.map((t) => name(t.topicId)).join(', ')}` : ''}. Topics with fewer than 2 attempted questions are not rated.</p>}
        </section>
        <section aria-labelledby="h-diff"><h2 id="h-diff" className="mb-3 text-xl">By difficulty</h2><BucketTable caption="Results by difficulty" rows={byDiff} nameOf={(id) => id[0]!.toUpperCase() + id.slice(1)} /></section>
      </div>

      <section className="mt-10" aria-labelledby="h-review">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="h-review" className="text-xl">Question review</h2>
          {/* Review language toggle temporarily hidden for English-only pilot (T-1) */}
        </div>
        {!review ? (
          <Alert tone="info" className="mt-3" title="Answers and explanations are not open yet">They unlock on {fmtDateTime(data.reviewAvailableAtMs)}. Your score and the breakdown above are final. <button className="font-semibold underline" onClick={() => void load()}>Check again</button></Alert>
        ) : (
          <>
            <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Question map">{review.map((r, i) => { const g = GLYPH[r.outcome] ?? GLYPH.unattempted!; return <li key={i}><a href={`#rq-${i + 1}`} className={cn('grid size-10 place-items-center rounded-md border-2 font-semibold tabular-nums', g.cls)} aria-label={`Question ${i + 1}: ${g.label}`}><span aria-hidden>{i + 1}<sup className="text-[10px]">{g.sym}</sup></span></a></li>; })}</ol>
            <div className="mt-6 grid gap-5">{review.map((r, i) => { const q = r.question; if (!q) return null; const g = GLYPH[r.outcome] ?? GLYPH.unattempted!; return (
              <Sheet as="article" key={q.qid} id={`rq-${i + 1}`} className="scroll-mt-24 p-5" aria-label={`Question ${i + 1}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2"><span className="font-semibold">Question {i + 1}</span><span className={cn('rounded-full border px-2.5 py-0.5 text-sm font-semibold', g.cls)}><span aria-hidden>{g.sym} </span>{g.label}</span><span className="text-sm text-muted">{r.marks >= 0 ? '+' : ''}{r.marks} marks · {fmtDuration(r.timeMs)}</span>{r.marked && <Pill tone="review">Marked for review</Pill>}</div>
                <QuestionBody q={q} lang={lang}>
                  <ul className="mt-4 grid gap-2">{q.content.options.map((o, k) => { const right = r.correct.includes(o.id); const mine = r.selected.includes(o.id); return (
                    <li key={o.id} className={cn('flex items-start gap-3 rounded-sheet border px-3.5 py-2.5', right ? 'border-ok bg-ok-soft' : mine ? 'border-bad bg-bad-soft' : 'border-line')}>
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line-strong font-sans text-sm font-semibold">{String.fromCharCode(65 + k)}</span>
                      <span className="flex-1" lang={lang}>{pickText(o.text, lang)}</span>
                      <span className="shrink-0 font-sans text-sm font-semibold">{right && mine ? '✓ Your answer, correct' : right ? '✓ Correct answer' : mine ? '✕ Your answer' : ''}</span>
                    </li>); })}</ul>
                </QuestionBody>
                {r.explanation && <div className="mt-4 rounded-sheet bg-pen-50 p-4"><p className="font-sans text-sm font-semibold">Explanation</p><p className="read mt-1" lang={lang}>{pickText(r.explanation, lang)}</p></div>}
                <div className="mt-3"><Link className="text-sm font-semibold text-pen-700 underline" href={`/app/mentor?s=${sid}&q=${q.qid}&t=${q.topicId}`}>Ask the study mentor about this question</Link></div>
              </Sheet>); })}</div>
          </>
        )}
      </section>
      {!bp && !row.loading && !tests.loading && stored && <p className="mt-6 text-sm text-muted">Section names are unavailable because this test is no longer published.</p>}
    </>
  );
}
export default function Page() { return <Suspense><Body /></Suspense>; }
