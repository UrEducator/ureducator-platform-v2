'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, Button, PageHeader, Sheet } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useDocumentTitle } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

/** One-time bootstrap. The server accepts it only from the verified email configured at deploy time, and only once. */
export default function Page() {
  useDocumentTitle('Claim owner access'); const { backend, refresh, user } = useAuth(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  async function claim() {
    if (!backend) return;
    setBusy(true);
    setMsg(null);
    try {
      await backend.call('claimOwner', {});
      await refresh();
      setMsg({ tone: 'ok', text: 'You are now the owner.' });
    } catch (e) {
      const err = asApiError(e);
      let text = err.message;
      if (err.reason === 'FORBIDDEN') {
        text = 'This account cannot claim ownership. Ensure you are signed in with the authorised owner address and that your email is verified.';
      } else if (err.reason === 'OWNER_ALREADY_CLAIMED') {
        text = 'Platform ownership has already been claimed.';
      } else if (err.reason === 'BOOTSTRAP_DISABLED') {
        text = 'Owner bootstrap is not configured in this environment.';
      }
      setMsg({ tone: 'error', text });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Claim owner access" intro="This works once, and only for the email address that was set when this environment was configured. Anyone else is refused." />
      <Sheet className="max-w-xl p-6"><p>Signed in as <strong className="break-all">{user?.email}</strong>.</p>
        {msg && <Alert tone={msg.tone} className="mt-4">{msg.text} {msg.tone === 'ok' && <Link href="/admin" className="font-semibold underline">Open the content studio</Link>}</Alert>}
        <Button className="mt-4" onClick={claim} busy={busy} data-testid="claim-owner">Claim owner access</Button></Sheet>
    </>
  );
}
