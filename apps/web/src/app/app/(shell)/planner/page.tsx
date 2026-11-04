'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ClipboardCheck, PenLine, RotateCcw } from 'lucide-react';
import type { PlanTask } from '@ureducator/shared';
import { Alert, Button, Empty, PageHeader, Sheet, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useDocumentTitle, useLoad } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

const ICON = { learn: BookOpen, practice: PenLine, revise: RotateCcw, mock: ClipboardCheck } as const;
const todayKey = () => new Date().toISOString().slice(0, 10);
export default function Page() {
  useDocumentTitle('Planner'); const { backend, user } = useAuth(); const uid = user?.uid ?? '';
  const stored = useLoad((b) => b.reads.studyPlan(uid), [uid]); const [tasks, setTasks] = useState<PlanTask[] | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState<Record<string, true>>({});
  const key = `ur.plan.done.${uid}`;
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(key) ?? '{}')); } catch { /* storage unavailable: ticks last for this visit only */ } }, [key]);
  useEffect(() => { if (stored.data) setTasks(stored.data.tasks); }, [stored.data]);
  const toggle = (id: string) => setDone((d) => { const n = { ...d }; if (n[id]) delete n[id]; else n[id] = true; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* ignore */ } return n; });
  async function make() { if (!backend) return; setBusy(true); setErr(''); try { setTasks((await backend.call('generatePlan', {})).tasks); } catch (e) { setErr(asApiError(e).message); } finally { setBusy(false); } }
  const days = useMemo(() => { const m = new Map<string, PlanTask[]>(); for (const t of tasks ?? []) m.set(t.date, [...(m.get(t.date) ?? []), t]); return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [tasks]);
  const today = todayKey(); const total = tasks?.length ?? 0; const finished = (tasks ?? []).filter((t) => done[t.id]).length;
  return (
    <>
      <PageHeader title="Study planner" intro="A seven-day plan built from your weak topics, your due notebook questions and the minutes per day you set in Settings. Make a new one after each test." actions={<Button onClick={make} busy={busy} variant={tasks ? 'secondary' : 'primary'}>{tasks ? 'Rebuild my plan' : 'Create my plan'}</Button>} />
      {err && <Alert tone="error" className="mb-4">{err}</Alert>}
      {stored.loading ? <Spinner /> : !tasks ? <Empty title="No plan yet">Create a plan and it will list what to learn, practise and revise each day. Take a mock test first to make it specific to you.</Empty> : (
        <>
          <p className="mb-4 text-[15px]" aria-live="polite">{finished} of {total} tasks done. <span className="text-muted">Ticks are saved on this device only.</span></p>
          <div className="grid gap-4 md:grid-cols-2">
            {days.map(([date, list]) => (
              <Sheet key={date} className={cn('p-5', date === today && 'border-pen-600 ring-1 ring-pen-600')} aria-label={date}>
                <h2 className="text-lg">{new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}{date === today && <span className="ml-2 rounded-full bg-marker px-2 py-0.5 align-middle text-xs font-semibold text-ink">Today</span>}</h2>
                <ul className="mt-3 grid gap-2">{list.map((t) => { const I = ICON[t.kind]; return (
                  <li key={t.id}><label className="flex cursor-pointer items-start gap-3 rounded-md p-1.5 hover:bg-pen-50"><input type="checkbox" className="mt-1 size-5 accent-pen-700" checked={!!done[t.id]} onChange={() => toggle(t.id)} /><I aria-hidden className="mt-0.5 size-5 shrink-0 text-pen-700" /><span className={cn('flex-1', done[t.id] && 'text-muted line-through')}>{t.title}</span><span className="shrink-0 text-sm text-muted">{t.minutes} min</span></label></li>
                ); })}</ul>
              </Sheet>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">Revision tasks follow your <Link href="/app/notebook" className="font-semibold text-pen-700 underline">error notebook</Link> schedule.</p>
        </>
      )}
    </>
  );
}
