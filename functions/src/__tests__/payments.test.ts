import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../domain/memoryStore';
import { P } from '../domain/paths';
import * as pay from '../services/payments';

// Dummy values used only inside these tests. They are not Razorpay credentials.
const SECRET = 'unit-test-only-secret';
const T0 = 1_800_000_000_000;
const ON = { enabled: true, mode: 'test' as const }; const OFF = { enabled: false, mode: 'test' as const };
const alice = { uid: 'alice', emailVerified: true }; const bob = { uid: 'bob', emailVerified: true };
const gw = (id = 'order_TEST1'): pay.PaymentGateway => ({ createOrder: async () => ({ id }) });
const mk = async () => {
  let now = T0; const store = new MemoryStore();
  await store.set(P.plan('pro'), { name: 'Pro', pricePaise: 49900, currency: 'INR', durationDays: 90, entitlements: ['all'], published: true });
  await store.set(P.plan('hidden'), { name: 'Hidden', pricePaise: 100, currency: 'INR', durationDays: 30, entitlements: ['all'], published: false });
  return { d: { store, clock: () => now }, store, tick: (ms: number) => (now += ms) };
};
const buy = async (e: Awaited<ReturnType<typeof mk>>, actor = alice, rzp = 'order_TEST1') => (await pay.createOrder(e.d, ON, gw(rzp), actor, { planId: 'pro' }));
const sign = (orderId: string, paymentId: string) => pay.hmacHex(SECRET, `${orderId}|${paymentId}`);

describe('payments are disabled by default', () => {
  it('rejects every entry point and never calls the gateway', async () => {
    const e = await mk(); let called = 0;
    const spy: pay.PaymentGateway = { createOrder: async () => { called++; return { id: 'x' }; } };
    await expect(pay.createOrder(e.d, OFF, spy, alice, { planId: 'pro' })).rejects.toMatchObject({ reason: 'PAYMENTS_DISABLED' });
    await expect(pay.verifyPayment(e.d, OFF, SECRET, alice, { orderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 'a'.repeat(64) })).rejects.toMatchObject({ reason: 'PAYMENTS_DISABLED' });
    await expect(pay.handleWebhook(e.d, OFF, SECRET, Buffer.from('{}'), 'x', 'evt_123456')).rejects.toMatchObject({ reason: 'PAYMENTS_DISABLED' });
    expect(called).toBe(0);
    expect(await e.store.count('orders', [])).toBe(0);
  });
  it('refuses even when enabled but no gateway/secret is configured', async () => {
    const e = await mk();
    await expect(pay.createOrder(e.d, ON, null, alice, { planId: 'pro' })).rejects.toMatchObject({ reason: 'PAYMENTS_NOT_CONFIGURED' });
    await expect(pay.verifyPayment(e.d, ON, null, alice, { orderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 'a'.repeat(64) })).rejects.toMatchObject({ reason: 'PAYMENTS_NOT_CONFIGURED' });
  });
});

describe('signatures', () => {
  it('compares in constant time and never throws on a length mismatch', () => {
    expect(pay.safeEqualHex('abcd', 'abcd')).toBe(true);
    expect(pay.safeEqualHex('abcd', 'abce')).toBe(false);
    expect(pay.safeEqualHex('abcd', 'abcde')).toBe(false);
    expect(pay.safeEqualHex('', '')).toBe(true);
  });
  it('matches the documented HMAC-SHA256 scheme for checkout and webhooks', () => {
    expect(pay.verifyCheckoutSignature(SECRET, 'order_1', 'pay_1', sign('order_1', 'pay_1'))).toBe(true);
    expect(pay.verifyCheckoutSignature(SECRET, 'order_1', 'pay_2', sign('order_1', 'pay_1'))).toBe(false);
    const raw = Buffer.from('{"event":"x"}');
    expect(pay.verifyWebhookSignature(SECRET, raw, pay.hmacHex(SECRET, raw))).toBe(true);
    expect(pay.verifyWebhookSignature(SECRET, Buffer.from('{"event":"y"}'), pay.hmacHex(SECRET, raw))).toBe(false);
  });
});

describe('createOrder', () => {
  it('takes the price only from the server catalogue and stores the order against the caller', async () => {
    const e = await mk(); const o = await buy(e);
    expect(o).toMatchObject({ amountPaise: 49900, currency: 'INR', razorpayOrderId: 'order_TEST1' });
    expect(await e.store.get(P.order(o.orderId))).toMatchObject({ uid: 'alice', planId: 'pro', amountPaise: 49900, status: 'created' });
  });
  it('rejects unpublished or unknown plans and unverified emails', async () => {
    const e = await mk();
    await expect(pay.createOrder(e.d, ON, gw(), alice, { planId: 'hidden' })).rejects.toMatchObject({ reason: 'PLAN_NOT_AVAILABLE' });
    await expect(pay.createOrder(e.d, ON, gw(), alice, { planId: 'nope' })).rejects.toMatchObject({ reason: 'PLAN_NOT_AVAILABLE' });
    await expect(pay.createOrder(e.d, ON, gw(), { uid: 'z', emailVerified: false }, { planId: 'pro' })).rejects.toMatchObject({ reason: 'EMAIL_NOT_VERIFIED' });
  });
});

