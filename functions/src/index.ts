/**
 * UrEducator 2.0 — Cloud Functions (Gen 2). Every export is a callable generated from the endpoint table in ./endpoints.ts.
 * Business logic lives in ./services (pure and tested against an in-memory store).
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { CONFIG, assertEnvironment } from './infra/config';
import { callable } from './infra/callable';
import { deps } from './infra/runtime';
import { rateLimit } from './infra/ratelimit';
import { AppError } from './infra/errors';
import { ENDPOINTS as E, SECRETS, payCfg } from './endpoints';
import * as pay from './services/payments';

/** Secrets are declared (and therefore required in Secret Manager) only when payments are enabled for this deployment. */
const secretFor = (names: readonly string[]) => (CONFIG.paymentsEnabled ? names.map((n) => defineSecret(n)) : []);

export const publicConfig = callable('publicConfig', E.publicConfig);
export const captureLead = callable('captureLead', E.captureLead);
export const verifyReport = callable('verifyReport', E.verifyReport);

export const ensureProfile = callable('ensureProfile', E.ensureProfile);
export const updateProfile = callable('updateProfile', E.updateProfile);
export const startExam = callable('startExam', E.startExam);
export const getExamSession = callable('getExamSession', E.getExamSession);
export const saveResponses = callable('saveResponses', E.saveResponses);
export const submitExam = callable('submitExam', E.submitExam);
export const getExamResult = callable('getExamResult', E.getExamResult);
export const generatePlan = callable('generatePlan', E.generatePlan);
export const listNotebook = callable('listNotebook', E.listNotebook);
export const reviewNotebook = callable('reviewNotebook', E.reviewNotebook);
export const notebookQuestion = callable('notebookQuestion', E.notebookQuestion);
export const createTicket = callable('createTicket', E.createTicket);
export const askMentor = callable('askMentor', E.askMentor);
export const generateReport = callable('generateReport', E.generateReport);

export const claimOwner = callable('claimOwner', E.claimOwner);
export const assignRole = callable('assignRole', E.assignRole);

export const adminList = callable('adminList', E.adminList);
export const adminUpsertCatalogue = callable('adminUpsertCatalogue', E.adminUpsertCatalogue);
export const adminSaveQuestion = callable('adminSaveQuestion', E.adminSaveQuestion);
export const adminTransitionQuestion = callable('adminTransitionQuestion', E.adminTransitionQuestion);
export const adminUpsertMockTest = callable('adminUpsertMockTest', E.adminUpsertMockTest);
export const adminPublishMockTest = callable('adminPublishMockTest', E.adminPublishMockTest);
export const adminUnpublishMockTest = callable('adminUnpublishMockTest', E.adminUnpublishMockTest);
export const adminUpsertPlan = callable('adminUpsertPlan', E.adminUpsertPlan);
export const adminUpdateTicket = callable('adminUpdateTicket', E.adminUpdateTicket);
export const adminUpdateLead = callable('adminUpdateLead', E.adminUpdateLead);

export const createOrder = callable('createOrder', E.createOrder, secretFor(SECRETS.createOrder));
export const verifyPayment = callable('verifyPayment', E.verifyPayment, secretFor(SECRETS.verifyPayment));

/** Exported only when payments are enabled. Needs the raw body for the signature, so it is a plain HTTP function. */
const [webhookSecret] = secretFor(SECRETS.razorpayWebhook);
export const razorpayWebhook = CONFIG.paymentsEnabled && webhookSecret
  ? onRequest({ region: CONFIG.region, maxInstances: CONFIG.maxInstances, minInstances: 0, secrets: [webhookSecret], cors: false }, async (req, res) => {
      try {
        assertEnvironment();
        if (req.method !== 'POST') { res.status(405).end(); return; }
        const d = deps();
        await rateLimit(d.store, d.clock, { bucket: 'webhook', subject: req.ip ?? 'unknown', limit: 600, windowSec: 60 });
        const out = await pay.handleWebhook(d, payCfg(), webhookSecret.value(), req.rawBody, String(req.header('x-razorpay-signature') ?? ''), String(req.header('x-razorpay-event-id') ?? ''));
        res.status(200).json({ ok: true, ...out });
      } catch (e) {
        if (e instanceof AppError) { res.status(e.code === 'permission-denied' ? 401 : e.code === 'resource-exhausted' ? 429 : e.code === 'invalid-argument' ? 400 : 409).json({ ok: false, reason: e.reason }); return; }
        res.status(500).json({ ok: false });
      }
    })
  : undefined;
