/**
 * Demo content for LOCAL testing only. It is not imported by index.ts, so it is never part of the deployed Functions bundle.
 *
 * Everything here is labelled `sample`. The ten "real-style" questions are original, simple and factually safe; the 150-item full-length
 * paper is deliberately synthetic ("Choose the option labelled ...") so the exam format, palette and scoring can be rehearsed without
 * pretending to be UGC-NET content. No question here is an official previous-year question.
 */
import { DEFAULT_BLUEPRINT, SEED_SUBJECTS, type AnswerKey, type Blueprint, type PaperQuestion, type PublishedPaper } from '@ureducator/shared';
import type { Store } from '../domain/store';
import { P } from '../domain/paths';
import type { MockTestDoc } from '../domain/types';

type Opt = [string, string];
type Real = { qid: string; section: 'paper1' | 'paper2'; unit: string; topic: string; difficulty: 'easy' | 'medium' | 'hard'; stem: [string, string?]; opts: [Opt, Opt, Opt, Opt]; hi?: [string, string, string, string]; correct: string[]; why: [string, string?]; multi?: boolean };

const REAL: Real[] = [
  { qid: 'dq-research-sampling', section: 'paper1', unit: 'p1-research', topic: 'p1-research-types', difficulty: 'easy', stem: ['Which of the following is a probability sampling method?'], opts: [['a', 'Quota sampling'], ['b', 'Snowball sampling'], ['c', 'Stratified random sampling'], ['d', 'Purposive sampling']], correct: ['c'], why: ['In probability sampling every unit has a known, non-zero chance of selection. Stratified random sampling meets this; quota, snowball and purposive sampling do not.'] },
  { qid: 'dq-teaching-formative', section: 'paper1', unit: 'p1-teaching', topic: 'p1-teaching-methods', difficulty: 'easy', stem: ['Which of the following is an example of formative assessment?'], opts: [['a', 'End-of-year board examination'], ['b', 'A short classroom quiz followed by feedback during the unit'], ['c', 'Final semester examination'], ['d', 'University entrance test']], correct: ['b'], why: ['Formative assessment happens during learning and is used to give feedback. The other options are summative.'] },
  { qid: 'dq-ict-url', section: 'paper1', unit: 'p1-ict', topic: 'p1-ict-basics', difficulty: 'easy', stem: ['What is the full form of URL?', 'URL का पूर्ण रूप क्या है?'], opts: [['a', 'Uniform Resource Locator'], ['b', 'Universal Research Link'], ['c', 'Unified Root Location'], ['d', 'User Request Layer']], hi: ['यूनिफ़ॉर्म रिसोर्स लोकेटर', 'यूनिवर्सल रिसर्च लिंक', 'यूनिफ़ाइड रूट लोकेशन', 'यूज़र रिक्वेस्ट लेयर'], correct: ['a'], why: ['URL stands for Uniform Resource Locator, the address of a resource on the web.', 'URL का पूर्ण रूप यूनिफ़ॉर्म रिसोर्स लोकेटर है, जो वेब पर किसी संसाधन का पता होता है।'] },
  { qid: 'dq-comm-noise', section: 'paper1', unit: 'p1-communication', topic: 'p1-communication-basics', difficulty: 'medium', stem: ['In the Shannon–Weaver model of communication, anything that interferes with accurate reception of the message is called:'], opts: [['a', 'Feedback'], ['b', 'Noise'], ['c', 'Encoding'], ['d', 'Channel']], correct: ['b'], why: ['Noise is any disturbance, physical or psychological, that distorts the message between sender and receiver.'] },
  { qid: 'dq-ethics-plagiarism', section: 'paper1', unit: 'p1-research', topic: 'p1-research-ethics', difficulty: 'easy', stem: ['Presenting another author’s words as one’s own without acknowledgement is called:', 'किसी अन्य लेखक के शब्दों को बिना स्वीकृति अपना बताकर प्रस्तुत करना क्या कहलाता है?'], opts: [['a', 'Paraphrasing'], ['b', 'Editing'], ['c', 'Citation'], ['d', 'Plagiarism']], hi: ['भावार्थ लेखन', 'संपादन', 'संदर्भ देना', 'साहित्यिक चोरी (प्लेजियरिज़्म)'], correct: ['d'], why: ['Plagiarism is using someone else’s work without credit. Proper citation is the way to avoid it.', 'किसी और के कार्य को श्रेय दिए बिना उपयोग करना प्लेजियरिज़्म है। उचित संदर्भ देकर इससे बचा जा सकता है।'] },
  { qid: 'dq-maths-series', section: 'paper1', unit: 'p1-maths', topic: 'p1-maths-series', difficulty: 'medium', stem: ['What is the next number in the series 2, 6, 12, 20, 30, ?'], opts: [['a', '36'], ['b', '40'], ['c', '42'], ['d', '48']], correct: ['c'], why: ['The terms are n × (n + 1): 1×2, 2×3, 3×4, 4×5, 5×6, so the next is 6×7 = 42.'] },
  { qid: 'dq-edu-pedagogy', section: 'paper2', unit: 'sample-education-u1', topic: 'sample-education-u1-t1', difficulty: 'easy', stem: ['The term “pedagogy” most closely refers to:'], opts: [['a', 'The science of teaching and learning practice'], ['b', 'The study of the human skeleton'], ['c', 'The management of school finances'], ['d', 'The design of school buildings']], correct: ['a'], why: ['Pedagogy is the theory and practice of teaching and how learning is supported.'] },
  { qid: 'dq-cs-queue', section: 'paper2', unit: 'sample-cs-u1', topic: 'sample-cs-u1-t1', difficulty: 'easy', stem: ['Which data structure follows First-In-First-Out (FIFO) order?'], opts: [['a', 'Stack'], ['b', 'Queue'], ['c', 'Binary tree'], ['d', 'Hash table']], correct: ['b'], why: ['A queue removes elements in the order they were added. A stack is Last-In-First-Out.'] },
  { qid: 'dq-com-double-entry', section: 'paper2', unit: 'sample-commerce-u1', topic: 'sample-commerce-u1-t1', difficulty: 'easy', stem: ['In double-entry bookkeeping every transaction affects at least:'], opts: [['a', 'One account'], ['b', 'Two accounts'], ['c', 'Three accounts'], ['d', 'Four accounts']], correct: ['b'], why: ['Each transaction has a debit and a credit, so at least two accounts are affected.'] },
  { qid: 'dq-multi-rgb', section: 'paper2', unit: 'sample-cs-u1', topic: 'sample-cs-u1-t1', difficulty: 'medium', multi: true, stem: ['Select all colours that are primary channels of the RGB colour model.'], opts: [['a', 'Red'], ['b', 'Green'], ['c', 'Blue'], ['d', 'Yellow']], correct: ['a', 'b', 'c'], why: ['RGB uses red, green and blue light. Yellow is produced by mixing red and green.'] },
];

