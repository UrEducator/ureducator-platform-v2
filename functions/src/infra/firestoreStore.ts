import type { Firestore, Query } from 'firebase-admin/firestore';
import type { ListOpts, Row, Store, TxStore, Where } from '../domain/store';

export class FirestoreStore implements Store {
  constructor(private db: Firestore) {}
  async get<T>(path: string) { const s = await this.db.doc(path).get(); return s.exists ? (s.data() as T) : null; }
  async set(path: string, data: object) { await this.db.doc(path).set(data); }
  async merge(path: string, data: object) { await this.db.doc(path).set(data, { merge: true }); }
  async delete(path: string) { await this.db.doc(path).delete(); }
  private q(collection: string, where: Where[] = []): Query {
    let q: Query = this.db.collection(collection);
    for (const [f, op, v] of where) q = q.where(f, op === 'in' ? 'in' : op, v);
    return q;
  }
  async list<T>(collection: string, o: ListOpts): Promise<Row<T>[]> {
    let q = this.q(collection, o.where);
    if (o.orderBy) q = q.orderBy(o.orderBy, o.desc ? 'desc' : 'asc');
    if (o.startAfter) { const snap = await this.db.collection(collection).doc(o.startAfter).get(); if (snap.exists) q = q.startAfter(snap); }
    const res = await q.limit(o.limit).get();
    return res.docs.map((d) => ({ id: d.id, data: d.data() as T }));
  }
  async count(collection: string, where: Where[]) { return (await this.q(collection, where).count().get()).data().count; }
  async transact<T>(fn: (tx: TxStore) => Promise<T>): Promise<T> {
    return this.db.runTransaction(async (t) => {
      const tx: TxStore = {
        get: async <U>(p: string) => { const s = await t.get(this.db.doc(p)); return s.exists ? (s.data() as U) : null; },
        set: (p, d) => { t.set(this.db.doc(p), d); },
        merge: (p, d) => { t.set(this.db.doc(p), d, { merge: true }); },
        create: (p, d) => { t.create(this.db.doc(p), d); },
      };
      return fn(tx);
    });
  }
}
