# M9 — Implementation Roadmap

| | |
|---|---|
| **Milestone** | M9 — Academic Content Foundation (design only) |
| **Baseline** | Commit `694999a` (M8.8.5 accepted) |
| **Author** | Claude (architecture and security lead) |
| **Date** | 5 November 2026 |
| **Status** | PROPOSAL. Nothing below starts until the owner approves the architecture. Each milestone then needs its own go-ahead, and every cloud step inside it needs explicit authorisation. |

Evidence tags: **[C]** read in code; **[O]** observed on an official page, unverified by a person; **[P]** proposal; **[?]** unknown.

---

## 1. Principles for the whole programme

1. **Academic truth before volume.** No bulk content until the syllabus it hangs on is verified and a small pilot has been reviewed end to end.
2. **Reuse first.** The question store, workflow, publish pipeline, analytics and exam engine stay. Changes are additive.
3. **Protect the engine.** Changes to engine files happen only as the numbered change requests (CE-1 to CE-4) and the presentation request PR-1, each with the M8.8.5 regression rerun on staging.
4. **Local first.** Emulator and in-memory tests before any staging step. Staging is `ugc-mock-test-staging` only. Production and the trial project are never touched.
5. **Explicit authorisation at every cloud boundary.** Rules, indexes, function deploys, hosting and data writes each need their own "yes". A milestone approval is not a deployment approval.
6. **One thing at a time.** Antigravity works one milestone at a time on one branch of its own. Claude reviews; Claude does not edit the same files.
7. **Report with evidence.** Each milestone ends with a report that separates verified results from assumptions, in the format of the earlier reports.
8. **The bottleneck is people, not code.** Syllabus checking, authoring and review are human work. The plan is paced by reviewer capacity, which is measured in the pilot and used to plan Paper II.

---

## 2. Overview

```
 NOW        M9.0              M9.1                  M9.2                 M9.3             M9.4             M9.5                 M9.6              Exam-UI
 approve ─► official sources ─► catalogue & data ─► question bank ───────► bulk ingestion ─► Paper I pilot ─► Paper II, subject ─► learning content ─► milestone
 docs       & syllabus check    model, Curriculum    & workflows,          (staged,         GATE: go/no-go   by subject            & analytics         (separate
 commit     (humans + hashes)   Manager, trees       review queue          draft-only)      for mass content (repeatable)         integration         assignment)
```

| Milestone | Code? | Cloud (staging) | Owner decisions first | Security items | Engine touch |
|---|---|---|---|---|---|
| Docs commit | No | No | Approve the architecture | — | None |
| **M9.0** Official sources and syllabus | Scripts and data files only | No | O-2, O-3 | — | None |
| **M9.1** Catalogue and data model | Yes | Rules, indexes, data (each authorised) | O-4 (S-1, S-3 part) | S-1, S-2, S-3 | None |
| **M9.2** Question bank and workflows | Yes | Functions, indexes, data | O-4 (S-6, S-7, S-10), O-5, O-8 | S-2, S-3, S-6, S-7, S-10 | None |
| **M9.3** Bulk ingestion | Yes | Functions, indexes, data | O-4 (S-5, S-8, S-9), O-7 | S-5, S-8, S-9 | None |
| **M9.4** Paper I pilot | PR-1 only | Content and a test, via the normal pipeline | O-1 (before any PYQ), O-6 | S-8 enforcement date | PR-1 (view file), CE-2 recommended earlier |
| **M9.5** Paper II by subject | Minor | Content, repeatable | O-6, O-1 | — | CE-1 (when first needed) |
| **M9.6** Learning content and analytics | Yes | Functions, data | O-9 (CE-4) | S-2 | CE-4 |
| Exam-UI redesign | Separate assignment | | | | PR-2 |

Detailed dependencies, complexity and the testing strategy are in sections 10 to 12. Which of the 13 Admin Content Studio screens ships in which milestone is in the final review, part 7.

---

## 3. Cross-cutting work packages (done once, early)

