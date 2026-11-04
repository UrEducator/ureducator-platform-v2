'use client';
import Link from 'next/link';
import { useState } from 'react';
import { LeadForm } from '@/components/LeadForm';
import { Alert, Button, Input, Select, Sheet, Textarea } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { asApiError } from '@/lib/types';
import { useDocumentTitle } from '@/lib/hooks';

function Ticket() {
  const { backend } = useAuth(); const [f, setF] = useState({ subject: '', message: '', category: 'technical' }); const [err, setErr] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false); const [fail, setFail] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); const er: Record<string, string> = {};
    if (f.subject.trim().length < 3) er.subject = 'Write a short subject (3 characters or more).'; if (f.message.trim().length < 10) er.message = 'Describe the problem in at least 10 characters.';
    setErr(er); setFail(''); if (Object.keys(er).length || !backend) return; setBusy(true);
    try { await backend.call('createTicket', { subject: f.subject.trim(), message: f.message.trim(), category: f.category as 'technical' }); setOk(true); } catch (x) { setFail(asApiError(x).message); } finally { setBusy(false); }
  }
  if (ok) return <Alert tone="ok" title="Message received">We will reply to the email on your account.</Alert>;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Select label="Topic" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="technical">Something is not working</option><option value="account">My account</option><option value="content">A question or answer looks wrong</option><option value="billing">Billing</option><option value="other">Something else</option></Select>
      <Input label="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} error={err.subject} />
      <Textarea label="What happened?" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} error={err.message} hint="Do not include passwords." />
      {fail && <Alert tone="error">{fail}</Alert>}
      <Button type="submit" busy={busy}>Send message</Button>
    </form>
  );
}

export default function Page() {
  useDocumentTitle('Contact'); const { status } = useAuth();
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl sm:text-5xl">Contact</h1>
      <p className="mt-3 max-w-xl text-muted">Signed-in students can send a support message. Everyone else can leave their email to hear about verified releases.</p>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Sheet className="p-6"><h2 className="text-2xl">Support</h2><div className="mt-4">{status === 'in' ? <Ticket /> : <p className="text-muted">Please <Link href="/login?next=/contact" className="font-semibold text-pen-700 underline">sign in</Link> to contact support, so we can find your account.</p>}</div></Sheet>
        <Sheet className="p-6"><h2 className="text-2xl">Stay informed</h2><div className="mt-4"><LeadForm source="contact" /></div></Sheet>
      </div>
    </main>
  );
}
