'use client';
import Link from 'next/link';
import { METRIC_DEFINITIONS, classifyTopics, consistency, trend } from '@ureducator/shared';
import { Meter, ScoreLine } from '@/components/charts';
import { Empty, LinkButton, PageHeader, Sheet, Spinner, Stat, Table, Td } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fmtDuration, pct, useDocumentTitle, useLoad } from '@/lib/hooks';
import { useNames } from '@/lib/names';

const TREND = { up: 'Improving', down: 'Slipping', flat: 'Steady', insufficient: 'Not enough tests yet' } as const;
export default function Page() {
  useDocumentTitle('Analytics'); const uid = useAuth().user?.uid ?? ''; const { name } = useNames();
  const snap = useLoad((b) => b.reads.snapshot(uid), [uid]);
  if (snap.loading) return <Spinner />;
  const s = snap.data;
  if (!s || s.testsTaken === 0) return <><PageHeader title="Analytics" /><Empty title="Nothing to analyse yet" action={<LinkButton href="/app/tests">Take a test</LinkButton>}>Finish at least one test and your strengths, weaknesses and score history appear here. Topic ratings need 4 or more attempted questions.</Empty></>;
  const scores = s.recentScores; const last5 = scores.slice(-5); const avg = last5.reduce((a, b) => a + b.percentage, 0) / Math.max(1, last5.length);
  const t = trend(scores.map((x) => x.percentage)); const cons = consistency(s.activeDays, new Date().toISOString().slice(0, 10));
  const { weak, strong } = classifyTopics(s.topics); const all = Object.values(s.topics).filter((x) => x.attempted > 0).sort((a, b) => a.correct / a.attempted - b.correct / b.attempted);
  return (
    <>
      <PageHeader title="Analytics" intro="Built from your submitted tests. Each number is defined at the bottom of the page." />
      <Sheet className="p-6">
        <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label="Tests taken" value={s.testsTaken} /><Stat label={`Average of last ${last5.length}`} value={pct(avg)} />
          <Stat label="Direction" value={<span className="text-2xl">{TREND[t.direction]}</span>} note={t.direction === 'insufficient' ? undefined : `${t.delta >= 0 ? '+' : ''}${(t.delta * 100).toFixed(1)} points, recent vs earlier`} />
          <Stat label="Consistency" value={pct(cons.value)} note={`${cons.numerator} of the last ${cons.denominator} days`} />
        </dl>
        <div className="mt-6"><h2 className="mb-2 text-xl">Score history</h2><ScoreLine points={scores.map((x) => ({ label: new Date(x.atMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: x.percentage }))} />
          <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold">View as a table</summary><div className="mt-2"><Table caption="Score history" head={['Date', 'Percentage']}>{scores.map((x) => <tr key={x.sessionId}><Td>{new Date(x.atMs).toLocaleDateString('en-IN')}</Td><Td className="tabular-nums">{pct(x.percentage)}</Td></tr>)}</Table></div></details>
        </div>
      </Sheet>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Sheet className="p-6"><h2 className="text-xl">Strong topics</h2>{strong.length === 0 ? <p className="mt-2 text-muted">None yet. {METRIC_DEFINITIONS.strongArea}</p> : <ul className="mt-3 grid gap-3">{strong.map((x) => <li key={x.topicId}><p className="text-sm font-medium">{name(x.topicId)}</p><Meter value={x.correct / x.attempted} label={name(x.topicId)} /></li>)}</ul>}</Sheet>
        <Sheet className="p-6"><h2 className="text-xl">Weak topics</h2>{weak.length === 0 ? <p className="mt-2 text-muted">None yet. {METRIC_DEFINITIONS.weakArea}</p> : <ul className="mt-3 grid gap-3">{weak.map((x) => <li key={x.topicId}><p className="text-sm font-medium">{name(x.topicId)}</p><Meter value={x.correct / x.attempted} label={name(x.topicId)} /></li>)}</ul>}<Link href="/app/planner" className="mt-4 inline-block text-sm font-semibold text-pen-700 underline">Build a plan around these</Link></Sheet>
      </div>
      <section className="mt-6" aria-labelledby="h-all"><h2 id="h-all" className="mb-3 text-xl">All topics</h2>
        <Table caption="Accuracy and speed by topic" head={['Topic', 'Attempted', 'Correct', 'Accuracy', 'Avg time per question']}>
          {all.map((x) => <tr key={x.topicId}><Td className="font-medium">{name(x.topicId)}</Td><Td className="tabular-nums">{x.attempted}</Td><Td className="tabular-nums">{x.correct}</Td><Td className="min-w-36"><Meter value={x.correct / x.attempted} label={`${name(x.topicId)} accuracy`} /></Td><Td className="tabular-nums">{fmtDuration(x.timeMs / x.attempted)}</Td></tr>)}
        </Table>
      </section>
      <section className="mt-8" aria-labelledby="h-def"><h2 id="h-def" className="text-xl">Metric definitions</h2>
        <dl className="mt-3 grid gap-2 text-sm">{Object.entries(METRIC_DEFINITIONS).map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}: </dt><dd className="inline text-muted">{v}</dd></div>)}</dl>
      </section>
    </>
  );
}
