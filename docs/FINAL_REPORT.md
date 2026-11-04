# UrEducator 2.0 — Greenfield Cloud Build and Staging Deployment Report

Date: 4 November 2026 · Target project: `ugc-mock-test-staging` only · Repository: `ureducator-platform-v2` (local git history, no remote)

## Bottom line

A complete, tested **foundation-plus** application exists in source form and passes every local gate. **It is not deployed.** No staging URL is live, because this environment has no authenticated route to Google Cloud and the linked PC was offline on both attempts. This is **not a launched commercial platform**: content is synthetic/sample, payments are off, live AI is off, and nothing is verified against official NTA documents.

### Status at a glance

| Category | Items |
|---|---|
| **Completed and verified (locally)** | Shared domain package; 34-endpoint backend pipeline with in-memory store; server-side exam engine and scoring; RBAC and content workflow; student and admin web apps; PDF reports; learning tools; mock AI mentor; payment *architecture* (disabled); lint, typecheck, 134 unit tests, 18 browser E2E tests, accessibility scan, mobile layout check; bundle-safety scanner with a negative control |
| **Implemented but not deployed** | Everything above, plus firestore.rules, storage.rules, indexes, Hosting headers, `firebase.json`, deploy preparation script, guarded seed CLI, staging runbook |
| **Deployed but awaiting external configuration** | Nothing is deployed. (Cloud foundation from the owner is in place: project, Firestore, bucket, Hosting site, web app, Auth with no providers) |
| **Not started** | Question bulk-import, resources/coupon admin pages, CSP hardening with hashes, marketing/consent record views, load testing, external security review |
| **Blocked** | Deployment (no authenticated route to Google); sign-in provider, owner identity, App Check key, private GitHub repo (owner actions, see §17) |

---

## 1. Architecture

Static Next.js 16 export on Firebase Hosting → Firebase Auth → Cloud Functions Gen2 callables (Node 24, `asia-south1`) → Firestore (Admin SDK). Browsers read only the public catalogue and their own documents (rules-enforced); every write is a Cloud Function. One endpoint table drives both the real functions and the local test harness. Details: `docs/ARCHITECTURE.md`, `docs/adr/README.md` (ADR-001 to ADR-009).

Decision to note: **Firebase App Hosting was not used** because it needs a GitHub authorisation that does not exist here. The static export on ordinary Firebase Hosting is the staging-only alternative (ADR-001). Functions run in `asia-south1` next to Firestore (ADR-002).

## 2. Repository and workspace

npm-workspaces monorepo: `packages/shared`, `functions`, `apps/web`, plus `tests/`, `scripts/`, `docs/`. Pinned versions and a lockfile (Next 16.4.5, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.4, Zod 4.6.7, firebase 13.2.0, firebase-admin 14.5.0, firebase-functions 7.4.0, Playwright 1.64.1, ESLint 9.39.5). Strict TypeScript throughout. **Private GitHub repo not created** (no valid GitHub authorisation); history is intact locally and can be pushed once access exists.

One real defect was found and fixed during this final pass: a `.gitignore` pattern (`lib/`) silently excluded `apps/web/src/lib/` from version control. Patterns are now anchored.

## 3. Modules completed

* **Public site**: home, about, syllabus, pricing (no prices shown), contact/lead form with consent, privacy, terms, disclaimer, report verification. Staging is always `noindex`.
* **Accounts**: sign-up, email verification gate, login, password reset, onboarding, settings.
* **Catalogue**: versioned subjects/units/topics with the four honest labels. Nothing is "Fully verified"; Paper I units are "Under development"; Paper II subjects are "Sample content".
* **Question bank**: provenance, versions, Draft → Review → Approved → Published, separation of duties.
* **Mock tests and blueprints**: configurable blueprint, test builder with a question picker per section, publish/unpublish.
* **CBT simulator**: see §9.
* **Analytics**: score, accuracy, time, section/unit/topic/difficulty breakdowns, history, insights, with the metric definitions shown on the page.
* **Learning tools**: study planner, error notebook with spaced repetition and revision calendar, AI mentor (mock).
* **Reports**: PDF with QR verification, watermark and the exact line "Practice Examination Performance Report — Not an Official NTA Scorecard."
* **Admin studio**: overview, catalogue, questions (editor and review), tests, blueprints, people/roles, leads, support, pricing (unpublished), audit log.
* **Marketing**: lead capture with consent record and rate limit. No real messages are sent.

## 4. Cloud resources created by this build

