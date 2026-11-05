import { describe, expect, it } from 'vitest';
import { startExam, submitExam } from '../services/exam';
import { alice, bob, seed } from './fixtures';

const T0 = 1_800_000_000_000;
const HOUR = 3_600_000;
const mk = async () => { let now = T0; const store = await seed(); return { store, d: { store, clock: () => now }, at: (ms: number) => (now = ms) }; };
type E = Awaited<ReturnType<typeof mk>>;
const start = (e: E, actor = alice, id = 'r') => startExam(e.d, actor, { mockTestId: 'mt1', language: 'en', clientRequestId: id });
async function sessionsAt(e: E, ms: number, n: number, actor = alice, tag = 'x') {
  e.at(ms);
  for (let i = 0; i < n; i++) {
    const p = await start(e, actor, `${tag}-${ms}-${i}`);
    await submitExam(e.d, actor, { sessionId: p.sessionId, clientRequestId: `s-${tag}-${ms}-${i}`, finalSeq: 0, reason: 'manual' });
  }
}

describe('startExam hourly rate limit: edges', () => {
  it('cutoff is inclusive: 6 sessions started exactly 1 hour ago still block', async () => {
    const e = await mk(); await sessionsAt(e, T0 - HOUR, 6); e.at(T0);
    await expect(start(e, alice, 'next')).rejects.toMatchObject({ reason: 'TOO_MANY_ATTEMPTS' });
  });
  it('6 sessions started 1 hour + 1 ms ago do not count', async () => {
    const e = await mk(); await sessionsAt(e, T0 - HOUR - 1, 6); e.at(T0);
    await expect(start(e, alice, 'next')).resolves.toMatchObject({ sessionId: expect.any(String) });
  });
  it('sessions 45 minutes old still count (the window is a full hour)', async () => {
    const e = await mk(); await sessionsAt(e, T0 - 2_700_000, 6); e.at(T0);
    await expect(start(e, alice, 'next')).rejects.toMatchObject({ reason: 'TOO_MANY_ATTEMPTS' });
  });
  it("is per user: bob's 6 recent sessions never block alice, and still block bob", async () => {
    const e = await mk(); await sessionsAt(e, T0 - 60_000, 6, bob, 'b'); e.at(T0);
    await expect(start(e, alice, 'a1')).resolves.toMatchObject({ sessionId: expect.any(String) });
    await expect(start(e, bob, 'b-next')).rejects.toMatchObject({ reason: 'TOO_MANY_ATTEMPTS' });
  });
  it('query contract: one examSessions list (uid equality only, startedAtMs desc, limit 6) and no examSessions count()', async () => {
    const e = await mk(); const calls: { coll: string; o: unknown }[] = []; const counts: { coll: string }[] = [];
    const l = e.store.list.bind(e.store); const c = e.store.count.bind(e.store);
    (e.store as unknown as { list: unknown }).list = (coll: string, o: unknown) => { calls.push({ coll, o }); return l(coll, o as never); };
    (e.store as unknown as { count: unknown }).count = (coll: string, w: unknown) => { counts.push({ coll }); return c(coll, w as never); };
    e.at(T0); await start(e, alice, 'first');
    const rl = calls.filter((x) => x.coll === 'examSessions' && (x.o as { orderBy?: string }).orderBy);
    expect(rl).toHaveLength(1);
    expect(rl[0]!.o).toEqual({ where: [['uid', '==', alice.uid]], orderBy: 'startedAtMs', desc: true, limit: 6 });
    expect(counts.filter((x) => x.coll === 'examSessions')).toEqual([]);
  });
});
