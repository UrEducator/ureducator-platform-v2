import { randomUUID } from 'node:crypto';
import type { z, ZodType } from 'zod';
import { AppError, type ErrorCode } from './errors';
import { rateLimit } from './ratelimit';
import type { Deps } from '../services/exam';
import type { AuthPort, StaffActor } from '../services/admin';

export type Auth = 'public' | 'user' | 'verified';
export type Ctx = { d: Deps; actor: StaffActor; ip: string; cid: string; name: string; secret: (name: string) => string | null; auth: AuthPort };
export type EndpointDef<S extends ZodType = ZodType, R = unknown> = {
  auth: Auth; input: S; run: (c: Ctx, i: z.infer<S>) => Promise<R>;
  rate?: { limit: number; windowSec: number; by: 'uid' | 'ip' };
  memory?: '256MiB' | '512MiB' | '1GiB'; timeoutSeconds?: number;
};
export const define = <S extends ZodType, R>(d: EndpointDef<S, R>): EndpointDef<S, R> => d;

export type Identity = { uid: string; emailVerified: boolean; role?: string | undefined; email?: string | undefined } | null;
export type Failure = { code: ErrorCode; reason: string; message: string; correlationId: string };
export type Outcome = { ok: true; data: unknown; cid: string } | { ok: false; error: Failure };

/**
 * validate -> authenticate -> rate limit -> run -> map errors. No framework types in here, so the same pipeline runs inside
 * Cloud Functions and inside the local end-to-end harness. Internal errors never leak details to the caller.
 */
export async function dispatch(name: string, def: EndpointDef, raw: unknown, who: Identity, o: { d: Deps; auth: AuthPort; ip: string; cid?: string; secret?: (n: string) => string | null; onError?: (cid: string, e: unknown) => void }): Promise<Outcome> {
  const cid = (o.cid ?? '').slice(0, 64) || randomUUID();
  try {
    const parsed = def.input.safeParse(raw ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'INVALID_INPUT', `Invalid request: ${parsed.error.issues[0]?.path.join('.') || 'body'}`);
    if (def.auth !== 'public' && !who) throw new AppError('unauthenticated', 'SIGN_IN_REQUIRED', 'Please sign in.');
    const actor: StaffActor = { uid: who?.uid ?? 'anonymous', emailVerified: who?.emailVerified === true, role: who?.role, email: who?.email };
    if (def.auth === 'verified' && !actor.emailVerified) throw new AppError('failed-precondition', 'EMAIL_NOT_VERIFIED', 'Verify your email address to continue.');
    if (def.rate) await rateLimit(o.d.store, o.d.clock, { bucket: name, subject: def.rate.by === 'uid' ? actor.uid : o.ip, limit: def.rate.limit, windowSec: def.rate.windowSec });
    const data = await def.run({ d: o.d, actor, ip: o.ip, cid, name, secret: o.secret ?? (() => null), auth: o.auth }, parsed.data);
    return { ok: true, data: data ?? { ok: true }, cid };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: { code: e.code, reason: e.reason, message: e.message, correlationId: cid } };
    o.onError?.(cid, e);
    return { ok: false, error: { code: 'internal', reason: 'INTERNAL', message: `Something went wrong. Reference ${cid.slice(0, 8)}.`, correlationId: cid } };
  }
}
