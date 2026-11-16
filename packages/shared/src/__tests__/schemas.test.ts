import { describe, expect, it } from 'vitest';
import { LeadInput, ProfileUpdateSchema, QuestionVersionSchema, SaveResponsesInput, SubmitExamInput, MockTestSchema, QuestionSchema } from '../schemas';
import { SEED_SUBJECTS } from '../catalogue';
import { BlueprintSchema, PAPER1_PILOT_BLUEPRINT, maxMarks, totalQuestions } from '../blueprint';

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

describe('pilot blueprint', () => {
  it('PAPER1_PILOT_BLUEPRINT conforms to BlueprintSchema with exactly 50 questions, +2/0 scoring, and unverified pattern', () => {
    expect(BlueprintSchema.safeParse(PAPER1_PILOT_BLUEPRINT).success).toBe(true);
    expect(PAPER1_PILOT_BLUEPRINT.id).toBe('ugcnet-paper1-pilot-v1');
    expect(totalQuestions(PAPER1_PILOT_BLUEPRINT)).toBe(50);
    expect(maxMarks(PAPER1_PILOT_BLUEPRINT)).toBe(100);
    expect(PAPER1_PILOT_BLUEPRINT.durationMinutes).toBe(60);
    expect(PAPER1_PILOT_BLUEPRINT.marking).toMatchObject({
      correct: 2,
      incorrect: 0,
      unattempted: 0,
      multiCorrectPolicy: 'all_or_nothing',
    });
    expect(PAPER1_PILOT_BLUEPRINT.officialPatternVerified).toBe(false);
    expect(PAPER1_PILOT_BLUEPRINT.sections).toHaveLength(1);
    expect(PAPER1_PILOT_BLUEPRINT.sections[0]?.paper).toBe('paper1');
    expect(PAPER1_PILOT_BLUEPRINT.sections[0]?.questionCount).toBe(50);
  });
});

describe('Phase F taxonomy schemas', () => {
  it('validates MockTestSchema with setCode conforming to standard format', () => {
    const mockTest = {
      mockTestId: 'mt-pyq-2024-jun18-s1',
      title: 'UGC NET Paper 1 — 18 June 2024 (Shift 1)',
      setCode: 'PYQ-UN-P1-24J-S1',
      kind: 'pyq' as const,
      blueprintId: 'bp1',
      access: 'paid' as const,
      contentLabel: 'fully_verified' as const,
    };
    const parsed = MockTestSchema.safeParse(mockTest);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.setCode).toBe('PYQ-UN-P1-24J-S1');
    }
  });

  it('validates QuestionSchema with usedInSets array tracking set codes', () => {
    const qDoc = {
      subjectId: 'paper1',
      unitId: 'u1',
      topicId: 't1',
      difficulty: 'medium' as const,
      languages: ['en' as const],
      status: 'published' as const,
      currentVersion: 1,
      preview: 'Preview text for question',
      usedInSets: ['PYQ-UN-P1-24J-S1', 'UE-UN-P1-MK01'],
    };
    const parsed = QuestionSchema.safeParse(qDoc);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.usedInSets).toEqual(['PYQ-UN-P1-24J-S1', 'UE-UN-P1-MK01']);
    }
  });

  it('defaults usedInSets to empty array when omitted', () => {
    const qDoc = {
      subjectId: 'paper1',
      unitId: 'u1',
      topicId: 't1',
      difficulty: 'medium' as const,
      languages: ['en' as const],
      status: 'draft' as const,
      currentVersion: 1,
    };
    const parsed = QuestionSchema.safeParse(qDoc);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.usedInSets).toEqual([]);
    }
  });
});

