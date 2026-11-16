# UrEducator 2.0 — Dual-Agent Handoff & Architecture Review Packet
**Handoff Date:** 6 November 2026  
**From:** Google Antigravity (Implementation & Execution Auditor)  
**To:** Claude (Senior Architecture & Security Reviewer)  
**Target Baseline:** Commit `d34b223` on branch `main`  
**Target Environment:** `ugc-mock-test-staging` (`336521990930`, `asia-south1`)  
**Production Status:** Strictly Prohibited / Untouched (`ugc-mock-test`)

---

## 1. Executive Context & Purpose of this Packet

UrEducator 2.0 has successfully concluded Phase M8.8.5. The end-to-end Computer-Based Testing (CBT) engine—including authentication, resumable owner claim, session lifecycle, sequence-numbered response autosaving, rate-limiting query alignment, tamper-proof server-side scoring, and private answer-key anti-leakage—has been deployed to staging and accepted live by the owner across tests V3 through V5b.

In milestone M9.0-A, the 8 M9 architecture specifications and the 4 curriculum research deliverables (`M9_OFFICIAL_CURRICULUM_DATA.json`, `schema`, `validator`, and `validation.md`) were integrated locally and verified offline (exit code 0, 0 total errors).

As we approach launch planning, this packet presents Antigravity's **Master Project Status & Launch Readiness Audit** for Claude's independent architectural and security review.

---

## 2. Baseline Architecture & Reference Documents

| Document | Primary Role | Key Section / Topic |
|---|---|---|
| [`docs/AI_HANDOFF.md`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/docs/AI_HANDOFF.md) | Dual-Agent Ledger | Section 11 (M8.8.4 Deployment) & Section 12 (M8.8.5 State Classification) |
| [`reports/status/AG_PROJECT_STATUS_2026-11-06.md`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/reports/status/AG_PROJECT_STATUS_2026-11-06.md) | Master Audit | Comprehensive 18-area status inventory and evidence separation |
| [`docs/M9_ACADEMIC_CONTENT_ARCHITECTURE.md`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/docs/M9_ACADEMIC_CONTENT_ARCHITECTURE.md) | Content Architecture | Editorial vs official layers; provenance; invariants I-1 to I-12 |
| [`docs/M9_IMPLEMENTATION_ROADMAP.md`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/docs/M9_IMPLEMENTATION_ROADMAP.md) | Phased Roadmap | M9.0 (sources) through M9.6 (learning analytics); cross-cutting packages X-1 to X-6 |
| [`docs/M9_OFFICIAL_CURRICULUM_VALIDATION.md`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/docs/M9_OFFICIAL_CURRICULUM_VALIDATION.md) | Research Report | 12 declared research gaps (GAP-01 to GAP-12); owner decisions O-A1 to O-A5 |
| [`docs/M9_OFFICIAL_CURRICULUM_DATA.json`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/docs/M9_OFFICIAL_CURRICULUM_DATA.json) | Skeleton Dataset | 88 subjects at V1; `releaseStatus: SKELETON_UNVERIFIED`; `importAsOfficialContent: false` |

---

## 3. Key Implementation & Test Evidence

- **Unit & Integration Test Suites:**
  - `packages/shared`: **37/37 tests passed** (RBAC, session, clientExam, scoring, schemas).
  - `functions`: **121/121 tests passed** (Admin, exam, ratelimit-edges, platform, payments, runtime).
  - `scripts/test-curriculum-checker.mjs`: **25/25 assertions passed** (structural validity, dual signatures).
  - Total local unit test count: **183 passed, 0 failed**.
- **Static Analysis & Type Integrity:**
  - TypeScript: 0 errors across `shared`, `web`, `functions`.
  - ESLint: 0 errors, 0 warnings repository-wide.
- **Local Emulator Suite:**
  - `tests/rules/firestore.rules.test.ts`: **57/57 security rules tests passed** on local Firestore emulator.
- **Staging Cloud Deployment:**
  - Project: `ugc-mock-test-staging` (`336521990930`, `asia-south1`).
  - 34 Cloud Functions Gen 2 updated cleanly with zero deletions.
  - Staging smoke test (`scripts/smoke-staging.ps1`): **36/36 checks passed**.
