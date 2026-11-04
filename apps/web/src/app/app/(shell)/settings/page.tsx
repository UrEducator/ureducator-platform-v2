'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Button, Input, PageHeader, Select, Sheet, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle, useLoad } from '@/lib/hooks';
import { useNames } from '@/lib/names';
import { asApiError } from '@/lib/types';

export function ProfileForm({ onDone, submitLabel = 'Save changes', completing = false }: { onDone?: () => void; submitLabel?: string; completing?: boolean }) {
  const { backend, user } = useAuth(); const uid = user?.uid ?? ''; const p = useLoad((b) => b.reads.profile(uid), [uid]); const { subjects } = useNames();
  const [f, setF] = useState({ displayName: '', preferredPaper2Subject: '', studyGoal: '', examTarget: '', studyMinutesPerDay: '60' }); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  useEffect(() => { if (p.data) setF({ displayName: p.data.displayName ?? '', preferredPaper2Subject: p.data.preferredPaper2Subject ?? '', studyGoal: p.data.studyGoal ?? '', examTarget: p.data.examTarget ?? '', studyMinutesPerDay: String(p.data.studyMinutesPerDay ?? 60) }); }, [p.data]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!backend) return; setBusy(true); setMsg(null);
    try {
      await backend.call('updateProfile', { displayName: f.displayName.trim(), preferredPaper2Subject: f.preferredPaper2Subject || null, studyGoal: (f.studyGoal || null) as 'qualify_net' | null, examTarget: f.examTarget || null, studyMinutesPerDay: Number(f.studyMinutesPerDay), ...(completing ? { onboardingComplete: true } : {}) });
      setMsg({ tone: 'ok', text: 'Saved.' }); onDone?.();
    } catch (x) { setMsg({ tone: 'error', text: asApiError(x).message }); } finally { setBusy(false); }
  }
  if (p.loading) return <Spinner />;
  return (
    <form onSubmit={save} className="grid gap-4" noValidate>
      <Input label="Name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
      <Select label="What are you aiming for?" value={f.studyGoal} onChange={(e) => setF({ ...f, studyGoal: e.target.value })}><option value="">Not decided</option><option value="qualify_net">Qualify for NET</option><option value="jrf">Junior Research Fellowship</option><option value="assistant_professor">Assistant Professor eligibility</option><option value="phd_entrance">PhD admission</option></Select>
      <Select label="Paper II subject" value={f.preferredPaper2Subject} onChange={(e) => setF({ ...f, preferredPaper2Subject: e.target.value })} hint="The official subject list is still being verified, so only sample subjects are shown."><option value="">Not chosen yet</option>{subjects.filter((s) => s.paper === 'paper2').map((s) => <option key={s.id} value={s.id}>{s.name.en}</option>)}</Select>
      <Select label="Target exam session" value={f.examTarget} onChange={(e) => setF({ ...f, examTarget: e.target.value })}><option value="">Not decided</option>{['2026-12', '2027-06', '2027-12', '2028-06'].map((x) => <option key={x} value={x}>{new Date(x + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>)}</Select>
      <Input label="Study minutes per day" type="number" min={15} max={720} value={f.studyMinutesPerDay} onChange={(e) => setF({ ...f, studyMinutesPerDay: e.target.value })} hint="Between 15 and 720. Your planner uses this." />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" busy={busy}>{submitLabel}</Button>
    </form>
  );
}

export default function Page() {
  useDocumentTitle('Settings'); const { user } = useAuth();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Sheet className="p-6"><h2 className="text-xl">Your preparation</h2><div className="mt-4"><ProfileForm /></div></Sheet>
        <Sheet className="h-fit p-6"><h2 className="text-xl">Account</h2><dl className="mt-4 grid gap-3 text-[15px]"><div><dt className="text-sm text-muted">Email</dt><dd className="break-all">{user?.email}</dd></div><div><dt className="text-sm text-muted">Email status</dt><dd>{user?.emailVerified ? 'Confirmed' : 'Not confirmed'}</dd></div></dl><p className="mt-5 text-sm text-muted">To export or delete your data, <Link href="/contact" className="font-semibold text-pen-700 underline">contact support</Link>.</p></Sheet>
      </div>
    </>
  );
}
