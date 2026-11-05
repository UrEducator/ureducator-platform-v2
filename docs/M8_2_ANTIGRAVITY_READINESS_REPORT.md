# UrEducator 2.0 — Phase M8.2 Antigravity Staging Readiness & Preflight Report

- **Date:** 5 November 2026
- **Target Project:** `ugc-mock-test-staging`
- **Project Number:** `336521990930`
- **Region:** `asia-south1`
- **Hosting Site / Target:** `ugc-mock-test-staging` (`https://ugc-mock-test-staging.web.app`)
- **Operator:** Antigravity AI Assistant on Windows 11 Host
- **Status:** **LOCAL GATES PASSED (READY). ZERO CLOUD DEPLOYMENTS EXECUTED.**

---

## Executive Summary & Verdict

| Question | Status / Result | Evidence / Details |
|---|---|---|
| **Local Readiness Gate** | **READY** | All 14 verification checks passed with exit code 0. |
| **Firestore Security Rules Tested?** | **PASS (57/57)** | Executed on local Firestore emulator against `demo-ureducator` (localhost only). |
| **Unit Tests Passed?** | **PASS (135/135)** | Shared: 37/37; Cloud Functions: 98/98. |
| **Lint & TypeScript Checks?** | **PASS (0 errors / 0 warnings)** | Strict ESLint 0 warnings; TypeScript clean across all 3 workspaces. |
| **Staging Web & Functions Builds?** | **PASS** | Web: 249 static output files; Functions: clean bundled `dist/functions`. |
| **Bundle & Config Security Scans?** | **PASS (0 findings)** | 34/34 configuration checks; no production IDs or live payment keys found. |
| **Has anything been deployed?** | **NO (0 deployments)** | Strictly adhering to deployment restrictions; awaiting `GO DEPLOY STAGING`. |
| **Production / Trial Isolation?** | **UNTOUCHED** | `ugc-mock-test` and `ur-educator` completely isolated and unreferenced. |
| **Staging Cloud Billing Status?** | **VERIFIED ACTIVE** | Blaze billing active (`billingAccounts/01768F-FE1D80-622354`). |
| **Authentication Configuration?** | **ACTION REQUIRED** | Email/Password provider is **Disabled**; Anonymous is **Disabled**. |

---

## 1. Workspace Preparation & Repository Layout

1. **Source Archive Location:** `C:\Users\subha\Downloads\ureducator-platform-v2-m81-source.zip` (2,853,192 bytes, preserved intact).
2. **Backup Git Bundle:** `C:\Users\subha\Downloads\ureducator-platform-v2-m81.bundle` (4,384,775 bytes, preserved intact).
3. **Extraction Destination:** `C:\AI\ureducator-platform-v2-m81`
4. **Identified Repository Root:** `C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2`
5. **File Count:** 200 files, 68 directories.
6. **Package Verification:**
   - `package.json` & `package-lock.json`: Present
   - `apps/web`: Present (Next.js application)
   - `functions`: Present (Cloud Functions Gen 2 backend)
   - `packages/shared`: Present (Domain models, RBAC, scoring, validation schemas)
   - `tests`: Present (Rules behavioural test suite and E2E suites)
   - `scripts`: Present (`verify-readiness.ps1`, `test-rules.mjs`, `verify-staging-config.mjs`, etc.)
   - `docs`: Present (`DEPLOY_RUNBOOK_STAGING.md`, `OWNER_ACTIONS.md`, `M8_1_REPORT.md`, etc.)
7. **Git Status:** Clean unversioned source archive (`fatal: not a git repository: .git`).

---

## 2. Environment Prerequisites Verification

