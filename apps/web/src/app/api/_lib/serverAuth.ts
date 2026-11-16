import { randomUUID } from 'node:crypto';
import { getApps, initializeApp, getApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function getAdminApp(): App | null {
  try {
    if (getApps().length > 0) {
      return getApp();
    }
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      'ugc-mock-test-staging';

    return initializeApp({ projectId });
  } catch (err) {
    console.error('[serverAuth] Failed to initialize Firebase Admin app:', err);
    return null;
  }
}

export async function verifyAuthToken(req: Request): Promise<{ uid: string; email?: string | null } | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const app = getAdminApp();
  if (!app) {
    return null;
  }

  try {
    const decoded = await getAuth(app).verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch (err) {
    console.error('[serverAuth] Token verification failed:', err);
    return null;
  }
}

export async function grantEntitlements(
  uid: string,
  entitlements: string[],
  planId = 'plan-pyq-premium-pack'
): Promise<void> {
  const app = getAdminApp();
  if (!app) {
    console.error('[serverAuth] Cannot grant entitlements: Firebase Admin app not available.');
    return;
  }
  const db = getFirestore(app);
  const now = Date.now();
  const ninetyDaysMs = 90 * 86_400_000;

  const batch = db.batch();

  // 1. Update users/{uid} document with required entitlements
  const userRef = db.collection('users').doc(uid);
  batch.set(
    userRef,
    {
      entitlements: FieldValue.arrayUnion(...entitlements),
      updatedAtMs: now,
    },
    { merge: true }
  );

  // 2. Update subscriptions/{uid} document to active status with duration and entitlements
  const subRef = db.collection('subscriptions').doc(uid);
  batch.set(
    subRef,
    {
      status: 'active',
      planId,
      entitlements: FieldValue.arrayUnion(...entitlements),
      expiresAtMs: now + ninetyDaysMs,
      updatedAtMs: now,
    },
    { merge: true }
  );

  await batch.commit();
}

export async function recordCreatedOrder(orderDoc: {
  uid: string;
  orderId: string;
  razorpayOrderId: string;
  planId: string;
  amountPaise: number;
  currency: string;
}): Promise<void> {
  const app = getAdminApp();
  if (!app) return;
  const db = getFirestore(app);
  await db.collection('orders').doc(orderDoc.orderId).set({
    uid: orderDoc.uid,
    planId: orderDoc.planId,
    amountPaise: orderDoc.amountPaise,
    currency: orderDoc.currency,
    status: 'created',
    razorpayOrderId: orderDoc.razorpayOrderId,
    createdAtMs: Date.now(),
  });
}

export async function recordPaidOrder(razorpayOrderId: string, razorpayPaymentId: string): Promise<void> {
  const app = getAdminApp();
  if (!app) return;
  const db = getFirestore(app);
  const orderId = `o_${razorpayOrderId}`;
  await db.collection('orders').doc(orderId).set(
    {
      status: 'paid',
      paymentId: razorpayPaymentId,
      paidAtMs: Date.now(),
      paidVia: 'checkout',
    },
    { merge: true }
  );

  await db.collection('paymentEvents').doc(`act_${razorpayPaymentId}`).set({
    orderId,
    kind: 'activated',
    via: 'checkout',
    atMs: Date.now(),
  });
}

export async function recordPrintAuditLog(entry: {
  userId: string;
  action?: string;
  reportId: string;
  method?: string;
  meta?: Record<string, unknown>;
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  const app = getAdminApp();
  if (!app) {
    console.error('[serverAuth] Cannot record print audit log: Firebase Admin app not available.');
    return { success: false, error: 'NO_ADMIN_APP' };
  }

  try {
    const db = getFirestore(app);
    const clock = Date.now();
    const logId = `${clock}_${randomUUID().slice(0, 8)}`;
    const action = entry.action || 'ANALYTICS_REPORT_PRINTED';

    await db.collection('auditLogs').doc(logId).set({
      actorUid: entry.userId,
      actorRole: 'student',
      userId: entry.userId,
      action,
      target: `reports/${entry.reportId}`,
      reportId: entry.reportId,
      method: entry.method || 'print',
      atMs: clock,
      timestamp: FieldValue.serverTimestamp(),
      meta: {
        reportId: entry.reportId,
        method: entry.method || 'print',
        environment: 'ugc-mock-test-staging',
        ...(entry.meta ?? {}),
      },
    });

    return { success: true, logId };
  } catch (err) {
    console.error('[serverAuth] Failed to write print auditLog:', err);
    return { success: false, error: String(err) };
  }
}
