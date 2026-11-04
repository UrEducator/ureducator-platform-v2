import { randomUUID } from 'node:crypto';
import type { Clock } from '../domain/types';
import type { Store } from '../domain/store';
import { P } from '../domain/paths';

export type AuditEntry = { actorUid: string; actorRole: string | null; action: string; target: string; meta?: Record<string, string | number | boolean | null> };
/** Append-only audit trail. Never put answers, tokens or personal free text in `meta`. */
export async function audit(store: Store, clock: Clock, e: AuditEntry) {
  await store.set(P.audit(`${clock()}_${randomUUID().slice(0, 8)}`), { ...e, atMs: clock() });
}
