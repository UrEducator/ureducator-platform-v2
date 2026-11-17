/**
 * The complete endpoint table. index.ts wraps each entry as a Cloud Function; the local end-to-end harness wraps the same
 * entries with the same pipeline, so there is one definition of inputs, auth and limits.
 */
import {
  AdminListInput, AssignRoleInput, CreateOrderInput, EmptyInput, GetQuestionInput, UpsertBlueprintInput, LeadInput, MentorAskInput, MockTestRefInput, NotebookQuestionInput,
  ProfilePatchSchema, ReportInput, ReviewNotebookInput, SaveQuestionInput, SaveResponsesInput, SessionRefInput, StartExamInput, SubmitExamInput,
  TicketInput, TransitionInput, UpdateLeadInput, UpdateTicketInput, UpsertCatalogueInput, UpsertMockTestInput, UpsertPlanInput,
  VerifyPaymentInput, VerifyReportInput, EscalateTicketInput, RecordPrintAuditInput,
} from '@ureducator/shared';
import { define } from './infra/dispatch';
import { CONFIG } from './infra/config';
import * as exam from './services/exam';
import * as admin from './services/admin';
import * as learning from './services/learning';
import * as reports from './services/reports';
import * as pay from './services/payments';
import { askMentor, MockAiProvider, VertexGeminiProvider, type AiProvider } from './services/ai';
import { captureLead } from './services/leads';

export const payCfg = (): pay.PaymentConfig => ({ enabled: CONFIG.paymentsEnabled, mode: CONFIG.paymentMode });
export const aiProvider = (): AiProvider =>
  CONFIG.aiLiveEnabled
    ? new VertexGeminiProvider({ project: process.env.GCLOUD_PROJECT ?? '', location: CONFIG.region, model: process.env.AI_MODEL ?? 'gemini-2.5-flash', token: async () => (await import('./infra/runtime')).accessToken() })
    : new MockAiProvider();

