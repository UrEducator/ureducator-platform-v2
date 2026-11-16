'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFrame } from '@/components/AuthFrame';
import { Alert, Button, Input, toast } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { safeNext } from '@/lib/nav';
import { asApiError } from '@/lib/types';
import { useDocumentTitle } from '@/lib/hooks';

function Form() {
  useDocumentTitle('Sign in');
  const { backend, envError, status } = useAuth();
  const router = useRouter();
  const q = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Auto-redirect to dashboard if already authenticated
  useEffect(() => {
    if (status === 'in') {
      router.replace(safeNext(q.get('next')));
    }
  }, [status, router, q]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    if (!backend) {
      setError('Authentication service is still initializing. Please try again in a moment.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await backend.auth.signIn(email.trim(), password);
      router.replace(safeNext(q.get('next')));
    } catch (x) {
      const err = asApiError(x);
      const msg = err.message || 'Unable to sign in. Please verify your email and password.';
      setError(msg);
      toast({
        title: 'Sign-in Failed',
        description: msg,
        tone: 'error',
      });
    } finally {
      // Strictly reset loading state to prevent infinite spinner
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Welcome back"
      intro="Sign in to continue your practice, review your results and pick up where you stopped."
      footer={
        <p>
          New here?{' '}
          <Link
            className="font-semibold text-pen-700 underline"
            href={`/signup${q.get('next') ? `?next=${encodeURIComponent(q.get('next') as string)}` : ''}`}
          >
            Create a free account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {envError && <Alert tone="error" title="Sign-in is unavailable">{envError}</Alert>}
        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" busy={busy} disabled={!backend || !email || !password}>
          Sign in
        </Button>
        <Link href="/forgot-password" className="text-sm font-semibold text-pen-700 underline">
          Forgot your password?
        </Link>
      </form>
    </AuthFrame>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
