'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { TRANSITIONS, canTransition, type Difficulty } from '@ureducator/shared';
import { Alert, Button, Check, Input, PageHeader, Pill, Select, Sheet, Spinner, Textarea } from '@/components/ui';
import { useRole } from '@/components/AdminShell';
import { loc, str } from '@/lib/adminHooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, useDocumentTitle } from '@/lib/hooks';
import { useNames } from '@/lib/names';
import { asApiError, type Out } from '@/lib/types';

type Detail = Out<'adminGetQuestion'>;
const IDS = ['a', 'b', 'c', 'd'] as const;
const TO_LABEL: Record<string, string> = { review: 'Submit for review', approved: 'Approve', published: 'Publish', draft: 'Send back to draft' };
const STATUS_TEXT: Record<string, string> = { draft: 'Draft', review: 'In review', approved: 'Approved', published: 'Published' };
const blank = () => ({ subjectId: '', unitId: '', topicId: '', difficulty: 'medium' as Difficulty, type: 'mcq_single' as 'mcq_single' | 'mcq_multi', stemEn: '', stemHi: '', opts: IDS.map((id) => ({ id, en: '', hi: '' })), correct: [] as string[], expEn: '', expHi: '', kind: 'original', source: '', sourceYear: '', copyright: 'own_work', pyq: false });
type Form = ReturnType<typeof blank>;

