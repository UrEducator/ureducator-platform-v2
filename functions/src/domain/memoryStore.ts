import type { ListOpts, Row, Store, TxStore, Where } from './store';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k] as Record<string, unknown>, v) : structuredClone(v);
  return out;
}
const field = (d: Record<string, unknown>, f: string) => f.split('.').reduce<unknown>((o, k) => (isObj(o) ? o[k] : undefined), d);
const match = (d: Record<string, unknown>, [f, op, v]: Where) => {
  const x = field(d, f) as never;
  switch (op) { case '==': return x === v; case '>=': return x >= (v as never); case '<=': return x <= (v as never); case '>': return x > (v as never); case '<': return x < (v as never); case 'in': return (v as unknown[]).includes(x); }
};

export class MemoryStore implements Store {
  docs = new Map<string, Record<string, unknown>>();
  private lock: Promise<void> = Promise.resolve();
  writes = 0;
  async get<T>(path: string) { const d = this.docs.get(path); return d ? (structuredClone(d) as T) : null; }
  async set(path: string, data: object) { this.docs.set(path, structuredClone(data) as Record<string, unknown>); this.writes++; }
  async merge(path: string, data: object) { this.docs.set(path, deepMerge(this.docs.get(path) ?? {}, data as Record<string, unknown>)); this.writes++; }
  async delete(path: string) { this.docs.delete(path); }
  async list<T>(collection: string, o: ListOpts): Promise<Row<T>[]> {
    const prefix = collection + '/';
    let rows = [...this.docs.entries()].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')).map(([p, d]) => ({ id: p.slice(prefix.length), data: d }));
    for (const w of o.where ?? []) rows = rows.filter((r) => match(r.data, w));
    if (o.orderBy) { const f = o.orderBy; rows.sort((a, b) => { const x = field(a.data, f) as never, y = field(b.data, f) as never; return (x < y ? -1 : x > y ? 1 : 0) * (o.desc ? -1 : 1); }); }
    else rows.sort((a, b) => (a.id < b.id ? -1 : 1));
    if (o.startAfter) { const i = rows.findIndex((r) => r.id === o.startAfter); if (i >= 0) rows = rows.slice(i + 1); }
    return rows.slice(0, o.limit).map((r) => ({ id: r.id, data: structuredClone(r.data) as T }));
  }
  async count(collection: string, where: Where[]) { return (await this.list(collection, { where, limit: 1_000_000 })).length; }
  async transact<T>(fn: (tx: TxStore) => Promise<T>): Promise<T> {
    // serialise transactions like Firestore would effectively do via retries on contention
    const prev = this.lock; let release!: () => void;
    this.lock = new Promise((r) => (release = r)); await prev;
    try {
      const pending: (() => void)[] = []; const createdPaths: string[] = [];
      const tx: TxStore = {
        get: async (p) => this.get(p),
        set: (p, d) => { pending.push(() => { this.docs.set(p, structuredClone(d) as Record<string, unknown>); this.writes++; }); },
        merge: (p, d) => { pending.push(() => { this.docs.set(p, deepMerge(this.docs.get(p) ?? {}, d as Record<string, unknown>)); this.writes++; }); },
        create: (p, d) => { createdPaths.push(p); pending.push(() => { this.docs.set(p, structuredClone(d) as Record<string, unknown>); this.writes++; }); },
      };
      const out = await fn(tx);
      // Firestore commits atomically: check every create() precondition before applying anything.
      const creates = new Set<string>();
      for (const c of createdPaths) {
        if (this.docs.has(c) || creates.has(c)) {
          const err = new Error('ALREADY_EXISTS');
          (err as unknown as { code: number }).code = 6;
          throw err;
        }
        creates.add(c);
      }
      for (const w of pending) w(); // commit only when the callback succeeded
      return out;
    } finally { release(); }
  }
}