| ID | Package | Why | Where it lands |
|---|---|---|---|
| X-1 | **Query-shape contract test**: every Firestore query the code can issue is recorded and checked against `firestore.indexes.json`; the build fails if an index is missing. | The in-memory store and the emulator did not catch the missing index that stopped exam start in M8.8. This is item P-1 from Review #004 and must exist **before** any new index is written. | Start of M9.1 |
| X-2 | **Shared schemas first.** All new fields are optional or have defaults so every existing document still parses (synthetic fixtures included). | Existing papers, sessions and results must keep working. | M9.1 and M9.2 |
| X-3 | **Fixture isolation.** Synthetic items keep `provenance.kind = synthetic_demo`; invariant I-11 blocks them from verified taxonomy and `fully_verified` tests. They stay until the owner decides to remove them after the pilot. | The assignment forbids replacing synthetic data in this stage; separation must still be enforceable. | M9.1 |
| X-4 | **Regression pack.** The M8.8.5 staging checks (V3 start, V4 resume, V5a autosave, V5b submit and score) are written down as a repeatable script so each milestone can rerun them. | Evidence that the engine was not disturbed. | M9.1 |
| X-5 | **Rules test additions.** For every new collection, tests that students and anonymous users cannot read or write it, and that staff can only through functions. Invariants I-1 and I-12 as tests. The existing rules test already has a **drift guard** (`tests/rules/firestore.rules.test.ts`, "classifies every collection…") **[C]**: it fails when a collection used in `domain/paths.ts` or named in `firestore.rules` is missing from its classification lists. Each new collection must therefore be added there on purpose (private ones to `SERVER_ONLY`; `catalogueTrees` to a new public-get-only list), and if S-1 is approved `subjects`, `units` and `topics` move out of `PUBLIC_OPEN`. | Security is built in, not added at the end. | Every milestone |
| X-6 | **Milestone report template.** Problem, files inspected, files changed, implementation, tests run with actual results, remaining risks, authorisations needed, and a verified-versus-assumed list. | Matches the project's reporting standard. | Every milestone |

---

## 4. Milestones

### M9.0 — Official curriculum and source verification

**Goal.** Turn the unverified source register into a verified one, and freeze hashed copies of what was used. This is mostly human work.

**Scope.**
* Capture and hash the official documents (register §8 steps 1–2): the Information Bulletin as updated 16.10.2026, the 08.10.2026 version for comparison, the **corrigendum**, and the Paper I syllabus PDFs (English and Hindi).
* Two-person comparison of the exam-pattern facts in register §3 with the bulletin and corrigendum.
* Two-person transcription of the **Paper I** syllabus (10 units) into a data file with page references. Hindi typed or visually checked, never taken from the PDF text layer.
* Confirm the 87 Paper II subject names and codes against `subjects.php`, and record printed versus normalised codes (D5).
* Close or accept each discrepancy D1–D12.

**Deliverables.** `content-sources/MANIFEST` (file names, source URLs, retrieval dates, sizes, pages, SHA-256), the updated source register at V2/V3, `curriculum/paper1.syllabus.json` (verbatim, with provenance), `curriculum/subjects.provisional.json` (88 rows, status `listed`, nothing about units), a discrepancy log.

**Not in scope.** Any Firestore write; any code beyond a local hashing script; syllabus text for Paper II subjects.

**Needs from the owner.** O-2 (who downloads and who verifies), O-3 (the corrigendum).

**Acceptance.** As register §8. In addition: a reviewer other than the transcriber has checked every unit title and statement against the PDF; the manifest hashes match the files; no syllabus text exists in the repository without a source page and a verifier name.

**Risk.** The official site may not serve a stable file URL (pre-signed links, register §5). Mitigation: the evidence is the downloaded file and its hash, not a URL.

**Size.** Small in code, medium in human effort.

---

### M9.1 — Catalogue and data model

**Goal.** A versioned, verified-or-labelled curriculum in the database, a Curriculum Manager to maintain it, and a student catalogue that scales.

**Work packages.**
1. X-1 to X-5 (above), first.
2. Shared schemas and constants for curriculum, `sourceDocuments`, `syllabusVersions`, extended `subjects`, `units`, `topics`, `catalogueTrees` (data dictionary §3).
3. Curriculum functions in a **new file** (`curriculum.ts`): save, submit, verify, publish, retire; V-C-01 to V-C-10 enforced; audit events.
4. Catalogue publisher: builds `catalogueTrees/{subject}` and `_index` on publish; size check (V-C-10).
5. Admin Content Studio screens: **Curriculum Manager** (with the source register and syllabus versions side by side), **Subject Manager**, **Unit and Topic Manager**, and the curriculum side of **Content Version History**. They extend the existing `/admin/catalogue` page rather than replace it.
6. Student side: `useNames`, the public syllabus page and the dashboard read trees; **remove the `SEED_SUBJECTS` fallbacks** in `lib/names.ts` and `app/(site)/syllabus/page.tsx` (G-17) and show a loading or error state instead.
7. Import the M9.0 data into staging **only after** authorisation: Paper I (verified) and the 88-row subject list (`listed`).
8. S-1 rules (if approved) with extended rules tests; otherwise the `status`-filter fallback (ADR-3).

