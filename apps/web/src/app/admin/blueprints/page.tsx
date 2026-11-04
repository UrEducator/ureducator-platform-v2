'use client';
import { useState } from 'react';
import { DEFAULT_BLUEPRINT, maxMarks, totalQuestions, type Blueprint } from '@ureducator/shared';
import { Alert, Button, Check, Input, PageHeader, Select, Sheet, Spinner, Table, Td } from '@/components/ui';
import { useCan } from '@/components/AdminShell';
import { num, str, useAdminList } from '@/lib/adminHooks';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

type Sec = { id: string; title: string; paper: 'paper1' | 'paper2'; questionCount: number };
export default function Page() {
  useDocumentTitle('Blueprints'); const can = useCan(); const { backend } = useAuth(); const l = useAdminList('examBlueprints', undefined, 50);
  const [f, setF] = useState({ id: '', name: '', durationMinutes: 180, correct: 2, incorrect: 0, unattempted: 0, hi: true, official: false }); const [secs, setSecs] = useState<Sec[]>(DEFAULT_BLUEPRINT.sections.map((s) => ({ id: s.id, title: s.title.en, paper: s.paper, questionCount: s.questionCount })));
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const edit = (b: Record<string, unknown>) => { const bp = b as unknown as Blueprint; setF({ id: bp.id, name: bp.name, durationMinutes: bp.durationMinutes, correct: bp.marking.correct, incorrect: bp.marking.incorrect, unattempted: bp.marking.unattempted, hi: bp.languages.includes('hi'), official: bp.officialPatternVerified }); setSecs(bp.sections.map((s) => ({ id: s.id, title: s.title.en, paper: s.paper, questionCount: s.questionCount }))); setMsg(null); window.scrollTo({ top: 0 }); };
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!backend) return; setBusy(true); setMsg(null);
    try {
      const r = await backend.call('adminUpsertBlueprint', { blueprint: { id: f.id, name: f.name.trim(), version: 1, durationMinutes: f.durationMinutes, sections: secs.map((s) => ({ id: s.id, title: { en: s.title }, paper: s.paper, questionCount: s.questionCount })), marking: { correct: f.correct, incorrect: f.incorrect, unattempted: f.unattempted, multiCorrectPolicy: 'all_or_nothing' }, languages: f.hi ? ['en', 'hi'] : ['en'], officialPatternVerified: f.official } });
      setMsg({ tone: 'ok', text: `Saved version ${r.version}.${f.official && !r.officialPatternVerified ? ' The “matches the official pattern” flag was not applied: only a super administrator or the owner can set it.' : ''}` }); l.reload();
    } catch (x) { setMsg({ tone: 'error', text: asApiError(x).message }); } finally { setBusy(false); }
  }
  const total = secs.reduce((n, s) => n + s.questionCount, 0);
  const idOk = /^[a-z0-9_-]{2,60}$/.test(f.id);
  return (
    <>
      <PageHeader title="Blueprints" intro="A blueprint defines sections, question counts, duration and marking. The default practice blueprint is Paper I 50 + Paper II 100 = 150 questions, 2 marks each, 180 minutes, no negative marking. It is not labelled as the official NTA pattern until someone verifies it." />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div>{l.loading ? <Spinner /> : l.error ? <Alert tone="error">{l.error}</Alert> : (
          <Table caption="Blueprints" head={['Blueprint', 'Questions', 'Marks', 'Minutes', 'Official pattern', '']}>
            {l.items.map((b) => { const bp = b as unknown as Blueprint; return <tr key={b.id}><Td className="font-medium">{str(b.name)}<br /><span className="font-mono text-xs text-muted">{b.id} · v{num(b.version, 1)}</span></Td><Td className="tabular-nums">{totalQuestions(bp)}</Td><Td className="tabular-nums">{maxMarks(bp)}</Td><Td className="tabular-nums">{bp.durationMinutes}</Td><Td>{bp.officialPatternVerified ? 'Verified' : 'Not verified'}</Td><Td>{can('tests.write') && <button type="button" className="font-semibold text-pen-700 underline" onClick={() => edit(b)}>Edit</button>}</Td></tr>; })}
          </Table>
        )}</div>
        {can('tests.write') && (
          <Sheet className="h-fit p-5"><h2 className="text-xl">Add or update</h2>
            <form onSubmit={save} className="mt-4 grid gap-3">
              <Input label="Identifier" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} hint="Lower-case letters, numbers, - and _. An existing identifier is updated." error={f.id && !idOk ? 'Use lower-case letters, numbers, - and _.' : undefined} />
              <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <Input label="Duration (minutes)" type="number" min={1} max={600} value={f.durationMinutes} onChange={(e) => setF({ ...f, durationMinutes: Number(e.target.value) })} />
              <div className="grid grid-cols-3 gap-2"><Input label="Correct" type="number" step="0.5" value={f.correct} onChange={(e) => setF({ ...f, correct: Number(e.target.value) })} /><Input label="Wrong" type="number" step="0.5" max={0} value={f.incorrect} onChange={(e) => setF({ ...f, incorrect: Number(e.target.value) })} /><Input label="Skipped" type="number" step="0.5" max={0} value={f.unattempted} onChange={(e) => setF({ ...f, unattempted: Number(e.target.value) })} /></div>
              <fieldset className="grid gap-2"><legend className="font-semibold">Sections ({total} questions)</legend>
                {secs.map((s, i) => (<div key={i} className="grid grid-cols-[1fr_6rem] gap-2 rounded-sheet border border-line p-2"><Input label="Section id" value={s.id} onChange={(e) => setSecs(secs.map((x, k) => (k === i ? { ...x, id: e.target.value } : x)))} /><Input label="Questions" type="number" min={1} value={s.questionCount} onChange={(e) => setSecs(secs.map((x, k) => (k === i ? { ...x, questionCount: Number(e.target.value) } : x)))} /><Input label="Title" value={s.title} onChange={(e) => setSecs(secs.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} /><Select label="Paper" value={s.paper} onChange={(e) => setSecs(secs.map((x, k) => (k === i ? { ...x, paper: e.target.value as Sec['paper'] } : x)))}><option value="paper1">Paper I</option><option value="paper2">Paper II</option></Select>{secs.length > 1 && <button type="button" className="col-span-2 text-left text-sm font-semibold text-bad underline" onClick={() => setSecs(secs.filter((_, k) => k !== i))}>Remove section</button>}</div>))}
                <Button type="button" variant="secondary" size="sm" onClick={() => setSecs([...secs, { id: `section${secs.length + 1}`, title: '', paper: 'paper2', questionCount: 10 }])}>Add a section</Button>
              </fieldset>
              <Check checked={f.hi} onChange={(e) => setF({ ...f, hi: e.target.checked })} label="Offer English and Hindi" />
              <Check checked={f.official} disabled={!can('settings.write')} onChange={(e) => setF({ ...f, official: e.target.checked })} label="This matches the current official pattern" error={!can('settings.write') ? undefined : undefined} />
              {!can('settings.write') && <p className="text-xs text-muted">Only a super administrator or the owner can mark a blueprint as matching the official pattern.</p>}
              {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
              <Button type="submit" busy={busy} disabled={!idOk || !f.name.trim() || secs.some((s) => !/^[a-z0-9_-]{2,40}$/.test(s.id) || !s.title.trim())}>Save blueprint</Button>
            </form>
          </Sheet>
        )}
      </div>
    </>
  );
}