function Body() {
  useDocumentTitle('Edit question'); const id = useSearchParams().get('id') ?? ''; const router = useRouter(); const { backend, user } = useAuth(); const role = useRole(); const { subjects, units, topics } = useNames();
  const [f, setF] = useState<Form>(blank); const [detail, setDetail] = useState<Detail | null>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null); const [loading, setLoading] = useState(!!id);

  const load = async (version?: number) => {
    if (!backend || !id) return; setLoading(true);
    try {
      const r = await backend.call('adminGetQuestion', { questionId: id, ...(version ? { version } : {}) }); setDetail(r);
      const v = r.version as { content: { type: 'mcq_single' | 'mcq_multi'; stem: unknown; options: { id: string; text: unknown }[] }; correct: string[]; explanation?: unknown; provenance: { kind: string; source?: string; sourceYear?: number; copyrightStatus: string; officialPyqVerified?: boolean } }; const h = r.head as unknown as Record<string, unknown>;
      setF({ subjectId: str(h.subjectId), unitId: str(h.unitId), topicId: str(h.topicId), difficulty: str(h.difficulty, 'medium') as Difficulty, type: v.content.type, stemEn: loc(v.content.stem).en, stemHi: loc(v.content.stem).hi ?? '', opts: IDS.map((i) => { const o = v.content.options.find((x) => x.id === i); return { id: i, en: loc(o?.text).en, hi: loc(o?.text).hi ?? '' }; }), correct: v.correct, expEn: loc(v.explanation).en, expHi: loc(v.explanation).hi ?? '', kind: v.provenance.kind, source: v.provenance.source ?? '', sourceYear: v.provenance.sourceYear ? String(v.provenance.sourceYear) : '', copyright: v.provenance.copyrightStatus, pyq: !!v.provenance.officialPyqVerified });
    } catch (e) { setMsg({ tone: 'error', text: asApiError(e).message }); } finally { setLoading(false); }
  };
  // load() is re-created every render; it should run only when the backend or the question id changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [backend, id]);

  const unitsOf = useMemo(() => units.filter((u) => u.subjectId === f.subjectId), [units, f.subjectId]); const topicsOf = useMemo(() => topics.filter((t) => t.unitId === f.unitId), [topics, f.unitId]);
  const bilingual = !!f.stemHi.trim() && f.opts.every((o) => o.hi.trim());
  const status = detail ? str((detail.version as { status?: string }).status, 'draft') : 'draft'; const editingLocked = false;
  const problems: string[] = [];
  if (!f.subjectId || !f.unitId || !f.topicId) problems.push('Choose a subject, unit and topic.');
  if (!f.stemEn.trim()) problems.push('Write the question.'); if (f.opts.some((o) => !o.en.trim())) problems.push('Fill in all four options.');
  if (f.correct.length === 0) problems.push('Mark the correct answer.'); if (f.type === 'mcq_single' && f.correct.length > 1) problems.push('A single-answer question has one correct option.');
  if (f.kind === 'official_pyq' && !f.pyq) problems.push('An official past question needs verified provenance.');

  async function save() {
    if (!backend) return; setBusy(true); setMsg(null);
    const L = (en: string, hi: string) => ({ en: en.trim(), ...(hi.trim() ? { hi: hi.trim() } : {}) });
    try {
      const r = await backend.call('adminSaveQuestion', {
        ...(id ? { questionId: id } : {}),
        meta: { subjectId: f.subjectId, unitId: f.unitId, topicId: f.topicId, difficulty: f.difficulty, languages: bilingual ? ['en', 'hi'] : ['en'] },
        version: { content: { type: f.type, stem: L(f.stemEn, f.stemHi), options: f.opts.map((o) => ({ id: o.id, text: L(o.en, o.hi) })) }, correct: f.correct, ...(f.expEn.trim() ? { explanation: L(f.expEn, f.expHi) } : {}), provenance: { kind: f.kind as 'original', ...(f.source.trim() ? { source: f.source.trim() } : {}), ...(f.sourceYear ? { sourceYear: Number(f.sourceYear) } : {}), copyrightStatus: f.copyright as 'own_work', officialPyqVerified: f.pyq } },
      });
      if (!id) router.replace(`/admin/questions/edit?id=${r.questionId}`); else { setMsg({ tone: 'ok', text: `Saved as version ${r.version}.` }); await load(r.version); }
    } catch (e) { setMsg({ tone: 'error', text: asApiError(e).message }); } finally { setBusy(false); }
  }
  async function move(to: 'draft' | 'review' | 'approved' | 'published') {
    if (!backend || !detail) return; setBusy(true); setMsg(null);
    try { await backend.call('adminTransitionQuestion', { questionId: id, version: (detail.version as { version: number }).version, to }); setMsg({ tone: 'ok', text: `Status is now “${STATUS_TEXT[to]}”.` }); await load((detail.version as { version: number }).version); }
    catch (e) { setMsg({ tone: 'error', text: asApiError(e).message }); } finally { setBusy(false); }
  }
  const toggle = (oid: string) => setF((p) => ({ ...p, correct: p.type === 'mcq_multi' ? (p.correct.includes(oid) ? p.correct.filter((x) => x !== oid) : [...p.correct, oid]) : [oid] }));
  const moves = (TRANSITIONS[status] ?? []).filter((t) => canTransition(role, status, t.to));
  const mine = detail && (detail.version as { createdBy?: string }).createdBy === user?.uid;
  if (loading) return <Spinner />;
  return (
    <>
      <PageHeader title={id ? 'Edit question' : 'New question'} intro={id && detail ? <>Showing version {(detail.version as { version: number }).version} <Pill tone={status === 'published' ? 'ok' : status === 'draft' ? 'neutral' : 'warn'}>{STATUS_TEXT[status] ?? status}</Pill>{status !== 'draft' && ' Saving will create a new draft version and leave this one unchanged.'}</> : 'Write the question, mark the answer and record where it came from.'} actions={<Link className="text-sm font-semibold text-pen-700 underline" href="/admin/questions">Back to questions</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-6">
          <Sheet className="grid gap-4 p-5 sm:grid-cols-2"><h2 className="text-xl sm:col-span-2">Where it belongs</h2>
            <Select label="Subject" value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value, unitId: '', topicId: '' })}><option value="">Choose…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name.en}</option>)}</Select>
            <Select label="Unit" value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value, topicId: '' })} disabled={!f.subjectId}><option value="">Choose…</option>{unitsOf.map((u) => <option key={u.id} value={u.id}>{u.name.en}</option>)}</Select>
            <Select label="Topic" value={f.topicId} onChange={(e) => setF({ ...f, topicId: e.target.value })} disabled={!f.unitId}><option value="">Choose…</option>{topicsOf.map((t) => <option key={t.id} value={t.id}>{t.name.en}</option>)}</Select>
            <Select label="Difficulty" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value as Difficulty })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select>
          </Sheet>
          <Sheet className="grid gap-4 p-5"><h2 className="text-xl">Question</h2>
            <Select label="Answer type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Form['type'], correct: e.target.value === 'mcq_single' ? f.correct.slice(0, 1) : f.correct })}><option value="mcq_single">One correct option</option><option value="mcq_multi">More than one correct option</option></Select>
            <Textarea label="Question (English)" rows={3} value={f.stemEn} onChange={(e) => setF({ ...f, stemEn: e.target.value })} /><Textarea label="Question (Hindi, optional)" lang="hi" rows={3} value={f.stemHi} onChange={(e) => setF({ ...f, stemHi: e.target.value })} />
            <fieldset className="grid gap-3"><legend className="mb-1 font-semibold">Options and correct answer</legend>
              {f.opts.map((o, i) => (
                <div key={o.id} className="grid gap-2 rounded-sheet border border-line p-3 sm:grid-cols-[auto_1fr_1fr] sm:items-start">
                  <label className="flex items-center gap-2 pt-2 font-semibold"><input type={f.type === 'mcq_multi' ? 'checkbox' : 'radio'} name="correct" checked={f.correct.includes(o.id)} onChange={() => toggle(o.id)} className="size-5 accent-pen-700" /><span>{o.id.toUpperCase()}<span className="sr-only"> is correct</span></span></label>
                  <Input label={`Option ${o.id.toUpperCase()} (English)`} value={o.en} onChange={(e) => setF({ ...f, opts: f.opts.map((x, k) => (k === i ? { ...x, en: e.target.value } : x)) })} /><Input label={`Option ${o.id.toUpperCase()} (Hindi)`} lang="hi" value={o.hi} onChange={(e) => setF({ ...f, opts: f.opts.map((x, k) => (k === i ? { ...x, hi: e.target.value } : x)) })} />
                </div>
              ))}
            </fieldset>
            <Textarea label="Explanation (English)" rows={3} value={f.expEn} onChange={(e) => setF({ ...f, expEn: e.target.value })} hint="Shown to students only after the test, when review opens." /><Textarea label="Explanation (Hindi, optional)" lang="hi" rows={3} value={f.expHi} onChange={(e) => setF({ ...f, expHi: e.target.value })} />
            <p className="text-sm text-muted">{bilingual ? 'This question will be offered in English and Hindi.' : 'Add a Hindi stem and all four Hindi options to offer it in both languages.'}</p>
          </Sheet>
          <Sheet className="grid gap-4 p-5 sm:grid-cols-2"><h2 className="text-xl sm:col-span-2">Provenance</h2>
            <Select label="Origin" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="original">Original work</option><option value="synthetic_demo">Synthetic demo</option><option value="licensed">Licensed</option><option value="official_pyq">Official past question</option></Select>
            <Select label="Copyright status" value={f.copyright} onChange={(e) => setF({ ...f, copyright: e.target.value })} hint="“Unknown” blocks publishing."><option value="own_work">Own work</option><option value="licensed">Licensed</option><option value="public_domain">Public domain</option><option value="unknown">Unknown</option></Select>
            <Input label="Source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /><Input label="Source year" type="number" value={f.sourceYear} onChange={(e) => setF({ ...f, sourceYear: e.target.value })} />
            {f.kind === 'official_pyq' && <div className="sm:col-span-2"><Check checked={f.pyq} onChange={(e) => setF({ ...f, pyq: e.target.checked })} label="I checked this question against the official paper and its answer key." /></div>}
          </Sheet>
        </div>
        <div className="grid h-fit gap-6">
          <Sheet className="p-5"><h2 className="text-xl">Save</h2>
            {problems.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-muted">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            {msg && <Alert tone={msg.tone} className="mt-3">{msg.text}</Alert>}
            <Button className="mt-4 w-full" onClick={save} busy={busy} disabled={problems.length > 0 || editingLocked} data-testid="save-question">{id ? 'Save changes' : 'Create question'}</Button>
          </Sheet>
          {id && detail && (
            <Sheet className="p-5"><h2 className="text-xl">Review workflow</h2>
              <p className="mt-2 text-sm text-muted">Version {(detail.version as { version: number }).version} is <strong>{STATUS_TEXT[status]}</strong>.{mine && status === 'review' && ' You wrote this version, so someone else must approve it.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">{moves.length === 0 ? <p className="text-sm text-muted">Your role has no next step for this status.</p> : moves.map((t) => <Button key={t.to} variant={t.to === 'draft' ? 'secondary' : 'primary'} onClick={() => void move(t.to as 'draft')} disabled={busy} data-testid={`move-${t.to}`}>{TO_LABEL[t.to]}</Button>)}</div>
              <h3 className="mt-5 text-base">Versions</h3>
              <ul className="mt-2 grid gap-1.5 text-sm">{detail.versions.map((v) => <li key={v.version}><button type="button" className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-pen-50" onClick={() => void load(v.version)}><span>Version {v.version}{v.version === (detail.version as { version: number }).version && ' (viewing)'}</span><span className="text-muted">{STATUS_TEXT[v.status] ?? v.status}{v.createdAtMs ? `, ${fmtDateTime(v.createdAtMs)}` : ''}</span></button></li>)}</ul>
            </Sheet>
          )}
        </div>
      </div>
    </>
  );
}
export default function Page() { return <Suspense><Body /></Suspense>; }
