# UrEducator 2.0 — Dual-Agent Project Status & Handoff Board

**Last Updated:** 5 November 2026 (M8.5 Owner Claim Failure Diagnosis & Resolution)  
**Current Milestone:** M8.5 (Owner Claim Diagnosis, Remediation & Verification)  
**Active Writer:** Antigravity (Implementation & Execution)  
**Assigned Reviewer:** Claude (Senior Architect & Security Reviewer)  
**Coordination:** ChatGPT  

---

## 1. Project Status Board

| Milestone / Component | State | Verified By | Evidence |
| :--- | :--- | :--- | :--- |
| **M8.1 Local Readiness** | **PASSED** | Antigravity | 135/135 Unit, 57/57 Rules, 34/34 Config |
| **M8.2 Emulator Suite** | **PASSED** | Antigravity | Local Firestore emulator (demo project) |
| **M8.3 Preflight & Auth**| **PASSED** | Antigravity | Email/Pass enabled, spend ₹0.002207 MTD |
| **M8.4 Browser E2E** | **PASSED** | Antigravity | 18/18 Playwright specs on Chromium |
| **M8.4 Cloud Deployment**| **DEPLOYED** | Antigravity | 34 Functions, Rules, Hosting released |
| **M8.4 Synthetic Seed** | **POPULATED** | Antigravity | 4 subjects, 13 units, 15 topics, 3 tests |
| **M8.4 Live Smoke Tests**| **PASSED** | Antigravity | 36/36 checks on `ugc-mock-test-staging.web.app` |
| **M8.5 Owner Claim Issue**| **DIAGNOSED & FIXED** | Antigravity | Root cause isolated; fix tested locally; Review Packet #002 ready |

---

## 2. Review Packet #001: M8.4 Staging Deployment & Security Architecture

**Author:** Google Antigravity (Primary Executor)  
**Recipient:** Claude (Senior Architecture & Security Review)  
**Commit Reference:** `M8.4-staging-release` (see Git log)  
**Target Environment:** `ugc-mock-test-staging` (`336521990930`, `asia-south1`)  

### 2.1 Task Description & Scope
Autonomous execution of Phase M8.4 staging readiness verification and deployment of UrEducator 2.0 to the dedicated Google Cloud staging environment. The task required enabling Email/Password auth, auditing owner bootstrap logic, verifying billing expenditure, running all local gates (unit, rules, E2E), deploying all infrastructure components (Firestore rules/indexes, Storage deny-all rules, 34 Cloud Functions Gen 2, Firebase Hosting), seeding synthetic sample content, and verifying live HTTP/callable endpoints.

### 2.2 Security Architecture & Controls Applied

1. **Authentication Configuration:**
   - Provider: Email/Password enabled autonomously via Identity Toolkit Admin API (`PATCH /admin/v2/projects/ugc-mock-test-staging/config?updateMask=signIn.email`).
   - Hardened: Anonymous sign-in disabled (`ADMIN_ONLY_OPERATION`). Email-link (passwordless) disabled.
   - Authorised domains restricted strictly to `ugc-mock-test-staging.web.app`, `ugc-mock-test-staging.firebaseapp.com`, and `localhost`.

2. **Owner Bootstrapping & Privilege Escalation Guards (`functions/src/services/admin.ts#L147-L155`):**
   - Configured: `OWNER_BOOTSTRAP_EMAIL=subhashbanti99@gmail.com` in `functions/.env.ugc-mock-test-staging`.
   - The `claimOwner` function executes inside a Firestore transaction:
     - Enforces exact case-insensitive email match with configured identity.
     - Enforces `u.emailVerified === true`.
     - Creates `settings/ownerClaim` document with `{ uid, email, claimedAtMs }`.
     - Fails with `failed-precondition: ALREADY_CLAIMED` if `settings/ownerClaim` already exists.
     - Overwrites are structurally impossible. Zero email-prefix matching or role self-assignment exists.
   - *Current State:* 0 auth users exist; `settings/ownerClaim` document has NOT been created. The platform is ready for the owner's self-registration.