describe('verifyPayment (browser callback)', () => {
  it('activates the entitlement once for a correct signature', async () => {
    const e = await mk(); const o = await buy(e);
    const r = await pay.verifyPayment(e.d, ON, SECRET, alice, { orderId: o.orderId, razorpayPaymentId: 'pay_1', razorpaySignature: sign('order_TEST1', 'pay_1') });
    expect(r).toMatchObject({ activated: true });
    expect(await e.store.get(P.subscription('alice'))).toMatchObject({ status: 'active', entitlements: ['all'], expiresAtMs: T0 + 90 * 86_400_000 });
    expect(await e.store.get(P.order(o.orderId))).toMatchObject({ status: 'paid', paymentId: 'pay_1', paidVia: 'checkout' });
  });
  it('rejects bad signatures and other users\' orders without changing anything', async () => {
    const e = await mk(); const o = await buy(e);
    await expect(pay.verifyPayment(e.d, ON, SECRET, alice, { orderId: o.orderId, razorpayPaymentId: 'pay_1', razorpaySignature: 'f'.repeat(64) })).rejects.toMatchObject({ reason: 'BAD_SIGNATURE' });
    await expect(pay.verifyPayment(e.d, ON, SECRET, bob, { orderId: o.orderId, razorpayPaymentId: 'pay_1', razorpaySignature: sign('order_TEST1', 'pay_1') })).rejects.toMatchObject({ reason: 'ORDER_NOT_FOUND' });
    expect(await e.store.get(P.subscription('alice'))).toBeNull();
    expect(await e.store.get(P.order(o.orderId))).toMatchObject({ status: 'created' });
  });
  it('is idempotent on replay and extends rather than stacks on a later purchase', async () => {
    const e = await mk(); const o = await buy(e);
    const body = { orderId: o.orderId, razorpayPaymentId: 'pay_1', razorpaySignature: sign('order_TEST1', 'pay_1') };
    await pay.verifyPayment(e.d, ON, SECRET, alice, body);
    const again = await pay.verifyPayment(e.d, ON, SECRET, alice, body);
    expect(again).toMatchObject({ activated: false, duplicate: false });
    expect((await e.store.get<{ expiresAtMs: number }>(P.subscription('alice')))!.expiresAtMs).toBe(T0 + 90 * 86_400_000);
    const o2 = await buy(e, alice, 'order_TEST2');
    await pay.verifyPayment(e.d, ON, SECRET, alice, { orderId: o2.orderId, razorpayPaymentId: 'pay_2', razorpaySignature: sign('order_TEST2', 'pay_2') });
    expect((await e.store.get<{ expiresAtMs: number }>(P.subscription('alice')))!.expiresAtMs).toBe(T0 + 180 * 86_400_000);
  });
  it('flags a second, different payment against an already-paid order for refund', async () => {
    const e = await mk(); const o = await buy(e);
    await pay.verifyPayment(e.d, ON, SECRET, alice, { orderId: o.orderId, razorpayPaymentId: 'pay_1', razorpaySignature: sign('order_TEST1', 'pay_1') });
    const dup = await pay.verifyPayment(e.d, ON, SECRET, alice, { orderId: o.orderId, razorpayPaymentId: 'pay_9', razorpaySignature: sign('order_TEST1', 'pay_9') });
    expect(dup).toMatchObject({ activated: false, duplicate: true });
    expect(await e.store.get(P.paymentEvent('dup_pay_9'))).toMatchObject({ needsRefund: true });
  });
  it('rejects an amount or currency that differs from the order', async () => {
    const e = await mk(); const o = await buy(e);
    await expect(pay.activateOrder(e.d, { orderId: o.orderId, paymentId: 'pay_1', amountPaise: 100, currency: 'INR', source: 'webhook' })).rejects.toMatchObject({ reason: 'AMOUNT_MISMATCH' });
    await expect(pay.activateOrder(e.d, { orderId: o.orderId, paymentId: 'pay_1', amountPaise: 49900, currency: 'USD', source: 'webhook' })).rejects.toMatchObject({ reason: 'AMOUNT_MISMATCH' });
    expect(await e.store.get(P.subscription('alice'))).toBeNull();
  });
});

