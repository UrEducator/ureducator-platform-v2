'use client';
import { useState } from 'react';
import { ROLES, type Role } from '@ureducator/shared';
import { Alert, Button, PageHeader, Pill, Select, Spinner, Table, Td } from '@/components/ui';
import { ROLE_LABEL, useCan } from '@/components/AdminShell';
import { str, useAdminList } from '@/lib/adminHooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, useDocumentTitle } from '@/lib/hooks';
import { asApiError } from '@/lib/types';

const ASSIGNABLE = ROLES.filter((r) => r !== 'owner');
export default function Page() {
  useDocumentTitle('People and roles'); const can = useCan(); const { backend, user } = useAuth();
  const canRead = can('students.read'); const canAssign = can('roles.assign');
  const users = useAdminList('users', undefined, 25); const roles = useAdminList('roles', undefined, 50);
  const [pick, setPick] = useState<Record<string, string>>({}); const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null); const [busy, setBusy] = useState('');
  async function apply(uid: string, role: Role | null) {
    if (!backend) return; setBusy(uid); setMsg(null);
    try { await backend.call('assignRole', { uid, role }); setMsg({ tone: 'ok', text: role ? `Role set to ${ROLE_LABEL[role]}. It takes effect the next time that person signs in or refreshes.` : 'Role removed. It takes effect the next time that person signs in or refreshes.' }); roles.reload(); }
    catch (e) { setMsg({ tone: 'error', text: asApiError(e).message }); } finally { setBusy(''); }
  }
  const roleOf = new Map(roles.items.map((r) => [r.id, str(r.role)]));
  return (
    <>
      <PageHeader title="People and roles" intro="Roles are stored in the person’s sign-in token and checked on the server for every action. They are never decided by an email address." />
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      {canAssign && (
        <section className="mb-10" aria-labelledby="h-staff"><h2 id="h-staff" className="mb-3 text-xl">Staff</h2>
          {roles.loading ? <Spinner /> : roles.items.length === 0 ? <Alert tone="info">No staff roles have been assigned yet.</Alert> : (
            <Table caption="Staff" head={['Account', 'Role', '']}>{roles.items.map((r) => <tr key={r.id}><Td className="font-mono text-xs">{r.id}{r.id === user?.uid && <Pill tone="pen"> you</Pill>}</Td><Td>{ROLE_LABEL[str(r.role) as Role] ?? str(r.role)}</Td><Td>{str(r.role) !== 'owner' && r.id !== user?.uid && <Button size="sm" variant="secondary" busy={busy === r.id} onClick={() => void apply(r.id, null)}>Remove role</Button>}</Td></tr>)}</Table>
          )}
        </section>
      )}
      {canRead ? (
        <section aria-labelledby="h-students"><h2 id="h-students" className="mb-3 text-xl">Accounts</h2>
          {users.error ? <Alert tone="error">{users.error}</Alert> : users.loading && !users.items.length ? <Spinner /> : (
            <Table caption="Accounts" head={['Name', 'Email', 'Joined', 'Role', ...(canAssign ? [''] : [])]}>
              {users.items.map((u) => (
                <tr key={u.id}><Td className="font-medium">{str(u.displayName, '–')}</Td><Td className="break-all">{str(u.email, '–')}</Td><Td className="whitespace-nowrap">{typeof u.createdAtMs === 'number' ? fmtDate(u.createdAtMs) : ''}</Td><Td>{roleOf.get(u.id) ? ROLE_LABEL[roleOf.get(u.id) as Role] : 'Student'}</Td>
                  {canAssign && <Td>{u.id !== user?.uid && roleOf.get(u.id) !== 'owner' && <div className="flex items-end gap-2"><Select label="Role" className="min-w-40" value={pick[u.id] ?? ''} onChange={(e) => setPick({ ...pick, [u.id]: e.target.value })}><option value="">Choose…</option>{ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select><Button size="sm" disabled={!pick[u.id]} busy={busy === u.id} onClick={() => void apply(u.id, pick[u.id] as Role)}>Apply</Button></div>}</Td>}
                </tr>
              ))}
            </Table>
          )}
          {users.next && <Button className="mt-4" variant="secondary" onClick={() => void users.more()} busy={users.loading}>Load more</Button>}
        </section>
      ) : <Alert tone="info">Your role can manage staff but not view student accounts.</Alert>}
    </>
  );
}