**Security.** S-1, S-2, S-3 (the indexes this milestone needs, generated from X-1). `roles/*` untouched (I-12).

**Tests.** Unit: schemas, tree builder, V-C rules. Integration: curriculum lifecycle in the emulator; a draft element never appears in a tree; a retired element disappears from the next tree but historical results still resolve its name. Rules: students cannot read working tables or drafts; anyone can `get` a published tree and cannot `list`. Regression: X-4 on staging.

**Acceptance.**
* Paper I appears in the Curriculum Manager as `verified`/`dual_verified` with page references; all other subjects appear as `listed` with no units.
* A student page load reads at most three catalogue documents (measured).
* No frontend file contains curriculum data (a static check).
* The 57 existing rules tests plus the new ones pass; query-shape test passes.
* Existing synthetic exams still run (X-4 passes).

**Owner decisions.** O-4 for S-1, S-2, S-3.

**Size.** Medium-large.

---

### M9.2 — Question bank and workflows

**Goal.** Questions that carry the classification and provenance a student can trust, with a review process that scales and cannot be bypassed.

**Work packages.**
1. Question schema extension (data dictionary §4): classification (difficulty, Bloom, format, knowledge domain, estimated time), content blocks (`table`, `format`), provenance blocks, `workingStatus`/`liveVersion`, `contentHash`.
2. Server-side taxonomy check on save and submit (G-2) and duplicate fingerprints (G-13).
3. Workflow functions in new files (`content.ts`): states `draft → submitted → in_review → approved → published → retired`, claim/return/approve/publish/retire, reason codes, comments, events written **inside** the transaction (ADR-10, S-10). Rename `review` to `submitted` (O-5) after a read-only staging count; until then readers treat `review` as `submitted`.
4. PYQ verification (S-7): `pyqVerification` is written only by the verify function; dual verification; reset on edit. The save endpoint stops accepting `officialPyqVerified`.
5. `staffProfiles` with subject scopes (S-6); `systemSettings/contentWorkflow`.
6. Admin Content Studio screens: **Question Bank Manager** (filters; G-5), **Question Editor** with the **Answer and Explanation Editor** and **Question Preview** (the exact student rendering), **Review Queue** (duplicate review is a panel inside it), **PYQ Verification Manager**, the question side of **Content Version History**, and the first version of the **Publishing Dashboard**. Existing `/admin/questions` and `/admin/questions/edit` are extended.
7. Indexes generated from X-1 (S-3).
8. Test assembly additions to `publishMockTest` that do not touch the engine (subject scope, contiguous `setKey`, `fully_verified` rules, and the `questionUsage` records that tell staff which published tests contain a question) — data dictionary §7 and §7.1.

**Security.** S-2, S-3, S-6, S-7, S-10. Invariants I-1 to I-12 each become an automated test.

**Tests.** The twelve invariants; permission matrix (every role × every transition); concurrency (two reviewers claim one item; two publishes); idempotent retries; the hash test (approved versions never change); an adversarial request that supplies `status`, `pyqVerification`, `reviewedBy` and expects it ignored; forced failure inside the transaction leaves no half state. Regression X-4.

**Acceptance.** All invariants pass; an editor alone cannot reach `published`; a published question edited afterwards creates version n+1 while version n stays live; the admin list filters by subject, unit, topic, difficulty, provenance and status on indexes; the migration of existing documents is read-only (old documents still parse and publish).

**Owner decisions.** O-4 (S-6, S-7, S-10), O-5, O-8 (Hindi policy).

**Size.** Large. This is the heart of the programme.

---

### M9.3 — Bulk ingestion

**Goal.** A safe way to load many questions as **drafts**, with every safeguard in the ingestion spec.

**Work packages.** Browser parsers (CSV, JSON, Excel; Excel library chosen, pinned and kept out of the student bundle); stage, validate, approve, create functions in a **new file** (`imports.ts`); Bulk Import Manager screen; templates and the taxonomy export; failed-rows download; budgets and leases; clean-up of expired batches; S-5 (TTL) if approved; S-8 (rate limits and budgets) for the import callables.