const loc = (en: string, hi?: string) => (hi ? { en, hi } : { en });
function toPaper(items: Real[]): { qs: PaperQuestion[]; key: AnswerKey } {
  const qs: PaperQuestion[] = []; const key: AnswerKey = {};
  for (const r of items) {
    const options = r.opts.map(([id, en], i) => ({ id, text: loc(en, r.hi?.[i]) }));
    qs.push({ qid: r.qid, version: 1, sectionId: r.section, unitId: r.unit, topicId: r.topic, difficulty: r.difficulty, content: { type: r.multi ? 'mcq_multi' : 'mcq_single', stem: loc(r.stem[0], r.stem[1]), options } });
    key[r.qid] = { correct: r.correct, sectionId: r.section, unitId: r.unit, topicId: r.topic, difficulty: r.difficulty, explanation: loc(r.why[0], r.why[1]) };
  }
  return { qs, key };
}

/** 150 synthetic items: 50 spread across the Paper I topics, 100 for one sample Paper II subject. The correct option is stated in the stem. */
function fullSynthetic(): { qs: PaperQuestion[]; key: AnswerKey } {
  const p1Topics = SEED_SUBJECTS[0]!.units.flatMap((u) => u.topics.map((t) => ({ unit: u.id, topic: t.id })));
  const items: Real[] = [];
  for (let i = 0; i < 150; i++) {
    const p1 = i < 50; const t = p1 ? p1Topics[i % p1Topics.length]! : { unit: 'sample-education-u1', topic: 'sample-education-u1-t1' }; const ans = 'abcd'[i % 4]!;
    items.push({ qid: `fx-${String(i + 1).padStart(3, '0')}`, section: p1 ? 'paper1' : 'paper2', unit: t.unit, topic: t.topic, difficulty: (['easy', 'medium', 'hard'] as const)[i % 3]!, stem: [`Practice item ${i + 1} (synthetic). Choose the option labelled “${ans.toUpperCase()}”.`], opts: [['a', 'Option A'], ['b', 'Option B'], ['c', 'Option C'], ['d', 'Option D']], correct: [ans], why: [`Synthetic item: the stem names option ${ans.toUpperCase()}.`] });
  }
  return toPaper(items);
}

