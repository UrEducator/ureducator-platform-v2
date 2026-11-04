/**
 * UrEducator 2.0 — Cloud Functions (Gen 2). Every export is a callable unless noted.
 * Business logic lives in ./services (pure, tested against an in-memory store). This file only wires inputs, auth and limits.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import {
  AssignRoleInput, EmptyInput, LeadInput, MentorAskInput, NotebookQuestionInput, ProfilePatchSchema, ReportInput, ReviewNotebookInput,
  SaveQuestionInput, SaveResponsesInput, SessionRefInput, StartExamInput, SubmitExamInput, TicketInput, TransitionInput,
  UpdateLeadInput, UpdateTicketInput, UpsertCatalogueInput, UpsertMockTestInput, UpsertPlanInput, VerifyReportInput, VerifyPaymentInput,
  CreateOrderInput, MockTestRefInput, AdminListInput,
} from '@ureducator/shared';
import { CONFIG, assertEnvironment } from './infra/config';
import { callable } from './infra/callable';
import { accessToken, authPort, deps } from './infra/runtime';
import { rateLimit } from './infra/ratelimit';
import { AppError } from './infra/errors';
import * as exam from './services/exam';
import * as admin from './services/admin';
import * as learning from './services/learning';
import * as reports from './services/reports';
import * as pay from './services/payments';
import { askMentor as askMentorService, MockAiProvider, VertexGeminiProvider, type AiProvider } from './services/ai';
import { captureLead as captureLeadService } from './services/leads';

const payCfg: pay.PaymentConfig = { enabled: CONFIG.paymentsEnabled, mode: CONFIG.paymentMode };
const aiProvider = (): AiProvider =>
  CONFIG.aiLiveEnabled
    ? new VertexGeminiProvider({ project: process.env.GCLOUD_PROJECT ?? '', location: CONFIG.region, model: process.env.AI_MODEL ?? 'gemini-2.5-flash', token: accessToken })
    : new MockAiProvider();

/* ------------------------------------------------------------------ public */
/** Lets the UI show which switches are on. Contains no project identifiers or secrets. */
export const publicConfig = callable('publicConfig', {
  auth: 'public', input: EmptyInput, rate: { limit: 120, windowSec: 60, by: 'ip' }, memory: '256MiB',
  run: async () => ({ env: CONFIG.env, paymentsEnabled: payCfg.enabled, paymentMode: payCfg.mode, aiLive: CONFIG.aiLiveEnabled, appCheckEnforced: CONFIG.enforceAppCheck }),
});
export const captureLead = callable('captureLead', {
  auth: 'public', input: LeadInput, rate: { limit: 5, windowSec: 3600, by: 'ip' }, memory: '256MiB',
  run: async (c, i) => captureLeadService(c.d, c.ip, i),
});
export const verifyReport = callable('verifyReport', {
  auth: 'public', input: VerifyReportInput, rate: { limit: 30, windowSec: 60, by: 'ip' }, memory: '256MiB',
  run: async (c, i) => reports.verifyReport(c.d, i),
});

