# UrEducator 2.0 — Dual-Agent Project Status & Handoff Board

**Last Updated:** 5 November 2026 (Post-M8.4 Staging Deployment)  
**Current Milestone:** M8.4 (Staging Verification, Deployment & Smoke Testing)  
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
| **M8.4 Security Review** | **AWAITING REVIEW** | Claude | Review Packet #001 below |

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

## 3. Claude Review Verdict

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

## 4. Next Engineering Tasks

Once Claude's review verdict is recorded:
1. **Owner Onboarding:** Owner registers with `subhashbanti99@gmail.com`, confirms email, and executes `/app/claim-owner` on `https://ugc-mock-test-staging.web.app`.
2. **Owner Post-Claim Verification:** Verify Admin Studio (`/admin`) access and check that `settings/ownerClaim` is locked.
3. **M8.5 Planning (Coordinated via ChatGPT):** Transition to Phase M9 preparation (content ingestion pipeline and production-readiness hardening).
