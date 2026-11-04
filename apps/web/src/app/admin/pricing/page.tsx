'use client';
import { useState } from 'react';
import { Alert, Button, Check, Input, PageHeader, Pill, Sheet, Spinner, Table, Td } from '@/components/ui';
import { useCan } from '@/components/AdminShell';
import { num, str, useAdminList } from '@/lib/adminHooks';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

const inr = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
export default function Page() {
  useDocumentTitle('Pricing (admin)'); const can = useCan(); const { backend } = useAuth(); const l = useAdminList('plans', undefined, 50);
  const [f, setF] = useState({ planId: '', name: '', rupees: '', days: '365', ent: 'all_tests', published: false }); const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null); const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!backend) return; setBusy(true); setMsg(null);
    try { await backend.call('adminUpsertPlan', { planId: f.planId, name: f.name.trim(), pricePaise: Math.round(Number(f.rupees) * 100), durationDays: Number(f.days), entitlements: f.ent.split(',').map((s) => s.trim()).filter(Boolean), published: f.published }); setMsg({ tone: 'ok', text: 'Saved.' }); l.reload(); }
    catch (x) { setMsg({ tone: 'error', text: asApiError(x).message }); } finally { setBusy(false); }
  }
  const ok = /^[A-Za-z0-9_-]{1,80}$/.test(f.planId) && f.name.trim().length >= 2 && Number(f.rupees) >= 0 && f.rupees !== '' && Number(f.days) >= 1;
  return (
    <>
      <PageHeader title="Pricing" intro="Prices are configuration, not code. Nothing is published by default, and nobody can buy anything while payments are switched off. The server is the only source of prices: the app never sends an amount." />
      <Alert tone="warn" className="mb-6" title="Payments are off">Publishing a plan only makes its price visible on the pricing page. Checkout stays disabled until the owner authorises the payment phase.</Alert>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div>{l.loading ? <Spinner /> : l.error ? <Alert tone="error">{l.error}</Alert> : !l.items.length ? <Alert tone="info">No plans have been drafted.</Alert> : (
          <Table caption="Plans" head={['Plan', 'Price', 'Days', 'Entitlements', 'Status']}>{l.items.map((p) => <tr key={p.id}><Td className="font-medium">{str(p.name)}<br /><span className="font-mono text-xs text-muted">{p.id}</span></Td><Td className="tabular-nums">{inr(num(p.pricePaise))}</Td><Td className="tabular-nums">{num(p.durationDays)}</Td><Td>{Array.isArray(p.entitlements) ? (p.entitlements as string[]).join(', ') : ''}</Td><Td><Pill tone={p.published ? 'ok' : 'neutral'}>{p.published ? 'Published' : 'Draft'}</Pill></Td></tr>)}</Table>
        )}</div>
        {can('pricing.write') && (
          <Sheet className="h-fit p-5"><h2 className="text-xl">Draft a plan</h2>
            <form onSubmit={save} className="mt-4 grid gap-3">
              <Input label="Identifier" value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })} hint="Letters, numbers, - and _." /><Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <Input label="Price in rupees" type="number" min={0} step="1" value={f.rupees} onChange={(e) => setF({ ...f, rupees: e.target.value })} hint="Decide this before publishing. There is no built-in price." />
              <Input label="Access lasts (days)" type="number" min={1} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /><Input label="Entitlements (comma separated)" value={f.ent} onChange={(e) => setF({ ...f, ent: e.target.value })} />
              <Check checked={f.published} disabled={!can('settings.write')} onChange={(e) => setF({ ...f, published: e.target.checked })} label="Show this price on the pricing page" />
              {!can('settings.write') && <p className="text-xs text-muted">Only a super administrator or the owner can publish a price.</p>}
              {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}<Button type="submit" busy={busy} disabled={!ok}>Save plan</Button>
            </form>
          </Sheet>
        )}
      </div>
    </>
  );
}