**Security.** S-5, S-8, S-9 (sanitisation). Invariants I-2, I-7.

**Tests.** Ingestion spec §12 in full. Performance: stage and create rates measured at 200, 1,000 and 2,000 rows in the emulator, then once on staging with synthetic **labelled** rows that are deleted afterwards (authorised).

**Acceptance.** Import of any size creates only drafts (I-7); retry never duplicates; two simultaneous creates cannot both run; a malicious file (formula cells, HTML, huge cell, injected status) is neutralised; the failed-rows file opens safely in a spreadsheet; measured throughput recorded in the report instead of the estimates in the spec.

**Owner decisions.** O-4 (S-5, S-8, S-9), O-7 (AI-assisted drafting policy) before any AI-assisted batch.

**Size.** Medium-large.

---

### M9.4 — Paper I pilot (the go/no-go gate)

**Goal.** Prove the whole chain with real, reviewed content for one paper, and measure the human side, before any large investment.

**Scope.**
* About **300 reviewed questions** for Paper I across all ten verified units, about 30 per unit on average (an author's starting figure to be adjusted by the owner). Enough for two 50-question practice papers plus unit and topic practice with some spare.
* Sources of content: `original`, `adapted` and `licensed` only. **No official PYQ until O-1 is decided.** If O-1 allows it, official items enter through the PYQ verification path and are labelled only when `dual_verified`.
* Hindi per policy O-8.
* Data Interpretation items use `table` blocks (PR-1).
* Two Paper I practice tests published through the normal pipeline, on staging, using a Paper-I-only blueprint (format and duration set by the owner; labelled as practice, not as the official pattern, until the pattern is verified).
* A reviewer team of at least two named people with Paper I scope.

**Measurements the pilot must produce.**
* Authoring: items per author-hour. Review: items per reviewer-hour; return rate and the top reason codes.
* Duplicate rate; share of items needing Hindi fixes; share of provenance gaps.
* Size of a real 50-question paper document against the 800 KB cap (the cap was never measured on the 150-question seed).
* Student-path checks: start, resume, autosave, submit, score, result and analytics by real unit and topic, on staging.
* Cost: Firestore reads, writes and function invocations for the pilot.

**Acceptance (go/no-go for mass ingestion).**
1. Every published pilot item has a verified taxonomy chain, an explanation (original or adapted), a named reviewer different from the author, and a recorded provenance.
2. A random audit of at least 10% of published items by a person who was not the author or reviewer finds no wrong key. A single wrong key blocks the gate until the root cause is fixed and the sample re-drawn.
3. The two practice tests run end to end on staging with M8.8.5 regression results unchanged.
4. Analytics show weak and strong topics under the real taxonomy for a test student.
5. Measured throughput is written into the report and Paper II planning uses it.
6. The owner signs the gate. **No M9.5 work starts without it.**

**Owner decisions.** O-1, O-6; PR-1 approval; the decision on whether to remove synthetic fixtures after the pilot.

**Size.** Medium in code, large in people time.

---

### M9.5 — Paper II expansion (repeatable per subject)

**Goal.** Onboard subjects one by one, in the owner's priority, using the same recipe.

**Subject onboarding recipe (each subject is a small project).**
1. Capture and hash the syllabus PDFs (M9.0 steps); two-person transcription; create `syllabusVersions` and units; verify; publish tree.
2. Define topics (editorial layer) with `officialRefs`; review.
3. Appoint a subject reviewer (scope in `staffProfiles`).
4. Author or acquire content (originals, adaptations, licensed); import in batches (M9.3); review; publish.
5. **Subject-ready check** before a subject is shown as available: every unit has at least a threshold of published items (owner sets the number; the pilot gives the evidence), a published practice test exists, and the subject's medium policy is known.
6. Publish subject practice tests and a full-length test using the official structure only if the pattern is `officialPatternVerified`.

**Cross-subject concerns.** Subjects whose papers are not in English or Hindi only; the 29 rows marked "language subject (inferred)" in the register need the owner's confirmation of medium policy before onboarding. Subjects with several fields in one code (for example code 01) need the owner's rule for how they appear to students.

**CE-1.** The first time a published key is found wrong and the official treatment is "credit all" or "drop", CE-1 (key policies) is needed. It should be approved before the first PYQ-based test, not after.

**Size.** Per subject: medium. Whole Paper II: large; paced by reviewers.

---

### M9.6 — Learning content and analytics integration

**Goal.** One taxonomy connecting syllabus, questions, notes, practice, notebook, plan and reports.

**Work packages.** `learningMaterials` with the same workflow (citations required); authoring screens (the Question Editor pattern reused; learning material is an extension, not one of the 13 screens); student pages for unit and topic notes linked from catalogue trees; the mentor retriever moves from `learningNotes` to published materials; topic and unit practice generated on the server (**CE-4**); weak-topic recommendations that link a topic to material and practice; reports keyed by the same ids; the full **Content Quality Dashboard** (coverage and gaps by unit and topic, review turnaround, return reasons).

**Security.** S-2 for the new collections; rate limits on practice generation (S-8).

**Acceptance.** A student who is weak in a topic is shown (a) the official syllabus lines, (b) published notes, (c) a practice set drawn only from published questions, and the loop updates the plan after the next test; staff can see coverage and gaps by unit and topic.

**Owner decisions.** O-9 (CE-4).

---

### Exam-UI redesign (separate milestone, not M9)

Requires: CE-2 done; the separation document accepted; PR-2 approved. Its acceptance is the behaviour table in the UI separation document plus the existing end-to-end suite on the new skin. It must use UrEducator's own identity and no official marks.

---

## 5. Owner decision timeline

| Needed before | Decisions |
|---|---|
| Docs commit | Approve the architecture (this package) |
| M9.0 | O-2 (who downloads and verifies), O-3 (corrigendum) |
| M9.1 | O-4 for S-1, S-2, S-3 |
| M9.2 | O-4 for S-6, S-7, S-10; O-5 (rename, after the read-only count); O-8 (Hindi policy) |
| M9.3 | O-4 for S-5, S-8, S-9; O-7 (AI drafting policy) if AI is to be used |
| M9.4 | O-6 (priorities and reviewers); **O-1 before any official PYQ is ingested**; PR-1 approval |
| M9.5 | CE-1 (before the first PYQ-based test); per-subject medium rules |
| M9.6 | O-9 for CE-4 |
| Any time | Production readiness decisions (App Check enforcement date, payments) remain outside M9 |

---

## 6. Mapping of change items to milestones

| Item | What | Milestone | Needs approval |
|---|---|---|---|
| S-1 | Catalogue trees and staff-only working tables | M9.1 | Yes |
| S-2 | Explicit denies for new collections | M9.1 onward | Yes |
| S-3 | Composite indexes generated by X-1 | M9.1, M9.2, M9.3 | Yes, per deployment |
| S-4 | Storage rules for images | Not scheduled; after the pilot | Yes |
| S-5 | TTL on import rows | M9.3 | Yes |
| S-6 | `staffProfiles` subject scopes | M9.2 | Yes |
| S-7 | Server-owned PYQ verification | M9.2 | Yes |
| S-8 | App Check enforcement; admin rate limits and import budgets | M9.3 (limits); enforcement date set by owner | Yes |
| S-9 | Rich-text sanitisation and CSP review | M9.3 | Yes |
| S-10 | Event inside the transition transaction | M9.2 | Yes |
| CE-1 | Key policies in scoring | Before first PYQ test (M9.5) | Yes |
| CE-2 | Frozen DTOs and contract tests | M9.1 or M9.2 | Yes |
| CE-3 | Strip classification from the pre-submission payload | Optional, M9.2 or later | Yes |
| CE-4 | Server-generated practice papers | M9.6 | Yes |
| PR-1 | Render `table` blocks and an unsupported-block fallback in `QuestionBody` | M9.4 | Yes |
| PR-2 | Controller returns codes and does not navigate | Exam-UI milestone | Yes |

---

## 7. Compatibility and migration

* **Old documents keep working.** New fields are optional or defaulted (X-2). A stored `review` status is read as `submitted` until O-5 is executed.
* **No production migration.** Production is not touched. Staging data is synthetic; the plan adds data, it does not rewrite or delete the accepted synthetic fixtures.
* **`officialPyqVerified` on old documents** is ignored by the new logic. Any old item with `official_pyq` is treated as `unverified` until verified through the new path.
* **Published papers and answer keys** are immutable and untouched (I-8).
* **Rollback.** Each milestone is a set of additive changes: functions can be redeployed to the previous build; rules and indexes have their previous files in git; data written by an import is draft-only and can be retired or deleted by an authorised admin. Rollback steps are part of each authorisation request.

---

## 8. Risks

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R-1 | **Legal position on using official PYQ text** is unclear or negative | Medium / High | O-1 before any ingestion; original and adapted content carries the pilot; provenance recorded either way |
| R-2 | **Syllabus cannot be reliably captured** (stable links, corrupted Hindi) | High / High | Human transcription; hashes as evidence; two verifiers; nothing labelled verified without them |
| R-3 | **Reviewer capacity is the bottleneck** | High / High | Measure in the pilot; subject scopes; reviewer capacity limits; paced subject rollout |
| R-4 | **Wrong keys reach students** | Medium / High | Separation of duties, explanation required, random audit gate, content-incident procedure (workflow §12), CE-1 |
| R-5 | **Hindi quality** | Medium / Medium | Typed or checked Hindi; script-share validation; Hindi policy O-8; Hindi reviewer role |
| R-6 | **Index or query mistakes** repeat M8.8 | Medium / High | X-1 before any index; staging rehearsal of every new query |
| R-7 | **Scope creep into the engine or the visual design** | Medium / High | Numbered change requests only; the UI separation document; separate milestone |
| R-8 | **Importing bad data in bulk** | Medium / Medium | Draft-only imports, preview, spot-check sample, near-duplicate flags, budgets |
| R-9 | **Cost growth** from reads and writes | Low-Medium / Medium | Catalogue trees; counters; limits on batches; measured in the pilot |
| R-10 | **Owner approval latency** blocks progress | Medium / Medium | Decisions listed with dates in section 5; M9.0 and the docs commit need only O-2 and O-3 |
| R-11 | **Two agents editing the same files** | Low / High | Antigravity implements; Claude reviews; no competing branch; Claude edits only its own documents |
| R-12 | **AI-assisted content treated as verified** | Medium / High | `authoringMethod`, named reviewer per item, share limit, never bulk-published (O-7) |

---

## 9. Definition of done for every milestone

* Code, tests and documents committed on Antigravity's branch.
* Full test run with actual numbers reported (unit, integration, rules, end to end, bundle scan).
* Query-shape test and rules tests green.
* M8.8.5 regression on staging for any milestone that deploys.
* Report with the verified-versus-assumed table and the list of authorisations used.
* Claude's review verdict (PASS, PASS WITH CONDITIONS, or FAIL) recorded.
* Owner sign-off before the next milestone starts.

---

## 10. Dependencies and critical path

| Item | Depends on | Blocks |
|---|---|---|
| Docs commit | Owner approval of the architecture | Everything |
| M9.0 | O-2, O-3; people to download and verify | M9.1 data load; M9.4 (needs verified Paper I units) |
| X-1 query-shape test | Nothing (can start in parallel with M9.0) | Every index change |
| M9.1 | M9.0 data for the staging load (code can start before); X-1; O-4 for S-1/S-3 | M9.2 (taxonomy check needs verified elements) |
| M9.2 | M9.1; O-4 (S-6, S-7, S-10); O-5; O-8 | M9.3, M9.4 |
| M9.3 | M9.2 (import creates drafts in the new store); O-4 (S-5, S-8, S-9) | M9.4 volume (the pilot can also use manual entry if M9.3 slips) |
| PR-1 | Owner approval | Data Interpretation items in the pilot |
| M9.4 | M9.2 (M9.3 optional); reviewers named (O-6); O-1 only for PYQ items | **Gate** for M9.5 |
| CE-1 | Owner approval | First PYQ-based full test |
| M9.5 | M9.4 gate; per-subject M9.0-style capture | — |
| CE-4, M9.6 | M9.4 gate; O-9 | — |
| Exam-UI redesign | CE-2, separation document accepted, PR-2 | — |

**Critical path.** M9.0 (human verification) → M9.1 → M9.2 → M9.4. M9.3 is off the critical path for the pilot, because a few hundred items can be entered through the editor; it becomes critical for Paper II. The path is dominated by people: the transcribers and reviewers of M9.0, and the authors and reviewers of M9.4.

---

## 11. Estimated implementation complexity

Sizes are relative (S, M, L, XL) and describe the engineering and the human effort separately. They are the author's judgement from reading the code, not a schedule. Calendar time depends on Antigravity's throughput and on reviewer availability, and should be re-estimated from the M9.1 report.

| Milestone | Engineering | Human / content effort | Main drivers | Largest uncertainty |
|---|---|---|---|---|
| Docs commit | S | S | Copy eight files into `docs/` | — |
| M9.0 | S (scripts, data files) | M | Capturing, hashing, transcribing and double-checking Paper I; closing D1–D12 | Whether the official files can be captured reliably; the corrigendum |
| M9.1 | M–L | S | New schemas, curriculum workflow, tree publisher, rules and index work, student catalogue change, query-shape test | Rules and index rehearsal on staging |
| M9.2 | **XL** | M | Largest change set: schema extension, workflow functions, verification, scoped review, admin screens, indexes, twelve invariants | Interaction of the new workflow with existing documents and the `review` rename |
| M9.3 | M–L | S | Parsers (including Excel), staging and chunking, approval, safeguards, import screen | Measured write throughput and limits |
| M9.4 | S–M (PR-1, assembly checks) | **XL** | Authoring and reviewing about 300 items, Hindi checking, the audit | Reviewer throughput; the legal position (O-1) |
| M9.5 | S per subject (after the first) | **XL** in total | Repeating the recipe 87 times, in priority order | Reviewer supply per subject |
| M9.6 | L | M | `learningMaterials`, materials screens, practice generation (CE-4), recommendation loop, dashboard | CE-4 scope; mentor retrieval change |
| Exam-UI redesign | M–L | S | New skin only, if the contract holds | Fidelity decisions |

---

## 12. Testing strategy

**Layers, from cheapest to most expensive.** Every layer runs on Antigravity's machine or in its CI. Claude reviews the reported results and the tests themselves; the Firestore emulator could not be downloaded in Claude's review environment, so Claude does not claim to have run the rules suite.

| Layer | What it proves | Tooling today [C] | New in M9 |
|---|---|---|---|
| Unit (shared and functions) | Schemas, rules, normaliser, fingerprints, tree builder, scoring, permission matrix | vitest in `packages/shared` and `functions` | Curriculum, content and ingestion suites |
| Service / integration | Whole flows against the in-memory store and the emulator: workflow, import, publish, concurrency, idempotency | `functions/src/__tests__/*` | Invariants I-1 to I-12; import retry and lease tests |
| Rules | Who can read or write each collection | `tests/rules` with 57 cases | Cases for every new collection (S-2); students and anonymous users denied |
| **Contract** | Shapes that must not drift | — | **Query-shape vs index (X-1)**; DTO allowlist (T-U1 to T-U3); schema back-compat (old documents still parse) |
| End to end | Real UI routes against a mock server | Playwright in `tests/e2e` | Studio flows: curriculum, question lifecycle, review queue, import, preview, table rendering |
| Staging acceptance | The deployed system | M8.8.5 checks | X-4 script after every deploy; read-only rehearsal of every new query after index deployment; measured import throughput; a real 50-question paper size |
| Security | Abuse cases | rules tests, auth tests | Adversarial imports, role abuse, tampering attempts, a hash test for immutable versions |
| Content QA (human) | The content is right | — | Dual verification; reviewer checklist; random 10% audit at the pilot gate; Hindi review |

**Rules of the strategy.**
1. **Wired-in check.** A feature counts as done only when a test goes through the real endpoint and the real UI route. Files existing is not evidence (project rule).
2. **Negative controls.** Each security invariant test is shown, once, to fail against a deliberately broken variant of the guard. A guard test that cannot fail proves nothing.
3. **No blind spots from M8.8.** The in-memory store and the emulator do not detect missing indexes. X-1 plus a staging rehearsal covers it.
4. **Test data.** Tests use synthetic, clearly labelled content. No real past-paper text appears in tests or fixtures until O-1 is decided. Test files containing Hindi are UTF-8 and checked by eye.
5. **Regression on every deploy.** The X-4 script (V3 start, V4 resume, V5a autosave, V5b submit and score) runs after each authorised deployment and its output is attached to the report.
6. **Numbers, not adjectives.** Reports state counts of tests run and passed, the throughput measured, and the document sizes measured. Estimates in the specifications are replaced by measurements as they arrive.
7. **Authorisation inside the test plan.** Any test that writes to staging (for example a 2,000-row import rehearsal) is listed in the milestone report as an authorisation request before it is run, with its clean-up step.

**Per-milestone gate tests.** The acceptance list under each milestone in section 4 is the gate. The final review (part 10) repeats them as one table.
