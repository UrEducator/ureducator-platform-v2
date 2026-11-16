'use client';
import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DISCLAIMERS, maxMarks, totalQuestions } from '@ureducator/shared';
import { ContentLabelPill, PaletteLegend } from '@/components/brand';
import { Alert, Button, Check, PageHeader, Sheet, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle, useLoad } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

function Body() {
  useDocumentTitle('Test instructions');
  const id = useSearchParams().get('id') ?? ''; const router = useRouter(); const { backend, user } = useAuth();
  const tests = useLoad((b) => b.reads.publishedTests()); const bps = useLoad((b) => b.reads.blueprints()); const attempts = useLoad((b) => b.reads.attempts(user?.uid ?? ''), [user?.uid]);
  const [lang] = useState<'en' | 'hi'>('en'); const [agree, setAgree] = useState(false); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; reason?: string } | null>(null);
  const reqId = useRef(`r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`); // one id per page view: double clicks cannot start two attempts
  const t = tests.data?.find((x) => x.id === id); const bp = t ? bps.data?.[t.blueprintId] : undefined;
  const open = attempts.data?.find((a) => a.mockTestId === id && a.status === 'in_progress' && a.deadlineMs > Date.now());
  const isAdmin = Boolean(user?.role && ['owner', 'super_admin', 'admin'].includes(user.role));
  const isSynthetic = Boolean(t && (['mt-mini', 'mt-mini-late', 'mt-full'].includes(t.id) || t.contentLabel === 'sample' || t.paperId?.startsWith('demo-')));

  async function start() {
    if (!backend || !t) return;
    if (isSynthetic && !isAdmin) {
      setErr({ message: 'Synthetic demo mock tests are restricted to administrators.', reason: 'SYNTHETIC_TEST_RESTRICTED' });
      return;
    }
    setBusy(true); setErr(null);
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
  if (isSynthetic && !isAdmin) {
    return (
      <>
        <div role="status" className="mb-6 rounded-sheet border border-[#f59e0b] bg-[#fef3c7] px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-[#92400e]">
          UrEducator Pilot Study — Practice Content Only — Not an Official NTA/UGC Publication
        </div>
        <Alert tone="error" title="Synthetic Test Restricted">
          Synthetic demo mock tests are restricted to administrators.
        </Alert>
      </>
    );
  }
  return (
    <>
      <div role="status" className="mb-6 rounded-sheet border border-[#f59e0b] bg-[#fef3c7] px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-[#92400e]">
        UrEducator Pilot Study — Practice Content Only — Not an Official NTA/UGC Publication
      </div>
      <PageHeader
        title={t.title}
        intro={t.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {t.setCode && (
              <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-neutral-800 border border-neutral-300">
                {t.setCode}
              </span>
            )}
            <ContentLabelPill label={t.contentLabel} />
          </div>
        }
      />
      {t.contentLabel !== 'fully_verified' && <Alert tone="warn" className="mb-6" title="Practice content">This test is labelled “{t.contentLabel === 'sample' ? 'sample content' : t.contentLabel.replace('_', ' ')}”. Its questions have not all been checked against official sources, so treat the score as practice only.</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Sheet className="p-6">
          <h2 className="text-xl">Instructions</h2>
          <ol className="read mt-4 grid list-decimal gap-2.5 pl-5">
            {bp && <li>The test has <strong>{totalQuestions(bp)} questions</strong> for <strong>{maxMarks(bp)} marks</strong> and lasts <strong>{bp.durationMinutes} minutes</strong>{!bp.officialPatternVerified ? ' (practice setting)' : ''}.</li>}
            {bp && <li>Each correct answer earns <strong>{bp.marking.correct} marks</strong>. {bp.marking.incorrect < 0 ? `Each wrong answer costs ${Math.abs(bp.marking.incorrect)} mark(s).` : 'There is no negative marking.'}</li>}
            <li>The countdown follows the server clock. It keeps running if you close the page, and the test submits itself at zero.</li>
            <li>Your answers are saved automatically. If your connection drops, they are kept on your device and sent when it returns.</li>
            <li>Use <em>Mark for review</em> to flag a question. Marked questions are still scored if answered.</li>
            <li>Use the palette on the right to jump to any question. The shapes below show each state.</li>
            {/* Language switching note temporarily removed for English-only pilot (T-1) */}
          </ol>
          <div className="mt-6 border-t border-line pt-5"><PaletteLegend /></div>
          <p className="mt-6 text-sm text-muted">{DISCLAIMERS.notNta}</p>
        </Sheet>
        <Sheet className="h-fit p-6">
          <h2 className="text-xl">Ready to begin</h2>
          <div className="mt-4 grid gap-4">
            {/* Language selection temporarily hidden for English-only pilot (T-1) */}
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
