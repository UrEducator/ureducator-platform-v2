'use client';
import { useState } from 'react';
import { LABEL_TEXT, type ContentLabel } from '@ureducator/shared';
import { ContentLabelPill } from '@/components/brand';
import { Alert, Button, Input, PageHeader, Select, Sheet, Spinner, Table, Td } from '@/components/ui';
import { useCan } from '@/components/AdminShell';
import { useAuth } from '@/lib/auth';
import { asApiError } from '@/lib/types';
import { useDocumentTitle, useLoad } from '@/lib/hooks';

type Kind = 'subject' | 'unit' | 'topic';
export default function Page() {
  useDocumentTitle('Catalogue'); const can = useCan(); const cat = useLoad((b) => b.reads.catalogue()); const [kind, setKind] = useState<Kind>('topic');
  const [f, setF] = useState({ id: '', parent: '', subjectId: '', paper: 'paper2', en: '', hi: '', label: 'under_development', sourceRef: '' }); const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const { backend } = useAuth();
  const subjects = cat.data?.subjects ?? []; const units = cat.data?.units ?? []; const topics = cat.data?.topics ?? [];
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!backend) return; setBusy(true); setMsg(null);
    const name = { en: f.en.trim(), ...(f.hi.trim() ? { hi: f.hi.trim() } : {}) };
    try {
      if (kind === 'subject') await backend.call('adminUpsertCatalogue', { kind, id: f.id, paper: f.paper as 'paper1' | 'paper2', name, label: f.label as ContentLabel, ...(f.sourceRef ? { sourceRef: f.sourceRef } : {}), order: 0 });
      else if (kind === 'unit') await backend.call('adminUpsertCatalogue', { kind, id: f.id, subjectId: f.parent, name, order: 0, objectives: [] });
      else { const u = units.find((x) => x.id === f.parent); await backend.call('adminUpsertCatalogue', { kind, id: f.id, subjectId: u?.subjectId ?? f.subjectId, unitId: f.parent, name, order: 0, subtopics: [] }); }
      setMsg({ tone: 'ok', text: `Saved ${kind} “${name.en}”.` }); cat.reload();
    } catch (x) { setMsg({ tone: 'error', text: asApiError(x).message }); } finally { setBusy(false); }
  }
  const idOk = /^[A-Za-z0-9_-]{1,80}$/.test(f.id);
  return (
    <>
      <PageHeader title="Catalogue" intro="Subjects, units and topics. A subject may be labelled “Fully verified” only after an official source reference is recorded. Until the official documents are checked, leave labels at “Under development” or “Sample content”." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div>
          {cat.loading ? <Spinner /> : (
            <Table caption="Subjects" head={['Subject', 'Paper', 'Label', 'Units', 'Topics']}>
              {subjects.map((s) => <tr key={s.id}><Td className="font-medium">{s.name.en}<br /><span className="font-mono text-xs text-muted">{s.id}</span></Td><Td>{s.paper === 'paper1' ? 'Paper I' : 'Paper II'}</Td><Td><ContentLabelPill label={s.label} /></Td><Td className="tabular-nums">{units.filter((u) => u.subjectId === s.id).length}</Td><Td className="tabular-nums">{topics.filter((t) => t.subjectId === s.id).length}</Td></tr>)}
            </Table>
          )}
        </div>
        {can('catalogue.write') && (
          <Sheet className="h-fit p-5"><h2 className="text-xl">Add or update</h2>
            <form onSubmit={save} className="mt-4 grid gap-3">
              <Select label="What are you adding?" value={kind} onChange={(e) => setKind(e.target.value as Kind)}><option value="subject">Subject</option><option value="unit">Unit</option><option value="topic">Topic</option></Select>
              <Input label="Identifier" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} hint="Letters, numbers, - and _. Using an existing identifier updates it." error={f.id && !idOk ? 'Use letters, numbers, - and _ only.' : undefined} />
              {kind === 'subject' && <><Select label="Paper" value={f.paper} onChange={(e) => setF({ ...f, paper: e.target.value })}><option value="paper1">Paper I</option><option value="paper2">Paper II</option></Select>
                <Select label="Content label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })}>{(Object.keys(LABEL_TEXT) as ContentLabel[]).map((l) => <option key={l} value={l}>{LABEL_TEXT[l]}</option>)}</Select>
                <Input label="Official source reference" value={f.sourceRef} onChange={(e) => setF({ ...f, sourceRef: e.target.value })} hint="Required for “Fully verified”. Name the official document and its date." /></>}
              {kind === 'unit' && <Select label="Subject" value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })}><option value="">Choose…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name.en}</option>)}</Select>}
              {kind === 'topic' && <Select label="Unit" value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })}><option value="">Choose…</option>{units.map((u) => <option key={u.id} value={u.id}>{subjects.find((s) => s.id === u.subjectId)?.name.en} / {u.name.en}</option>)}</Select>}
              <Input label="Name (English)" value={f.en} onChange={(e) => setF({ ...f, en: e.target.value })} />
              <Input label="Name (Hindi — disabled for English-only pilot)" lang="hi" value={f.hi} onChange={(e) => setF({ ...f, hi: e.target.value })} disabled hint="Hindi catalogue entries are disabled during the English-only pilot." />
              {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
              <Button type="submit" busy={busy} disabled={!idOk || !f.en.trim() || (kind !== 'subject' && !f.parent)}>Save {kind}</Button>
            </form>
          </Sheet>
        )}
      </div>
    </>
  );
}
