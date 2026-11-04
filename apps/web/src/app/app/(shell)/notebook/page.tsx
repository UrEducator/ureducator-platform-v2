'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { pickText } from '@ureducator/shared';
import { QuestionBody } from '@/components/exam/QuestionBody';
import { Alert, Button, Empty, PageHeader, Pill, Sheet, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate, useDocumentTitle } from '@/lib/hooks';
import { useNames } from '@/lib/names';
import { asApiError, type Out } from '@/lib/types';

type Entries = Out<'listNotebook'>; type Entry = Entries['entries'][number]; type Q = Out<'notebookQuestion'>;
const RATING = [[0, 'Blank'], [1, 'Wrong'], [2, 'Wrong, but close'], [3, 'Right, hard'], [4, 'Right'], [5, 'Easy']] as const;
const todayKey = () => new Date().toISOString().slice(0, 10);

function EntryCard({ e, onRated }: { e: Entry; onRated: (id: string, review: Entry['review']) => void }) {
  const { backend } = useAuth(); const { name } = useNames(); const [open, setOpen] = useState(false); const [q, setQ] = useState<Q | null>(null); const [shown, setShown] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const rv = e.review as { dueDate: string; intervalDays: number; reps: number }; const due = rv.dueDate <= todayKey();
  async function expand() {
    setOpen(true); if (q || !backend) return;
    try { setQ(await backend.call('notebookQuestion', { entryId: e.id })); } catch (x) { setErr(asApiError(x).message); }
  }
  async function rate(quality: number) {
    if (!backend) return; setBusy(true); setErr('');
    try { const r = await backend.call('reviewNotebook', { entryId: e.id, quality }); onRated(e.id, r.review); setOpen(false); setShown(false); } catch (x) { setErr(asApiError(x).message); } finally { setBusy(false); }
  }
  return (
    <li className="px-5 py-4" data-testid="notebook-entry">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{name(e.topicId)}</p><p className="text-sm text-muted">{e.kind === 'flagged' ? 'Marked for review' : 'Answered wrongly'} · added {fmtDate(e.createdAtMs)}</p></div>
        <div className="flex items-center gap-3">{due ? <Pill tone="warn">Due today</Pill> : <Pill>Next: {fmtDate(Date.parse(rv.dueDate))}</Pill>}<Button size="sm" variant={due ? 'primary' : 'secondary'} onClick={open ? () => setOpen(false) : expand} aria-expanded={open}>{open ? 'Close' : 'Revise'}</Button></div>
      </div>
      {open && (
        <div className="mt-4 rounded-sheet border border-line bg-paper p-4">
          {err && <Alert tone="error" className="mb-3">{err}</Alert>}
          {!q && !err ? <Spinner /> : q && (
            <>
              <QuestionBody q={q.question} lang="en">
                <ul className="mt-3 grid gap-2">{q.question.content.options.map((o, i) => { const right = shown && q.correct.includes(o.id); return <li key={o.id} className={cn('flex gap-3 rounded-sheet border px-3 py-2', right ? 'border-ok bg-ok-soft' : 'border-line bg-surface')}><span className="font-semibold">{String.fromCharCode(65 + i)}.</span><span className="flex-1">{pickText(o.text, 'en')}</span>{right && <span className="font-sans text-sm font-semibold">✓ Correct</span>}</li>; })}</ul>
              </QuestionBody>
              {!shown ? <Button className="mt-4" variant="secondary" onClick={() => setShown(true)}>Show the answer</Button> : (
                <div className="mt-4 grid gap-3">
                  {q.explanation && <div className="rounded-sheet bg-pen-50 p-3"><p className="font-sans text-sm font-semibold">Explanation</p><p className="read mt-1">{pickText(q.explanation, 'en')}</p></div>}
                  <fieldset><legend className="mb-1.5 text-sm font-semibold">How well did you remember it?</legend><div className="flex flex-wrap gap-2">{RATING.map(([n, label]) => <Button key={n} size="sm" variant="secondary" disabled={busy} onClick={() => rate(n)} data-testid={`rate-${n}`}>{n}: {label}</Button>)}</div></fieldset>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function Page() {
  useDocumentTitle('Error notebook'); const { backend } = useAuth(); const [data, setData] = useState<Entries | null>(null); const [err, setErr] = useState('');
  const load = useCallback(async () => { if (!backend) return; try { setData(await backend.call('listNotebook', {})); } catch (e) { setErr(asApiError(e).message); } }, [backend]);
  useEffect(() => { void load(); }, [load]);
  const rated = (id: string, review: Entry['review']) => setData((d) => d && { ...d, entries: d.entries.map((x) => (x.id === id ? { ...x, review } : x)) });
  const sorted = data ? [...data.entries].sort((a, b) => (a.review as { dueDate: string }).dueDate.localeCompare((b.review as { dueDate: string }).dueDate)) : [];
  const dueCount = sorted.filter((e) => (e.review as { dueDate: string }).dueDate <= todayKey()).length;
  return (
    <>
      <PageHeader title="Error notebook" intro="Questions you got wrong or flagged are saved here and come back on a spaced schedule: wrong answers return tomorrow, remembered ones return after longer gaps." />
      {err ? <Alert tone="error">{err}</Alert> : !data ? <Spinner /> : sorted.length === 0 ? (
        <Empty title="Your notebook is empty">{data.hidden > 0 ? `${data.hidden} entries will appear when answer review opens for your latest test.` : 'Wrong answers and questions you marked for review are added automatically after you submit a test.'} <Link className="font-semibold underline" href="/app/tests">Take a test</Link></Empty>
      ) : (
        <>
          <p className="mb-3 text-[15px]" aria-live="polite"><strong>{dueCount}</strong> {dueCount === 1 ? 'question is' : 'questions are'} due today out of {sorted.length}.{data.hidden > 0 && ` ${data.hidden} more will appear when review opens.`}</p>
          <Sheet as="div"><ul className="divide-y divide-line">{sorted.map((e) => <EntryCard key={e.id} e={e} onRated={rated} />)}</ul></Sheet>
        </>
      )}
    </>
  );
}
