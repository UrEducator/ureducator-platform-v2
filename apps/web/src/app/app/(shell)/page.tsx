'use client';
import Link from 'next/link';
import { classifyTopics } from '@ureducator/shared';
import { Alert, Empty, LinkButton, PageHeader, Sheet, Spinner, Stat } from '@/components/ui';
import { ScoreLine } from '@/components/charts';
import { ContentLabelPill } from '@/components/brand';
import { useAuth } from '@/lib/auth';
import { fmtDate, pct, useDocumentTitle, useLoad } from '@/lib/hooks';
import { useNames } from '@/lib/names';

export default function Page() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth(); const uid = user?.uid ?? ''; const { name } = useNames();
  const profile = useLoad((b) => b.reads.profile(uid), [uid]); const snap = useLoad((b) => b.reads.snapshot(uid), [uid]); const attempts = useLoad((b) => b.reads.attempts(uid), [uid]);
  const tests = useLoad((b) => b.reads.publishedTests()); const plan = useLoad((b) => b.reads.studyPlan(uid), [uid]);
  const open = (attempts.data ?? []).filter((a) => a.status === 'in_progress' && a.deadlineMs > Date.now());
  const s = snap.data; const scores = s?.recentScores ?? []; const last5 = scores.slice(-5);
  const avg = last5.length ? last5.reduce((x, y) => x + y.percentage, 0) / last5.length : 0;
  const { weak } = classifyTopics(s?.topics ?? {});
  const today = new Date().toISOString().slice(0, 10); const todays = (plan.data?.tasks ?? []).filter((t) => t.date === today);
  const first = (profile.data?.displayName ?? user?.displayName ?? '').split(' ')[0];

  return (
    <>
      <PageHeader title={first ? `Welcome back, ${first}` : 'Dashboard'} intro="Pick up a test, see where marks were lost and follow your plan for today." actions={<LinkButton href="/app/tests" variant="marker">Choose a mock test</LinkButton>} />
      {profile.data && !profile.data.onboardingComplete && <Alert tone="info" className="mb-6" title="Tell us about your preparation">Two minutes of setup lets us build a revision plan around your target exam date. <Link className="font-semibold underline" href="/app/onboarding">Set up your plan</Link></Alert>}
      {open.map((a) => <Alert key={a.id} tone="warn" className="mb-6" title="You have a test in progress"><Link className="font-semibold underline" href={`/app/exam?s=${a.id}`}>Resume “{a.testTitle}”</Link> before the timer runs out.</Alert>)}

      {snap.loading || attempts.loading ? <Spinner /> : !s || s.testsTaken === 0 ? (
        <Empty title="No tests taken yet" action={<LinkButton href="/app/tests">Take your first test</LinkButton>}>Your scores, strong topics and weak topics appear here after your first submitted test.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Sheet className="p-6">
            <h2 className="text-xl">Recent scores</h2>
            <dl className="mt-4 grid grid-cols-3 gap-4"><Stat label="Tests taken" value={s.testsTaken} /><Stat label={`Average of last ${last5.length}`} value={pct(avg)} /><Stat label="Best" value={pct(Math.max(...scores.map((x) => x.percentage)))} /></dl>
            <div className="mt-5"><ScoreLine points={scores.slice(-10).map((x) => ({ label: new Date(x.atMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: x.percentage }))} /></div>
          </Sheet>
          <Sheet className="p-6">
            <h2 className="text-xl">Topics to work on</h2>
            {weak.length === 0 ? <p className="mt-3 text-muted">No topic has enough attempts yet to call it weak. A topic needs 4 or more attempted questions across your tests.</p> : <ul className="mt-3 divide-y divide-line">{weak.slice(0, 5).map((t) => <li key={t.topicId} className="flex items-baseline justify-between gap-3 py-2.5"><span>{name(t.topicId)}</span><span className="text-sm tabular-nums text-bad">{t.correct}/{t.attempted} correct</span></li>)}</ul>}
            <Link href="/app/analytics" className="mt-3 inline-block text-sm font-semibold text-pen-700 underline">Full analysis</Link>
          </Sheet>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Sheet className="p-6">
          <h2 className="text-xl">Today</h2>
          {todays.length === 0 ? <p className="mt-3 text-muted">{plan.data ? 'Nothing is planned for today.' : 'You have no plan yet.'} <Link className="font-semibold text-pen-700 underline" href="/app/planner">{plan.data ? 'Open the planner' : 'Create a plan'}</Link></p> : <ul className="mt-3 divide-y divide-line">{todays.map((t) => <li key={t.id} className="flex items-baseline justify-between gap-3 py-2.5"><span>{t.title}</span><span className="text-sm text-muted">{t.minutes} min</span></li>)}</ul>}
        </Sheet>
        <Sheet className="p-6">
          <h2 className="text-xl">Available tests</h2>
          {tests.loading ? <Spinner /> : !tests.data?.length ? <p className="mt-3 text-muted">No tests are published yet.</p> : (
            <ul className="mt-3 divide-y divide-line">{tests.data.slice(0, 4).map((t) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><Link className="font-semibold hover:underline" href={`/app/tests/detail?id=${t.id}`}>{t.title}</Link><ContentLabelPill label={t.contentLabel} /></li>)}</ul>
          )}
          <p className="mt-3 text-xs text-muted">Account created {profile.data ? fmtDate(profile.data.createdAtMs) : ''}</p>
        </Sheet>
      </div>
    </>
  );
}
