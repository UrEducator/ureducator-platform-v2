'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Sheet, Spinner } from '@/components/ui';
import { useLoad, useDocumentTitle } from '@/lib/hooks';

function Body() {
  useDocumentTitle('Verify a report');
  const q = useSearchParams(); const id = q.get('id') ?? ''; const sig = q.get('sig') ?? '';
  const valid = /^UR-[A-Z0-9]{8,24}$/.test(id) && /^[a-f0-9]{16,64}$/.test(sig);
  const r = useLoad((b) => b.call('verifyReport', { reportId: id, sig }), [id, sig], valid);
  return (
    <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl">Report verification</h1>
      <div className="mt-6">
        {!valid ? <Alert tone="warn" title="No report to check">Open the link or scan the QR code printed on a UrEducator report.</Alert>
          : r.loading ? <Spinner label="Checking the report" />
          : r.error ? <Alert tone="error">The check could not be completed. Try again in a minute.</Alert>
          : r.data && 'valid' in r.data && r.data.valid ? (
            <Sheet className="p-6"><p className="font-semibold text-ok">This report was issued by UrEducator.</p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-muted">Test</dt><dd>{r.data.testTitle}</dd></div><div><dt className="text-sm text-muted">Score</dt><dd className="tabular-nums">{r.data.marks} out of {r.data.maxMarks}</dd></div><div><dt className="text-sm text-muted">Issued</dt><dd>{r.data.issuedAt}</dd></div><div><dt className="text-sm text-muted">Report ID</dt><dd className="break-all">{id}</dd></div></dl>
              <p className="mt-4 text-sm text-muted">{r.data.notice}</p></Sheet>
          ) : <Alert tone="error" title="This report could not be verified">The ID or signature does not match our records. It may have been altered or mistyped.</Alert>}
      </div>
    </main>
  );
}
export default function Page() { return <Suspense><Body /></Suspense>; }
