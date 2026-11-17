import { randomUUID } from 'node:crypto';

export interface VerifiedUser {
  uid: string;
  email?: string | null;
  token: string;
}

/**
 * Statelessly verifies a Firebase Auth ID token using the official Google Identity Toolkit REST API.
 * This completely avoids dependency on the Node.js firebase-admin SDK, allowing execution on Vercel
 * serverless environments where Google Application Default Credentials are not present.
 */
export async function verifyIdToken(token: string): Promise<{ uid: string; email?: string | null } | null> {
  if (!token) return null;

  try {
    const apiKey =
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      '';

    const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const url = authEmulator
      ? `http://${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`
      : `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[serverAuth] Token verification REST call failed:', res.status, errText);
      return null;
    }

    const data = (await res.json()) as { users?: Array<{ localId: string; email?: string }> };
    const user = data.users?.[0];
    if (!user || !user.localId) {
      return null;
    }

    return {
      uid: user.localId,
      email: user.email ?? null,
    };
  } catch (err) {
    console.error('[serverAuth] Error verifying ID token via Identity Toolkit:', err);
    return null;
  }
}

/**
 * Extracts and verifies Bearer token from incoming Request Authorization headers.
 */
export async function verifyAuthToken(req: Request): Promise<VerifiedUser | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const verified = await verifyIdToken(token);
  if (!verified) {
    return null;
  }

  return {
    uid: verified.uid,
    email: verified.email,
    token,
  };
}

/**
 * Proxies an authenticated request to an audited Cloud Functions (Gen 2) callable endpoint.
 * Ensures that all sensitive and transactional database writes pass through existing domain logic.
 */
export async function callCloudFunction<TReq, TRes>(
  functionName: string,
  data: TReq,
  idToken?: string
): Promise<{ ok: boolean; data?: TRes; error?: string; status?: number }> {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'ugc-mock-test-staging';
  const region =
    process.env.NEXT_PUBLIC_FUNCTIONS_REGION ||
    'asia-south1';

  const functionsEmulator = process.env.FUNCTIONS_EMULATOR_HOST;
  const url = functionsEmulator
    ? `http://${functionsEmulator}/${projectId}/${region}/${functionName}`
    : `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data }),
    });

    const json = (await res.json()) as { result?: TRes; error?: { message?: string; status?: string } };
    if (!res.ok || json.error) {
      return {
        ok: false,
        error: json.error?.message || `Cloud function ${functionName} returned status ${res.status}`,
        status: res.status,
      };
    }
    return { ok: true, data: json.result as TRes, status: res.status };
  } catch (err) {
    console.error(`[serverAuth] Network error calling Cloud Function ${functionName}:`, err);
    return { ok: false, error: String(err), status: 500 };
  }
}

/**
 * Records print diagnostic audit logs without relying on firebase-admin SDK.
 */
export async function recordPrintAuditLog(entry: {
  userId: string;
  action?: string;
  reportId: string;
  method?: string;
  meta?: Record<string, unknown>;
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const clock = Date.now();
    const logId = `${clock}_${randomUUID().slice(0, 8)}`;
    // Audited in server logs without triggering ADC failure on Vercel
    console.warn(`[AUDIT] Action: ${entry.action || 'ANALYTICS_REPORT_PRINTED'} | User: ${entry.userId} | Report: ${entry.reportId} | Method: ${entry.method || 'print'}`);
    return { success: true, logId };
  } catch (err) {
    console.error('[serverAuth] Failed to generate print auditLog:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Proxies order creation to the audited Cloud Functions backend.
 */
export async function recordCreatedOrder(
  orderDoc: {
    uid: string;
    orderId: string;
    razorpayOrderId: string;
    planId: string;
    amountPaise: number;
    currency: string;
  },
  idToken?: string
): Promise<void> {
  await callCloudFunction('createOrder', { planId: orderDoc.planId }, idToken);
}

/**
 * Proxies payment completion and entitlement activation to the audited Cloud Functions backend.
 */
export async function recordPaidOrder(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  idToken?: string
): Promise<void> {
  const orderId = `o_${razorpayOrderId}`;
  await callCloudFunction('verifyPayment', { orderId, razorpayPaymentId, razorpaySignature: '' }, idToken);
}

export async function grantEntitlements(
  _uid: string,
  _entitlements: string[],
  _planId = 'plan-pyq-premium-pack',
  _idToken?: string
): Promise<void> {
  // Entitlement grants are now managed exclusively inside the audited Cloud Function verifyPayment
}
