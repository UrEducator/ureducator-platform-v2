# Next.js Server-Side API Architecture & Security Guidelines

🚨 PAYMENT GATEWAY DORMANCY 🚨: The Razorpay integration is currently DORMANT. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must remain UNSET in the Vercel environment variables. Setting these variables activates live payments and bypasses Firebase feature flags. A full security review of idempotency and replay protection is required before adding these keys.

## API Surface Overview

| Route | Method | Purpose | Auth Mechanism | Backend Integration |
| :--- | :--- | :--- | :--- | :--- |
| `/api/create-order` | `POST` | Initiates payment order | Bearer ID Token | Proxies to Cloud Function `createOrder` |
| `/api/verify-payment` | `POST` | Verifies checkout signature | Bearer ID Token | Proxies to Cloud Function `verifyPayment` |
| `/api/audit/print` | `POST` | Records diagnostic print logs | Optional Bearer | In-memory / Client SDK |
| `/api/tickets/escalate` | `POST` | Automatic SLA breach scan | Public / Cron | Escalation helper (`lib/escalationHelper.ts`) |

## Security & Architecture Rules
1. **Zero Firebase Admin SDK:** Next.js API routes run on serverless hosting (Vercel) without Google Application Default Credentials. Under no circumstances should `firebase-admin` be imported into `apps/web`.
2. **Server-Side Token Verification:** Tokens are verified statelessly via the Google Identity Toolkit REST API (`verifyAuthToken` in `_lib/serverAuth.ts`).
3. **Write Isolation:** All transactional and privileged database writes must route through audited Cloud Functions in `functions/src/` to strictly enforce domain validation and Firestore security rules.
