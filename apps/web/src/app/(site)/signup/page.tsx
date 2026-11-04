'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFrame } from '@/components/AuthFrame';
import { Alert, Button, Check, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { safeNext } from '@/lib/nav';
import { asApiError } from '@/lib/types';
import { useDocumentTitle } from '@/lib/hooks';

function Form() {
  useDocumentTitle('Create your account');
  const { backend, envError } = useAuth(); const router = useRouter(); const q = useSearchParams();
  const [f, setF] = useState({ name: '', email: '', password: '', agree: false }); const [err, setErr] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [fail, setFail] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email address.';
    if (f.password.length < 8) er.password = 'Use at least 8 characters.';
    if (!f.agree) er.agree = 'Tick the box to continue.';
    setErr(er); setFail(''); if (Object.keys(er).length || !backend) return;
    setBusy(true);
    try { await backend.auth.signUp(f.email.trim(), f.password, f.name.trim()); router.replace(`/verify-email?next=${encodeURIComponent(safeNext(q.get('next')))}`); } catch (x) { setFail(asApiError(x).message); setBusy(false); }
  }
  return (
    <AuthFrame title="Create your free account" intro="Free practice tests, an error notebook and a revision planner. We will ask you to confirm your email before your first test." footer={<p>Already have an account? <Link className="font-semibold text-pen-700 underline" href="/login">Sign in</Link></p>}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {envError && <Alert tone="error" title="Sign-up is unavailable">{envError}</Alert>}
        <Input label="Full name" name="name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={err.name} />
        <Input label="Email address" type="email" name="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={err.email} />
        <Input label="Password" type="password" name="password" autoComplete="new-password" hint="At least 8 characters." value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={err.password} />
        <Check name="agree" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} error={err.agree} label={<>I have read the <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy" className="underline">privacy notice</Link>. I understand scores here are practice scores.</>} />
        {fail && <Alert tone="error">{fail}</Alert>}
        <Button type="submit" busy={busy} disabled={!backend}>Create account</Button>
      </form>
    </AuthFrame>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
