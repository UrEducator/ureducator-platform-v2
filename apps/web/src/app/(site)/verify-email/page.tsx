'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFrame } from '@/components/AuthFrame';
import { Alert, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { safeNext } from '@/lib/nav';
import { mockVerifyEmail } from '@/lib/mockTools';
import { asApiError } from '@/lib/types';
import { useDocumentTitle } from '@/lib/hooks';

function Body() {
  useDocumentTitle('Confirm your email');
  const a = useAuth(); const router = useRouter(); const q = useSearchParams(); const next = safeNext(q.get('next'));
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null); const [busy, setBusy] = useState(false); const [cool, setCool] = useState(0);
  useEffect(() => { if (a.status === 'out' && !a.envError) router.replace('/login'); if (a.user?.emailVerified) router.replace(next); }, [a.status, a.user, a.envError, router, next]);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  async function check() { setBusy(true); setMsg(null); try { const u = await a.refresh(); if (u?.emailVerified) router.replace(next); else setMsg({ tone: 'warn', text: 'We have not seen the confirmation yet. Open the link in the email, then try again.' }); } catch (x) { setMsg({ tone: 'error', text: asApiError(x).message }); } finally { setBusy(false); } }
  async function resend() { if (!a.backend) return; try { await a.backend.auth.resendVerification(); setMsg({ tone: 'ok', text: 'A new email is on its way.' }); setCool(60); } catch (x) { setMsg({ tone: 'error', text: asApiError(x).message }); } }
  return (
    <AuthFrame title="Confirm your email" intro="Tests need a confirmed email so your results stay yours.">
      <p className="mb-4">We sent a link to <strong className="break-all">{a.user?.email ?? 'your email address'}</strong>. Open it, then come back and press the button below.</p>
      <div className="grid gap-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button onClick={check} busy={busy}>I have confirmed my email</Button>
        <Button variant="secondary" onClick={resend} disabled={cool > 0}>{cool > 0 ? `Send again in ${cool}s` : 'Send the email again'}</Button>
        <Button variant="ghost" onClick={() => void a.signOut().then(() => router.replace('/'))}>Use a different account</Button>
        {process.env.NEXT_PUBLIC_BACKEND === 'mock' && <Button variant="marker" onClick={async () => { await mockVerifyEmail(); await check(); }}>Test build only: simulate clicking the email link</Button>}
      </div>
    </AuthFrame>
  );
}
export default function Page() { return <Suspense><Body /></Suspense>; }
