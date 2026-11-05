# UrEducator 2.0 — M8.3 Final Staging Pre-Deployment Report

- **Date:** 5 November 2026
- **Target Project:** `ugc-mock-test-staging`
- **Project Number:** `336521990930`
- **Region:** `asia-south1`
- **Hosting Site:** `ugc-mock-test-staging` (`https://ugc-mock-test-staging.web.app`)
- **Configured Owner Email:** `subhashbanti99@gmail.com`
- **Status:** **BLOCKED (LOCAL GATES READY · CLOUD AUTH & BILLING CONFIRMATION REQUIRED)**

---

## 1. Executive Verdict & Pre-Deployment Decision

**Overall Status: BLOCKED**

While all local gates, builds, security scans, unit tests, and the 57-test local emulator security-rule suite passed completely (Exit Code `0`), deployment is held due to two specific preflight conditions:

1. **Authentication Discrepancy:** The live Firebase Identity Toolkit API for project `ugc-mock-test-staging` reports that Email/Password sign-in is **NOT ENABLED** (`PASSWORD_LOGIN_DISABLED`). The owner must enable this in the Firebase Console before deployment.
2. **Billing Expenditure Verification:** The Cloud Billing API confirmed that `ugc-mock-test-staging` is linked to active Blaze billing account `01768F-FE1D80-622354` (`Firebase Payment`, INR). However, because programmatic budget/cost APIs are disabled (`403 SERVICE_DISABLED`), the exact November 2026 month-to-date expenditure cannot be retrieved via CLI/API and must be confirmed from the Google Cloud Console to ensure it is below the ₹800 stop threshold.

Per instructions, **ZERO cloud deployment commands were executed**.

---

## 2. Workspace & Owner Identity Configuration

### 2.1 Workspace Integrity
- **Verified Root:** `C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2`
- **Files & Packages:** All manifest files (`package.json`, `package-lock.json`), workspaces (`packages/shared`, `apps/web`, `functions`), test suites (`tests`), deployment scripts (`scripts`), and documentation (`docs`) are intact.
- **Archive Isolation:** Original ZIP (`ureducator-platform-v2-m81-source.zip`) and Git bundle (`ureducator-platform-v2-m81.bundle`) remain untouched in `Downloads`.

### 2.2 Staging Owner Identity Configuration
- File: `functions/.env.ugc-mock-test-staging`
- Configured Variable: `OWNER_BOOTSTRAP_EMAIL=subhashbanti99@gmail.com`
- All other staging environment variables were strictly preserved:
  - `APP_ENV=staging`
  - `EXPECTED_PROJECT_ID=ugc-mock-test-staging`
  - `APP_REGION=asia-south1`
  - `PAYMENTS_ENABLED=false`
  - `PAYMENT_MODE=test`
  - `AI_LIVE_ENABLED=false`
  - `ENFORCE_APP_CHECK=false`
  - `MAX_INSTANCES=5`
  - `ALLOWED_ORIGINS=https://ugc-mock-test-staging.web.app,https://ugc-mock-test-staging.firebaseapp.com`
  - `PUBLIC_BASE_URL=https://ugc-mock-test-staging.web.app`

### 2.3 `claimOwner` Implementation Audit (`functions/src/services/admin.ts`)
- **Exact Email Matching:** Requires `a.email.toLowerCase() === configuredEmail.toLowerCase()`. Email-prefix matching is **never** used.
- **Email Verification Guard:** Checks `if (!a.emailVerified || !a.email ...) throw err('permission-denied', 'FORBIDDEN')`. Unverified users cannot claim ownership.
- **Single-Claim Guarantee:** Executes `tx.create(P.setting('ownerClaim'), { uid: a.uid, atMs: d.clock() })`. Transactional create fails if the document already exists, throwing `OWNER_ALREADY_CLAIMED`.
- **Existing Owner Protection:** Once claimed, subsequent claims are permanently rejected; an existing owner cannot be overwritten.
- **Current State:** No owner account, student account, or administrator was created.

---

## 3. Firebase Authentication Cloud Audit

API Queried: `https://identitytoolkit.googleapis.com/admin/v2/projects/ugc-mock-test-staging/config` and `accounts:signInWithPassword` (non-destructive probe).

| Parameter | Required | Current Live Cloud State | Result |
|---|---|---|---|
| **Project ID** | `ugc-mock-test-staging` | `projects/336521990930/config` | **MATCH** |
| **Email/Password** | `ENABLED` | **`PASSWORD_LOGIN_DISABLED`** (Missing in `signInConfig`) | **DISCREPANCY (BLOCKED)** |
| **Email Link** | `DISABLED` | `DISABLED` | **PASS** |
| **Anonymous Auth** | `DISABLED` | `DISABLED` (`ADMIN_ONLY_OPERATION`) | **PASS** |
| **Authorized Domains** | Staging only | `localhost`, `ugc-mock-test-staging.firebaseapp.com`, `ugc-mock-test-staging.web.app` | **PASS** |
| **Production Domains** | None | No production domains present | **PASS** |

