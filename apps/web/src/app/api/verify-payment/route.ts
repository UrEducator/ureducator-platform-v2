import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { verifyAuthToken, grantEntitlements, recordPaidOrder } from '../_lib/serverAuth';



function safeVerifySignature(secret: string, orderId: string, paymentId: string, clientSignature: string): boolean {
  if (!secret || !orderId || !paymentId || !clientSignature) {
    return false;
  }
  const payload = `${orderId}|${paymentId}`;
  const expectedHex = createHmac('sha256', secret).update(payload).digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'utf8');
  const clientBuf = Buffer.from(clientSignature, 'utf8');

  if (expectedBuf.length !== clientBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, clientBuf);
}

export async function POST(req: Request) {
  try {
    // 1. Session Authentication Check
    const user = await verifyAuthToken(req);
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'You must be signed in to verify payment.' },
        { status: 401 }
      );
    }

    // 2. Gateway Secret Check
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json(
        {
          error: 'PAYMENTS_NOT_CONFIGURED',
          message: 'Razorpay payment gateway secret (RAZORPAY_KEY_SECRET) is not configured.',
        },
        { status: 503 }
      );
    }

    // 3. Parse and Validate Payment Callback Payload
    const body = (await req.json()) as {
      razorpay_payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
      orderId?: string;
    };

    const paymentId = body.razorpay_payment_id;
    const razorpayOrderId = body.razorpay_order_id;
    const signature = body.razorpay_signature;

    if (!paymentId || !razorpayOrderId || !signature) {
      return NextResponse.json(
        {
          error: 'INVALID_PAYLOAD',
          message: 'Missing required Razorpay callback fields: razorpay_payment_id, razorpay_order_id, razorpay_signature.',
        },
        { status: 400 }
      );
    }

    // 4. Secure HMAC-SHA256 Signature Verification via Node crypto
    const isValid = safeVerifySignature(keySecret, razorpayOrderId, paymentId, signature);
    if (!isValid) {
      console.error(`[verify-payment] Tampering or signature failure for order=${razorpayOrderId}, payment=${paymentId}`);
      return NextResponse.json(
        {
          error: 'BAD_SIGNATURE',
          message: 'Payment verification failed: HMAC SHA256 signature mismatch.',
        },
        { status: 400 }
      );
    }

    // 5. Update Firestore: Grant paper1-all and pyq-2023-pack entitlements to the authenticated user
    const grantedEntitlements = ['paper1-all', 'pyq-2023-pack'];
    await grantEntitlements(user.uid, grantedEntitlements, 'plan-pyq-premium-pack');
    await recordPaidOrder(razorpayOrderId, paymentId);

    return NextResponse.json({
      success: true,
      message: 'Payment signature verified successfully. Entitlements granted.',
      paymentId,
      razorpayOrderId,
      entitlements: grantedEntitlements,
    });
  } catch (err: unknown) {
    console.error('[verify-payment] Unexpected error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to verify payment.' },
      { status: 500 }
    );
  }
}
