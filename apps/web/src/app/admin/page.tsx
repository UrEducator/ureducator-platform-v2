'use client';
import Link from 'next/link';
import { Alert, PageHeader, Sheet, Spinner, Stat } from '@/components/ui';
import { ROLE_LABEL, useRole } from '@/components/AdminShell';
import { useDocumentTitle, useLoad } from '@/lib/hooks';

const TILES: [string, string, string][] = [
  ['questionsInReview', 'Questions waiting for review', '/admin/questions?status=review'], ['questionsApproved', 'Approved, ready to publish', '/admin/questions?status=approved'], ['questionsDraft', 'Draft questions', '/admin/questions?status=draft'], ['questionsPublished', 'Published questions', '/admin/questions?status=published'],
  ['testsDraft', 'Draft tests', '/admin/tests'], ['testsPublished', 'Published tests', '/admin/tests'], ['leadsNew', 'New leads', '/admin/leads'], ['ticketsOpen', 'Open support tickets', '/admin/support'], ['students', 'Students', '/admin/people'],
];
export default function Page() {
  useDocumentTitle('Admin overview'); const role = useRole(); const o = useLoad((b) => b.call('adminOverview', {}));
  return (
    <>
      <PageHeader title="Overview" intro={role ? `You are signed in as ${ROLE_LABEL[role]}. You see only the work your role covers.` : undefined} />
      {o.loading ? <Spinner /> : o.error ? <Alert tone="error">{o.error.message}</Alert> : (
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TILES.filter(([k]) => o.data && k in o.data.counts).map(([k, label, href]) => <Sheet key={k} className="p-5"><Stat label={label} value={o.data!.counts[k]} /><Link href={href} className="mt-2 inline-block text-sm font-semibold text-pen-700 underline">Open</Link></Sheet>)}
        </dl>
      )}
      <Alert tone="info" className="mt-8" title="This is a staging environment">Payments are off, live AI is off, and nothing here touches the production project.</Alert>
    </>
  );
}
