'use client';
import Link from 'next/link';
import { Alert, Empty, PageHeader, Pill, Spinner, Table, Td } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, pct, useDocumentTitle, useLoad } from '@/lib/hooks';

export default function Page() {
  useDocumentTitle('History'); const uid = useAuth().user?.uid ?? '';
  const a = useLoad((b) => b.reads.attempts(uid), [uid]); const r = useLoad((b) => b.reads.results(uid), [uid]);
  const res = new Map((r.data ?? []).map((x) => [x.id, x]));
  return (
    <>
      <PageHeader title="Test history" intro="Every attempt, newest first." />
      {a.loading || r.loading ? <Spinner /> : a.error ? <Alert tone="error">We could not load your history.</Alert> : !a.data?.length ? <Empty title="No attempts yet">Your submitted tests will be listed here.</Empty> : (
        <Table caption="Your test attempts" head={['Date', 'Test', 'Status', 'Score', '']}>
          {a.data.map((x) => { const y = res.get(x.id); const live = x.status === 'in_progress' && x.deadlineMs > Date.now(); return (
            <tr key={x.id}>
              <Td>{fmtDateTime(x.startedAtMs)}</Td><Td className="font-medium">{x.testTitle}</Td>
              <Td>{live ? <Pill tone="warn">In progress</Pill> : x.status === 'in_progress' ? <Pill>Finalising</Pill> : <Pill tone={x.status === 'submitted' ? 'ok' : 'neutral'}>{x.status === 'submitted' ? 'Submitted' : 'Auto-submitted'}</Pill>}</Td>
              <Td className="tabular-nums">{y ? `${y.marks} / ${y.maxMarks} (${pct(y.percentage)})` : '–'}</Td>
              <Td><Link className="font-semibold text-pen-700 underline" href={live ? `/app/exam?s=${x.id}` : `/app/results?s=${x.id}`}>{live ? 'Resume' : 'View result'}</Link></Td>
            </tr>
          ); })}
        </Table>
      )}
    </>
  );
}