/* ------------------------------------------------------------------ student */
export const ensureProfile = callable('ensureProfile', {
  auth: 'user', input: EmptyInput, rate: { limit: 30, windowSec: 3600, by: 'uid' }, memory: '256MiB',
  run: async (c) => learning.ensureProfile(c.d, c.actor),
});
export const updateProfile = callable('updateProfile', {
  auth: 'user', input: ProfilePatchSchema, rate: { limit: 60, windowSec: 3600, by: 'uid' }, memory: '256MiB',
  run: async (c, i) => learning.updateProfile(c.d, c.actor, i),
});
export const startExam = callable('startExam', {
  auth: 'verified', input: StartExamInput, rate: { limit: 30, windowSec: 3600, by: 'uid' }, memory: '512MiB',
  run: async (c, i) => exam.startExam(c.d, c.actor, i),
});
export const getExamSession = callable('getExamSession', {
  auth: 'user', input: SessionRefInput, memory: '512MiB',
  run: async (c, i) => exam.getSession(c.d, c.actor, i.sessionId),
});
// Autosave is deliberately NOT rate limited through Firestore (that would double its cost). It is bounded by: session ownership,
// monotonic seq numbers, Zod size limits, max instances and (when enforced) App Check.
export const saveResponses = callable('saveResponses', {
  auth: 'user', input: SaveResponsesInput, memory: '256MiB', timeoutSeconds: 20,
  run: async (c, i) => exam.saveResponses(c.d, c.actor, i),
});
export const submitExam = callable('submitExam', {
  auth: 'user', input: SubmitExamInput, rate: { limit: 60, windowSec: 3600, by: 'uid' }, memory: '512MiB', timeoutSeconds: 60,
  run: async (c, i) => exam.submitExam(c.d, c.actor, i),
});
export const getExamResult = callable('getExamResult', {
  auth: 'user', input: SessionRefInput, memory: '512MiB',
  run: async (c, i) => exam.getExamResult(c.d, c.actor, i.sessionId),
});
export const generatePlan = callable('generatePlan', {
  auth: 'user', input: EmptyInput, rate: { limit: 20, windowSec: 3600, by: 'uid' }, memory: '256MiB',
  run: async (c) => learning.generatePlan(c.d, c.actor),
});
export const reviewNotebook = callable('reviewNotebook', {
  auth: 'user', input: ReviewNotebookInput, memory: '256MiB',
  run: async (c, i) => learning.reviewNotebook(c.d, c.actor, i),
});
export const listNotebook = callable('listNotebook', {
  auth: 'user', input: EmptyInput, memory: '256MiB',
  run: async (c) => learning.listNotebook(c.d, c.actor),
});
export const notebookQuestion = callable('notebookQuestion', {
  auth: 'user', input: NotebookQuestionInput, memory: '256MiB',
  run: async (c, i) => learning.notebookQuestion(c.d, c.actor, i),
});
export const createTicket = callable('createTicket', {
  auth: 'user', input: TicketInput, rate: { limit: 10, windowSec: 86_400, by: 'uid' }, memory: '256MiB',
  run: async (c, i) => learning.createTicket(c.d, { ...c.actor, ...(c.actor.email ? { email: c.actor.email } : {}) }, i),
});
export const askMentor = callable('askMentor', {
  auth: 'verified', input: MentorAskInput, rate: { limit: 40, windowSec: 3600, by: 'uid' }, memory: '512MiB', timeoutSeconds: 60,
  run: async (c, i) => askMentorService(c.d, aiProvider(), c.actor, i),
});
export const generateReport = callable('generateReport', {
  auth: 'user', input: ReportInput, rate: { limit: 20, windowSec: 3600, by: 'uid' }, memory: '512MiB', timeoutSeconds: 60,
  run: async (c, i) => reports.generateReport(c.d, c.actor, i, { baseUrl: CONFIG.publicBaseUrl }),
});

/* ------------------------------------------------------------------ owner bootstrap & roles */
export const claimOwner = callable('claimOwner', {
  auth: 'verified', input: EmptyInput, rate: { limit: 10, windowSec: 3600, by: 'uid' }, memory: '256MiB',
  run: async (c) => admin.claimOwner(c.d, authPort, c.actor, process.env.OWNER_BOOTSTRAP_EMAIL ?? ''),
});
export const assignRole = callable('assignRole', {
  auth: 'verified', input: AssignRoleInput, rate: { limit: 60, windowSec: 3600, by: 'uid' }, memory: '256MiB',
  run: async (c, i) => admin.assignRole(c.d, authPort, c.actor, i),
});

