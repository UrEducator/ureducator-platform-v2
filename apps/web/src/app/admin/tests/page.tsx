'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ContentLabelPill } from '@/components/brand';
import { Alert, Button, LinkButton, PageHeader, Pill, Spinner, Table, Td } from '@/components/ui';
import { useCan } from '@/components/AdminShell';
import { str, useAdminList } from '@/lib/adminHooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, useDocumentTitle } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

export default function Page() {
  useDocumentTitle('Mock tests (admin)'); const can = useCan(); const { backend } = useAuth(); const l = useAdminList('mockTests'); const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null); const [busy, setBusy] = useState('');
  async function act(kind: 'publish' | 'unpublish', id: string) {
    if (!backend) return; setBusy(id); setMsg(null);
    try { if (kind === 'publish') await backend.call('adminPublishMockTest', { mockTestId: id }); else await backend.call('adminUnpublishMockTest', { mockTestId: id }); setMsg({ tone: 'ok', text: kind === 'publish' ? 'Published. Students can now start this test.' : 'Unpublished. New attempts are blocked; finished attempts are kept.' }); l.reload(); }
    catch (e) { setMsg({ tone: 'error', text: asApiError(e).message }); } finally { setBusy(''); }
  }
  return (
    <>
      <PageHeader title="Mock tests" intro="A test is assembled from published questions, checked against its blueprint, then published as an immutable paper. Editing a published test means unpublishing it first." actions={can('tests.write') ? <LinkButton href="/admin/tests/edit">New test</LinkButton> : undefined} />
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      {l.error ? <Alert tone="error">{l.error}</Alert> : l.loading && !l.items.length ? <Spinner /> : !l.items.length ? <Alert tone="info">No tests yet.</Alert> : (
        <Table caption="Mock tests" head={['Test', 'Questions', 'Label', 'Status', 'Updated', '']}>
          {l.items.map((t) => { const published = str(t.status) === 'published'; const refs = Array.isArray(t.questionRefs) ? t.questionRefs.length : null; return (
            <tr key={t.id}><Td className="font-medium"><div>{str(t.title)}</div>{Boolean(t.setCode) && <span className="inline-block mt-1 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-neutral-800 border border-neutral-300">{str(t.setCode)}</span>}</Td><Td className="tabular-nums">{refs ?? '–'}</Td><Td><ContentLabelPill label={str(t.contentLabel, 'under_development')} /></Td><Td><Pill tone={published ? 'ok' : 'neutral'}>{published ? 'Published' : 'Draft'}</Pill></Td><Td className="whitespace-nowrap text-muted">{typeof t.updatedAtMs === 'number' ? fmtDateTime(t.updatedAtMs) : ''}</Td>
              <Td><div className="flex flex-wrap items-center gap-2">{!published && <Link className="font-semibold text-pen-700 underline" href={`/admin/tests/edit?id=${t.id}`}>Edit</Link>}
                {can('tests.publish') && (published ? <Button size="sm" variant="secondary" busy={busy === t.id} onClick={() => void act('unpublish', t.id)}>Unpublish</Button> : refs ? <Button size="sm" busy={busy === t.id} onClick={() => void act('publish', t.id)} data-testid={`publish-${t.id}`}>Publish</Button> : null)}</div></Td></tr>
          ); })}
        </Table>
      )}
    </>
  );
}
