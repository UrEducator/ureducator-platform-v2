'use client';
import { useMemo } from 'react';
import { SEED_SUBJECTS } from '@ureducator/shared';
import { useLoad } from './hooks';

/** id -> display name for subjects, units and topics. Falls back to the built-in seed names, then to the id itself. */
export function useNames() {
  const cat = useLoad((b) => b.reads.catalogue());
  const names = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of SEED_SUBJECTS) { m[s.id] = s.name.en; for (const u of s.units) { m[u.id] = u.name.en; for (const t of u.topics) m[t.id] = t.name.en; } }
    for (const x of [...(cat.data?.subjects ?? []), ...(cat.data?.units ?? []), ...(cat.data?.topics ?? [])]) m[x.id] = x.name.en;
    return m;
  }, [cat.data]);
  return {
    names, name: (id: string) => names[id] ?? id, loading: cat.loading,
    subjects: cat.data?.subjects ?? SEED_SUBJECTS.map((s) => ({ id: s.id, paper: s.paper, name: s.name, label: s.label })),
    units: cat.data?.units ?? SEED_SUBJECTS.flatMap((s) => s.units.map((u, order) => ({ id: u.id, subjectId: s.id, name: u.name, order }))),
    topics: cat.data?.topics ?? SEED_SUBJECTS.flatMap((s) => s.units.flatMap((u) => u.topics.map((t, order) => ({ id: t.id, unitId: u.id, subjectId: s.id, name: t.name, order })))),
  };
}
