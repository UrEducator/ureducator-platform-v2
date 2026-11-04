'use client';
import { useState } from 'react';
import { Alert, Button, PageHeader, Select, Sheet, Spinner } from '@/components/ui';
import { useCan } from '@/components/AdminShell';
import { str, useAdminList } from '@/lib/adminHooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, useDocumentTitle } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

export default function Page() {
  useDocumentTitle('Support'); const can = useCan(); const { backend } = useAuth(); const l = useAdminList('supportTickets'); const [err, setErr] = useState('');
  async function set(id: string, status: 'open' | 'in_progress' | 'resolved') { if (!backend) return; setErr(''); try { await backend.call('adminUpdateTicket', { ticketId: id, status }); l.reload(); } catch (e) { setErr(asApiError(e).message); } }
  return (
    <>
      <PageHeader title="Support" intro="Tickets from students. Answer them by email from your own mailbox; replies are not sent from this site." />
      {(err || l.error) && <Alert tone="error" className="mb-4">{err || l.error}</Alert>}
      {l.loading && !l.items.length ? <Spinner /> : !l.items.length ? <Alert tone="info">No tickets.</Alert> : (
        <ul className="grid gap-3">{l.items.map((t) => (
          <li key={t.id}><Sheet className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{str(t.subject)}</p><p className="text-sm text-muted">{str(t.category)} · {str(t.email, 'no email')} · {typeof t.createdAtMs === 'number' ? fmtDateTime(t.createdAtMs) : ''}</p></div>
            {can('support.write') ? <Select label="Status" className="min-w-40" value={str(t.status, 'open')} onChange={(e) => void set(t.id, e.target.value as 'open')}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></Select> : <p>{str(t.status)}</p>}</div>
            <p className="read mt-3 whitespace-pre-line text-[15px]">{str(t.message)}</p></Sheet></li>
        ))}</ul>
      )}
      {l.next && <Button className="mt-4" variant="secondary" onClick={() => void l.more()}>Load more</Button>}
    </>
  );
}
