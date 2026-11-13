'use client';
import Link from 'next/link';
import { totalQuestions } from '@ureducator/shared';
import { ContentLabelPill } from '@/components/brand';
import { Alert, Empty, PageHeader, Pill, Spinner } from '@/components/ui';
import { useDocumentTitle, useLoad } from '@/lib/hooks';

const KIND: Record<string, string> = { full: 'Full length', paper1: 'Paper I', paper2: 'Paper II', unit: 'Unit test', topic: 'Topic test', pyq: 'Previous-year style', custom: 'Custom' };
export default function Page() {
  useDocumentTitle('Mock tests');
  const tests = useLoad((b) => b.reads.publishedTests()); const bps = useLoad((b) => b.reads.blueprints());
  return (
    <>
      <PageHeader title="Mock tests" intro="Every test shows how complete its content is. Start with the full-length format, then use topic tests to repair weak areas." />
      {tests.loading ? <Spinner /> : tests.error ? <Alert tone="error">We could not load the tests. Refresh the page to try again.</Alert> : !tests.data?.length ? <Empty title="No tests are published yet">An editor needs to publish a test before it appears here.</Empty> : (
        <ul className="divide-y divide-line rounded-sheet border border-line bg-surface">
          {tests.data.map((t) => { const bp = bps.data?.[t.blueprintId]; return (
            <li key={t.id}><Link href={`/app/tests/detail?id=${t.id}`} className="grid gap-2 px-5 py-4 hover:bg-pen-50 sm:grid-cols-[1fr_auto] sm:items-center">
              <div><p className="text-lg font-semibold">{t.title}</p><p className="text-sm text-muted">{KIND[t.kind] ?? t.kind}{bp ? `, ${totalQuestions(bp)} questions, ${bp.durationMinutes} minutes${!bp.officialPatternVerified ? ' (practice setting)' : ''}` : ''}{t.timed ? '' : ', untimed'}</p>{t.description && <p className="mt-1 text-sm">{t.description}</p>}</div>
              <div className="flex flex-wrap items-center gap-2"><ContentLabelPill label={t.contentLabel} /><Pill tone={t.access === 'free' ? 'ok' : 'pen'}>{t.access === 'free' ? 'Free' : 'Paid'}</Pill></div>
            </Link></li>
          ); })}
        </ul>
      )}
    </>
  );
}
