import { describe, expect, it } from 'vitest';
import { LeadInput, ProfileUpdateSchema, QuestionVersionSchema, SaveResponsesInput, SubmitExamInput } from '../schemas';
import { SEED_SUBJECTS } from '../catalogue';

const base = {
  version: 1, createdBy: 'u1',
  content: { type: 'mcq_single', stem: { en: 'Sample question?' }, options: [{ id: 'a', text: { en: 'One' } }, { id: 'b', text: { en: 'Two' } }] },
  correct: ['a'], provenance: { kind: 'synthetic_demo', copyrightStatus: 'own_work' },
} as const;

describe('question schema', () => {
  it('accepts a valid synthetic question', () => { expect(QuestionVersionSchema.safeParse(base).success).toBe(true); });
  it('rejects a correct answer that is not an option', () => { expect(QuestionVersionSchema.safeParse({ ...base, correct: ['d'] }).success).toBe(false); });
  it('rejects multiple answers on a single-answer type', () => { expect(QuestionVersionSchema.safeParse({ ...base, correct: ['a', 'b'] }).success).toBe(false); });
  it('rejects an official PYQ without verified provenance', () => {
    expect(QuestionVersionSchema.safeParse({ ...base, provenance: { kind: 'official_pyq', copyrightStatus: 'unknown', officialPyqVerified: false } }).success).toBe(false);
  });
  it('rejects duplicate option ids', () => {
    const dup = { ...base, content: { ...base.content, options: [{ id: 'a', text: { en: 'x' } }, { id: 'a', text: { en: 'y' } }] } };
    expect(QuestionVersionSchema.safeParse(dup).success).toBe(false);
  });
});

describe('callable inputs', () => {
  it('rejects unknown option ids and oversize batches', () => {
    const resp = { qid: 'q1', selected: ['z'], visited: true, marked: false, timeSpentMs: 1 };
    expect(SaveResponsesInput.safeParse({ sessionId: 's', seq: 1, responses: [resp] }).success).toBe(false);
    const ok = { ...resp, selected: ['a'] };
    expect(SaveResponsesInput.safeParse({ sessionId: 's', seq: 1, responses: Array(201).fill(ok) }).success).toBe(false);
    expect(SubmitExamInput.safeParse({ sessionId: 's', clientRequestId: 'r1', finalSeq: 3 }).success).toBe(true);
  });
  it('lead capture requires explicit consent and a contact method', () => {
    expect(LeadInput.safeParse({ name: 'A', email: 'a@example.com', consent: true }).success).toBe(true);
    expect(LeadInput.safeParse({ name: 'A', email: 'a@example.com', consent: false }).success).toBe(false);
    expect(LeadInput.safeParse({ name: 'A', consent: true }).success).toBe(false);
  });
  it('profile update contains no privileged fields', () => {
    const keys = Object.keys(ProfileUpdateSchema.shape);
    for (const forbidden of ['role', 'isAdmin', 'hasPaid', 'plan', 'subscription', 'email']) expect(keys).not.toContain(forbidden);
  });
});

describe('seed catalogue', () => {
  it('never labels seed content as fully verified', () => {
    for (const s of SEED_SUBJECTS) expect(s.label).not.toBe('fully_verified');
  });
});
