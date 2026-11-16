'use client';
import Link from 'next/link';
import { totalQuestions } from '@ureducator/shared';
import { ContentLabelPill } from '@/components/brand';
import { Alert, Empty, PageHeader, Pill, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle, useLoad } from '@/lib/hooks';

const KIND: Record<string, string> = { full: 'Full length', paper1: 'Paper I', paper2: 'Paper II', unit: 'Unit test', topic: 'Topic test', pyq: 'Previous-year style', custom: 'Custom' };
const isSynthetic = (t: { id: string; contentLabel?: string }) => ['mt-mini', 'mt-mini-late', 'mt-full'].includes(t.id) || t.contentLabel === 'sample';

export default function Page() {
  useDocumentTitle('Mock tests');
  const { user } = useAuth();
  const isAdmin = Boolean(user?.role && ['owner', 'super_admin', 'admin'].includes(user.role));
  const tests = useLoad((b) => b.reads.publishedTests()); const bps = useLoad((b) => b.reads.blueprints());
  const attempts = useLoad((b) => (user?.uid ? b.reads.attempts(user.uid) : Promise.resolve([])), [user?.uid]);
  const visibleTests = (tests.data ?? []).filter((t) => isAdmin || !isSynthetic(t));
  return (
    <>
      <div role="status" className="mb-6 rounded-sheet border border-[#f59e0b] bg-[#fef3c7] px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-[#92400e]">
        UrEducator Pilot Study — Practice Content Only — Not an Official NTA/UGC Publication
      </div>
      <PageHeader title="Mock tests" intro="Every test shows how complete its content is. Start with the full-length format, then use topic tests to repair weak areas." />
      {tests.loading ? <Spinner /> : tests.error ? <Alert tone="error">We could not load the tests. Refresh the page to try again.</Alert> : !visibleTests.length ? <Empty title="No tests are published yet">An editor needs to publish a test before it appears here.</Empty> : (
        <ul className="divide-y divide-line rounded-sheet border border-line bg-surface">
          {visibleTests.map((t) => {
            const bp = bps.data?.[t.blueprintId];
            const userSessions = (attempts.data ?? []).filter((a) => a.mockTestId === t.id);
            const isCompleted = userSessions.some((a) => a.status === 'submitted');
            const isAttempted = userSessions.length > 0;

            return (
              <li key={t.id}><Link href={`/app/tests/detail?id=${t.id}`} className="grid gap-2 px-5 py-4 hover:bg-pen-50 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">{t.title}</p>
                    {t.setCode && (
                      <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-neutral-800 border border-neutral-300">
                        {t.setCode}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted">{KIND[t.kind] ?? t.kind}{bp ? `, ${totalQuestions(bp)} questions, ${bp.durationMinutes} minutes${!bp.officialPatternVerified ? ' (practice setting)' : ''}` : ''}{t.timed ? '' : ', untimed'}</p>
                  {t.description && <p className="mt-1 text-sm">{t.description}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isCompleted ? <Pill tone="ok">Completed</Pill> : isAttempted ? <Pill tone="warn">Attempted</Pill> : null}
                  <ContentLabelPill label={t.contentLabel} />
                  <Pill tone={t.access === 'free' ? 'ok' : 'pen'}>{t.access === 'free' ? 'Free' : 'Paid'}</Pill>
                </div>
              </Link></li>
            );
          })}
        </ul>
      )}
    </>
  );
}
