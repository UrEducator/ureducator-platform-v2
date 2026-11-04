import { z } from 'zod';
import {
  CONTENT_LABELS, DIFFICULTIES, LANGS, LIMITS, PROVENANCE, PUBLICATION_STATUSES, QUESTION_TYPES, ROLES,
} from './constants';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, 'invalid id');
const text = z.string().min(1).max(LIMITS.maxTextLength);
export const LocalizedTextSchema = z.object({ en: text, hi: z.string().max(LIMITS.maxTextLength).optional() });

/* ---------- Question content ---------- */
export const OptionSchema = z.object({ id: z.string().regex(/^[a-f]$/), text: LocalizedTextSchema });

export const QuestionContentSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  stem: LocalizedTextSchema,
  passage: LocalizedTextSchema.optional(),
  statements: z.array(LocalizedTextSchema).max(8).optional(),
  matchLists: z.object({
    listI: z.array(LocalizedTextSchema).min(2).max(8),
    listII: z.array(LocalizedTextSchema).min(2).max(8),
  }).optional(),
  image: z.object({ storagePath: z.string().max(300), alt: z.string().max(300) }).optional(),
  options: z.array(OptionSchema).min(2).max(LIMITS.maxOptions),
});
export type QuestionContent = z.infer<typeof QuestionContentSchema>;

export const ProvenanceSchema = z.object({
  kind: z.enum(PROVENANCE),
  source: z.string().max(300).optional(),
  sourceYear: z.number().int().min(1990).max(2100).optional(),
  copyrightStatus: z.enum(['own_work', 'licensed', 'public_domain', 'unknown']),
  officialPyqVerified: z.boolean().default(false),
});

export const QuestionVersionBase = z.object({
  version: z.number().int().min(1),
  content: QuestionContentSchema,
  correct: z.array(z.string().regex(/^[a-f]$/)).min(1).max(LIMITS.maxOptions),
  explanation: LocalizedTextSchema.optional(),
  provenance: ProvenanceSchema,
  createdBy: z.string(),
  reviewedBy: z.string().optional(),
});
/** Cross-field rules, shared by the full schema and by the admin input (zod 4 cannot .pick() a refined object). */
export function refineQuestion(q: { content: { type: string; options: { id: string }[] }; correct: string[]; provenance: { kind: string; officialPyqVerified?: boolean | undefined } }, ctx: z.RefinementCtx) {
  const optionIds = new Set(q.content.options.map((o) => o.id));
  if (optionIds.size !== q.content.options.length) ctx.addIssue({ code: 'custom', message: 'duplicate option ids' });
  for (const c of q.correct) if (!optionIds.has(c)) ctx.addIssue({ code: 'custom', message: `correct answer ${c} is not an option` });
  if (q.content.type !== 'mcq_multi' && q.correct.length !== 1) ctx.addIssue({ code: 'custom', message: 'single-answer question must have exactly one correct option' });
  if (q.provenance.kind === 'official_pyq' && !q.provenance.officialPyqVerified) ctx.addIssue({ code: 'custom', message: 'official PYQ requires verified provenance' });
}
export const QuestionVersionSchema = QuestionVersionBase.superRefine(refineQuestion);
export type QuestionVersion = z.infer<typeof QuestionVersionSchema>;

export const QuestionMetaSchema = z.object({
  subjectId: id, unitId: id, topicId: id, subtopicId: id.optional(),
  difficulty: z.enum(DIFFICULTIES),
  languages: z.array(z.enum(LANGS)).min(1),
  status: z.enum(PUBLICATION_STATUSES),
  currentVersion: z.number().int().min(1),
  publishedVersion: z.number().int().min(1).optional(),
});
export type QuestionMeta = z.infer<typeof QuestionMetaSchema>;

/* ---------- Sanitised, student-facing paper (never contains answers) ---------- */
export const PaperQuestionSchema = z.object({
  qid: id, version: z.number().int().min(1), sectionId: id,
  unitId: id, topicId: id, difficulty: z.enum(DIFFICULTIES),
  content: QuestionContentSchema,
});
export type PaperQuestion = z.infer<typeof PaperQuestionSchema>;