### Required Owner Action:
1. Open [Firebase Console](https://console.firebase.google.com/) → Select **`ugc-mock-test-staging`** (Project Number `336521990930`).
2. Go to **Build → Authentication → Sign-in method**.
3. Click **Email/Password** → Toggle primary switch to **Enabled** → Click **Save**.
4. Leave "Email link (passwordless sign-in)" **Disabled**.
5. Leave "Anonymous" **Disabled**.

---

## 4. Google Cloud Billing Audit

Queried via Cloud Billing Management API:
- **Project:** `ugc-mock-test-staging`
- **Billing Account ID:** `01768F-FE1D80-622354`
- **Billing Account Name:** `Firebase Payment`
- **Currency Code:** `INR`
- **Billing Account Status:** `open: true`
- **Project Billing Status:** `billingEnabled: true` (**Blaze Plan Active**)
- **Month-to-Date Cost:** Programmatic Budget API returned `403 SERVICE_DISABLED` for project `ugc-mock-test-staging`. Cost must be inspected via the [Google Cloud Console Billing Page](https://console.cloud.google.com/billing).
- **Threshold Check:** Per runbook guidelines, deployment requires confirming actual staging cost is below ₹800 against the ₹1,000 alert-only budget.

---

## 5. Local Readiness Gate Results (Gate 2 Re-Run)

Command:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-readiness.ps1 -SkipInstall -WebApiKey "<STAGING_PUBLIC_API_KEY>"
```
Runtime: Node v24.11.1 (session isolated from system Node v26.13.0), Java Temurin 21.0.12.1 LTS.

### Check Results:
```text
PASS  Node.js 24 is installed
PASS  npm is available
PASS  Java 21 or newer is installed (needed only by the local Firestore emulator)
PASS  Lint (zero errors, zero warnings)
PASS  TypeScript checks (all workspaces)
PASS  Unit tests (shared + functions)
PASS  Static rules lint (NOT a behavioural test)
PASS  Firestore rules tests on the LOCAL emulator (demo project, localhost only)
PASS  Build the staging web app and the Functions bundle
PASS  Bundle scan: web (no production id, no live Razorpay, no mock code, no answer-key names)
PASS  Bundle scan: Functions (lib and dist/functions)
PASS  Staging configuration scan (project, region, payments off, AI off, App Check monitor, instances)
PASS  Independent text search for the production project id, the old project id and live Razorpay keys

RESULT: READY. All local gates passed. Nothing has been deployed.
```

- **Unit Tests:** 135/135 passed (Shared: 37/37, Functions: 98/98).
- **Firestore Security Rules:** 57/57 behavioral tests passed against local `demo-ureducator` emulator.
- **Bundle Scans:** Scanned 249 web files and 4 backend bundle files: **0 findings**.
- **Staging Config Scan:** 34/34 checks passed (including verified owner email `subhashbanti99@gmail.com`).
- **Independent Text Search:** 0 occurrences of `ugc-mock-test(?!-staging)`, `ur-educator`, or `rzp_live_`.

---

## 6. Deployment Plan Verification

The deployment runbook (`DEPLOY_RUNBOOK_STAGING.md`) was reviewed. All commands strictly specify `--project ugc-mock-test-staging`:

1. **Firestore Rules & Indexes:**
   ```powershell
   npx.cmd --no-install firebase deploy --only firestore:rules,firestore:indexes --project ugc-mock-test-staging
   ```
2. **Storage Rules (Deny-All):**
   ```powershell
   npx.cmd --no-install firebase deploy --only storage --project ugc-mock-test-staging
   ```
3. **Cloud Functions Gen 2:**
   ```powershell
   npx.cmd --no-install firebase deploy --only functions --project ugc-mock-test-staging
   ```
4. **Firebase Hosting:**
   ```powershell
   npx.cmd --no-install firebase deploy --only hosting --project ugc-mock-test-staging
   ```
5. **Post-Deploy Smoke Test:**
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-staging.ps1
   ```

### Deployment Guardrails Confirmed:
- Storage rules: deny-all (`allow read, write: if false;`).
- Payments: `PAYMENTS_ENABLED=false`, `PAYMENT_MODE=test`.
- AI: `AI_LIVE_ENABLED=false` (mock provider).
- App Check: `ENFORCE_APP_CHECK=false` (monitor mode).
- Functions instances: `minInstances: 0`, `maxInstances: 5`.
- Production credentials: None present.

---

## 7. Outstanding Owner Actions Before Deployment

1. **Enable Email/Password Provider:** In Firebase Console for `ugc-mock-test-staging`, enable Email/Password (save changes).
2. **Confirm November 2026 MTD Cost:** Check Google Cloud Console Billing for `ugc-mock-test-staging` to confirm expenditure is below ₹800.
3. **Issue Deploy Command:** Once the above two items are complete, issue the deployment instruction:
   ```text
   GO DEPLOY STAGING
   ```
