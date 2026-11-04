import { randomUUID } from 'node:crypto';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import type { z, ZodType } from 'zod';
import { AppError } from './errors';
import { CONFIG, assertEnvironment } from './config';
import { deps } from './runtime';
import { rateLimit } from './ratelimit';
import type { Deps } from '../services/exam';
import type { StaffActor } from '../services/admin';

export type Ctx = { d: Deps; actor: StaffActor; ip: string; cid: string; name: string };
type Auth = 'public' | 'user' | 'verified';
type Cfg<S extends ZodType> = {
  input: S; auth: Auth; run: (c: Ctx, i: z.infer<S>) => Promise<unknown>;
  rate?: { limit: number; windowSec: number; by: 'uid' | 'ip' };
  memory?: '256MiB' | '512MiB' | '1GiB'; timeoutSeconds?: number;
};

let checked = false;
/** Wraps every callable with: environment guard, validation, auth, rate limit, structured logging, safe errors. */
export function callable<S extends ZodType>(name: string, cfg: Cfg<S>) {
  return onCall(
    {
      region: CONFIG.region, maxInstances: CONFIG.maxInstances, minInstances: 0, cpu: 1, concurrency: 40,
      memory: cfg.memory ?? '512MiB', timeoutSeconds: cfg.timeoutSeconds ?? 30,
      cors: CONFIG.allowedOrigins.length ? CONFIG.allowedOrigins : false,
      enforceAppCheck: CONFIG.enforceAppCheck,
    },
    async (req: CallableRequest) => {
      const cid = String(req.rawRequest.headers['x-request-id'] ?? '').slice(0, 64) || randomUUID();
      const t0 = Date.now(); const ip = req.rawRequest.ip ?? 'unknown';
      try {
        if (!checked) { assertEnvironment(); checked = true; }
        const parsed = cfg.input.safeParse(req.data ?? {});
        if (!parsed.success) throw new AppError('invalid-argument', 'INVALID_INPUT', `Invalid request: ${parsed.error.issues[0]?.path.join('.') || 'body'}`);
        if (cfg.auth !== 'public' && !req.auth) throw new AppError('unauthenticated', 'SIGN_IN_REQUIRED', 'Please sign in.');
        const tok = req.auth?.token;
        const actor: StaffActor = { uid: req.auth?.uid ?? 'anonymous', emailVerified: tok?.email_verified === true, role: typeof tok?.role === 'string' ? tok.role : undefined, email: tok?.email };
        if (cfg.auth === 'verified' && !actor.emailVerified) throw new AppError('failed-precondition', 'EMAIL_NOT_VERIFIED', 'Verify your email address to continue.');
        const d = deps();
        if (cfg.rate) await rateLimit(d.store, d.clock, { bucket: name, subject: cfg.rate.by === 'uid' ? actor.uid : ip, limit: cfg.rate.limit, windowSec: cfg.rate.windowSec });
        const out = await cfg.run({ d, actor, ip, cid, name }, parsed.data);
        logger.info('callable.ok', { name, cid, uid: actor.uid, ms: Date.now() - t0, appCheck: req.app ? 'present' : 'missing' });
        return out ?? { ok: true };
      } catch (e) {
        if (e instanceof AppError) {
          logger.warn('callable.rejected', { name, cid, reason: e.reason, ms: Date.now() - t0 });
          throw new HttpsError(e.code, e.message, { reason: e.reason, correlationId: cid });
        }
        logger.error('callable.failed', { name, cid, error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : 'unknown' });
        throw new HttpsError('internal', `Something went wrong. Reference ${cid.slice(0, 8)}.`, { reason: 'INTERNAL', correlationId: cid });
      }
    },
  );
}
