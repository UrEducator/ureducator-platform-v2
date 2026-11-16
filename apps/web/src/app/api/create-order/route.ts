import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { verifyAuthToken, recordCreatedOrder } from '../_lib/serverAuth';



export async function POST(req: Request) {
  try {
    // 1. Session Authentication Check
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

    // 3. Plan Specification: ₹499 for plan-pyq-premium-pack
    let body: { planId?: string } = {};
    try {
      body = (await req.json()) as { planId?: string };
    } catch (_err) {
      // Empty or non-JSON body defaults to canonical plan
    }

    const planId = body.planId || 'plan-pyq-premium-pack';
    const amountPaise = 49900; // ₹499.00
    const currency = 'INR';
    const receipt = `rcpt_${user.uid.slice(0, 8)}_${Date.now()}`;

    // 4. Secure Server-to-Server Razorpay Order API Call
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt,
        notes: {
          planId,
          uid: user.uid,
          appName: 'UrEducator 2.0',
        },
      }),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      console.error('[create-order] Razorpay gateway error:', rzpRes.status, errBody);
      return NextResponse.json(
        {
          error: 'GATEWAY_ERROR',
          message: 'The payment service is unavailable or returned an error. You have not been charged.',
        },
        { status: 502 }
      );
    }

    const rzpOrder = (await rzpRes.json()) as { id: string; amount: number; currency: string };
    const orderId = `o_${rzpOrder.id}`;

    // 5. Store order state in Firestore
    await recordCreatedOrder({
      uid: user.uid,
      orderId,
      razorpayOrderId: rzpOrder.id,
      planId,
      amountPaise,
      currency,
    });

    return NextResponse.json({
      success: true,
      orderId,
      razorpayOrderId: rzpOrder.id,
      amount: amountPaise,
      currency,
      keyId,
    });
  } catch (err: unknown) {
    console.error('[create-order] Unexpected error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create payment order.' },
      { status: 500 }
    );
  }
}