| Prerequisite | Required | Installed on System | Resolved Runtime Version | Status |
|---|---|---|---|---|
| **PowerShell** | Windows PS 5.1+ | 5.1.26100.9711 | 5.1.26100.9711 (`-NoProfile -ExecutionPolicy Bypass`) | **PASS** |
| **Git** | Any modern | 2.52.0.windows.1 | 2.52.0.windows.1 | **PASS** |
| **Java (JDK)** | 21 or newer | Eclipse Temurin 21.0.12.1 LTS | OpenJDK 64-Bit Server VM Temurin-21.0.12.1+1 | **PASS** |
| **Node.js** | `>=24.0.0 <25.0.0` | Node v26.13.0 (in `C:\Program Files\nodejs`) | **Node v24.11.1** (extracted from local `node-v24.11.1-x64.msi` into `C:\AI\node24`) | **PASS** |
| **npm** | Matching Node 24 | 12.2.1 (global) / 11.6.2 (bundled) | 12.2.1 / 11.6.2 | **PASS** |
| **Emulator Network** | storage.googleapis.com | Verified live | Downloaded `cloud-firestore-emulator-v1.22.0.jar` | **PASS** |

*Note on Node.js:* The system-wide Node was version 26.13.0, which causes the readiness script's strict engine check (`v24.*`) to fail. Without modifying any system binaries or registry keys, `node-v24.11.1-x64.msi` (located in the user's Downloads folder) was administratively extracted locally to `C:\AI\node24\PFiles64\nodejs` and set on session PATH, cleanly fulfilling the repository's pinned requirement.

---

## 3. Local Gate 1 Execution (Clean Install & Emulator Validation)

Command executed:
```powershell
Set-Location "C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-readiness.ps1
```

### Gate 1 Step Results:

1. **Node.js 24 is installed:** `node v24.11.1` — **PASS**
2. **npm is available:** `12.2.1` — **PASS**
3. **Java 21 or newer is installed:** `openjdk version "21.0.12.1" 2026-08-18 LTS` — **PASS**
4. **Clean install from lockfile (`npm ci`):** Added 1,069 packages; audited 1,079 packages in 2m — **PASS**
5. **Lint (zero errors, zero warnings):** `eslint . --max-warnings 0` — **PASS**
6. **TypeScript checks (all workspaces):** `tsc --noEmit` across `@ureducator/shared`, `web`, `functions` — **PASS**
7. **Unit tests (shared + functions):**
   - `@ureducator/shared`: 6 test files, **37 passed (37)** in 684ms
     - `session.test.ts` (4 tests)
     - `clientExam.test.ts` (6 tests)
     - `rbac.test.ts` (3 tests)
     - `scoring.test.ts` (8 tests)
     - `schemas.test.ts` (9 tests)
     - `learning.test.ts` (7 tests)
   - `functions`: 5 test files, **98 passed (98)** in 1.16s
     - `payments.test.ts` (18 tests)
     - `exam.test.ts` (20 tests)
     - `admin.test.ts` (26 tests)
     - `dispatch.test.ts` (9 tests)
     - `platform.test.ts` (25 tests)
   - Total Unit Tests: **135 passed (135)** — **PASS**
8. **Static rules lint:** `rules lint ok` — **PASS**
9. **Firestore rules tests on LOCAL emulator:**
   - Downloaded `cloud-firestore-emulator-v1.22.0.jar`
   - Emulators bound to `127.0.0.1` on demo project `demo-ureducator`
   - Vitest suite: `tests/rules/firestore.rules.test.ts`
   - Test Files: 1 passed (1)
   - Tests: **57 passed (57)** in 23.07s — **PASS**
10. **Build staging web app & Functions bundle:** Success (Next.js static export + `dist/functions`).
11. **Bundle scan (web):** Scanned 249 text files, 0 finding(s) — **PASS**
12. **Bundle scan (Functions):** Scanned 4 text files, 0 finding(s) — **PASS**
13. **Staging configuration scan:** 34/34 checks passed — **PASS**
14. **Independent text search:** Searched `apps/web/out`, `functions/lib`, `dist/functions` for `ugc-mock-test(?!-staging)`, `ur-educator`, `rzp_live_`: **0 matches** — **PASS**
15. **Expected Gap Detected:**
    `GAP The web build has no Firebase API key (verification build only; pass -WebApiKey for a deployable build)`
    `RESULT: NOT READY TO DEPLOY` (Exit code 2 as expected before preflight).

---

## 4. Firebase CLI & Cloud Preflight (Read-Only)

All commands executed with strict project binding `--project ugc-mock-test-staging`.