describe('webhook', () => {
  const event = (name: string, entity: object) => Buffer.from(JSON.stringify({ event: name, payload: name.startsWith('refund') ? { refund: { entity } } : { payment: { entity } } }));
  const send = (e: Awaited<ReturnType<typeof mk>>, raw: Buffer, id: string, secret = SECRET) => pay.handleWebhook(e.d, ON, SECRET, raw, pay.hmacHex(secret, raw), id);

  it('rejects a bad signature before touching any data', async () => {
    const e = await mk(); await buy(e);
    const raw = event('payment.captured', { id: 'pay_1', order_id: 'order_TEST1', amount: 49900, currency: 'INR' });
    await expect(send(e, raw, 'evt_aaaaaa', 'wrong-secret')).rejects.toMatchObject({ reason: 'BAD_SIGNATURE' });
    expect(await e.store.count('paymentEvents', [])).toBe(0);
  });
  it('activates on payment.captured and ignores a replayed event id', async () => {
    const e = await mk(); const o = await buy(e);
    const raw = event('payment.captured', { id: 'pay_1', order_id: 'order_TEST1', amount: 49900, currency: 'INR' });
    expect(await send(e, raw, 'evt_aaaaaa')).toMatchObject({ handled: true });
    expect(await send(e, raw, 'evt_aaaaaa')).toMatchObject({ handled: false, duplicate: true });
    expect(await e.store.get(P.order(o.orderId))).toMatchObject({ status: 'paid', paidVia: 'webhook' });
  });
  it('browser callback and webhook for the same payment activate exactly once', async () => {
    const e = await mk(); const o = await buy(e);
    await pay.verifyPayment(e.d, ON, SECRET, alice, { orderId: o.orderId, razorpayPaymentId: 'pay_1', razorpaySignature: sign('order_TEST1', 'pay_1') });
    await send(e, event('payment.captured', { id: 'pay_1', order_id: 'order_TEST1', amount: 49900, currency: 'INR' }), 'evt_bbbbbb');
    expect((await e.store.get<{ expiresAtMs: number }>(P.subscription('alice')))!.expiresAtMs).toBe(T0 + 90 * 86_400_000);
  });
  it('releases its claim when processing fails, so the retry is not lost', async () => {
    const e = await mk(); await buy(e);
    await e.store.delete(P.plan('pro')); // activation will fail: plan missing
    const raw = event('payment.captured', { id: 'pay_1', order_id: 'order_TEST1', amount: 49900, currency: 'INR' });
    await expect(send(e, raw, 'evt_cccccc')).rejects.toMatchObject({ reason: 'PLAN_MISSING' });
    expect(await e.store.get(P.paymentEvent('evt_evt_cccccc'))).toBeNull();
    await e.store.set(P.plan('pro'), { name: 'Pro', pricePaise: 49900, currency: 'INR', durationDays: 90, entitlements: ['all'], published: true });
    expect(await send(e, raw, 'evt_cccccc')).toMatchObject({ handled: true });
    expect(await e.store.get(P.subscription('alice'))).toMatchObject({ status: 'active' });
  });
  it('records an amount mismatch for manual review instead of retrying forever', async () => {
    const e = await mk(); await buy(e);
    const r = await send(e, event('payment.captured', { id: 'pay_1', order_id: 'order_TEST1', amount: 100, currency: 'INR' }), 'evt_dddddd');
    expect(r).toMatchObject({ handled: false });
    expect(await e.store.get(P.paymentEvent('mismatch_pay_1'))).toMatchObject({ needsReview: true });
    expect(await e.store.get(P.subscription('alice'))).toBeNull();
  });
  it('counts failed attempts and revokes access on refund', async () => {
    const e = await mk(); const o = await buy(e);
    await send(e, event('payment.failed', { id: 'pay_0', order_id: 'order_TEST1', amount: 49900, currency: 'INR' }), 'evt_eeeeee');
    expect(await e.store.get(P.order(o.orderId))).toMatchObject({ failedAttempts: 1 });
    await send(e, event('payment.captured', { id: 'pay_1', order_id: 'order_TEST1', amount: 49900, currency: 'INR' }), 'evt_ffffff');
    await send(e, event('refund.processed', { id: 'rfnd_1', payment_id: 'pay_1' }), 'evt_gggggg');
    expect(await e.store.get(P.order(o.orderId))).toMatchObject({ status: 'refunded' });
    expect(await e.store.get(P.subscription('alice'))).toMatchObject({ status: 'revoked' });
  });
  it('rejects a malformed event id or body (after the signature check)', async () => {
    const e = await mk();
    await expect(send(e, Buffer.from('{}'), 'x')).rejects.toMatchObject({ reason: 'BAD_EVENT_ID' });
    await expect(send(e, Buffer.from('not json'), 'evt_hhhhhh')).rejects.toMatchObject({ reason: 'BAD_BODY' });
  });
});
