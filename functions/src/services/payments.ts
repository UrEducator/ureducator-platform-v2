import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Actor } from '../domain/types';
import { P } from '../domain/paths';
import { AppError, err } from '../infra/errors';
import { audit } from '../infra/audit';
import type { Deps } from './exam';

/**
 * Payment architecture. All collection is disabled (PAYMENTS_ENABLED=false). Nothing here creates a Razorpay order
 * unless the flag is on AND a gateway with credentials is supplied. Pricing comes only from the server-side `plans` collection.
 */
export type PaymentConfig = { enabled: boolean; mode: 'test' | 'live' };
export interface PaymentGateway { createOrder(o: { amountPaise: number; currency: 'INR'; receipt: string }): Promise<{ id: string }> }

export const hmacHex = (secret: string, payload: string | Buffer) => createHmac('sha256', secret).update(payload).digest('hex');
/** Constant-time comparison of two hex strings. Length differences return false without early exit on content. */
export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8'); const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) { timingSafeEqual(x, x); return false; }
  return timingSafeEqual(x, y);
}
export const verifyCheckoutSignature = (secret: string, orderId: string, paymentId: string, sig: string) => safeEqualHex(hmacHex(secret, `${orderId}|${paymentId}`), sig);
export const verifyWebhookSignature = (secret: string, rawBody: Buffer | string, sig: string) => safeEqualHex(hmacHex(secret, rawBody), sig);

type Plan = { name: string; pricePaise: number; currency: 'INR'; durationDays: number; entitlements: string[]; published: boolean };
type Order = { uid: string; planId: string; amountPaise: number; currency: 'INR'; status: 'created' | 'paid' | 'refund_pending' | 'refunded'; razorpayOrderId: string; paymentId?: string; failedAttempts?: number; createdAtMs: number; flags?: string[] };

function assertEnabled(c: PaymentConfig) { if (!c.enabled) throw err('failed-precondition', 'PAYMENTS_DISABLED', 'Payments are not available yet.'); }

export async function createOrder(d: Deps, c: PaymentConfig, gw: PaymentGateway | null, actor: Actor, i: { planId: string; couponCode?: string | undefined }) {
  assertEnabled(c);
  if (!gw) throw err('failed-precondition', 'PAYMENTS_NOT_CONFIGURED', 'Payments are not configured.');
  if (!actor.emailVerified) throw err('failed-precondition', 'EMAIL_NOT_VERIFIED', 'Verify your email address before purchasing.');
  const plan = await d.store.get<Plan>(P.plan(i.planId));
  if (!plan || !plan.published || plan.pricePaise <= 0) throw err('not-found', 'PLAN_NOT_AVAILABLE', 'This plan is not available.');
  const receipt = `ur_${actor.uid.slice(0, 8)}_${d.clock()}`;
  const o = await gw.createOrder({ amountPaise: plan.pricePaise, currency: 'INR', receipt });
  const orderId = `o_${o.id}`;
  const order: Order = { uid: actor.uid, planId: i.planId, amountPaise: plan.pricePaise, currency: 'INR', status: 'created', razorpayOrderId: o.id, createdAtMs: d.clock() };
  await d.store.set(P.order(orderId), order);
  return { orderId, razorpayOrderId: o.id, amountPaise: plan.pricePaise, currency: 'INR' as const };
}

/** Idempotent activation shared by the browser callback and the webhook. */
export async function activateOrder(d: Deps, o: { orderId: string; paymentId: string; amountPaise: number; currency: string; source: 'checkout' | 'webhook' }) {
  return d.store.transact(async (tx) => {
    const order = await tx.get<Order>(P.order(o.orderId));
    if (!order) throw err('not-found', 'ORDER_NOT_FOUND', 'Order not found.');
    if (order.status !== 'created') {
      if (order.paymentId && order.paymentId !== o.paymentId) {
        tx.merge(P.order(o.orderId), { flags: [...(order.flags ?? []), `duplicate_payment:${o.paymentId}`] });
        tx.set(P.paymentEvent(`dup_${o.paymentId}`), { orderId: o.orderId, kind: 'duplicate_payment', needsRefund: true, atMs: d.clock() });
        return { activated: false as const, duplicate: true as const };
      }
      return { activated: false as const, duplicate: false as const };
    }
    if (o.amountPaise !== order.amountPaise || o.currency !== order.currency) throw err('failed-precondition', 'AMOUNT_MISMATCH', 'Payment amount does not match the order.');
    const plan = await tx.get<Plan>(P.plan(order.planId));
    if (!plan) throw err('failed-precondition', 'PLAN_MISSING', 'Plan missing.');
    const prevSub = await tx.get<{ expiresAtMs: number; entitlements: string[]; status: string }>(P.subscription(order.uid));
    const base = prevSub?.status === 'active' && prevSub.expiresAtMs > d.clock() ? prevSub.expiresAtMs : d.clock();
    tx.set(P.subscription(order.uid), { status: 'active', planId: order.planId, orderId: o.orderId, entitlements: [...new Set([...(prevSub?.entitlements ?? []), ...plan.entitlements])], expiresAtMs: base + plan.durationDays * 86_400_000, updatedAtMs: d.clock() });
    tx.merge(P.order(o.orderId), { status: 'paid', paymentId: o.paymentId, paidAtMs: d.clock(), paidVia: o.source });
    tx.set(P.paymentEvent(`act_${o.paymentId}`), { orderId: o.orderId, kind: 'activated', via: o.source, atMs: d.clock() });
    return { activated: true as const, duplicate: false as const };
  });
}