**None.** No API was enabled, no function deployed, no rule published, no index created, no document written, no service account created in any project. The resources that exist were created by the owner earlier: `ugc-mock-test-staging` (number 336521990930), Blaze plan with a ₹1,000 alert-only budget, Firestore Native `asia-south1` (deny-all), bucket `ugc-mock-test-staging.firebasestorage.app` (uniform access, public-access prevention, deny-all rules), Auth enabled with no providers, a Hosting site with no deploy, web app `1:336521990930:web:8ebaa57a7ae7bcf9f019cb`, no Functions.

## 5. Firestore data model

Collections, access and notes are tabulated in `docs/FIRESTORE_MODEL.md`. Key separation: sanitised `publishedPapers` (no answers) vs server-only `answerKeys`; student-owned `examSessions`, `results`, `performanceSnapshots`; server-only `questions`, `examResponses`, `errorNotebook`, `reports`, `leads`, `consentRecords`, `auditLogs`, `systemSettings`, `rateLimits`. Five composite indexes; a TTL policy on `rateLimits.expireAt`. All queries were read through for index needs (by reading, not by running).

## 6. Security rules

`firestore.rules`: deny by default, public read only for catalogue/blueprints/published tests/published plans, owner-only reads for a student's own sessions, results, orders, tickets, profile, plan and snapshot, **no client writes anywhere**. `storage.rules`: deny all. **Status: implemented, syntax-linted, NOT emulator-tested** (a rules test file exists in `tests/rules`; the Firestore emulator cannot run in this sandbox, so it is skipped here). Treat rules behaviour as unverified until run on a machine with the emulator.

## 7. Authentication and admin roles

Firebase Auth with a custom `role` claim. Seven roles: owner, super_admin, admin, content_editor, subject_reviewer, support_agent, analyst; permission matrix in `packages/shared/src/rbac.ts`. Roles take effect at the next token refresh. `roles.assign` is owner-only; nobody assigns a role at or above their own. Owner bootstrap works once and only for the verified email in `OWNER_BOOTSTRAP_EMAIL`, which is **empty** — **no owner or administrator account exists**, as instructed. Email-prefix checks are not used anywhere. Anonymous sign-in stays disabled; no sign-in provider has been enabled yet.

## 8. Functions inventory (34 callables, none deployed)

| Group | Callables |
|---|---|
| Public (3) | publicConfig, captureLead, verifyReport |
| Student (14) | ensureProfile, updateProfile, startExam, getExamSession, saveResponses, submitExam, getExamResult, generatePlan, listNotebook, reviewNotebook, notebookQuestion, createTicket, askMentor, generateReport |
| Roles (2) | claimOwner, assignRole |
| Admin (13) | adminList, adminOverview, adminGetQuestion, adminUpsertBlueprint, adminUpsertCatalogue, adminSaveQuestion, adminTransitionQuestion, adminUpsertMockTest, adminPublishMockTest, adminUnpublishMockTest, adminUpsertPlan, adminUpdateTicket, adminUpdateLead |
| Payments (2, reject while disabled) | createOrder, verifyPayment |

Plus `razorpayWebhook` (HTTP), which is exported **only** when `PAYMENTS_ENABLED=true`. Every callable: Zod validation, auth level, rate limit where meaningful, correlation id, structured logs, safe errors (no stack traces to students), `minInstances: 0`, `maxInstances: 5`.

## 9. CBT simulator

Server-issued sessions with deterministic ids and **server-clock deadlines**; sequence-numbered idempotent autosave; idempotent submit; late-save refusal; auto-submit on timeout; offline keep-and-resync; reload/resume. Default blueprint: Paper I 50 Q + Paper II 100 Q = 150 Q, 300 marks, 180 min, 2 marks per correct, no negative marking (all configurable; `officialPatternVerified` stays false until a human confirms it). Question palette with not-visited / not-answered / answered / marked / answered-and-marked, shape + glyph + colour so it does not rely on colour. English/Hindi toggle. Reveal policy `immediate` or `after_close`. **Verified locally**: no answer key appears in any API response during an exam; cross-student access is refused; the 150-question layout loads.

## 10. AI status

Adapter + UI built. `MockAiProvider` is the default and is what tests use. `VertexGeminiProvider` is implemented but **never called against a real service** and is unreachable unless `AI_LIVE_ENABLED=true`. Vertex AI has not been enabled. The mentor answers only from verified local learning notes and says "test assistant" in the UI.

## 11. Payment status

**Architecture only.** `PAYMENTS_ENABLED=false`, `PAYMENT_MODE=test`; the environment guard refuses live mode outside production. Server-side plan catalogue, HMAC signature verification with constant-time comparison, webhook idempotency — covered by unit tests. No orders, payments, keys or secrets exist; no payment secret was requested or printed; no Secret Manager entry is bound. Prices are unpublished and configurable; there are no hard-coded historical prices and no GST invoices. Checkout UI is off.

## 12. Build and test results (all local)