export const MINI_BLUEPRINT: Blueprint = { ...DEFAULT_BLUEPRINT, id: 'demo-mini', name: 'Demo mini test (10 questions)', durationMinutes: 15, sections: [{ id: 'paper1', title: { en: 'Paper I — Teaching & Research Aptitude', hi: 'प्रश्नपत्र I' }, paper: 'paper1', questionCount: 6 }, { id: 'paper2', title: { en: 'Paper II — Subject (sample)' }, paper: 'paper2', questionCount: 4 }] };

export async function seedDemo(store: Store, nowMs: number): Promise<{ miniKey: AnswerKey }> {
  for (const s of SEED_SUBJECTS) {
    await store.set(P.subject(s.id), { paper: s.paper, name: s.name, label: s.label, version: 1, updatedAtMs: nowMs });
    for (const [ui, u] of s.units.entries()) {
      await store.set(P.unit(u.id), { subjectId: s.id, name: u.name, order: ui, version: 1, updatedAtMs: nowMs });
      for (const [ti, t] of u.topics.entries()) await store.set(P.topic(t.id), { subjectId: s.id, unitId: u.id, name: t.name, order: ti, version: 1, updatedAtMs: nowMs });
    }
  }
  await store.set(P.blueprint(DEFAULT_BLUEPRINT.id), DEFAULT_BLUEPRINT);
  await store.set(P.blueprint(MINI_BLUEPRINT.id), MINI_BLUEPRINT);

  const mini = toPaper(REAL); const full = fullSynthetic();
  const mkPaper = (paperId: string, mockTestId: string, qs: PaperQuestion[]): PublishedPaper => ({ paperId, mockTestId, version: 1, questions: qs, contentLabel: 'sample' });
  await store.set(P.paper('demo-mini-p'), mkPaper('demo-mini-p', 'mt-mini', mini.qs)); await store.set(P.answerKey('demo-mini-p'), mini.key);
  await store.set(P.paper('demo-full-p'), mkPaper('demo-full-p', 'mt-full', full.qs)); await store.set(P.answerKey('demo-full-p'), full.key);

  const base = { access: 'free', status: 'published', timed: true, shuffle: false, contentLabel: 'sample', version: 1 } as const;
  const tests: Record<string, MockTestDoc> = {
    'mt-mini': { ...base, title: 'Demo mini test', kind: 'custom', blueprintId: MINI_BLUEPRINT.id, paperId: 'demo-mini-p', paperVersion: 1, revealPolicy: 'immediate', description: 'Ten sample questions, 15 minutes. Good for trying the exam screen and the result report.' },
    'mt-mini-late': { ...base, title: 'Demo mini test (answers open later)', kind: 'custom', blueprintId: MINI_BLUEPRINT.id, paperId: 'demo-mini-p', paperVersion: 1, revealPolicy: 'after_close', closesAtMs: nowMs + 86_400_000, description: 'The same ten questions, but answers and explanations unlock only after the test window closes.' },
    'mt-full': { ...base, title: 'Full-length format rehearsal (synthetic items)', kind: 'full', blueprintId: DEFAULT_BLUEPRINT.id, paperId: 'demo-full-p', paperVersion: 1, revealPolicy: 'immediate', description: '150 placeholder items in the 50 + 100 layout, 300 marks, 180 minutes. Practise the format, not the content.' },
  };
  for (const [id, t] of Object.entries(tests)) await store.set(P.mockTest(id), t);

  // Notes used by the mentor in local tests only. In staging, notes appear only after an editor verifies them.
  await store.set('learningNotes/n-sampling', { title: 'Probability and non-probability sampling', body: 'In probability sampling every member of the population has a known chance of selection. Simple random, stratified, systematic and cluster sampling are probability methods. Quota, snowball, purposive and convenience sampling are non-probability methods.', verified: true, label: 'Demo note (local test data)', topicId: 'p1-research-types', keywords: ['sampling', 'probability', 'stratified'] });
  return { miniKey: mini.key };
}