### 4.1 CLI & Authentication Verification
- `npx.cmd --no-install firebase --version`: **`15.34.2`**
- `npx.cmd --no-install firebase login:list`: **`Logged in as ureducatorsubhash@gmail.com`**

### 4.2 Apps List
```text
┌────────────────────────┬───────────────────────────────────────────┬──────────┐
│ App Display Name       │ App ID                                    │ Platform │
├────────────────────────┼───────────────────────────────────────────┼──────────┤
│ UrEducator Staging Web │ 1:336521990930:web:8ebaa57a7ae7bcf9f019cb │ WEB      │
└────────────────────────┴───────────────────────────────────────────┴──────────┘
```

### 4.3 Staging Web SDK Configuration
```json
{
  "projectId": "ugc-mock-test-staging",
  "appId": "1:336521990930:web:8ebaa57a7ae7bcf9f019cb",
  "storageBucket": "ugc-mock-test-staging.firebasestorage.app",
  "authDomain": "ugc-mock-test-staging.firebaseapp.com",
  "messagingSenderId": "336521990930",
  "projectNumber": "336521990930",
  "version": "2"
}
```
*Note on API Key:* The public Web API key was verified and extracted directly in-memory for process passing. In strict accordance with security guidelines, it is not printed in logs, chat, or documentation.

---

## 5. Cloud Billing & Resource Verification

Inspected via Cloud Billing Management API:
- **Project ID:** `ugc-mock-test-staging`
- **Billing Account:** `billingAccounts/01768F-FE1D80-622354`
- **Billing Status (`billingEnabled`):** `true` (**Blaze Plan Active**)
- **Safety Threshold Observation:** Expenditure remains under the ₹1,000 alert-only budget threshold.
- **Production Isolation:** No commands targeted `ugc-mock-test` or `ur-educator`.

---

## 6. Local Gate 2 Execution (Deployable Build with Staging Web API Key)

Command executed:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-readiness.ps1 -SkipInstall -WebApiKey "<STAGING_PUBLIC_API_KEY>"
```

### Gate 2 Result:

```text
-------------------------------------------------------------
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
**Exit Code:** `0` (Clean pass, 0 gaps remaining).

---

## 7. Firebase Authentication Configuration Status

Inspected via Identity Toolkit API (`projects/336521990930/config`):
- **Authorized Domains:**
  - `localhost`
  - `ugc-mock-test-staging.firebaseapp.com`
  - `ugc-mock-test-staging.web.app`
- **Anonymous Sign-in:** `DISABLED` (as required).
- **Email/Password Sign-in:** **NOT YET ENABLED** (missing in Identity Toolkit provider config).
- **Owner Account Bootstrap:** `OWNER_BOOTSTRAP_EMAIL` is empty (as required; no accounts created).

### Action Required by Project Owner:
Before students can register or log in on staging:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select project **`ugc-mock-test-staging`** (ensure project number matches `336521990930`).
3. Navigate to **Build → Authentication → Sign-in method**.
4. Click on **Email/Password**.
5. Toggle **Enable** to ON.
6. Leave "Email link (passwordless sign-in)" **Disabled**.
7. Ensure **Anonymous** sign-in remains **Disabled**.
8. Click **Save**.

---

## 8. Deployment Hold & Next Steps

Per the strict instructions:
- **No deployment command has been executed.**
- `firebase deploy` has **NOT** been run.
- Firestore rules, Storage rules, Cloud Functions, and Hosting artifacts have **NOT** been published to the cloud.
- To execute deployment, the explicit authorization command is required:
  ```text
  GO DEPLOY STAGING
  ```
Once authorized, deployment will follow the strict runbook sequence:
1. `npx.cmd --no-install firebase deploy --only firestore:rules,firestore:indexes --project ugc-mock-test-staging`
2. `npx.cmd --no-install firebase deploy --only storage --project ugc-mock-test-staging`
3. `npx.cmd --no-install firebase deploy --only functions --project ugc-mock-test-staging`
4. `npx.cmd --no-install firebase deploy --only hosting --project ugc-mock-test-staging`
5. Automated smoke test: `.\scripts\smoke-staging.ps1`
