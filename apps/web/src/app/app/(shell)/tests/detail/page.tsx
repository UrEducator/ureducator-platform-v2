'use client';
import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DISCLAIMERS, maxMarks, totalQuestions } from '@ureducator/shared';
import { ContentLabelPill, PaletteLegend } from '@/components/brand';
import { Alert, Button, Check, PageHeader, Select, Sheet, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle, useLoad } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

function Body() {
  useDocumentTitle('Test instructions');
  const id = useSearchParams().get('id') ?? ''; const router = useRouter(); const { backend, user } = useAuth();
  const tests = useLoad((b) => b.reads.publishedTests()); const bps = useLoad((b) => b.reads.blueprints()); const attempts = useLoad((b) => b.reads.attempts(user?.uid ?? ''), [user?.uid]);
  const [lang, setLang] = useState<'en' | 'hi'>('en'); const [agree, setAgree] = useState(false); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; reason?: string } | null>(null);
  const reqId = useRef(`r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`); // one id per page view: double clicks cannot start two attempts
  const t = tests.data?.find((x) => x.id === id); const bp = t ? bps.data?.[t.blueprintId] : undefined;
  const open = attempts.data?.find((a) => a.mockTestId === id && a.status === 'in_progress' && a.deadlineMs > Date.now());

  async function start() {
    if (!backend || !t) return; setBusy(true); setErr(null);
    try {
      const r = await backend.call('startExam', { mockTestId: t.id, language: lang, clientRequestId: reqId.current });
      router.push(`/app/exam?s=${r.sessionId}`);
    } catch (e) {
      const x = asApiError(e);
      setErr({ message: x.message, reason: x.reason });
      setBusy(false);
    }
  }
  if (tests.loading || bps.loading) return <Spinner />;
  if (!t) return <Alert tone="warn" title="Test not found">This test is not published or the link is wrong.</Alert>;
  return (
    <>
      <PageHeader title={t.title} intro={t.description} actions={<ContentLabelPill label={t.contentLabel} />} />
      {t.contentLabel !== 'fully_verified' && <Alert tone="warn" className="mb-6" title="Practice content">This test is labelled “{t.contentLabel === 'sample' ? 'sample content' : t.contentLabel.replace('_', ' ')}”. Its questions have not all been checked against official sources, so treat the score as practice only.</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Sheet className="p-6">
          <h2 className="text-xl">Instructions</h2>
          <ol className="read mt-4 grid list-decimal gap-2.5 pl-5">
            {bp && <li>The test has <strong>{totalQuestions(bp)} questions</strong> for <strong>{maxMarks(bp)} marks</strong> and lasts <strong>{bp.durationMinutes} minutes</strong>.</li>}
            {bp && <li>Each correct answer earns <strong>{bp.marking.correct} marks</strong>. {bp.marking.incorrect < 0 ? `Each wrong answer costs ${Math.abs(bp.marking.incorrect)} mark(s).` : 'There is no negative marking.'}</li>}
            <li>The countdown follows the server clock. It keeps running if you close the page, and the test submits itself at zero.</li>
            <li>Your answers are saved automatically. If your connection drops, they are kept on your device and sent when it returns.</li>
            <li>Use <em>Mark for review</em> to flag a question. Marked questions are still scored if answered.</li>
            <li>Use the palette on the right to jump to any question. The shapes below show each state.</li>
            <li>You can switch between English and Hindi at any time, where a question has both.</li>
          </ol>
          <div className="mt-6 border-t border-line pt-5"><PaletteLegend /></div>
          <p className="mt-6 text-sm text-muted">{DISCLAIMERS.notNta}</p>
        </Sheet>
        <Sheet className="h-fit p-6">
          <h2 className="text-xl">Ready to begin</h2>
          <div className="mt-4 grid gap-4">
            {bp && bp.languages.length > 1 && <Select label="Start in" value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'hi')}><option value="en">English</option><option value="hi">हिन्दी (Hindi)</option></Select>}
            {open ? <Alert tone="info">You already have an attempt open. Starting continues it.</Alert> : <Check checked={agree} onChange={(e) => setAgree(e.target.checked)} label="I have read the instructions and I am ready to start the timer." />}
            {err && err.reason === 'PILOT_ACCESS_DENIED' ? (
              <Alert tone="warn" title="Closed Private Pilot Access Only">
                <div className="space-y-2 text-sm leading-relaxed">
                  <p className="font-semibold text-pen-900">{err.message}</p>
                  <p className="text-pen-700">
                    This test is currently open exclusively to authorized pilot cohort participants. If you have been invited to participate, please make sure you are signed in with your registered cohort email address. For questions or to request cohort enrollment, contact your pilot coordinator.
                  </p>
                </div>
              </Alert>
            ) : err ? (
              <Alert tone="error">{err.message}</Alert>
            ) : null}
            <Button size="lg" onClick={start} busy={busy} disabled={!open && !agree} data-testid="start-test">{open ? 'Resume test' : 'Start test'}</Button>
          </div>
        </Sheet>
      </div>
    </>
  );
}
export default function Page() { return <Suspense><Body /></Suspense>; }