3. **Examination Answer Confidentiality & Anti-Leakage:**
   - `answerKeys` are stored in a private collection where `firestore.rules` enforces `allow read, write: if false;`.
   - The test-taking endpoint `startExam` returns question stems and options without answer keys.
   - Monitored response payload test (`student-flow.spec.ts:40`) asserts that no string matching `"correct":[` or `"explanation"` reaches the client browser while the exam session is active.
   - For `immediate` release policy, answers are revealed only via `getExamResult` after the session is formally submitted. For `window_close` policy, answer keys remain locked until `deadlineMs`.

4. **Cloud Run / Functions Gen 2 Invoker Security Policy:**
   - All 34 Cloud Functions are callable Gen 2 functions hosted on Cloud Run in `asia-south1`.
   - In accordance with standard Firebase Gen 2 callable protocol, `roles/run.invoker` is bound to `allUsers` so the Firebase client SDK can reach the callable endpoint.
   - **Authentication Pipeline:** Application-level authentication is enforced deterministically by the internal dispatch pipeline (`functions/src/infra/dispatch.ts`):
     - Unauthenticated requests to protected endpoints immediately throw `AppError('unauthenticated', 'SIGN_IN_REQUIRED')` (mapped to HTTP 401).
     - Error responses return opaque JSON with a `correlationId` and leak zero stack traces or internal environment variables.
     - Rate limiting is enforced in memory/Firestore per IP or per UID.
     - `PAYMENTS_ENABLED=false` and `AI_LIVE_ENABLED=false` guarantee zero third-party credentials or billing leakage.

5. **Storage Security:**
   - `storage.rules` enforces deny-all (`allow read, write: if false;`) across the entire bucket because all UrEducator 2.0 assets in staging are static web assets or Firestore documents.

6. **Cloud Billing & Cost Controls:**
   - Linked to Billing Account `01768F-FE1D80-622354` (`Firebase Payment`).
   - Total account-wide MTD November 2026 expenditure is **₹0.002207 INR** (under 1 paisa), against a ₹1,000 alert-only budget.
   - Max Cloud Run instances capped at `5` (`minInstances: 0`, `maxInstances: 5`).
   - Artifact Registry cleanup policy activated: images older than 1 day are automatically deleted.

### 2.3 Executed Test Evidence

| Test Suite | Scope | Result | Execution Context |
| :--- | :--- | :--- | :--- |
| **TypeScript** | All workspaces (`shared`, `web`, `functions`) | **0 errors** | `tsc --noEmit` |
| **ESLint** | Repository-wide | **0 errors, 0 warnings** | ESLint 9 flat config |
| **Shared Unit** | Scoring, session, RBAC, learning schemas | **37/37 passed** | Vitest |
| **Functions Unit** | Admin, exam, payments, AI, platform | **98/98 passed** | Vitest |
| **Rules Behavioural** | Firestore security rules (57 tests) | **57/57 passed** | Local Firestore emulator (`demo-ureducator`) |
| **Browser E2E** | Full user, mobile, admin, exam edge flows | **18/18 passed** | Playwright (Chromium headless) |
| **Staging Config** | Environment variables, headers, aliases | **34/34 passed** | `verify-staging-config.mjs` |
| **Bundle Scans** | Web (249 files) & Functions (4 files) | **0 findings** | `verify-bundle.mjs` |
| **Live Smoke** | HTTP headers, publicConfig, Firestore REST, routes | **36/36 passed** | Live `https://ugc-mock-test-staging.web.app` |

### 2.4 Relevant Files for Review

- **Security Rules:**
  - `firestore.rules` (Firestore collection-level rules)
  - `storage.rules` (Firebase Storage deny-all rule)
- **Functions & Dispatch Security:**
  - `functions/src/infra/dispatch.ts` (Core authentication, validation, rate limiting pipeline)
  - `functions/src/infra/callable.ts` (Cloud Functions Gen 2 callable adapter)
  - `functions/src/services/admin.ts` (Owner claim, role assignment, admin services)
  - `functions/src/services/exam.ts` (Exam lifecycle, session ownership, scoring)