/* ------------------------------------------------------------------ admin / content studio */
const staff = { auth: 'verified' as const, memory: '512MiB' as const };
export const adminList = callable('adminList', { ...staff, input: AdminListInput, run: async (c, i) => admin.adminList(c.d, c.actor, i) });
export const adminUpsertCatalogue = callable('adminUpsertCatalogue', { ...staff, input: UpsertCatalogueInput, run: async (c, i) => admin.upsertCatalogue(c.d, c.actor, i) });
export const adminSaveQuestion = callable('adminSaveQuestion', { ...staff, input: SaveQuestionInput, run: async (c, i) => admin.saveQuestion(c.d, c.actor, i) });
export const adminTransitionQuestion = callable('adminTransitionQuestion', { ...staff, input: TransitionInput, run: async (c, i) => admin.transitionQuestion(c.d, c.actor, i) });
export const adminUpsertMockTest = callable('adminUpsertMockTest', { ...staff, input: UpsertMockTestInput, run: async (c, i) => admin.upsertMockTest(c.d, c.actor, i) });
export const adminPublishMockTest = callable('adminPublishMockTest', { ...staff, input: MockTestRefInput, timeoutSeconds: 60, run: async (c, i) => admin.publishMockTest(c.d, c.actor, i.mockTestId) });
export const adminUnpublishMockTest = callable('adminUnpublishMockTest', { ...staff, input: MockTestRefInput, run: async (c, i) => admin.unpublishMockTest(c.d, c.actor, i.mockTestId) });
export const adminUpsertPlan = callable('adminUpsertPlan', { ...staff, input: UpsertPlanInput, run: async (c, i) => admin.upsertPlan(c.d, c.actor, i) });
export const adminUpdateTicket = callable('adminUpdateTicket', { ...staff, input: UpdateTicketInput, run: async (c, i) => admin.updateTicket(c.d, c.actor, i) });
export const adminUpdateLead = callable('adminUpdateLead', { ...staff, input: UpdateLeadInput, run: async (c, i) => admin.updateLead(c.d, c.actor, i) });

/* ------------------------------------------------------------------ payments (architecture only) */
/**
 * While PAYMENTS_ENABLED=false these callables exist so the UI can be built against them, but every call is rejected with
 * PAYMENTS_DISABLED before any data is read, and no secret is bound, requested or read. The webhook endpoint is not exported at all.
 */
const payEnabled = payCfg.enabled;
const keyId = payEnabled ? defineSecret('RAZORPAY_KEY_ID') : null;
const keySecret = payEnabled ? defineSecret('RAZORPAY_KEY_SECRET') : null;
const webhookSecret = payEnabled ? defineSecret('RAZORPAY_WEBHOOK_SECRET') : null;

export const createOrder = callable('createOrder', {
  auth: 'verified', input: CreateOrderInput, rate: { limit: 20, windowSec: 3600, by: 'uid' }, memory: '256MiB',
  ...(keyId && keySecret ? { secrets: [keyId, keySecret] } : {}),
  run: async (c, i) => pay.createOrder(c.d, payCfg, keyId && keySecret ? new pay.RazorpayGateway({ keyId: keyId.value(), keySecret: keySecret.value() }) : null, c.actor, i),
});
export const verifyPayment = callable('verifyPayment', {
  auth: 'verified', input: VerifyPaymentInput, rate: { limit: 30, windowSec: 3600, by: 'uid' }, memory: '256MiB',
  ...(keySecret ? { secrets: [keySecret] } : {}),
  run: async (c, i) => pay.verifyPayment(c.d, payCfg, keySecret ? keySecret.value() : null, c.actor, i),
});

/** Exported only when payments are enabled. Needs the raw body for the signature, so it is a plain HTTP function. */
export const razorpayWebhook = payEnabled && webhookSecret
  ? onRequest({ region: CONFIG.region, maxInstances: CONFIG.maxInstances, minInstances: 0, secrets: [webhookSecret], cors: false }, async (req, res) => {
      try {
        assertEnvironment();
        if (req.method !== 'POST') { res.status(405).end(); return; }
        const d = deps();
        await rateLimit(d.store, d.clock, { bucket: 'webhook', subject: req.ip ?? 'unknown', limit: 600, windowSec: 60 });
        const raw = req.rawBody; const sig = String(req.header('x-razorpay-signature') ?? ''); const id = String(req.header('x-razorpay-event-id') ?? '');
        const out = await pay.handleWebhook(d, payCfg, webhookSecret.value(), raw, sig, id);
        res.status(200).json({ ok: true, ...out });
      } catch (e) {
        if (e instanceof AppError) { res.status(e.code === 'permission-denied' ? 401 : e.code === 'resource-exhausted' ? 429 : e.code === 'invalid-argument' ? 400 : 409).json({ ok: false, reason: e.reason }); return; }
        res.status(500).json({ ok: false });
      }
    })
  : undefined;
