'use client';
import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, LinkButton, PageHeader, Pill, Select, Spinner, Table, Td } from '@/components/ui';
import { useCan } from '@/components/AdminShell';
import { str, useAdminList } from '@/lib/adminHooks';
import { fmtDateTime, useDocumentTitle } from '@/lib/hooks';
import { useNames } from '@/lib/names';

const TONE = { draft: 'neutral', review: 'warn', approved: 'pen', published: 'ok' } as const;
const STATUS_TEXT = { draft: 'Draft', review: 'In review', approved: 'Approved', published: 'Published' } as const;

function Body() {
  useDocumentTitle('Question Bank');
  const sp = useSearchParams();
  const router = useRouter();
  const status = sp.get('status') ?? '';
  const can = useCan();
  const { name, units, topics } = useNames();

  const [unitFilter, setUnitFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused'>('all');

  const l = useAdminList('questions', {
    status: status || undefined,
    unitId: unitFilter || undefined,
    topicId: topicFilter || undefined,
  }, 250);

  // Topics available under selected unit (or all topics if no unit selected)
  const availableTopics = useMemo(() => {
    if (!unitFilter) return topics;
    return topics.filter((t) => t.unitId === unitFilter);
  }, [topics, unitFilter]);

  // Client-side filtering for usage (All, Used, Unused) and fallback
  const filteredItems = useMemo(() => {
    return l.items.filter((q) => {
      const usedSets = (Array.isArray(q.usedInSets) ? q.usedInSets : []) as string[];
      if (usageFilter === 'used' && usedSets.length === 0) return false;
      if (usageFilter === 'unused' && usedSets.length > 0) return false;
      if (unitFilter && str(q.unitId) !== unitFilter) return false;
      if (topicFilter && str(q.topicId) !== topicFilter) return false;
      return true;
    });
  }, [l.items, usageFilter, unitFilter, topicFilter]);

  return (
    <>
      <PageHeader
        title="Question Bank"
        intro="Search, audit, and track cross-paper set usage for all UGC NET Paper 1 questions."
        actions={can('questions.write') ? <LinkButton href="/admin/questions/edit">New question</LinkButton> : undefined}
      />

      {/* Filter Bar */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-12">
        <div className="xl:col-span-2">
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              const val = e.target.value;
              router.replace(val ? `/admin/questions?status=${val}` : '/admin/questions');
            }}
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_TEXT) as (keyof typeof STATUS_TEXT)[]).map((s) => (
              <option key={s} value={s}>{STATUS_TEXT[s]}</option>
            ))}
          </Select>
        </div>

        <div className="xl:col-span-4">
          <Select
            label="Unit"
            value={unitFilter}
            onChange={(e) => {
              setUnitFilter(e.target.value);
              setTopicFilter('');
            }}
          >
            <option value="">All units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name.en || u.id}</option>
            ))}
          </Select>
        </div>

        <div className="xl:col-span-4">
          <Select
            label="Topic"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
          >
            <option value="">All topics</option>
            {availableTopics.map((t) => (
              <option key={t.id} value={t.id}>{t.name.en || t.id}</option>
            ))}
          </Select>
        </div>

        <div className="xl:col-span-2">
          <Select
            label="Usage"
            value={usageFilter}
            onChange={(e) => setUsageFilter(e.target.value as 'all' | 'used' | 'unused')}
          >
            <option value="all">All (Used & Unused)</option>
            <option value="used">Used in Sets</option>
            <option value="unused">Unused (Standalone)</option>
          </Select>
        </div>
      </div>

      {l.error ? (
        <Alert tone="error">{l.error}</Alert>
      ) : l.loading && l.items.length === 0 ? (
        <Spinner />
      ) : filteredItems.length === 0 ? (
        <Alert tone="info">No questions match the selected filters.</Alert>
      ) : (
        <Table caption="Questions" head={['Question', 'Source', 'Topic', 'Used In', 'Level', 'Status', 'Updated', '']}>
          {filteredItems.map((q) => {
            const s = str(q.status) as keyof typeof STATUS_TEXT;
            const prov = (q.provenance ?? {}) as { kind?: string };
            const isPyq = prov.kind === 'official_pyq' || str(q.shiftId).length > 0;
            const usedSets = (Array.isArray(q.usedInSets) ? q.usedInSets : []) as string[];

            return (
              <tr key={q.id}>
                <Td className="min-w-[260px] max-w-sm xl:max-w-lg font-medium">
                  <span className="line-clamp-2" title={str(q.preview)}>{str(q.preview, '(no preview)')}</span>
                </Td>
                <Td className="w-24 whitespace-nowrap">
                  {isPyq ? (
                    <Pill tone="ok">NTA PYQ</Pill>
                  ) : (
                    <Pill tone="pen">UrEducator</Pill>
                  )}
                </Td>
                <Td className="min-w-[220px] max-w-xs xl:max-w-md font-medium text-ink">
                  <span className="line-clamp-2" title={name(str(q.topicId))}>{name(str(q.topicId))}</span>
                </Td>
                <Td className="min-w-[140px] max-w-[240px]">
                  {usedSets.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {usedSets.map((code) => (
                        <span
                          key={code}
                          className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-neutral-800 border border-neutral-300"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted italic">Unused</span>
                  )}
                </Td>
                <Td className="w-20 capitalize whitespace-nowrap">{str(q.difficulty)}</Td>
                <Td className="w-24 whitespace-nowrap"><Pill tone={TONE[s] ?? 'neutral'}>{STATUS_TEXT[s] ?? s}</Pill></Td>
                <Td className="w-28 whitespace-nowrap text-muted text-xs">
                  {typeof q.updatedAtMs === 'number' ? fmtDateTime(q.updatedAtMs) : ''}
                </Td>
                <Td className="w-16 whitespace-nowrap text-right">
                  <Link className="font-semibold text-pen-700 underline" href={`/admin/questions/edit?id=${q.id}`}>
                    Open
                  </Link>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
      {l.next && (
        <Button className="mt-4" variant="secondary" onClick={() => void l.more()} busy={l.loading}>
          Load more
        </Button>
      )}
    </>
  );
}

export default function Page() { return <Suspense><Body /></Suspense>; }
