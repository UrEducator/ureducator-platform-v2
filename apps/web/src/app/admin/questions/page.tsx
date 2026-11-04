'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, LinkButton, PageHeader, Pill, Select, Spinner, Table, Td } from '@/components/ui';
import { useCan } from '@/components/AdminShell';
import { str, useAdminList } from '@/lib/adminHooks';
import { fmtDateTime, useDocumentTitle } from '@/lib/hooks';
import { useNames } from '@/lib/names';

const TONE = { draft: 'neutral', review: 'warn', approved: 'pen', published: 'ok' } as const;
const STATUS_TEXT = { draft: 'Draft', review: 'In review', approved: 'Approved', published: 'Published' } as const;
function Body() {
  useDocumentTitle('Questions'); const sp = useSearchParams(); const router = useRouter(); const status = sp.get('status') ?? ''; const can = useCan(); const { name } = useNames();
  const l = useAdminList('questions', status || undefined);
  return (
    <>
      <PageHeader title="Questions" intro="Every question moves Draft → In review → Approved → Published. A different person must approve it, and every edit to a reviewed question makes a new version." actions={can('questions.write') ? <LinkButton href="/admin/questions/edit">New question</LinkButton> : undefined} />
      <div className="mb-4 max-w-xs"><Select label="Show" value={status} onChange={(e) => router.replace(e.target.value ? `/admin/questions?status=${e.target.value}` : '/admin/questions')}><option value="">All statuses</option>{(Object.keys(STATUS_TEXT) as (keyof typeof STATUS_TEXT)[]).map((s) => <option key={s} value={s}>{STATUS_TEXT[s]}</option>)}</Select></div>
      {l.error ? <Alert tone="error">{l.error}</Alert> : l.loading && l.items.length === 0 ? <Spinner /> : l.items.length === 0 ? <Alert tone="info">No questions match.</Alert> : (
        <Table caption="Questions" head={['Question', 'Topic', 'Level', 'Status', 'Updated', '']}>
          {l.items.map((q) => { const s = str(q.status) as keyof typeof STATUS_TEXT; return (
            <tr key={q.id}><Td className="max-w-sm font-medium">{str(q.preview, '(no preview)')}</Td><Td>{name(str(q.topicId))}</Td><Td className="capitalize">{str(q.difficulty)}</Td><Td><Pill tone={TONE[s] ?? 'neutral'}>{STATUS_TEXT[s] ?? s}</Pill></Td><Td className="whitespace-nowrap text-muted">{typeof q.updatedAtMs === 'number' ? fmtDateTime(q.updatedAtMs) : ''}</Td><Td><Link className="font-semibold text-pen-700 underline" href={`/admin/questions/edit?id=${q.id}`}>Open</Link></Td></tr>
          ); })}
        </Table>
      )}
      {l.next && <Button className="mt-4" variant="secondary" onClick={() => void l.more()} busy={l.loading}>Load more</Button>}
    </>
  );
}
export default function Page() { return <Suspense><Body /></Suspense>; }
