'use client';
import { Alert, Button, PageHeader, Spinner, Table, Td } from '@/components/ui';
import { str, useAdminList } from '@/lib/adminHooks';
import { fmtDateTime, useDocumentTitle } from '@/lib/hooks';

export default function Page() {
  useDocumentTitle('Audit log'); const l = useAdminList('auditLogs', undefined, 50);
  return (
    <>
      <PageHeader title="Audit log" intro="Who changed what, and when. Entries record the action and the item, never answers or personal details, and cannot be edited from this site." />
      {l.error ? <Alert tone="error">{l.error}</Alert> : l.loading && !l.items.length ? <Spinner /> : !l.items.length ? <Alert tone="info">Nothing has been recorded yet.</Alert> : (
        <Table caption="Audit log" head={['When', 'Who', 'Action', 'Item']}>{l.items.map((a) => <tr key={a.id}><Td className="whitespace-nowrap">{typeof a.atMs === 'number' ? fmtDateTime(a.atMs) : ''}</Td><Td className="font-mono text-xs">{str(a.actorUid)}<br /><span className="font-sans text-muted">{str(a.actorRole)}</span></Td><Td>{str(a.action)}</Td><Td className="break-all font-mono text-xs">{str(a.target)}</Td></tr>)}</Table>
      )}
      {l.next && <Button className="mt-4" variant="secondary" onClick={() => void l.more()}>Load more</Button>}
    </>
  );
}