| Check | Result |
|---|---|
| ESLint (`--max-warnings 0`) | 0 errors, 0 warnings |
| TypeScript, all workspaces | clean |
| Shared unit tests | 37 passed |
| Functions unit tests | 97 passed |
| Production build | success, all routes static |
| Bundle scan: web (249 files) / functions | 0 findings / 0 findings |
| Scanner negative control (mock export) | reports findings, as it must |
| Browser E2E (headless Chromium) | **18 passed** |
| axe WCAG 2 A/AA | no violations on 5 key pages |
| Mobile 390 px | no horizontal overflow on 9 pages |

The bundle scan confirms the **production project ID, `ur-educator`, `rzp_live_` key patterns, private keys, service-account JSON, source maps, answer-key names and mock-backend code are absent** from the deployable web and functions output. The scanner caught one real problem along the way: test-only mock code was reaching the production bundle (inactive, but present). It is now removed at build time.

Full table and the list of what is *not* verified: `docs/TEST_REPORT.md`.

## 13. Staging URL

**None live.** The expected address once deployed is `https://ugc-mock-test-staging.web.app`. It currently serves nothing from this build.

## 14. Browser verification screenshots

Captured from the local build in headless Chromium (not from a cloud URL), in `tests/e2e/shots/`: `15-landing`, `16-syllabus`, `01-verify-email`, `02-dashboard-empty`, `03-test-list`, `04-instructions`, `05-exam-q1`, `06-exam-q9`, `07-submit-dialog`, `08-result`, `09-result-review-hindi`, `10-notebook`, `11-notebook-revise`, `12-planner`, `13-mentor`, `14-exam-full-150`, `20-staff-only`, `21-admin-overview`, `22-admin-people`, `23-admin-blueprints`, `24-question-editor`, `25-test-editor`, `30-mobile-mentor`, `31-mobile-exam`, `32-mobile-palette`.

## 15. Cost observations

Nothing has run in the cloud, so **this build has incurred no cost and no usage data exists**; I could not read the billing console. Design choices that keep cost low: static hosting, `minInstances: 0`, `maxInstances: 5`, no paid AI calls, no Secret Manager, autosave not double-charged by a rate-limit write, Mumbai co-location. Unknowns to measure after deploy: Firestore reads per exam, cold-start latency, per-student cost. Stop condition from the brief (≈₹800) is unchanged.

## 16. Limitations

* Cloud behaviour is unverified: Auth, Firestore rules/indexes, Functions IAM and cold starts, App Check, real email delivery.
* Rules tests have not run. Composite-index needs were checked by reading only.
* CSP allows inline scripts; report signing key is in a server-only Firestore doc (ADR-006).
* Content: 10 original demo questions plus 150 synthetic items. No official NTA verification of syllabus or pattern.
* `npm audit` shows advisories in transitive dependencies (see `docs/SECURITY.md` §Known gaps); not force-upgraded.
* No load test, penetration test or external review.

## 17. Remaining milestones and exact owner actions

M8 (deployment) is the only unfinished milestone in the brief; M0–M7 are done to the extent described above. To finish M8:

1. **Connectivity**: bring the linked PC online with the Claude desktop app open, **or** run `docs/DEPLOY_RUNBOOK_STAGING.md` yourself (every command pinned to `ugc-mock-test-staging`).
2. **Enable Email/Password** sign-in in staging (leave Anonymous off).
3. **Name the owner email** for `OWNER_BOOTSTRAP_EMAIL` (or leave empty to keep ownership claiming disabled).
4. **App Check**: create a reCAPTCHA Enterprise site key for the staging origin (public key only).
5. **GitHub**: authorise a connection or create the private repo, so the code can be pushed and App Hosting becomes possible.

After those: fetch the web SDK config, build the staging variant, run both bundle scans, deploy rules/indexes/functions/hosting, optionally run `scripts/seed-staging.mjs`, then run the smoke list in the runbook against the live URL.

## 18. Production isolation declaration

* No deployment, rule change, data change, Hosting/DNS change, IAM change, Function or Cloud Run change was made to `ugc-mock-test` (production). None was attempted.
* `ur-educator` was not read, modified, deleted or reused. The old repository was not requested, migrated or modified.
* No additional Firebase project, database or bucket was created. The global active Firebase project setting was not changed.
* No Razorpay credential of any kind was requested, retrieved or printed. No live payment path exists.
* No unqualified deployment command exists anywhere in the repo or docs; `.firebaserc` has no default project; the seed CLI refuses every project except `ugc-mock-test-staging`.
* A repository search found the production project ID and `ur-educator` only inside negative unit tests that prove the code refuses them. The built web and functions bundles contain neither.
* The existing production maintenance arrangement was not touched.
