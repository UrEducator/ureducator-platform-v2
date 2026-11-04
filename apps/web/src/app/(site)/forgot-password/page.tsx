'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AuthFrame } from '@/components/AuthFrame';
import { Alert, Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { asApiError } from '@/lib/types';
import { useDocumentTitle } from '@/lib/hooks';

export default function Page() {
  useDocumentTitle('Reset your password');
  const { backend } = useAuth(); const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!backend) return; setBusy(true); setErr(''); try { await backend.auth.sendReset(email.trim()); setDone(true); } catch (x) { setErr(asApiError(x).message); } finally { setBusy(false); } }
  return (
    <AuthFrame title="Reset your password" intro="Enter your account email and we will send you a link to choose a new password." footer={<p><Link className="font-semibold text-pen-700 underline" href="/login">Back to sign in</Link></p>}>
      {done ? <Alert tone="ok" title="Check your email">If an account exists for that address, a reset link is on its way. It can take a few minutes.</Alert> : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Input label="Email address" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {err && <Alert tone="error">{err}</Alert>}
          <Button type="submit" busy={busy} disabled={!backend || !email}>Send reset link</Button>
        </form>
      )}
    </AuthFrame>
  );
}