export async function verifyPayment(d: Deps, c: PaymentConfig, secret: string | null, actor: Actor, i: { orderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
  assertEnabled(c);
  if (!secret) throw err('failed-precondition', 'PAYMENTS_NOT_CONFIGURED', 'Payments are not configured.');
  const order = await d.store.get<Order>(P.order(i.orderId));
  if (!order || order.uid !== actor.uid) throw err('not-found', 'ORDER_NOT_FOUND', 'Order not found.');
  if (!verifyCheckoutSignature(secret, order.razorpayOrderId, i.razorpayPaymentId, i.razorpaySignature)) throw err('permission-denied', 'BAD_SIGNATURE', 'Payment could not be verified.');
  return activateOrder(d, { orderId: i.orderId, paymentId: i.razorpayPaymentId, amountPaise: order.amountPaise, currency: order.currency, source: 'checkout' });
}

type RzpEvent = { event: string; payload: { payment?: { entity: { id: string; order_id: string; amount: number; currency: string } }; order?: { entity: { id: string; amount_paid?: number } }; refund?: { entity: { id: string; payment_id: string } } } };

export async function handleWebhook(d: Deps, c: PaymentConfig, secret: string | null, raw: Buffer, signature: string, eventId: string) {
  assertEnabled(c);
  if (!secret) throw err('failed-precondition', 'PAYMENTS_NOT_CONFIGURED', 'Payments are not configured.');
  if (!verifyWebhookSignature(secret, raw, signature)) throw err('permission-denied', 'BAD_SIGNATURE', 'Invalid signature.');
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(eventId)) throw err('invalid-argument', 'BAD_EVENT_ID', 'Missing event id.');
  let ev: RzpEvent;
  try { ev = JSON.parse(raw.toString('utf8')) as RzpEvent; } catch { throw err('invalid-argument', 'BAD_BODY', 'Invalid body.'); }
  const first = await d.store.transact(async (tx) => {
    if (await tx.get(P.paymentEvent(`evt_${eventId}`))) return false;
    tx.create(P.paymentEvent(`evt_${eventId}`), { event: ev.event, atMs: d.clock() });
    return true;
  });
  if (!first) return { handled: false as const, duplicate: true as const };

  const claim = P.paymentEvent(`evt_${eventId}`);
  try {
    return await processEvent(d, ev);
  } catch (e) {
    // Release the claim so Razorpay's retry can be processed; a half-handled event must never be lost.
    await d.store.delete(claim);
    throw e;
  }
}

async function processEvent(d: Deps, ev: RzpEvent) {
  const pay = ev.payload.payment?.entity;
  const orderIdFor = async (razorpayOrderId: string) => (await d.store.list<Order>('orders', { where: [['razorpayOrderId', '==', razorpayOrderId]], limit: 1 }))[0];
  switch (ev.event) {
    case 'payment.captured': case 'order.paid': {
      if (!pay) return { handled: false as const, duplicate: false as const };
      const row = await orderIdFor(pay.order_id);
      if (!row) return { handled: false as const, duplicate: false as const };
      try {
        await activateOrder(d, { orderId: row.id, paymentId: pay.id, amountPaise: pay.amount, currency: pay.currency, source: 'webhook' });
      } catch (e) {
        if (e instanceof AppError && e.reason === 'AMOUNT_MISMATCH') {
          // Do not retry forever: record for manual review and acknowledge.
          await d.store.set(P.paymentEvent(`mismatch_${pay.id}`), { orderId: row.id, kind: 'amount_mismatch', needsReview: true, atMs: d.clock() });
          return { handled: false as const, duplicate: false as const };
        }
        throw e;
      }
      return { handled: true as const, duplicate: false as const };
    }
    case 'payment.failed': {
      if (!pay) return { handled: false as const, duplicate: false as const };
      const row = await orderIdFor(pay.order_id);
      if (row) await d.store.merge(P.order(row.id), { failedAttempts: (row.data.failedAttempts ?? 0) + 1, lastFailedAtMs: d.clock() });
      return { handled: true as const, duplicate: false as const };
    }
    case 'refund.processed': {
      const pid = ev.payload.refund?.entity.payment_id; if (!pid) return { handled: false as const, duplicate: false as const };
      const rows = await d.store.list<Order>('orders', { where: [['paymentId', '==', pid]], limit: 1 });
      const row = rows[0]; if (!row) return { handled: false as const, duplicate: false as const };
      await d.store.merge(P.order(row.id), { status: 'refunded', refundedAtMs: d.clock() });
      const sub = await d.store.get<{ orderId: string }>(P.subscription(row.data.uid));
      if (sub?.orderId === row.id) await d.store.merge(P.subscription(row.data.uid), { status: 'revoked', revokedAtMs: d.clock() });
      await audit(d.store, d.clock, { actorUid: 'system', actorRole: null, action: 'payment.refund_processed', target: row.id });
      return { handled: true as const, duplicate: false as const };
    }
    default: return { handled: false as const, duplicate: false as const };
  }
}
