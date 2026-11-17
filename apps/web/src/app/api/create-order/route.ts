import { NextResponse } from 'next/server';
import { verifyAuthToken, callCloudFunction } from '../_lib/serverAuth';

export async function POST(req: Request) {
  try {
    // 1. Session Authentication Check (stateless via Google Identity Toolkit)
    const user = await verifyAuthToken(req);
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'You must be signed in to purchase a plan.' },
        { status: 401 }
      );
    }

    // 2. Gateway Credentials Check
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          error: 'PAYMENTS_NOT_CONFIGURED',
          message: 'Razorpay payment gateway credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured.',
        },
        { status: 503 }
      );
    }

    // 3. Plan Specification: defaults to plan-pyq-premium-pack
    let body: { planId?: string } = {};
    try {
      body = (await req.json()) as { planId?: string };
    } catch (_err) {
      // Empty or non-JSON body defaults to canonical plan
    }

    const planId = body.planId || 'plan-pyq-premium-pack';

    // 4. Authenticated call to Cloud Function `createOrder`
    // Ensures all writes pass through our established security rules and transactional order record
    const cloudRes = await callCloudFunction<
      { planId: string },
      { orderId: string; razorpayOrderId: string; amountPaise: number; currency: 'INR' }
    >('createOrder', { planId }, user.token);

    if (!cloudRes.ok || !cloudRes.data) {
      console.error('[create-order] Cloud function createOrder failed:', cloudRes.error);
      return NextResponse.json(
        {
          error: 'ORDER_CREATION_FAILED',
          message: cloudRes.error || 'Payment order creation failed in backend services.',
        },
        { status: cloudRes.status && cloudRes.status >= 400 && cloudRes.status < 600 ? cloudRes.status : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: cloudRes.data.orderId,
      razorpayOrderId: cloudRes.data.razorpayOrderId,
      amount: cloudRes.data.amountPaise,
      currency: cloudRes.data.currency,
      keyId,
    });
  } catch (err: unknown) {
    console.error('[create-order] Unexpected error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred while initiating payment order.' },
      { status: 500 }
    );
  }
}
