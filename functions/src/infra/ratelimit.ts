import { createHash } from 'node:crypto';
import type { Clock } from '../domain/types';
import type { Store } from '../domain/store';
import { P } from '../domain/paths';
import { err } from './errors';

export const hashSubject = (s: string, salt = 'ur') => createHash('sha256').update(`${salt}:${s}`).digest('hex').slice(0, 24);

/** Fixed-window counter in the store. Expired documents are removed by a Firestore TTL policy on `expireAt`. */
export async function rateLimit(store: Store, clock: Clock, o: { bucket: string; subject: string; limit: number; windowSec: number }) {
  const now = clock();
  const win = Math.floor(now / (o.windowSec * 1000));
  const path = P.rate(`${o.bucket}_${hashSubject(o.subject)}_${win}`);
  const count = await store.transact(async (tx) => {
    const cur = (await tx.get<{ count: number }>(path))?.count ?? 0;
    tx.set(path, { count: cur + 1, bucket: o.bucket, expireAt: new Date((win + 2) * o.windowSec * 1000) });
    return cur + 1;
  });
  if (count > o.limit) throw err('resource-exhausted', 'RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.');
}
