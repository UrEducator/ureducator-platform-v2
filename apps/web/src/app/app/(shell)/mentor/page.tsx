'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Button, PageHeader, Pill, Sheet, Textarea } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle } from '@/lib/hooks';
import { asApiError, type Out } from '@/lib/types';

const MODES = [['concept', 'Explain a concept'], ['revision', 'Quick revision'], ['question_explanation', 'Explain a question'], ['study_plan', 'Help with my plan']] as const;
type Mode = (typeof MODES)[number][0];
type Turn = { q: string; a?: Out<'askMentor'>; error?: string };

function Body() {
  useDocumentTitle('Study mentor'); const sp = useSearchParams(); const { backend, user } = useAuth();
  const ref = sp.get('s') && sp.get('q') ? { sessionId: sp.get('s')!, qid: sp.get('q')! } : undefined; const topicId = sp.get('t') ?? undefined;
  const [mode, setMode] = useState<Mode>(ref ? 'question_explanation' : 'concept'); const [text, setText] = useState(ref ? 'Explain why the correct option is right.' : ''); const [turns, setTurns] = useState<Turn[]>([]); const [busy, setBusy] = useState(false);
  async function ask(e: React.FormEvent) {
    e.preventDefault(); if (!backend || text.trim().length < 3) return; const question = text.trim(); setBusy(true); setText('');
    try { const a = await backend.call('askMentor', { question, mode, ...(topicId ? { topicId } : {}), ...(ref && mode === 'question_explanation' ? { ref } : {}) }); setTurns((t) => [...t, { q: question, a }]); }
    catch (x) { setTurns((t) => [...t, { q: question, error: asApiError(x).message }]); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader title="Study mentor" intro="Ask about a concept or a question you reviewed. Answers use only UrEducator’s verified study notes and show which notes they came from." />
      <Alert tone="info" className="mb-6" title="Preview mode">The mentor is running on a built-in test assistant, not a live AI model. It quotes from verified notes when it has them and says so when it does not. Live AI is switched off for this staging site.</Alert>
      {!user?.emailVerified && <Alert tone="warn" className="mb-6">Confirm your email address to use the mentor.</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Sheet className="h-fit p-6"><form onSubmit={ask} className="grid gap-4">
          <fieldset><legend className="mb-1.5 text-sm font-semibold">What do you need?</legend><div className="flex flex-wrap gap-2">{MODES.map(([m, l]) => <label key={m} className="cursor-pointer"><input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="peer sr-only" /><span className="inline-block rounded-md border border-line-strong px-3 py-1.5 text-sm font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-pen-500">{l}</span></label>)}</div></fieldset>
          <Textarea label="Your question" rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} hint={ref ? 'This will use the explanation of the question you were reviewing.' : 'For example: What is the difference between validity and reliability in research?'} />
          <Button type="submit" busy={busy} disabled={text.trim().length < 3 || !user?.emailVerified}>Ask the mentor</Button>
        </form></Sheet>
        <div className="grid content-start gap-4" aria-live="polite">
          {turns.length === 0 ? <p className="text-muted">Your conversation will appear here.</p> : [...turns].reverse().map((t, i) => (
            <Sheet as="article" key={turns.length - i} className="p-5" data-testid="mentor-turn">
              <p className="text-sm text-muted">You asked</p><p className="font-medium">{t.q}</p>
              <div className="mt-3 border-t border-line pt-3">
                {t.error ? <Alert tone="error">{t.error}</Alert> : t.a && <>
                  <p className="read whitespace-pre-line">{t.a.text}</p>
                  {t.a.citations.length > 0 ? <ul className="mt-3 flex flex-wrap gap-2" aria-label="Sources">{t.a.citations.map((c, k) => <li key={c.id}><Pill tone="pen">[{k + 1}] {c.title}</Pill></li>)}</ul> : <p className="mt-3 text-sm text-muted">No verified source was found, so this is not a grounded answer.</p>}
                  <p className="mt-2 text-xs text-muted">Answered by: {t.a.provider === 'mock' ? 'test assistant' : t.a.provider}</p>
                </>}
              </div>
            </Sheet>
          ))}
        </div>
      </div>
    </>
  );
}
export default function Page() { return <Suspense><Body /></Suspense>; }
