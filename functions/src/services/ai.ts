import type { Actor } from '../domain/types';
import { P } from '../domain/paths';
import { err } from '../infra/errors';
import type { Deps } from './exam';

export type Source = { id: string; title: string; body: string; verified: boolean; label: string };
export type AiRequest = { mode: 'concept' | 'question_explanation' | 'revision' | 'study_plan'; question: string; sources: Source[]; extraContext?: string };
export type AiResponse = { text: string; citations: { id: string; title: string; label: string }[]; grounded: boolean; provider: string };
export interface AiProvider { id: string; generate(r: AiRequest): Promise<AiResponse> }

export const SYSTEM_POLICY = [
  'You are the UrEducator study mentor for UGC-NET aspirants.',
  'Use only the supplied verified UrEducator sources. Cite them as [1], [2].',
  'Say clearly when the sources are not enough. Do not guess.',
  'Separate official information (only if a source says it is official) from educational explanation.',
  'Never invent exam notifications, dates or previous-year questions.',
  'Never reveal answers for a test that is still in progress.',
].join('\n');

/** Deterministic provider used for tests and while live model calls are disabled. Makes no network calls and costs nothing. */
export class MockAiProvider implements AiProvider {
  id = 'mock';
  async generate(r: AiRequest): Promise<AiResponse> {
    const src = r.sources.filter((s) => s.verified).slice(0, 3);
    if (src.length === 0) return { text: 'I do not have verified UrEducator material on this yet, so I cannot answer reliably. Try a related topic from the subject catalogue, or ask support to add this topic.', citations: [], grounded: false, provider: this.id };
    const parts = src.map((s, i) => `${s.body.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')} [${i + 1}]`);
    return { text: `${r.mode === 'revision' ? 'Quick revision' : 'From UrEducator material'}: ${parts.join(' ')}`, citations: src.map((s) => ({ id: s.id, title: s.title, label: s.label })), grounded: true, provider: this.id };
  }
}

/** Live Gemini on Vertex AI. Implemented but NOT exercised: disabled until API, IAM, quota and budget are reviewed. */
export class VertexGeminiProvider implements AiProvider {
  id = 'vertex-gemini';
  constructor(private o: { project: string; location: string; model: string; token: () => Promise<string>; fetchFn?: typeof fetch }) {}
  async generate(r: AiRequest): Promise<AiResponse> {
    const ctx = r.sources.filter((s) => s.verified).map((s, i) => `[${i + 1}] ${s.title}: ${s.body}`).join('\n\n');
    const url = `https://${this.o.location}-aiplatform.googleapis.com/v1/projects/${this.o.project}/locations/${this.o.location}/publishers/google/models/${this.o.model}:generateContent`;
    const res = await (this.o.fetchFn ?? fetch)(url, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await this.o.token()}` },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_POLICY }] }, contents: [{ role: 'user', parts: [{ text: `Sources:\n${ctx || '(none)'}\n\nMode: ${r.mode}\nQuestion: ${r.question}` }] }], generationConfig: { maxOutputTokens: 700, temperature: 0.2 } }),
    });
    if (!res.ok) throw err('unavailable', 'AI_UNAVAILABLE', 'The mentor is unavailable right now.');
    const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const src = r.sources.filter((s) => s.verified);
    return { text, citations: src.map((s) => ({ id: s.id, title: s.title, label: s.label })), grounded: src.length > 0, provider: this.id };
  }
}

export async function retrieveSources(d: Deps, topicId: string | undefined, question: string): Promise<Source[]> {
  const rows = await d.store.list<{ title: string; body: string; verified: boolean; label?: string; topicId?: string; keywords?: string[] }>('learningNotes', { where: [['verified', '==', true], ...(topicId ? [['topicId', '==', topicId] as [string, '==', string]] : [])], limit: 30 });
  const words = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return rows
    .map((r) => ({ r, score: words.filter((w) => (r.data.title + ' ' + r.data.body + ' ' + (r.data.keywords ?? []).join(' ')).toLowerCase().includes(w)).length }))
    .filter((x) => topicId ? true : x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)
    .map(({ r }) => ({ id: r.id, title: r.data.title, body: r.data.body, verified: r.data.verified, label: r.data.label ?? 'UrEducator learning note' }));
}

export async function askMentor(d: Deps, provider: AiProvider, actor: Actor, i: { question: string; topicId?: string | undefined; mode: AiRequest['mode']; ref?: { sessionId: string; qid: string } | undefined }) {
  if (!actor.emailVerified) throw err('failed-precondition', 'EMAIL_NOT_VERIFIED', 'Verify your email address to use the mentor.');
  let extra: string | undefined;
  if (i.ref) {
    const s = await d.store.get<{ uid: string; status: string; paperId: string; revealAvailableAtMs?: number }>(P.session(i.ref.sessionId));
    if (!s || s.uid !== actor.uid) throw err('not-found', 'SESSION_NOT_FOUND', 'Session not found.');
    if (s.status === 'in_progress' || d.clock() < (s.revealAvailableAtMs ?? Infinity)) throw err('failed-precondition', 'ANSWERS_LOCKED', 'Explanations unlock after the test is submitted and review opens.');
    const key = await d.store.get<Record<string, { explanation?: { en: string } }>>(P.answerKey(s.paperId));
    extra = key?.[i.ref.qid]?.explanation?.en;
  }
  const sources = await retrieveSources(d, i.topicId, i.question);
  if (extra) sources.unshift({ id: `exp_${i.ref?.qid}`, title: 'Question explanation', body: extra, verified: true, label: 'UrEducator explanation' });
  return provider.generate({ mode: i.mode, question: i.question, sources, ...(extra ? { extraContext: extra } : {}) });
}