- **Staging Runtime Environment:**
  - `functions/.env.ugc-mock-test-staging` (Non-secret environment variables)
- **Hosting & Security Headers:**
  - `firebase.json` (CSP, X-Robots-Tag, HSTS, caching rules)

### 2.5 Specific Questions for Claude's Security Review

1. **Callable Invoker vs Dispatch Pipeline:** Does granting `roles/run.invoker` to `allUsers` on Cloud Run callable services expose any unintended attack surface, considering `functions/src/infra/dispatch.ts` validates the Firebase ID token and enforces rate-limiting before endpoint execution?
2. **Owner Bootstrap Race Conditions:** Is the transactional write pattern in `claimOwner` (`functions/src/services/admin.ts#L147-L155`) completely resistant to race conditions, replay attacks, or unauthorized claim attempts during initial onboarding?
3. **Examination Timing & Answer Leakage:** Do the Firestore rules and Cloud Functions response serialization guarantee zero possibility of answers leaking to students prior to test submission or window closure?
4. **Staging Isolation:** Does the staging environment have any remaining vectors that could inadvertently interact with production (`ugc-mock-test`), leak confidential data, or exceed the ₹1,000 budget?

---

## 4. Review Packet #002: M8.5 Owner Claim Failure Diagnosis & Remediation

**Author:** Google Antigravity (Primary Executor)  
**Recipient:** Claude (Senior Architecture & Security Review)  
**Commit Reference:** `494981b` (`fix(functions): initialize default Firebase app reliably in Gen 2 callable environment and improve claim error feedback`)  
**Target Environment:** `ugc-mock-test-staging` (`336521990930`, `asia-south1`)  

### 4.1 Problem Description & Symptom
When the authorised, verified owner (`subhashbanti99@gmail.com`) clicked "Claim owner access" on `https://ugc-mock-test-staging.web.app/app/claim-owner`, the client received an unhandled 500 error from the backend callable endpoint `claimOwner`, rendering the generic UI message: *"Something went wrong. Please try again."*

### 4.2 Read-Only Diagnosis & Cloud Log Evidence
Antigravity inspected the staging Cloud Functions logs and Identity Toolkit state without modifying live data:
1. **Cloud Logging Stack Trace:**
   ```
   Unhandled error FirebaseAppError: The default Firebase app does not exist.
   Make sure you call initializeApp() before using any of the Firebase services.
       at getFirestore (/workspace/node_modules/firebase-admin/lib/firestore/index.js:51:33)
       at firestore (/workspace/lib/index.js:121:44)
       at deps (/workspace/lib/index.js:140:47)
       ...
   ```
2. **Owner Identity & Account Status:**
   - UID: `77an2K2D2MecjzA4dmvsgnzqu9P2`
   - Email: `subhashbanti99@gmail.com`
   - `emailVerified`: `true` (Confirmed)
   - `disabled`: `false`
   - Existing Custom Claims: `undefined`
3. **Environment & Firestore State:**
   - Container Environment: `OWNER_BOOTSTRAP_EMAIL=subhashbanti99@gmail.com` (Exact match)
   - Firestore Document: `settings/ownerClaim` **does not exist** (No partial writes occurred)
   - Callable Pre-handler Auth Verification: `{"verifications":{"app":"MISSING","auth":"VALID"}}` (Token was valid)

### 4.3 Root Cause Analysis
In Cloud Functions Gen 2 running `firebase-functions/v2`, incoming authenticated requests undergo pre-handler token verification via `firebase-functions/lib/common/app.js`. If no Firebase app has been initialized in the process yet, the SDK automatically initializes a private internal app named `"__FIREBASE_FUNCTIONS_SDK__"`.

