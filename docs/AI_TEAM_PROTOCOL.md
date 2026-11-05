# UrEducator 2.0 — Dual-Agent Engineering Protocol

**Status:** ACTIVE & PERMANENT  
**Effective Date:** 5 November 2026  
**Governing Authority:** Project Owner  
**Coordinating Agent:** ChatGPT  

---

## 1. Purpose & Agent Roles

UrEducator 2.0 operates under a dual-agent engineering model designed to combine autonomous implementation velocity with senior architectural and security oversight while minimising token expenditure:

```
                  +---------------------------+
                  |          Owner            |
                  +-------------+-------------+
                                |
                  +-------------v-------------+
                  |         ChatGPT           |
                  | (Priorities, Coordination)|
                  +------+-------------+------+
                         |             |
           Implementation|             |Security & Architecture
                         |             |Review
                         v             v
       +--------------------+       +--------------------+
       |  Google Antigravity|       |       Claude       |
       |  (Primary Executor)|<----->| (Senior Architect/ |
       +--------------------+       |  Security Reviewer)|
                                    +--------------------+
                                               ^
                                               |
                                     Git Commits / Diffs
                                    docs/AI_HANDOFF.md
```

### 1.1 Google Antigravity (Primary Executor)
Antigravity operates directly inside the Windows workspace and local CLI environment, serving as the hands-on engineering engine.
**Core Responsibilities:**
- Frontend, UI/UX, and component implementation.
- Responsive design and accessibility standards (WCAG 2.1 AA).
- Routine application features and standard backend implementation.
- Database operations and ordinary CRUD services.
- Unit, emulator, and Playwright browser E2E test suites.
- Linting, typechecking, packaging, and bundle verification.
- Bug fixing, refactoring, and dependency maintenance.
- Technical documentation, runbooks, and test reporting.
- Authorised Google Cloud and Firebase staging operations (`ugc-mock-test-staging`).
- Monitoring, smoke testing, and routine operational maintenance.

*Rule:* Antigravity does not delegate routine implementation or operational tasks to Claude.

### 1.2 Claude (Senior Architect & Independent Security Reviewer)
Claude acts as the senior architectural consultant and principal security reviewer.
**Core Responsibilities:**
- Security architecture and threat modelling.
- Authentication mechanisms and Role-Based Access Control (RBAC).
- Firestore and Firebase Storage security rules.
- Examination answer confidentiality, timing integrity, and scoring guarantees.
- Payment gateway verification, webhook cryptographic validation, and idempotency.
- Subscription lifecycle and entitlement logic.
- Data privacy, student PII protection, and tamper resistance.
- Complex Cloud Functions design and Gen 2 runtime performance.
- Final production-readiness verdicts.

*Rule:* Claude reviews focused review packets and does not execute routine development or unqualified repository-wide passes.

### 1.3 ChatGPT (Coordinator & Product Manager)
- Sets task priorities based on owner directives.
- Reviews milestone reports and manages handoffs between agents.
- Arbitrates any technical disagreements or trade-offs between Antigravity and Claude.

---

## 2. Core Collaboration Rules

1. **One Writer at a Time:** Exactly one agent holds write access to any task or file set at any moment. Simultaneous concurrent editing of code or configuration files is strictly forbidden.
2. **Git Commits & Diffs as Ground Truth:** All transitions, code handoffs, and review requests must reference a specific Git commit hash and targeted `git diff`.
3. **Mandatory Security Review:** Any modification touching security-sensitive surfaces (Section 4) requires a formal Claude review packet before deployment or sign-off.
4. **Verified Execution Beats Static Review:** A review verdict from Claude does not substitute for real, executed test suites (unit tests, emulator behavioural tests, browser E2E, smoke tests).
5. **No Hallucinated Credentials or Environments:** Neither agent may assume permissions, credentials, or environments not explicitly established and verified.

---

## 3. Communication & Handoff Lifecycle

Every task follows a strict 7-step lifecycle:

```
[1. Implement]       Antigravity implements feature, fixes, or configuration.
       |
[2. Gate & Commit]   Antigravity runs local gates, commits to Git, updates docs/AI_HANDOFF.md.
       |
[3. Package]         Antigravity creates focused Review Packet in docs/AI_HANDOFF.md (if security-relevant).
       |
[4. Review]          Claude inspects the Review Packet and emits Verdict (PASS / PASS WITH CONDITIONS / BLOCK).
       |
[5. Remediate]       Antigravity addresses conditions or blockers raised by Claude.
       |
[6. Retest]          Antigravity reruns affected test suites and records outcomes.
       |
[7. Release/Handover]Deployment to staging proceeds (if authorised); report provided to ChatGPT & Owner.
```