export const PublishedPaperSchema = z.object({
  paperId: id, mockTestId: id, version: z.number().int().min(1),
  questions: z.array(PaperQuestionSchema).min(1).max(LIMITS.maxQuestionsPerPaper),
  contentLabel: z.enum(CONTENT_LABELS),
});
export type PublishedPaper = z.infer<typeof PublishedPaperSchema>;

export const AnswerKeyEntrySchema = z.object({
  correct: z.array(z.string()).min(1),
  sectionId: id, unitId: id, topicId: id, difficulty: z.enum(DIFFICULTIES),
  explanation: LocalizedTextSchema.optional(),
});
export type AnswerKeyEntry = z.infer<typeof AnswerKeyEntrySchema>;
export type AnswerKey = Record<string, AnswerKeyEntry>;

/* ---------- Exam responses ---------- */
export const ResponseSchema = z.object({
  qid: id,
  selected: z.array(z.string().regex(/^[a-f]$/)).max(LIMITS.maxOptions),
  visited: z.boolean(),
  marked: z.boolean(),
  timeSpentMs: z.number().int().min(0).max(4 * 3600 * 1000),
});
export type ExamResponse = z.infer<typeof ResponseSchema>;

/* ---------- Callable inputs ---------- */
export const StartExamInput = z.object({ mockTestId: id, language: z.enum(LANGS).default('en'), clientRequestId: id });
export const SaveResponsesInput = z.object({
  sessionId: id, seq: z.number().int().min(1).max(1_000_000),
  responses: z.array(ResponseSchema).min(1).max(LIMITS.maxResponsesPerSave),
  currentQid: id.optional(),
});
export const SubmitExamInput = z.object({
  sessionId: id, clientRequestId: id,
  finalSeq: z.number().int().min(0).max(1_000_000),
  responses: z.array(ResponseSchema).max(LIMITS.maxQuestionsPerPaper).optional(),
  reason: z.enum(['manual', 'deadline']).default('manual'),
});
export const SessionRefInput = z.object({ sessionId: id });
export const LeadInput = z.object({
  name: z.string().min(1).max(100), email: z.email().max(200).optional(), phone: z.string().regex(/^[0-9+\- ]{7,20}$/).optional(),
  interest: z.string().max(200).optional(), source: z.string().max(100).default('website'),
  campaign: z.string().max(100).optional(), consent: z.literal(true),
  contactPreference: z.enum(['email', 'whatsapp', 'telegram', 'phone']).default('email'),
}).refine((v) => v.email || v.phone, { message: 'email or phone required' });
export const AssignRoleInput = z.object({ uid: id, role: z.enum(ROLES).nullable() });
export const MentorAskInput = z.object({ question: z.string().min(3).max(1500), topicId: id.optional(), mode: z.enum(['concept', 'question_explanation', 'revision', 'study_plan']).default('concept'), ref: z.object({ sessionId: id, qid: id }).optional() });
export const VerifyReportInput = z.object({ reportId: z.string().regex(/^UR-[A-Z0-9]{8,24}$/), sig: z.string().regex(/^[a-f0-9]{16,64}$/) });

/* ---------- Profile (user-editable fields only) ---------- */
export const ProfileUpdateSchema = z.object({
  displayName: z.string().min(1).max(80),
  preferredPaper2Subject: id.nullable(),
  studyGoal: z.enum(['qualify_net', 'jrf', 'assistant_professor', 'phd_entrance']).nullable(),
  examTarget: z.string().regex(/^\d{4}-(06|12)$/).nullable(),
  studyMinutesPerDay: z.number().int().min(15).max(720),
  onboardingComplete: z.boolean(),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
/** Partial and strict: unknown or privileged keys (role, entitlements, email) are rejected, not ignored. */
export const ProfilePatchSchema = ProfileUpdateSchema.partial().strict().refine((v) => Object.keys(v).length > 0, { message: 'nothing to update' });
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;
export const PROFILE_FIELDS = Object.keys(ProfileUpdateSchema.shape) as (keyof ProfileUpdate)[];