/** Names of secrets an endpoint needs. They are bound (and Secret Manager is touched) only when payments are enabled at deploy time. */
export const SECRETS = { createOrder: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'], verifyPayment: ['RAZORPAY_KEY_SECRET'], razorpayWebhook: ['RAZORPAY_WEBHOOK_SECRET'] } as const;

const staff = { auth: 'verified' as const, memory: '512MiB' as const };

export const ENDPOINTS = {
  /* public */
  publicConfig: define({ auth: 'public', input: EmptyInput, rate: { limit: 120, windowSec: 60, by: 'ip' }, memory: '256MiB',
    run: async () => ({ env: CONFIG.env, paymentsEnabled: CONFIG.paymentsEnabled, paymentMode: CONFIG.paymentMode, aiLive: CONFIG.aiLiveEnabled, appCheckEnforced: CONFIG.enforceAppCheck }) }),
  captureLead: define({ auth: 'public', input: LeadInput, rate: { limit: 5, windowSec: 3600, by: 'ip' }, memory: '256MiB', run: async (c, i) => captureLead(c.d, c.ip, i) }),
  verifyReport: define({ auth: 'public', input: VerifyReportInput, rate: { limit: 30, windowSec: 60, by: 'ip' }, memory: '256MiB', run: async (c, i) => reports.verifyReport(c.d, i) }),

  /* student */
  ensureProfile: define({ auth: 'user', input: EmptyInput, rate: { limit: 30, windowSec: 3600, by: 'uid' }, memory: '256MiB', run: async (c) => learning.ensureProfile(c.d, c.actor) }),
  updateProfile: define({ auth: 'user', input: ProfilePatchSchema, rate: { limit: 60, windowSec: 3600, by: 'uid' }, memory: '256MiB', run: async (c, i) => learning.updateProfile(c.d, c.actor, i) }),
  startExam: define({ auth: 'verified', input: StartExamInput, rate: { limit: 30, windowSec: 3600, by: 'uid' }, memory: '512MiB', run: async (c, i) => exam.startExam(c.d, c.actor, i) }),
  getExamSession: define({ auth: 'user', input: SessionRefInput, memory: '512MiB', run: async (c, i) => exam.getSession(c.d, c.actor, i.sessionId) }),
  // Autosave is deliberately not rate limited through Firestore (that would double its cost). It is bounded by session ownership,
  // monotonic sequence numbers, schema size limits, max instances and, when enforced, App Check.
  saveResponses: define({ auth: 'user', input: SaveResponsesInput, memory: '256MiB', timeoutSeconds: 20, run: async (c, i) => exam.saveResponses(c.d, c.actor, i) }),
  submitExam: define({ auth: 'user', input: SubmitExamInput, rate: { limit: 60, windowSec: 3600, by: 'uid' }, memory: '512MiB', timeoutSeconds: 60, run: async (c, i) => exam.submitExam(c.d, c.actor, i) }),
  getExamResult: define({ auth: 'user', input: SessionRefInput, memory: '512MiB', run: async (c, i) => exam.getExamResult(c.d, c.actor, i.sessionId) }),
  generatePlan: define({ auth: 'user', input: EmptyInput, rate: { limit: 20, windowSec: 3600, by: 'uid' }, memory: '256MiB', run: async (c) => learning.generatePlan(c.d, c.actor) }),
  listNotebook: define({ auth: 'user', input: EmptyInput, memory: '256MiB', run: async (c) => learning.listNotebook(c.d, c.actor) }),
  reviewNotebook: define({ auth: 'user', input: ReviewNotebookInput, memory: '256MiB', run: async (c, i) => learning.reviewNotebook(c.d, c.actor, i) }),
  notebookQuestion: define({ auth: 'user', input: NotebookQuestionInput, memory: '256MiB', run: async (c, i) => learning.notebookQuestion(c.d, c.actor, i) }),
  createTicket: define({ auth: 'user', input: TicketInput, rate: { limit: 10, windowSec: 86_400, by: 'uid' }, memory: '256MiB', run: async (c, i) => learning.createTicket(c.d, c.actor, i) }),
  askMentor: define({ auth: 'verified', input: MentorAskInput, rate: { limit: 40, windowSec: 3600, by: 'uid' }, memory: '512MiB', timeoutSeconds: 60, run: async (c, i) => askMentor(c.d, aiProvider(), c.actor, i) }),
  generateReport: define({ auth: 'user', input: ReportInput, rate: { limit: 20, windowSec: 3600, by: 'uid' }, memory: '512MiB', timeoutSeconds: 60, run: async (c, i) => reports.generateReport(c.d, c.actor, i, { baseUrl: CONFIG.publicBaseUrl }) }),

  /* owner bootstrap and roles */
  claimOwner: define({ auth: 'verified', input: EmptyInput, rate: { limit: 10, windowSec: 3600, by: 'uid' }, memory: '256MiB', run: async (c) => admin.claimOwner(c.d, c.auth, c.actor, process.env.OWNER_BOOTSTRAP_EMAIL ?? '') }),
  assignRole: define({ auth: 'verified', input: AssignRoleInput, rate: { limit: 60, windowSec: 3600, by: 'uid' }, memory: '256MiB', run: async (c, i) => admin.assignRole(c.d, c.auth, c.actor, i) }),

  /* admin / content studio */
  adminList: define({ ...staff, input: AdminListInput, run: async (c, i) => admin.adminList(c.d, c.actor, i) }),
  adminOverview: define({ ...staff, input: EmptyInput, run: async (c) => admin.overview(c.d, c.actor) }),
  adminGetQuestion: define({ ...staff, input: GetQuestionInput, run: async (c, i) => admin.getQuestion(c.d, c.actor, i) }),
  adminUpsertBlueprint: define({ ...staff, input: UpsertBlueprintInput, run: async (c, i) => admin.upsertBlueprint(c.d, c.actor, i) }),
  adminUpsertCatalogue: define({ ...staff, input: UpsertCatalogueInput, run: async (c, i) => admin.upsertCatalogue(c.d, c.actor, i) }),
  adminSaveQuestion: define({ ...staff, input: SaveQuestionInput, run: async (c, i) => admin.saveQuestion(c.d, c.actor, i) }),
  adminTransitionQuestion: define({ ...staff, input: TransitionInput, run: async (c, i) => admin.transitionQuestion(c.d, c.actor, i) }),
  adminUpsertMockTest: define({ ...staff, input: UpsertMockTestInput, run: async (c, i) => admin.upsertMockTest(c.d, c.actor, i) }),
  adminPublishMockTest: define({ ...staff, input: MockTestRefInput, timeoutSeconds: 60, run: async (c, i) => admin.publishMockTest(c.d, c.actor, i.mockTestId) }),
  adminUnpublishMockTest: define({ ...staff, input: MockTestRefInput, run: async (c, i) => admin.unpublishMockTest(c.d, c.actor, i.mockTestId) }),
  adminUpsertPlan: define({ ...staff, input: UpsertPlanInput, run: async (c, i) => admin.upsertPlan(c.d, c.actor, i) }),
  adminUpdateTicket: define({ ...staff, input: UpdateTicketInput, run: async (c, i) => admin.updateTicket(c.d, c.actor, i) }),
  adminUpdateLead: define({ ...staff, input: UpdateLeadInput, run: async (c, i) => admin.updateLead(c.d, c.actor, i) }),

  /* payments: architecture only. Every call is rejected with PAYMENTS_DISABLED while PAYMENTS_ENABLED=false. */
  createOrder: define({ auth: 'verified', input: CreateOrderInput, rate: { limit: 20, windowSec: 3600, by: 'uid' }, memory: '256MiB',
    run: async (c, i) => { const id = c.secret('RAZORPAY_KEY_ID'); const sec = c.secret('RAZORPAY_KEY_SECRET'); return pay.createOrder(c.d, payCfg(), id && sec ? new pay.RazorpayGateway({ keyId: id, keySecret: sec }) : null, c.actor, i); } }),
  verifyPayment: define({ auth: 'verified', input: VerifyPaymentInput, rate: { limit: 30, windowSec: 3600, by: 'uid' }, memory: '256MiB',
    run: async (c, i) => pay.verifyPayment(c.d, payCfg(), c.secret('RAZORPAY_KEY_SECRET'), c.actor, i) }),

  /* tickets and audit */
  adminEscalateTicket: define({ ...staff, input: EscalateTicketInput, memory: '256MiB',
    run: async (c, i) => admin.adminEscalateTicket(c.d, c.actor, i) }),
  recordPrintAudit: define({ auth: 'user', input: RecordPrintAuditInput, rate: { limit: 60, windowSec: 3600, by: 'uid' }, memory: '256MiB',
    run: async (c, i) => admin.recordPrintAudit(c.d, c.actor, i) }),
} as const;

export type EndpointName = keyof typeof ENDPOINTS;