- **Owner Real-Browser Acceptance:**
  - V3 (Start): Full-length synthetic exam (`mt-full`, 150 questions) starts without HTTP 500.
  - V4 (Resume): Reopening exam resumes active session without duplicate session creation.
  - V5a (Autosave): Sequence-numbered answer autosave verified.
  - V5b (Scoring): Exam submission triggers server-side scoring and loads results page.
  - V7 (Owner Claim): Staging owner (`subhashbanti99@gmail.com`, `77an2K2D2MecjzA4dmvsgnzqu9P2`) intact with custom claim `role: 'owner'`.

---

## 4. Launch-Blocking Issues & Known Risks

### 4.1 Academic Content Readiness (Critical Path Blocker)
- **100% Synthetic Content:** The platform contains zero authentic questions and zero verified syllabus statements. Current mock tests use synthetic test fixtures (`fx-001` to `fx-150`).
- **M9.0 Human Capture Incomplete:** Official source PDFs (UGC NET December 2026 Information Bulletin `S3`, syllabus catalogue `S4`, and corrigendum `S6`) have not been captured with SHA-256 hashes into `content-sources/MANIFEST.json` (GAP-06).
- **Paper 1 Syllabus Unread:** `curriculum/paper1.syllabus.json` is currently an unpopulated starter template. Units I–X have not been transcribed by two independent human reviewers (GAP-01).
- **Hindi Font Corruption (GAP-07):** Official Hindi syllabus PDFs use legacy fonts that extract as corrupted Devanagari, necessitating visual verification and manual typing.
- **Copyright Policy Open (Owner Decision O-1):** Legal stance on using official past-year question (PYQ) text remains unformulated.

### 4.2 Security & Operational Risks
- **App Check in Monitor Mode (P-6):** `ENFORCE_APP_CHECK=false` on staging. Opening the platform to public traffic without switching to `true` exposes callable endpoints to automated scraping and denial-of-wallet attacks.
- **Razorpay Unconfigured for Production (P-4):** Payments are disabled (`PAYMENTS_ENABLED=false`). Live API keys and webhook signing secrets must be provisioned and tested prior to monetization.
- **Automated Backups Missing:** Cloud Firestore point-in-time recovery and scheduled daily exports to Cloud Storage are not configured.
- **Local Live-Run ADC Safeguards (P-2):** CLI scripts currently lack environment guards preventing accidental execution against live cloud resources when Application Default Credentials exist.

---

## 5. Claims Submitted for Claude's Independent Validation

Antigravity requests that Claude independently evaluate and validate the following factual and architectural claims:

1. **Query-Shape Index Parity:** Does the implemented rate-limiting query in `functions/src/services/exam.ts` (`d.store.list` on `examSessions` with `uid == actor.uid`, `orderBy: 'startedAtMs', desc: true, limit: 6`) permanently satisfy Firestore composite index requirements without risking index mismatch regressions in production?
2. **Launch Tier Feasibility:** Is Antigravity's assessment that a **Private Student Pilot (Phase A)** can safely launch before Razorpay activation, App Check enforcement, or Paper 2 ingestion—provided that Paper 1 academic content is human-verified (M9.0/M9.4) and a prominent pilot disclaimer is displayed—sound and risk-contained?
3. **De-Scoping Safety:** Does de-scoping the Live Gemini AI Mentor (retaining the mock provider), native mobile applications, and external SMS/email notification systems for the initial public release preserve complete CBT exam integrity and student safety?

---

## 6. Specific Questions for Claude's Review

1. **Pilot Content Threshold:** For the proposed Private Pilot (Phase A), is a single 50-question Paper 1 test with dual-verified bilingual statements and peer-reviewed explanations sufficient to evaluate platform behavior under real student use, or does Claude recommend a different minimum viable academic content volume?
2. **App Check Migration Sequence:** What is Claude's recommended operational protocol for transitioning App Check from monitor mode (`ENFORCE_APP_CHECK=false`) to strict enforcement (`true`) without locking out legitimate students on diverse mobile and desktop browsers?
3. **Automated Index Enforcement (P-1 / X-1):** How should the automated query-shape contract test be architected in CI to ensure that future schema or service changes cannot introduce queries lacking composite indexes in `firestore.indexes.json`?
4. **Transition to M9.0 Step 2:** Does Claude concur with Antigravity proceeding to assist the owner with the local source capture and curriculum verification workflow (M9.0) upon explicit owner authorization?

---

**Packet End. Awaiting Claude's independent review and recommendations.**
