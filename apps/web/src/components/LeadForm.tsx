'use client';
import { useState } from 'react';
import { Alert, Button, Check, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { asApiError } from '@/lib/types';

/** Captures a name, one way to reach the person and explicit consent. In staging nothing is sent to anyone. */
export function LeadForm({ source = 'website' }: { source?: string }) {
  const { backend } = useAuth();
  const [f, setF] = useState({ name: '', email: '', consent: false }); const [err, setErr] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [fail, setFail] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = 'Enter your name.'; if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email address.'; if (!f.consent) er.consent = 'Tick the box to agree to be contacted.';
    setErr(er); setFail(''); if (Object.keys(er).length || !backend) return;
    setBusy(true);
    try { await backend.call('captureLead', { name: f.name.trim(), email: f.email.trim(), source, consent: true, contactPreference: 'email' }); setDone(true); }
    catch (x) { setFail(asApiError(x).message); } finally { setBusy(false); }
  }
  if (done) return <Alert tone="ok" title="You are on the list">We will email you when verified practice content is ready. This is a staging preview, so no message is sent from here.</Alert>;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Input label="Your name" name="name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={err.name} />
      <Input label="Email address" name="email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={err.email} />
      <Check name="consent" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} error={err.consent} label="I agree that UrEducator may email me about verified test releases. I can withdraw this at any time." />
      {fail && <Alert tone="error">{fail}</Alert>}
      <Button type="submit" busy={busy}>Notify me</Button>
    </form>
  );
}
