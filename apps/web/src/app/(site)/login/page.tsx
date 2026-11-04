'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFrame } from '@/components/AuthFrame';
import { Alert, Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { safeNext } from '@/lib/nav';
import { asApiError } from '@/lib/types';
import { useDocumentTitle } from '@/lib/hooks';

function Form() {
  useDocumentTitle('Sign in');
  const { backend, envError } = useAuth(); const router = useRouter(); const q = useSearchParams();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!backend) return; setBusy(true); setError('');
    try { await backend.auth.signIn(email.trim(), password); router.replace(safeNext(q.get('next'))); } catch (x) { setError(asApiError(x).message); setBusy(false); }
  }
  return (
    <AuthFrame title="Welcome back" intro="Sign in to continue your practice, review your results and pick up where you stopped." footer={<p>New here? <Link className="font-semibold text-pen-700 underline" href={`/signup${q.get('next') ? `?next=${encodeURIComponent(q.get('next') as string)}` : ''}`}>Create a free account</Link></p>}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {envError && <Alert tone="error" title="Sign-in is unavailable">{envError}</Alert>}
        <Input label="Email address" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" busy={busy} disabled={!backend || !email || !password}>Sign in</Button>
        <Link href="/forgot-password" className="text-sm font-semibold text-pen-700 underline">Forgot your password?</Link>
      </form>
    </AuthFrame>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
