import { z } from 'zod';
import { CONTENT_LABELS, LANGS, PUBLICATION_STATUSES, DIFFICULTIES } from './constants';
import { QuestionVersionBase, LocalizedTextSchema, refineQuestion } from './schemas';
import { BlueprintSchema } from './blueprint';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);

export const SaveQuestionInput = z.object({
  questionId: id.optional(),
  meta: z.object({ subjectId: id, unitId: id, topicId: id, subtopicId: id.optional(), difficulty: z.enum(DIFFICULTIES), languages: z.array(z.enum(LANGS)).min(1) }),
  version: QuestionVersionBase.pick({ content: true, correct: true, explanation: true, provenance: true }).superRefine(refineQuestion),
});
export const TransitionInput = z.object({ questionId: id, version: z.number().int().min(1), to: z.enum(PUBLICATION_STATUSES) });
export const UpsertCatalogueInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('subject'), id, paper: z.enum(['paper1', 'paper2']), name: LocalizedTextSchema, label: z.enum(CONTENT_LABELS), sourceRef: z.string().max(300).optional(), order: z.number().int().min(0).default(0) }),
  z.object({ kind: z.literal('unit'), id, subjectId: id, name: LocalizedTextSchema, order: z.number().int().min(0).default(0), objectives: z.array(z.string().max(300)).max(20).default([]) }),
  z.object({ kind: z.literal('topic'), id, subjectId: id, unitId: id, name: LocalizedTextSchema, order: z.number().int().min(0).default(0), subtopics: z.array(z.object({ id, name: z.string().max(200) })).max(40).default([]) }),
]);
export const UpsertMockTestInput = z.object({
  mockTestId: id.optional(), title: z.string().min(3).max(140),
  kind: z.enum(['full', 'paper1', 'paper2', 'unit', 'topic', 'pyq', 'custom']),
  blueprintId: id, access: z.enum(['free', 'paid']), collectionId: id.optional(), timed: z.boolean(), shuffle: z.boolean(),
  opensAtMs: z.number().int().optional(), closesAtMs: z.number().int().optional(),
  revealPolicy: z.enum(['immediate', 'after_close']), contentLabel: z.enum(CONTENT_LABELS), description: z.string().max(600).optional(),
  questionRefs: z.array(z.object({ qid: id, version: z.number().int().min(1), sectionId: id })).max(200),
});
export const MockTestRefInput = z.object({ mockTestId: id });
export const AdminListInput = z.object({
  collection: z.enum(['users', 'roles', 'subjects', 'units', 'topics', 'questions', 'mockTests', 'examBlueprints', 'leads', 'supportTickets', 'auditLogs', 'orders', 'paymentEvents', 'plans', 'coupons', 'resources']),
  limit: z.number().int().min(1).max(50).default(25), startAfter: id.optional(),
  status: z.string().max(40).optional(),
});
export const UpsertPlanInput = z.object({
  planId: id, name: z.string().min(2).max(80), pricePaise: z.number().int().min(0).max(100_000_00), durationDays: z.number().int().min(1).max(1100),
  entitlements: z.array(id).min(1).max(20), published: z.boolean().default(false),
});
export const ReviewNotebookInput = z.object({ entryId: id, quality: z.number().int().min(0).max(5) });
export const NotebookQuestionInput = z.object({ entryId: id });
export const TicketInput = z.object({ subject: z.string().min(3).max(120), message: z.string().min(10).max(2000), category: z.enum(['account', 'technical', 'content', 'billing', 'other']) });
export const UpdateTicketInput = z.object({ ticketId: id, status: z.enum(['open', 'in_progress', 'resolved']), note: z.string().max(1000).optional() });
export const UpdateLeadInput = z.object({ leadId: id, status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']) });
export const ReportInput = z.object({ sessionId: id });
export const CreateOrderInput = z.object({ planId: id, couponCode: z.string().max(40).optional() });
export const VerifyPaymentInput = z.object({ orderId: id, razorpayPaymentId: z.string().max(60), razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/) });
export const EmptyInput = z.object({}).strict();

export const GetQuestionInput = z.object({ questionId: id, version: z.number().int().min(1).optional() });
/** The server owns `version` and decides who may mark a blueprint as matching the official pattern. */
export const UpsertBlueprintInput = z.object({ blueprint: BlueprintSchema });