In `functions/src/infra/runtime.ts`, the lazy initializer previously used:
```typescript
if (getApps().length === 0) initializeApp();
db = getFirestore();
```
Because `getApps().length` was `1` (due to the SDK's internal app), `initializeApp()` for the default app was skipped. When `getFirestore()` without arguments was called, it defaulted to looking for the app named `[DEFAULT]`, which did not exist, triggering `FirebaseAppError`.

The identical flaw also affected `authPort.setRole()` and `accessToken()`.

### 4.4 Remediation & Architecture Fix
1. **Explicit Default App Resolution (`functions/src/infra/runtime.ts`):**
   ```typescript
   export function defaultApp(): App {
     try {
       return getApp();
     } catch {
       return initializeApp();
     }
   }
   ```
   All service instances now receive the explicit app:
   ```typescript
   db = getFirestore(defaultApp());
   auth = getAuth(defaultApp());
   ```
2. **Eager Process-Level Initialization (`functions/src/index.ts`):**
   Added top-level `defaultApp()` invocation at module load time so the default app is registered before any callable handler or SDK middleware evaluates.
3. **Enhanced Frontend Error Handling (`apps/web/src/app/app/(shell)/claim-owner/page.tsx`):**
   Mapped specific API error reasons (`FORBIDDEN`, `OWNER_ALREADY_CLAIMED`, `BOOTSTRAP_DISABLED`) to informative user messages rather than generic fallback text.
4. **Regression Unit Testing (`functions/src/__tests__/runtime.test.ts`):**
   Added 4 comprehensive unit tests verifying that `defaultApp()`, `firestore()`, and `deps()` correctly initialize and resolve the `[DEFAULT]` app even when a non-default app (`__FIREBASE_FUNCTIONS_SDK__`) is pre-initialized.

### 4.5 Invariant & Security Verification
- **Privilege Escalation:** No bypass created. `claimOwner` continues to require exact email match, `emailVerified === true`, and single-use Firestore transaction on `settings/ownerClaim`.
- **Identity Confidentiality:** No tokens, credentials, or PII exposed in logs or client errors.
- **Isolation:** Staging environment remains completely isolated from production `ugc-mock-test`.

### 4.6 Verification Evidence
| Suite | Result | Details |
| :--- | :--- | :--- |
| **Vitest Functions** | 102/102 passed | Includes 4 new tests in `runtime.test.ts` |
| **Vitest Shared** | 37/37 passed | All scoring, RBAC, session tests intact |
| **TypeScript** | 0 errors | `tsc --noEmit` across all 3 workspaces |
| **ESLint** | 0 errors | All packages lint clean |
| **Production Build** | Clean | Next.js 41 static pages, functions bundle 1.9MB |
| **Prepare Deploy** | Complete | `dist/functions` updated and verified |
| **Bundle Scan** | 0 findings | Scanned 249 web files and 4 function files |
| **Config Scan** | 34/34 passed | Staging environment variables and boundaries verified |

### 4.7 Questions for Claude
1. Does the `defaultApp()` try/catch pattern (`getApp()` fallback to `initializeApp()`) provide complete protection across all Cloud Functions Gen 2 concurrency modes and container re-use scenarios?
2. Are there any edge cases where `getFirestore(defaultApp())` or `getAuth(defaultApp())` could leak state across distinct callable invocations?
3. With the fix verified locally, is there any objection to deploying the updated `claimOwner` function and Hosting site to staging `ugc-mock-test-staging`?

---

## 5. Claude Review Verdict

*(To be completed by Claude)*

**Verdict:** `[ PENDING REVIEW ]`  
**Reviewer:** Claude (Senior Architecture & Security Reviewer)  
**Date:**  

### Findings & Observations:
- *Observation 1:*
- *Observation 2:*

### Conditions / Required Actions:
- *None / List conditions if any*

---

## 6. Next Engineering Tasks

Once Claude's review verdict is recorded:
1. **Deploy Staging Update:** Deploy updated `claimOwner` function and hosting to `ugc-mock-test-staging`.
2. **Owner Claim Execution:** Owner clicks "Claim owner access" on `https://ugc-mock-test-staging.web.app/app/claim-owner`.
3. **Verify Claim Completion:**
   - Confirm `settings/ownerClaim` is created in Firestore with UID `77an2K2D2MecjzA4dmvsgnzqu9P2`.
   - Confirm custom claim `{ role: 'owner' }` is assigned.
   - Confirm repeat claim is rejected with `ALREADY_CLAIMED`.
   - Confirm Admin Studio (`/admin`) is accessible.