### Review Verdict Definitions:
- **`PASS`**: Code meets architectural and security criteria; execution proceeds immediately.
- **`PASS WITH CONDITIONS`**: Non-blocking improvements or minor clarifications identified; Antigravity resolves them and records resolution before final release.
- **`BLOCK`**: Security, data privacy, or architectural flaw identified. Antigravity must address root cause, commit changes, and submit a revised packet.

---

## 4. Mandatory Claude Review Triggers

A formal Claude review packet is required whenever changes involve:

1. **Security Architecture & IAM:** Authentication flows, custom token claims, Admin SDK usage, role assignments, or owner bootstrapping.
2. **Database Security Rules:** Modifications to `firestore.rules` or `storage.rules`.
3. **Exam Confidentiality & Scoring:** Answer key storage, session state machine, countdown timers, autosave serialization, score calculation, and result release policies (`immediate` vs `window_close`).
4. **Payments & Subitlements:** Razorpay order creation, signature verification, webhook processing, subscription tier enforcement, and billing state.
5. **Cloud Functions Runtime:** Gen 2 configuration, CORS origins, rate limiting, App Check enforcement, or secret definitions.
6. **Data Privacy & Retention:** Consent capture, audit logging, student snapshot computation, and PII storage.
7. **Production Gate Decisions:** Promotion from staging to production or changes to cloud infrastructure scope.

---

## 5. Review Packet Specification

When submitting a task to Claude in `docs/AI_HANDOFF.md`, the review packet must be concise, structured, and token-efficient:

```markdown
### Review Packet: [Task Name] (Commit: <commit-hash>)
- **Task Summary:** 1–3 sentence objective.
- **Architecture Context:** High-level component relationship.
- **Relevant Files / Diffs:** Exact file links and bounded unified diffs (never entire tree).
- **Test Evidence:** Specific executed commands and passed assertions.
- **Security Assumptions:** What trust boundaries are relied upon.
- **Questions for Claude:** 2–5 specific questions requiring architectural/security validation.
```

---

## 6. Token & Operational Efficiency Rules

To keep token consumption low and avoid context pollution:
- **Antigravity absorbs repetitive and high-volume operations:** Test executions, full bundle builds, CLI outputs, formatting, and file generation.
- **Targeted Diffs over Full-Source Uploads:** Review packets provide only affected files, functions, or unified diffs.
- **Incremental Testing:** Run only unit/subsystem tests during active development; run full suites (emulator rules, browser E2E, bundle verification) at milestone integration gates.
- **Live State Persistence:** `docs/AI_HANDOFF.md` maintains a single active state board; completed milestone sections are compacted.

---

## 7. Cloud Security & Environment Boundaries

| Environment | Project ID | Project Number | Status | Allowed Actions |
| :--- | :--- | :--- | :--- | :--- |
| **Staging** | `ugc-mock-test-staging` | `336521990930` | **PERMITTED** | Deployments, synthetic seeding, automated smoke tests, authorized admin testing |
| **Production** | `ugc-mock-test` | `150503443058` | **STRICTLY PROTECTED** | **OFF-LIMITS.** No deployment, data read/write, credential minting, or CLI target |
| **Legacy Trial** | `ur-educator` | `76193197410` | **OFF-LIMITS** | Deprecated project. Never target. |

### Operational Cloud Invariants:
1. **Explicit Project Scoping:** Every Firebase CLI command must explicitly include `--project ugc-mock-test-staging`. Never run unqualified `firebase deploy` or `firebase use`.
2. **Zero Live Payments on Staging:** `PAYMENTS_ENABLED=false`, `PAYMENT_MODE=test`. Razorpay live keys (`rzp_live_`) are forbidden.
3. **Mock AI by Default:** `AI_LIVE_ENABLED=false`. All student mentor queries in staging use the deterministic mock provider.
4. **App Check Monitoring:** `ENFORCE_APP_CHECK=false` (monitoring mode only, avoids blocking staging web clients before Attestation is registered).
5. **Strict Instance Ceiling:** `minInstances: 0`, `maxInstances: 5` on all Cloud Run / Gen 2 callable services.
6. **No Staging-to-Production Bleed:** No secrets, credentials, or databases may be shared across staging and production.
