'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LABEL_TEXT, type Blueprint, type ContentLabel } from '@ureducator/shared';
import { Alert, Button, Check, Input, PageHeader, Select, Sheet, Spinner, Textarea } from '@/components/ui';
import { num, str, useAdminList, type Row } from '@/lib/adminHooks';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle } from '@/lib/hooks';
import { useNames } from '@/lib/names';
import { asApiError } from '@/lib/types';

type Ref = { qid: string; version: number; sectionId: string };
const KINDS = [['full', 'Full length'], ['paper1', 'Paper I'], ['paper2', 'Paper II'], ['unit', 'Unit test'], ['topic', 'Topic test'], ['pyq', 'Previous-year style'], ['custom', 'Custom']] as const;

function Body() {
  useDocumentTitle('Edit test'); const id = useSearchParams().get('id') ?? ''; const router = useRouter(); const { backend } = useAuth(); const { name } = useNames();
  const bps = useAdminList('examBlueprints', undefined, 50); const published = useAdminList('questions', 'published', 50); const tests = useAdminList('mockTests', undefined, 50);
  const [f, setF] = useState({ title: '', kind: 'custom', blueprintId: '', access: 'free', label: 'under_development', reveal: 'immediate', timed: true, shuffle: false, description: '', closes: '' }); const [refs, setRefs] = useState<Ref[]>([]); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null); const [loaded, setLoaded] = useState(!id);
  useEffect(() => {
    if (!id || loaded || tests.loading) return; const t = tests.items.find((x) => x.id === id); if (!t) { setLoaded(true); return; }
    setF({ title: str(t.title), kind: str(t.kind, 'custom'), blueprintId: str(t.blueprintId), access: str(t.access, 'free'), label: str(t.contentLabel, 'under_development'), reveal: str(t.revealPolicy, 'immediate'), timed: t.timed !== false, shuffle: t.shuffle === true, description: str(t.description), closes: typeof t.closesAtMs === 'number' ? new Date(t.closesAtMs).toISOString().slice(0, 16) : '' });
    setRefs(Array.isArray(t.questionRefs) ? (t.questionRefs as Ref[]) : []); setLoaded(true);
  }, [id, loaded, tests.loading, tests.items]);

  const bp = useMemo(() => { const r = bps.items.find((b) => b.id === f.blueprintId); return r ? (r as unknown as Blueprint) : null; }, [bps.items, f.blueprintId]);
  const qById = useMemo(() => new Map(published.items.map((q) => [q.id, q])), [published.items]);
  const counts = (sid: string) => refs.filter((r) => r.sectionId === sid).length;
  const add = (sectionId: string, q: Row) => setRefs((p) => (p.some((r) => r.qid === q.id) ? p : [...p, { qid: q.id, version: num(q.publishedVersion, 1), sectionId }]));
  const sectionsOk = !!bp && bp.sections.every((s) => counts(s.id) === s.questionCount);
  const problems: string[] = []; if (f.title.trim().length < 3) problems.push('Give the test a title.'); if (!bp) problems.push('Choose a blueprint.'); else if (!sectionsOk) problems.push('Each section needs exactly the number of questions the blueprint asks for.');

  async function save() {
    if (!backend || !bp) return; setBusy(true); setMsg(null);
    try {
      const r = await backend.call('adminUpsertMockTest', { ...(id ? { mockTestId: id } : {}), title: f.title.trim(), kind: f.kind as 'custom', blueprintId: bp.id, access: f.access as 'free', timed: f.timed, shuffle: f.shuffle, revealPolicy: f.reveal as 'immediate', contentLabel: f.label as ContentLabel, ...(f.description.trim() ? { description: f.description.trim() } : {}), ...(f.closes ? { closesAtMs: new Date(f.closes).getTime() } : {}), questionRefs: refs });
      setMsg({ tone: 'ok', text: 'Saved as a draft. Publish it from the test list when it is ready.' }); if (!id) router.replace(`/admin/tests/edit?id=${r.mockTestId}`);
    } catch (e) { setMsg({ tone: 'error', text: asApiError(e).message }); } finally { setBusy(false); }
  }
  if (!loaded || bps.loading) return <Spinner />;
  return (
    <>
      <PageHeader title={id ? 'Edit test' : 'New test'} intro="Only published questions can be added. The test uses the version published today." actions={<Link className="text-sm font-semibold text-pen-700 underline" href="/admin/tests">Back to tests</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-6">
          <Sheet className="grid gap-4 p-5 sm:grid-cols-2"><h2 className="text-xl sm:col-span-2">Details</h2>
            <div className="sm:col-span-2"><Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <Select label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            <Select label="Blueprint" value={f.blueprintId} onChange={(e) => setF({ ...f, blueprintId: e.target.value })}><option value="">Choose…</option>{bps.items.map((b) => <option key={b.id} value={b.id}>{str(b.name, b.id)}</option>)}</Select>
            <Select label="Content label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} hint="“Fully verified” is refused for synthetic questions or an unverified blueprint.">{(Object.keys(LABEL_TEXT) as ContentLabel[]).map((l) => <option key={l} value={l}>{LABEL_TEXT[l]}</option>)}</Select>
            <Select label="Access" value={f.access} onChange={(e) => setF({ ...f, access: e.target.value })}><option value="free">Free</option><option value="paid">Paid (needs a plan)</option></Select>
            <Select label="Answers and explanations open" value={f.reveal} onChange={(e) => setF({ ...f, reveal: e.target.value })}><option value="immediate">Right after submitting</option><option value="after_close">After the test window closes</option></Select>
            <Input label="Window closes (for “after the window closes”)" type="datetime-local" value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} />
            <Check checked={f.timed} onChange={(e) => setF({ ...f, timed: e.target.checked })} label="Timed" /><Check checked={f.shuffle} onChange={(e) => setF({ ...f, shuffle: e.target.checked })} label="Shuffle question order" />
            <div className="sm:col-span-2"><Textarea label="Description shown to students" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          </Sheet>
          {bp && bp.sections.map((s) => { const chosen = refs.filter((r) => r.sectionId === s.id); const free = published.items.filter((q) => !refs.some((r) => r.qid === q.id)); return (
            <Sheet key={s.id} className="p-5" aria-label={s.title.en}>
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl">{s.title.en}</h2><p className={chosen.length === s.questionCount ? 'font-semibold text-ok' : 'font-semibold text-bad'}>{chosen.length} of {s.questionCount} chosen</p></div>
              <ul className="mt-3 divide-y divide-line text-sm">{chosen.map((r) => <li key={r.qid} className="flex items-center justify-between gap-3 py-2"><span>{str(qById.get(r.qid)?.preview, r.qid)} <span className="text-muted">· {name(str(qById.get(r.qid)?.topicId))}</span></span><button type="button" className="font-semibold text-bad underline" onClick={() => setRefs((p) => p.filter((x) => x.qid !== r.qid))}>Remove</button></li>)}</ul>
              <details className="mt-3"><summary className="cursor-pointer font-semibold text-pen-700">Add questions to this section ({free.length} available)</summary>
                <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-sheet border border-line text-sm">{free.length === 0 ? <li className="p-3 text-muted">No other published questions.</li> : free.map((q) => <li key={q.id} className="flex items-center justify-between gap-3 px-3 py-2"><span>{str(q.preview)} <span className="text-muted">· {name(str(q.topicId))}</span></span><Button size="sm" variant="secondary" onClick={() => add(s.id, q)} aria-label={`Add: ${str(q.preview)}`}>Add</Button></li>)}</ul>
              </details>
            </Sheet>
          ); })}
        </div>
        <Sheet className="h-fit p-5"><h2 className="text-xl">Save</h2>
          {bp && <p className="mt-2 text-sm text-muted">{bp.sections.reduce((n, s) => n + s.questionCount, 0)} questions, {bp.durationMinutes} minutes.</p>}
          {problems.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-muted">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          {msg && <Alert tone={msg.tone} className="mt-3">{msg.text}</Alert>}
          <Button className="mt-4 w-full" onClick={save} busy={busy} disabled={problems.length > 0} data-testid="save-test">Save draft</Button>
        </Sheet>
      </div>
    </>
  );
}
export default function Page() { return <Suspense><Body /></Suspense>; }
