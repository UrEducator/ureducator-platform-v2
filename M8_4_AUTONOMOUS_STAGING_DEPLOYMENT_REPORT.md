# UrEducator 2.0 — Phase M8.4 Autonomous Staging Verification & Deployment Report

**Execution Date:** 5 November 2026  
**Environment:** Staging  
**Status:** **FULLY DEPLOYED AND VERIFIED**  
**Live URL:** [https://ugc-mock-test-staging.web.app](https://ugc-mock-test-staging.web.app)

---

## 1. Executive Summary

Phase M8.4 autonomous verification and deployment of **UrEducator 2.0** to the dedicated Google Cloud / Firebase staging project has completed successfully with zero manual console intervention required. All pre-deployment local gates, end-to-end browser specifications, cloud configuration validations, infrastructure component deployments, synthetic content populations, and live post-deployment smoke tests passed.

| Parameter | Authorised Target / Value | Verified Deployment Status |
| :--- | :--- | :--- |
| **Project ID** | `ugc-mock-test-staging` | Verified (`ugc-mock-test-staging`) |
| **Project Number** | `336521990930` | Verified (`336521990930`) |
| **Hosting Site & Target** | `ugc-mock-test-staging` | Released (`283 files`, version finalized) |
| **Target URL** | `https://ugc-mock-test-staging.web.app` | HTTP 200, Live & Operational |
| **Region** | `asia-south1` (Mumbai) | All 34 Cloud Functions Gen 2 deployed |
| **Runtime** | `nodejs24` | Verified |
| **Cloud Billing Account** | `01768F-FE1D80-622354` (`Firebase Payment`) | Linked & Active (`billingEnabled: true`) |
| **November 2026 MTD Cost** | `< ₹800.00` Stop Gate Threshold | **₹0.002207 INR** (Account-wide MTD) |
| **Authorised Staging Owner** | `subhashbanti99@gmail.com` | Configured in staging runtime env |
| **Owner State** | Unclaimed / Clean | `settings/ownerClaim` does NOT exist; 0 auth users |
| **Production Boundaries** | `ugc-mock-test` & `ur-educator` | **STRICTLY UNTOUCHED** (Zero interaction) |

---

## 2. Pre-Deployment Local Readiness Gates

All local tests and static analysis gates were executed inside the Windows workspace (`C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2`) against Node.js `v24.11.1` and OpenJDK Temurin `21.0.12.1`.

```
======================================================================
LOCAL READINESS GATE SUMMARY
======================================================================
PASS  Node.js 24 is installed (v24.11.1)
PASS  npm is available (12.2.1)
PASS  Java 21 LTS is installed (OpenJDK 21.0.12.1)
PASS  ESLint: zero errors, zero warnings across all workspaces
PASS  TypeScript: tsc --noEmit passed across shared, web, and functions
PASS  Unit Tests: 135/135 passed
      - Shared package (@ureducator/shared): 37/37 passed (6 suites)
      - Cloud Functions (functions): 98/98 passed (5 suites)
PASS  Static rules lint: syntax and structure verified
PASS  Firestore rules emulator: 57/57 behavioural security tests passed
      - Local emulator on localhost:8080 against demo project "demo-ureducator"
PASS  Deployable staging build:
      - apps/web/out (Next.js static export: 283 files)
      - dist/functions (prepared for Cloud Functions Gen 2)
PASS  Web bundle scan: 249 files scanned, 0 findings (no prod IDs, no live secrets)
PASS  Functions bundle scan: 4 files scanned, 0 findings
PASS  Staging configuration scan: 34/34 checks passed
PASS  Independent text search: 0 occurrences of prod/trial IDs or live keys
PASS  Playwright E2E browser suite: 18/18 tests passed (Chromium, 1 worker)
======================================================================
```

### Playwright E2E Behavioral Suite Results (18/18 Passed)
1. `admin-studio.spec.ts:10` — Owner bootstrap works once, only for configured verified email, student sees no staff area (PASS)
2. `admin-studio.spec.ts:45` — Content pipeline: editor writes, reviewer approves, admin publishes, student sits the test (PASS)
3. `admin-studio.spec.ts:95` — Each staff role sees only its own areas, server refuses the rest (PASS)
4. `exam-edge.spec.ts:14` — Answers survive reload, timer keeps running on server clock (PASS)
5. `exam-edge.spec.ts:33` — Going offline keeps answers on device, syncs when connection returns (PASS)
6. `exam-edge.spec.ts:47` — Test submits itself when time runs out, result confirms (PASS)
7. `exam-edge.spec.ts:59` — Late submit cannot add answers after deadline, second submit idempotent (PASS)
8. `exam-edge.spec.ts:75` — Answers open later: score shown immediately, key locked until window closes (PASS)
9. `exam-edge.spec.ts:96` — One student cannot read or finish another student's session (PASS)
10. `exam-edge.spec.ts:105` — 150-question full-length format loads with 50 + 100 layout, 300 marks, 180 min (PASS)
11. `mobile.spec.ts:8` — Phone layout: no sideways scrolling on key pages, exam palette opens as sheet (PASS)
12. `public-and-guards.spec.ts:7` — Public pages: honest labelling, no prices, not indexable, disclaimer visible (PASS)
13. `public-and-guards.spec.ts:24` — Lead form records consent, rate limited per IP (PASS)
14. `public-and-guards.spec.ts:37` — Signed-out visitors redirected to login, open redirects refused (PASS)
15. `public-and-guards.spec.ts:49` — Unconfirmed email can browse but cannot start test or use mentor (PASS)
16. `public-and-guards.spec.ts:56` — Students cannot call staff endpoints or assign roles (PASS)
17. `student-flow.spec.ts:10` — Complete student flow: sign up, email confirm, demo test, review, notebook, planner, mentor (PASS)
18. `student-flow.spec.ts:116` — Accessibility: zero WCAG 2.1 AA violations on key pages (AxeBuilder) (PASS)

---

## 3. Staging Cloud Configuration Verification

### 3.1 Firebase Authentication
- **Resolution**: Enabled `signIn.email` (`{ enabled: true, passwordRequired: true }`) autonomously via Identity Toolkit Admin API `PATCH` on `projects/ugc-mock-test-staging/config`.
- **Email/Password**: **ENABLED**
- **Anonymous Sign-in**: **DISABLED** (`ADMIN_ONLY_OPERATION`)
- **Email Link (Passwordless)**: **DISABLED**
- **Authorised Domains**:
  - `ugc-mock-test-staging.web.app`
  - `ugc-mock-test-staging.firebaseapp.com`
  - `localhost`
- **User Accounts**: **0** (No accounts created directly or via Admin SDK)

### 3.2 Google Cloud Billing Verification
- **Billing Account**: `01768F-FE1D80-622354` (`Firebase Payment`, INR)
- **Account Status**: Open & Active
- **Association**: Project `ugc-mock-test-staging` linked with `billingEnabled: true`
- **November 2026 Spend**: Total account-wide expenditure across both projects is **₹0.002207 INR** (~0.22 paise).
- **Threshold Gate**: `₹0.002207 << ₹800.00` stop threshold. Gate passed.
- **Budget**: ₹1,000 monthly alert-only budget.

### 3.3 Authorised Staging Owner Configuration
- Configured in `functions/.env.ugc-mock-test-staging`:
  ```ini
  OWNER_BOOTSTRAP_EMAIL=subhashbanti99@gmail.com
  ```
- **Code Audit (`functions/src/services/admin.ts#L147-L155`)**:
  - Requires exact string match (`u.email.toLowerCase() === configuredEmail.toLowerCase()`).
  - Requires `u.emailVerified === true`.
  - Transactional write creating `settings/ownerClaim` ensures single-use execution.
  - Rejects if owner already claimed (`ALREADY_CLAIMED`).
  - No email prefix / domain wildcard logic exists.

---

## 4. Component Deployments

Every component was deployed individually with explicit project scoping (`--project ugc-mock-test-staging`).

### 4.1 Firestore Security Rules & Indexes
```powershell
firebase deploy --only firestore:rules,firestore:indexes --project ugc-mock-test-staging
```
- **Rules File**: `firestore.rules` compiled and deployed to Cloud Firestore `(default)`.
- **Indexes**: Composite indexes deployed from `firestore.indexes.json`.
- **Status**: Complete (`release complete`).

### 4.2 Firebase Storage Security Rules
```powershell
firebase deploy --only storage --project ugc-mock-test-staging
```
- **Rules File**: `storage.rules` compiled and released to `firebase.storage`.
- **Rule Body**: Unconditional `allow read, write: if false;` (user file uploads disabled for staging).
- **Status**: Complete (`release complete`).

### 4.3 Cloud Functions Gen 2 (All 34 Callables)
```powershell
firebase deploy --only functions --force --project ugc-mock-test-staging
```
- **Region**: `asia-south1` (Mumbai)
- **Runtime**: `nodejs24`
- **Scaling Limits**: `minInstances: 0`, `maxInstances: 5`
- **Secrets Required**: 0 (Payments disabled: `PAYMENTS_ENABLED=false`)
- **Artifact Registry Cleanup Policy**: Configured in `asia-south1` (container images older than 1 day automatically deleted).
- **Cloud Run Invoker Policy**: `roles/run.invoker` granted to `allUsers` across all 34 callable endpoints to allow standard Firebase HTTPS callable client SDK invocation.

#### Deployed Cloud Functions (34 Total):
| Function Name | Gen / Trigger | Region | Memory | Runtime |
| :--- | :--- | :--- | :--- | :--- |
| `adminGetQuestion` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminList` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminOverview` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminPublishMockTest` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminSaveQuestion` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminTransitionQuestion` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminUnpublishMockTest` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminUpdateLead` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminUpdateTicket` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminUpsertBlueprint` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminUpsertCatalogue` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminUpsertMockTest` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `adminUpsertPlan` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `askMentor` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `assignRole` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `captureLead` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `claimOwner` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `createOrder` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `createTicket` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `ensureProfile` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `generatePlan` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `generateReport` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `getExamResult` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `getExamSession` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `listNotebook` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `notebookQuestion` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `publicConfig` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `reviewNotebook` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `saveResponses` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `startExam` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `submitExam` | v2 callable | `asia-south1` | 512 MiB | `nodejs24` |
| `updateProfile` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `verifyPayment` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |
| `verifyReport` | v2 callable | `asia-south1` | 256 MiB | `nodejs24` |

### 4.4 Firebase Hosting
```powershell
firebase deploy --only hosting --project ugc-mock-test-staging
```
- **Files Uploaded**: 283 files from `apps/web/out`
- **Hosting Site**: `ugc-mock-test-staging`
- **Hosting URL**: [https://ugc-mock-test-staging.web.app](https://ugc-mock-test-staging.web.app)
- **Status**: Complete (`version finalized`, `release complete`).

---

## 5. Synthetic Staging Content Population

The synthetic seed script was verified and executed with mandatory project guards:
```powershell
node scripts/seed-staging.mjs --project ugc-mock-test-staging --confirm-write-synthetic-staging-data
```

### Verified Firestore Collections & Documents:
- `subjects` (**4 documents**): `paper1`, `sample-commerce`, `sample-cs`, `sample-education`
- `units` (**13 documents**): `p1-teaching`, `p1-research`, `p1-comprehension`, `p1-communication`, `p1-maths`, `p1-reasoning`, `p1-data`, `p1-ict`, `p1-people`, `p1-higher-edu`, `sample-education-u1`, `sample-cs-u1`, `sample-commerce-u1`
- `topics` (**15 documents**): `p1-communication-basics`, `p1-comprehension-passage`, `p1-data-tables`, `p1-environment-issues`, `p1-higher-ed-structure`, `p1-ict-basics`, `p1-logical-arguments`, `p1-maths-series`, `p1-research-ethics`, `p1-research-types`, etc.
- `examBlueprints` (**2 documents**): `demo-mini`, `ugcnet-practice-full-v1`
- `mockTests` (**3 documents**):
  - `mt-mini`: Demo mini test (10 questions, immediate answer review)
  - `mt-mini-late`: Demo mini test (answers open after window closes)
  - `mt-full`: Full-length format rehearsal (150 synthetic questions, 50 Paper 1 + 100 Paper 2)
- `publishedPapers` (**2 documents**): `demo-mini-p`, `demo-full-p`
- `answerKeys` (**2 documents**): `demo-mini-p`, `demo-full-p` (stored in private collection, inaccessible to unauthenticated or student queries)
- `learningNotes` (**1 document**): `n-sampling`

---

## 6. Live Staging Smoke Tests & Verification (36/36 Passed)

The autonomous test script `scripts/smoke-staging.ps1` was executed directly against the live staging domain and Cloud Functions endpoints:

```
======================================================================
LIVE STAGING SMOKE TEST RESULTS (36/36 PASSED)
======================================================================
PASS  Landing page loads (HTTP 200)  status 200
PASS  Staging banner text is in the page
PASS  X-Robots-Tag header contains noindex (noindex, nofollow, noarchive)
PASS  Content-Security-Policy header present
PASS  robots.txt disallows crawling (status 200)
PASS  Route /login is served (status 200)
PASS  Route /signup is served (status 200)
PASS  Route /syllabus is served (status 200)
PASS  Route /pricing is served (status 200)
PASS  Route /disclaimer is served (status 200)
PASS  Route /app is served (status 200)
PASS  Route /admin is served (status 200)
PASS  Landing page does not mention the mock test backend
PASS  publicConfig answers (HTTP 200)
PASS  publicConfig: environment is staging
PASS  publicConfig: payments are disabled
PASS  publicConfig: live AI is disabled
PASS  publicConfig: payment mode is test
PASS  startExam refuses an unauthenticated caller (status 401)
PASS  submitExam refuses an unauthenticated caller (status 401)
PASS  getExamResult refuses an unauthenticated caller (status 401)
PASS  adminList refuses an unauthenticated caller (status 401)
PASS  adminOverview refuses an unauthenticated caller (status 401)
PASS  assignRole refuses an unauthenticated caller (status 401)
PASS  claimOwner refuses an unauthenticated caller (status 401)
PASS  createOrder refuses an unauthenticated caller (status 401)
PASS  Firestore refuses unauthenticated read of answerKeys/probe (status 403)
PASS  Firestore refuses unauthenticated read of publishedPapers/probe (status 403)
PASS  Firestore refuses unauthenticated read of questions/probe (status 403)
PASS  Firestore refuses unauthenticated read of leads/probe (status 403)
PASS  Firestore refuses unauthenticated read of auditLogs/probe (status 403)
PASS  Firestore refuses unauthenticated read of systemSettings/_reportKey (status 403)
PASS  Firestore refuses unauthenticated read of users/probe (status 403)
PASS  Firestore refuses unauthenticated read of examSessions/probe (status 403)
PASS  Firestore refuses unauthenticated read of mockTests (status 403)
PASS  Firestore allows the public catalogue (subjects) (status 200)
======================================================================
```

### 6.1 Live HTTP Surface
- **URL**: `https://ugc-mock-test-staging.web.app`
- **Response**: `200 OK`
- **Headers Verified**:
  - `X-Robots-Tag: noindex, nofollow, noarchive`
  - `Content-Security-Policy`: Present and enforced
  - `Strict-Transport-Security: max-age=31556926; includeSubDomains; preload`
- **`robots.txt`**:
  ```text
  User-Agent: *
  Disallow: /
  ```

### 6.2 Public Pages & Honesty Checks
- Verified public routes: `/`, `/about`, `/syllabus`, `/pricing`, `/privacy`, `/terms`, `/contact`, `/disclaimer`, `/verify-report`.
- **Honest Labelling**: The yellow banner `"Staging preview. Practice content only. Search engines are told not to index this site. Payments are switched off."` is visible on all public pages.
- **No False Claims**: Clear statutory disclaimer on public pages stating UrEducator is not affiliated with or endorsed by NTA or UGC.
- **No Pricing**: `/pricing` displays `"Payments are switched off in this preview. Nothing can be bought yet. Prices appear below only after an authorised administrator publishes them."` Zero rupee symbols (`₹`) appear in content.

### 6.3 Public Callable Function (`publicConfig`)
Invoked over HTTPS at `https://asia-south1-ugc-mock-test-staging.cloudfunctions.net/publicConfig`:
```json
{
  "result": {
    "env": "staging",
    "paymentsEnabled": false,
    "paymentMode": "test",
    "aiLive": false,
    "appCheckEnforced": false
  }
}
```

### 6.4 Unauthenticated Security Guards
All protected callables (`ensureProfile`, `startExam`, `claimOwner`, `adminOverview`) returned `HTTP 401 Unauthorized` for unauthenticated requests with clean, opaque response bodies, preventing information leakage or internal error disclosures.

---

## 7. Owner Handover & Action Guide

The staging environment is deployed, secure, and ready for you to claim ownership. To complete your identity onboarding, follow these 5 steps directly in your browser:

### Step 1: Open the Deployed Website
Navigate to the deployed staging application:  
👉 **[https://ugc-mock-test-staging.web.app](https://ugc-mock-test-staging.web.app)**

### Step 2: Register with the Authorised Identity
1. Click **Start practising** or visit `https://ugc-mock-test-staging.web.app/signup`.
2. Enter your name and the authorised email:
   - **Email:** `subhashbanti99@gmail.com`
   - **Password:** Enter a secure password (minimum 8 characters).
   - Tick the terms and privacy checkbox.
3. Submit the registration form.

### Step 3: Verify Your Email Address
1. Firebase Authentication sends a confirmation link to `subhashbanti99@gmail.com`.
2. Open the email in your inbox and click the verification link.
3. Return to the browser tab showing the `"Confirm your email"` screen and click **I have confirmed my email**.

### Step 4: Claim Platform Ownership
1. Once signed in and email-verified, navigate to:  
   👉 `https://ugc-mock-test-staging.web.app/app/claim-owner`
2. Click **Claim ownership**.
3. The server transaction verifies `subhashbanti99@gmail.com`, records the claim document in `settings/ownerClaim`, and assigns the `owner` custom claim to your account.

### Step 5: Verify Admin Studio Access
1. Sign out and sign back in to refresh your authentication token claims.
2. In the navigation bar, the **Admin Studio** link (`/admin`) will appear.
3. Confirm that you can access the staff dashboard, manage questions, review leads, and inspect the synthetic mock tests.
