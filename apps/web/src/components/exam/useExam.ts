'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addTime, chooseOption, clearResponse, dirtyBatch, interpretSave, paletteSummary, remainingWithOffset, setMarked, timeWarning, visitQuestion, type ClientResponses, type TimeWarning } from '@ureducator/shared';
import { useAuth } from '@/lib/auth';
import { asApiError, isOffline, type Out } from '@/lib/types';

export type ExamData = Out<'getExamSession'>;
export type SaveState = 'saved' | 'saving' | 'unsaved' | 'offline';
const backupKey = (sid: string) => `ur_exam_backup_${sid}`;

export function useExam(sessionId: string) {
  const { backend } = useAuth(); const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'submitting' | 'error'>('loading');
  const [error, setError] = useState<{ message: string; ended: boolean } | null>(null);
  const [data, setData] = useState<ExamData | null>(null);
  const [resp, setResp] = useState<ClientResponses>({});
  const [cur, setCur] = useState(0);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  const respRef = useRef<ClientResponses>({}); const dirty = useRef(new Set<string>()); const ver = useRef<Record<string, number>>({});
  const seq = useRef(1); const offset = useRef(0); const inflight = useRef(false); const submitting = useRef(false); const enteredAt = useRef(performance.now());
  const curRef = useRef(0); const dataRef = useRef<ExamData | null>(null); const retry = useRef(0); const warned = useRef<TimeWarning>('none');

  const persist = useCallback(() => {
    try { localStorage.setItem(backupKey(sessionId), JSON.stringify({ dirty: [...dirty.current], resp: respRef.current, at: Date.now() })); } catch { /* storage unavailable: autosave to the server still works */ }
  }, [sessionId]);

  const update = useCallback((fn: (m: ClientResponses) => ClientResponses, qid: string) => {
    respRef.current = fn(respRef.current); ver.current[qid] = (ver.current[qid] ?? 0) + 1; dirty.current.add(qid);
    setResp(respRef.current); setSaveState((s) => (s === 'offline' ? s : 'unsaved')); persist();
  }, [persist]);

  /** Adds the time spent on the question currently on screen. Called before any move, save or submit. */
  const commitTime = useCallback(() => {
    const d = dataRef.current; if (!d) return; const q = d.questions[curRef.current]; if (!q) return;
    const t = performance.now(); const ms = t - enteredAt.current; enteredAt.current = t;
    if (ms > 0 && ms < 4 * 3600_000) update((m) => addTime(m, q.qid, ms), q.qid);
  }, [update]);

  /* ---------- load ---------- */
  useEffect(() => {
    if (!backend) return; let dead = false;
    backend.call('getExamSession', { sessionId }).then((d) => {
      if (dead) return;
      offset.current = d.serverNowMs - Date.now(); dataRef.current = d; seq.current = d.lastSeq + 1;
      let m: ClientResponses = { ...d.responses };
      try { // restore edits that never reached the server (e.g. page refreshed while offline)
        const raw = localStorage.getItem(backupKey(sessionId)); const b = raw ? (JSON.parse(raw) as { dirty: string[]; resp: ClientResponses }) : null;
        if (b) for (const q of b.dirty) if (b.resp[q] && d.questions.some((x) => x.qid === q)) { m = { ...m, [q]: b.resp[q]! }; dirty.current.add(q); }
      } catch { /* ignore a corrupt backup */ }
      const first = d.questions[0]; if (first) m = visitQuestion(m, first.qid);
      respRef.current = m; setResp(m); setData(d); setLang(d.language); setPhase('ready'); enteredAt.current = performance.now();
      if (dirty.current.size) setSaveState('unsaved');
    }).catch((e) => { if (dead) return; const x = asApiError(e); setError({ message: x.message, ended: x.reason === 'SESSION_ENDED' }); setPhase('error'); });
    return () => { dead = true; };
  }, [backend, sessionId]);

  /* ---------- autosave (single flight, monotonic sequence numbers) ---------- */
  const flush = useCallback(async (): Promise<void> => {
    if (!backend || inflight.current || submitting.current || dirty.current.size === 0) return;
    inflight.current = true; setSaveState('saving'); commitTime();
    const sent = new Set(dirty.current); const sentVer = Object.fromEntries([...sent].map((q) => [q, ver.current[q] ?? 0])); const batch = dirtyBatch(respRef.current, sent); const sseq = seq.current;
    try {
      const ack = await backend.call('saveResponses', { sessionId, seq: sseq, responses: batch, ...(dataRef.current?.questions[curRef.current] ? { currentQid: dataRef.current.questions[curRef.current]!.qid } : {}) });
      offset.current = ack.serverNowMs - Date.now();
      const v = interpretSave(sseq, ack);
      if (v.kind === 'ended') { router.replace(`/app/results?s=${sessionId}`); return; }
      seq.current = v.nextSeq; retry.current = 0;
      if (v.kind === 'saved') { for (const q of sent) if ((ver.current[q] ?? 0) === sentVer[q]) dirty.current.delete(q); setLastSavedAt(Date.now()); }
      setSaveState(dirty.current.size ? 'unsaved' : 'saved'); persist();
    } catch (e) {
      retry.current++; setSaveState(isOffline(e) ? 'offline' : 'unsaved');
      if (asApiError(e).reason === 'SESSION_NOT_FOUND') setSaveState('offline');
    } finally { inflight.current = false; }
  }, [backend, sessionId, commitTime, persist, router]);

  useEffect(() => { if (phase !== 'ready') return; const t = setInterval(() => { void flush(); }, retry.current > 2 ? 15_000 : 8_000); return () => clearInterval(t); }, [phase, flush]);
  useEffect(() => { if (phase !== 'ready' || saveState !== 'unsaved') return; const t = setTimeout(() => { void flush(); }, 1500); return () => clearTimeout(t); }, [phase, saveState, resp, flush]);
  useEffect(() => { const on = () => void flush(); window.addEventListener('online', on); return () => window.removeEventListener('online', on); }, [flush]);

  /* ---------- submit ---------- */
  const submit = useCallback(async (reason: 'manual' | 'deadline') => {
    if (!backend || submitting.current) return; submitting.current = true; setPhase('submitting'); setSubmitError(null); commitTime();
    try {
      await backend.call('submitExam', { sessionId, clientRequestId: `submit-${sessionId}`, finalSeq: seq.current, responses: Object.values(respRef.current), reason });
      try { localStorage.removeItem(backupKey(sessionId)); } catch { /* ignore */ }
      router.replace(`/app/results?s=${sessionId}`);
    } catch (e) {
      submitting.current = false; setPhase('ready'); const x = asApiError(e);
      if (x.reason === 'SESSION_NOT_FOUND') { setError({ message: x.message, ended: false }); setPhase('error'); return; }
      setSubmitError(isOffline(e) ? 'We could not reach the server. Your answers are kept on this device. Check your connection, then submit again.' : x.message);
      if (reason === 'deadline') setTimeout(() => void submit('deadline'), 4000);
    }
  }, [backend, sessionId, commitTime, router]);

  /* ---------- clock: follows server time; auto-submits at zero ---------- */
  useEffect(() => { if (phase !== 'ready') return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [phase]);
  const remaining = data ? remainingWithOffset(data.deadlineMs, now, offset.current) : 0;
  const warning = timeWarning(remaining);
  useEffect(() => {
    if (!data || phase !== 'ready') return;
    if (warning !== warned.current) {
      warned.current = warning;
      if (warning === 'ten_minutes') setAnnounce('Ten minutes remaining.'); else if (warning === 'one_minute') setAnnounce('One minute remaining.'); else if (warning === 'ended') setAnnounce('Time is up. Submitting your test.');
    }
    if (warning === 'ended') void submit('deadline');
  }, [warning, data, phase, submit]);

  /* ---------- leave-page protection ---------- */
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (phase === 'ready' || phase === 'submitting') { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [phase]);

  /* ---------- actions ---------- */
  const goTo = useCallback((i: number) => {
    const d = dataRef.current; if (!d || i < 0 || i >= d.questions.length) return;
    commitTime(); curRef.current = i; setCur(i); enteredAt.current = performance.now();
    const q = d.questions[i]!; update((m) => visitQuestion(m, q.qid), q.qid);
  }, [commitTime, update]);
  const q = data?.questions[cur];
  const choose = useCallback((optionId: string) => { if (!q) return; const multi = q.content.type === 'mcq_multi'; update((m) => chooseOption(m, q.qid, optionId, multi), q.qid); }, [q, update]);
  const clear = useCallback(() => { if (q) update((m) => clearResponse(m, q.qid), q.qid); }, [q, update]);
  const mark = useCallback((on: boolean) => { if (q) update((m) => setMarked(m, q.qid, on), q.qid); }, [q, update]);

  const order = useMemo(() => data?.questions.map((x) => x.qid) ?? [], [data]);
  const counts = useMemo(() => paletteSummary(order, resp), [order, resp]);
  return { phase, error, data, resp, cur, q, lang, setLang, remaining, warning, announce, saveState, lastSavedAt, submitError, counts, goTo, choose, clear, mark, submit, flush, offsetMs: offset.current };
}
