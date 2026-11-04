'use client';
import { useMemo } from 'react';
import { LABEL_TEXT, SEED_SUBJECTS } from '@ureducator/shared';
import { ContentLabelPill } from '@/components/brand';
import { Alert } from '@/components/ui';
import { useLoad, useDocumentTitle } from '@/lib/hooks';

type Row = { id: string; paper: 'paper1' | 'paper2'; name: string; label: string; units: { id: string; name: string; topics: string[] }[]; sourceRef?: string };

export default function Page() {
  useDocumentTitle('Syllabus and content status');
  const cat = useLoad((b) => b.reads.catalogue());
  const rows: Row[] = useMemo(() => {
    if (cat.data?.subjects.length) {
      return cat.data.subjects.map((s) => ({ id: s.id, paper: s.paper, name: s.name.en, label: s.label, ...(s.sourceRef ? { sourceRef: s.sourceRef } : {}), units: cat.data!.units.filter((u) => u.subjectId === s.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((u) => ({ id: u.id, name: u.name.en, topics: cat.data!.topics.filter((t) => t.unitId === u.id).map((t) => t.name.en) })) }));
    }
    return SEED_SUBJECTS.map((s) => ({ id: s.id, paper: s.paper, name: s.name.en, label: s.label, units: s.units.map((u) => ({ id: u.id, name: u.name.en, topics: u.topics.map((t) => t.name.en) })) }));
  }, [cat.data]);
  const paper1 = rows.filter((r) => r.paper === 'paper1'); const paper2 = rows.filter((r) => r.paper === 'paper2');

  const Block = ({ r }: { r: Row }) => (
    <details className="group border-b border-line py-4" open={r.paper === 'paper1'}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2"><span className="text-lg font-semibold">{r.name}</span><ContentLabelPill label={r.label} /></summary>
      {r.sourceRef && <p className="mt-2 text-sm text-muted">Source checked: {r.sourceRef}</p>}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">{r.units.map((u) => <li key={u.id}><p className="font-medium">{u.name}</p>{u.topics.length > 0 && <p className="text-sm text-muted">{u.topics.join('; ')}</p>}</li>)}</ul>
    </details>
  );
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl sm:text-5xl">Syllabus and content status</h1>
      <Alert tone="warn" className="mt-6" title="Not yet checked against the official syllabus">The unit names below follow the commonly published structure of Paper I. They have not been verified against the current NTA notification, so none of it is labelled &ldquo;{LABEL_TEXT.fully_verified}&rdquo;. Paper II subjects are samples only. Read the official syllabus before you plan your study.</Alert>
      <section className="mt-10" aria-labelledby="p1"><h2 id="p1" className="text-2xl">Paper I</h2>{paper1.map((r) => <Block key={r.id} r={r} />)}</section>
      <section className="mt-10" aria-labelledby="p2"><h2 id="p2" className="text-2xl">Paper II</h2><p className="mt-1 text-muted">The full list of subjects will be imported and verified by an editor. Until then these are examples of how a subject will appear.</p>{paper2.map((r) => <Block key={r.id} r={r} />)}</section>
    </main>
  );
}
