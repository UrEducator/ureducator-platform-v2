'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { asApiError, type In } from './types';

export type Row = { id: string } & Record<string, unknown>;
export const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
export const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : d);
export const loc = (v: unknown): { en: string; hi?: string } => { const o = (v ?? {}) as { en?: string; hi?: string }; return { en: o.en ?? '', ...(o.hi ? { hi: o.hi } : {}) }; };

/** Paged staff listing with "load more". The server decides what each role may see; this only displays it. */
export function useAdminList(collection: In<'adminList'>['collection'], status?: string, limit = 25) {
  const { backend } = useAuth(); const [items, setItems] = useState<Row[]>([]); const [next, setNext] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [n, setN] = useState(0); const seq = useRef(0);
  const fetchPage = useCallback(async (after?: string) => {
    if (!backend) return; const id = ++seq.current; setLoading(true); setError('');
    try { const r = await backend.call('adminList', { collection, limit, ...(status ? { status } : {}), ...(after ? { startAfter: after } : {}) }); if (id !== seq.current) return; setItems((p) => (after ? [...p, ...(r.items as Row[])] : (r.items as Row[]))); setNext(r.next); }
    catch (e) { if (id === seq.current) setError(asApiError(e).message); } finally { if (id === seq.current) setLoading(false); }
  }, [backend, collection, status, limit]);
  useEffect(() => { void fetchPage(); }, [fetchPage, n]);
  return { items, next, loading, error, more: () => next && fetchPage(next), reload: () => setN((x) => x + 1) };
}
