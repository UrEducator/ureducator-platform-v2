import type { z } from 'zod';
import type {
  AdminListInput,
  CreateOrderInput,
  EmptyInput,
  GetQuestionInput,
  MockTestRefInput,
  NotebookQuestionInput,
  ReportInput,
  ReviewNotebookInput,
  SaveQuestionInput,
  TicketInput,
  TransitionInput,
  UpdateLeadInput,
  UpdateTicketInput,
  UpsertBlueprintInput,
  UpsertCatalogueInput,
  UpsertMockTestInput,
  UpsertPlanInput,
  VerifyPaymentInput,
} from './adminSchemas';
import type {
  AssignRoleInput,
  ExamResponse,
  LeadInput,
  MentorAskInput,
  PaperQuestion,
  ProfilePatchSchema,
  SaveResponsesInput,
  SessionRefInput,
  StartExamInput,
  SubmitExamInput,
  VerifyReportInput,
} from './schemas';
import type { Blueprint } from './blueprint';
import type { Lang, SessionStatus } from './constants';
import type { PlanTask } from './studyPlan';
import type { LocalizedText } from './i18n';

export type EndpointName =
  | 'publicConfig'
  | 'captureLead'
  | 'verifyReport'
  | 'ensureProfile'
  | 'updateProfile'
  | 'startExam'
  | 'getExamSession'
  | 'saveResponses'
  | 'submitExam'
  | 'getExamResult'
  | 'generatePlan'
  | 'listNotebook'
  | 'reviewNotebook'
  | 'notebookQuestion'
  | 'createTicket'
  | 'askMentor'
  | 'generateReport'
  | 'claimOwner'
  | 'assignRole'
  | 'adminList'
  | 'adminOverview'
  | 'adminGetQuestion'
  | 'adminUpsertBlueprint'
  | 'adminUpsertCatalogue'
  | 'adminSaveQuestion'
  | 'adminTransitionQuestion'
  | 'adminUpsertMockTest'
  | 'adminPublishMockTest'
  | 'adminUnpublishMockTest'
  | 'adminUpsertPlan'
  | 'adminUpdateTicket'
  | 'adminUpdateLead'
  | 'createOrder'
  | 'verifyPayment';

export type EndpointInputs = {
  publicConfig: z.input<typeof EmptyInput>;
  captureLead: z.input<typeof LeadInput>;
  verifyReport: z.input<typeof VerifyReportInput>;
  ensureProfile: z.input<typeof EmptyInput>;
  updateProfile: z.input<typeof ProfilePatchSchema>;
  startExam: z.input<typeof StartExamInput>;
  getExamSession: z.input<typeof SessionRefInput>;
  saveResponses: z.input<typeof SaveResponsesInput>;
  submitExam: z.input<typeof SubmitExamInput>;
  getExamResult: z.input<typeof SessionRefInput>;
  generatePlan: z.input<typeof EmptyInput>;
  listNotebook: z.input<typeof EmptyInput>;
  reviewNotebook: z.input<typeof ReviewNotebookInput>;
  notebookQuestion: z.input<typeof NotebookQuestionInput>;
  createTicket: z.input<typeof TicketInput>;
  askMentor: z.input<typeof MentorAskInput>;
  generateReport: z.input<typeof ReportInput>;
  claimOwner: z.input<typeof EmptyInput>;
  assignRole: z.input<typeof AssignRoleInput>;
  adminList: z.input<typeof AdminListInput>;
  adminOverview: z.input<typeof EmptyInput>;
  adminGetQuestion: z.input<typeof GetQuestionInput>;
  adminUpsertBlueprint: z.input<typeof UpsertBlueprintInput>;
  adminUpsertCatalogue: z.input<typeof UpsertCatalogueInput>;
  adminSaveQuestion: z.input<typeof SaveQuestionInput>;
  adminTransitionQuestion: z.input<typeof TransitionInput>;
  adminUpsertMockTest: z.input<typeof UpsertMockTestInput>;
  adminPublishMockTest: z.input<typeof MockTestRefInput>;
  adminUnpublishMockTest: z.input<typeof MockTestRefInput>;
  adminUpsertPlan: z.input<typeof UpsertPlanInput>;
  adminUpdateTicket: z.input<typeof UpdateTicketInput>;
  adminUpdateLead: z.input<typeof UpdateLeadInput>;
  createOrder: z.input<typeof CreateOrderInput>;
  verifyPayment: z.input<typeof VerifyPaymentInput>;
};

