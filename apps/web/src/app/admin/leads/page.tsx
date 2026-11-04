'use client';
import { useState } from 'react';
import { Alert, PageHeader, Select, Spinner, Table, Td, Button } from '@/components/ui';
import { useCan } from '@/components/AdminShell';
import { str, useAdminList } from '@/lib/adminHooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, useDocumentTitle } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

const STATUS = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
export default function Page() {
  useDocumentTitle('Leads'); const can = useCan(); const { backend } = useAuth(); const l = useAdminList('leads'); const [err, setErr] = useState('');
  async function set(id: string, status: (typeof STATUS)[number]) { if (!backend) return; setErr(''); try { await backend.call('adminUpdateLead', { leadId: id, status }); l.reload(); } catch (e) { setErr(asApiError(e).message); } }
  return (
    <>
      <PageHeader title="Leads" intro="People who asked to be told about verified test releases and agreed to be contacted. Nothing is sent from the staging site." />
      {(err || l.error) && <Alert tone="error" className="mb-4">{err || l.error}</Alert>}
      {l.loading && !l.items.length ? <Spinner /> : !l.items.length ? <Alert tone="info">No leads yet.</Alert> : (
        <Table caption="Leads" head={['Name', 'Contact', 'Source', 'Received', 'Status']}>
          {l.items.map((x) => <tr key={x.id}><Td className="font-medium">{str(x.name)}</Td><Td className="break-all">{str(x.email) || str(x.phone)}</Td><Td>{str(x.source)}</Td><Td className="whitespace-nowrap">{typeof x.createdAtMs === 'number' ? fmtDateTime(x.createdAtMs) : ''}</Td><Td>{can('leads.write') ? <Select label="Status" className="min-w-36" value={str(x.status, 'new')} onChange={(e) => void set(x.id, e.target.value as 'new')}>{STATUS.map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}</Select> : str(x.status)}</Td></tr>)}
        </Table>
      )}
      {l.next && <Button className="mt-4" variant="secondary" onClick={() => void l.more()}>Load more</Button>}
    </>
  );
}