export type ExamSessionPayload = {
  sessionId: string;
  serverNowMs: number;
  startedAtMs: number;
  deadlineMs: number;
  status: SessionStatus;
  lastSeq: number;
  language: Lang;
  testTitle: string;
  blueprint: {
    durationMinutes: number;
    sections: Blueprint['sections'];
    marking: { correct: number; incorrect: number };
    languages: Lang[];
  };
  questions: PaperQuestion[];
  responses: Record<string, ExamResponse>;
};

export type ExamResultPayload = {
  summary: {
    marks: number;
    maxMarks: number;
    correct: number;
    incorrect: number;
    unattempted: number;
    attempted: number;
    accuracy: number;
    attemptRate: number;
    percentage: number;
    durationMs: number;
    timeSpentMs: number;
    submittedAtMs: number;
    reason: string;
    bySection: Record<string, unknown>;
    byUnit: Record<string, unknown>;
    byTopic: Record<string, unknown>;
    byDifficulty: Record<string, unknown>;
    [key: string]: unknown;
  };
  testTitle: string;
  review: Array<{
    question?: PaperQuestion;
    selected: string[];
    marked: boolean;
    correct: string[];
    explanation?: LocalizedText | null;
    outcome: string;
    marks: number;
    timeMs: number;
  }> | null;
  reviewAvailableAtMs: number;
};

export type EndpointOutputs = {
  publicConfig: { env: string; paymentsEnabled: boolean; paymentMode: string; aiLive: boolean; appCheckEnforced: boolean };
  captureLead: { ok: boolean };
  verifyReport:
    | { valid: false }
    | { valid: true; testTitle: string; marks: number; maxMarks: number; issuedAt: string; notice: string };
  ensureProfile: { profile: unknown };
  updateProfile: { profile: unknown };
  startExam: { sessionId: string; serverNowMs: number; deadlineMs: number; status: string };
  getExamSession: ExamSessionPayload;
  saveResponses: { ok: boolean; status: string; lastSeq: number; serverNowMs: number; duplicate?: boolean };
  submitExam: { resultId: string; marks: number; maxMarks: number; percentage: number };
  getExamResult: ExamResultPayload;
  generatePlan: { tasks: PlanTask[] };
  listNotebook: { entries: Array<{ id: string; qid: string; topicId: string; unitId: string; sessionId: string; kind: string; createdAtMs: number; review: unknown }>; hidden: number };
  reviewNotebook: { review: unknown };
  notebookQuestion: {
    question: PaperQuestion & {
      content: {
        type: 'mcq_single' | 'mcq_multi';
        stem: LocalizedText;
        options: Array<{ id: string; text: LocalizedText }>;
      };
    };
    correct: string[];
    explanation?: LocalizedText | null;
  };
  createTicket: { ticketId: string; ok: boolean };
  askMentor: {
    text: string;
    citations: Array<{ id: string; title: string; label?: string }>;
    grounded: boolean;
    provider: string;
  };
  generateReport: { base64: string; mime: string; fileName: string; reportUrl?: string };
  claimOwner: { ok: boolean };
  assignRole: { ok: boolean };
  adminList: { items: Array<Record<string, unknown>>; next: string | null };
  adminOverview: { role: string; counts: Record<string, number> };
  adminGetQuestion: { questionId: string; head: Record<string, unknown>; versions: Array<{ version: number; status: string; createdBy: string; createdAtMs: number | null }>; version: Record<string, unknown> };
  adminUpsertBlueprint: { id: string; version: number; officialPatternVerified: boolean };
  adminUpsertCatalogue: { id: string; version: number };
  adminSaveQuestion: { questionId: string; version: number };
  adminTransitionQuestion: { questionId: string; version: number; status: string };
  adminUpsertMockTest: { mockTestId: string };
  adminPublishMockTest: { mockTestId: string; published: boolean };
  adminUnpublishMockTest: { mockTestId: string; published: boolean };
  adminUpsertPlan: { planId: string };
  adminUpdateTicket: { ticketId: string; ok: boolean };
  adminUpdateLead: { leadId: string; ok: boolean };
  createOrder: { orderId: string; amountPaise: number; currency: string; razorpayOrderId?: string };
  verifyPayment: { success: boolean; activated: boolean };
};

export type In<N extends EndpointName> = EndpointInputs[N];
export type Out<N extends EndpointName> = EndpointOutputs[N];
