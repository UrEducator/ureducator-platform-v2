# M9 — Academic Content Architecture

| | |
|---|---|
| **Milestone** | M9 — Academic Content Foundation (architecture and design only) |
| **Baseline** | Repository commit `694999a` (M8.8.5 accepted, staging CBT verified) |
| **Author** | Claude (architecture and security lead) |
| **Date** | 5 November 2026 |
| **Status** | PROPOSAL awaiting owner approval. No code, Firestore write, deployment, rules, index, IAM, billing or secrets change has been made or is made by this document. |
| **Companion documents** | `M9_OFFICIAL_SOURCE_REGISTER.md`, `M9_CONTENT_DATA_DICTIONARY.md`, `M9_CONTENT_WORKFLOW_SPEC.md`, `M9_CONTENT_INGESTION_SPEC.md`, `M9_STUDENT_EXAM_UI_SEPARATION.md`, `M9_IMPLEMENTATION_ROADMAP.md`, `M9_FINAL_ARCHITECTURE_REVIEW.md` |

**Evidence tags used throughout.**
**[C]** read in the code at commit `694999a` (file and function named, no line numbers because they drift).
**[O]** observed on an official web page on 5 Nov 2026 through a page-reading tool, not yet checked by a person (see the source register).
**[P]** proposal by the author. **[?]** unknown or unverified.

---

## 1. Summary

UrEducator 2.0 has a working, verified exam engine and a small but sound content pipeline. The pipeline already has versioned questions, a four-state workflow, separation of duties, role-based permissions, an audit log, immutable published-paper snapshots and a deny-by-default security posture. M9 does **not** rebuild any of it.

What is missing is everything that makes content *academic*: a verified syllabus, a curriculum that is versioned and cannot silently change, questions that carry the classification and provenance a UGC NET student can trust, a review process fit for thousands of items, a safe way to bring content in, and study material beside the questions.

The ten decisions that shape the design:

1. **Reuse the existing question store and publish pipeline.** Extend its fields and states; do not add a second question system. [P]
2. **Keep the official syllabus separate from UrEducator's teaching topics.** Official text is stored verbatim with its source and page; editorial topics point at it. This is what makes "never fabricate a unit or topic" enforceable in data, not just in policy. [P]
3. **Version the curriculum per subject** with an effective range on every unit and topic, so a syllabus change never breaks a student's history. [P]
4. **Serve students a small published catalogue tree per subject** instead of reading the whole catalogue. Today one page load reads every subject, unit and topic document; at 87 subjects that would be roughly ten thousand reads per visit. [C] [P]
5. **Provenance and PYQ verification are decided by the server**, never self-declared by the person saving a question. Today an editor can set `officialPyqVerified: true` in the save request. [C]
6. **Imports are staged, validated, reviewed and only then become drafts.** Nothing imported can publish itself. Large files are processed in small, retry-safe chunks. [P]
7. **The exam engine is protected.** M9 touches it only through four separately approved change requests (CE-1 to CE-4) and one small view-file request (PR-1, rendering tables), each with its own regression run. [P]
8. **The exam screen is already split into a controller (`useExam`) and a view (`ExamScreen`).** M9 only freezes the contract between them so a future UGC-NET-style screen needs no backend work. [C] [P]
9. **Keep storage identifiers stable, change labels.** Difficulty stays `easy|medium|hard` in data and shows as Easy, Moderate, Difficult. Existing results already use these keys. [C]
10. **Pilot on Paper I first**, with a few hundred reviewed items, before any large ingestion. [P]

Security changes needed are listed **separately** in section 9. None is made here.

---

## 2. Existing capability assessment

Inspection scope: `docs/FIRESTORE_MODEL.md`, `packages/shared/src/*` (constants, schemas, adminSchemas, blueprint, catalogue, rbac, scoring, analytics, session, clientExam, studyPlan), `functions/src/endpoints.ts`, `services/admin.ts`, `exam.ts`, `learning.ts`, `ai.ts`, `domain/*`, `infra/audit.ts`, `devtools/demoSeed.ts`, `firestore.rules`, `storage.rules`, the admin pages under `apps/web/src/app/admin`, the exam components and `lib/backend*.ts`. **Not inspected:** live staging data (no cloud access was used), the rules test file's 57 cases (not run here, because the emulator download is unreachable from the review sandbox), and `reports.ts` and `payments.ts` beyond their names.

Verdict key: **REUSE** as is; **EXTEND** add fields or behaviour without changing what exists; **REDESIGN** the current shape cannot carry the requirement.

### 2.1 Data and content

| Area | What exists [C] | Verdict | Notes |
|---|---|---|---|
| Collections | `subjects`, `units`, `topics`, `examBlueprints` (public read); `questions/{id}` + `questions/{id}/versions/{n}`; `mockTests`; `publishedPapers`, `answerKeys` (server-only); `examSessions`, `examResponses`, `results`, `performanceSnapshots`, `errorNotebook/{uid}/entries`, `studyPlans`, `learningNotes`, `auditLogs`, `roles`, `systemSettings`, others (`docs/FIRESTORE_MODEL.md`) | REUSE | Names and paths stay. New collections are added beside them. |
| Question schema | Version doc: `content` (type, stem, optional passage, statements, match lists, image placeholder, 2–6 options), `correct[]`, optional `explanation`, `provenance`, `createdBy`, `reviewedBy`. Head doc: `subjectId`, `unitId`, `topicId`, optional `subtopicId`, `difficulty`, `languages`, `status`, `currentVersion`, `publishedVersion`, `preview` (`packages/shared/src/schemas.ts`, `services/admin.ts#saveQuestion`) | EXTEND | Add paper, subject code, syllabus version, Bloom level, format, knowledge domain, solving time, richer provenance, concept note, resources. |
| Language model | `LocalizedText = { en (required), hi (optional) }`; `LANGS = ['en','hi']` | EXTEND, with one **REDESIGN** pocket | Fine for bilingual subjects. Language papers (set in the language concerned, per bulletin §3.4 [O]) need a per-subject medium policy and a way to hold a non-English primary text. See data dictionary §3. |
| Answer key | `answerKeys/{paperId}` map of `qid → {correct[], sectionId, unitId, topicId, difficulty, explanation?}`, created together with the paper by `tx.create` (immutable) | REUSE, then EXTEND once | Add `keyPolicy` for "any of", "all correct", "dropped" (CE-1). |
| Published paper | `publishedPapers/{mockTestId_vN}` created once per publish; sessions keep the `paperId`, so later edits cannot reach a running exam. 800 KB cap (`LIMITS.maxPaperDocBytes`) | REUSE | This is the property the assignment calls "published exam snapshots". It already holds. |
| Blueprint | `BlueprintSchema` (sections, marking, duration, languages, `officialPatternVerified`) and `DEFAULT_BLUEPRINT` 50 + 100, 180 min, +2/0/0 | REUSE | Numbers match the December 2026 bulletin [O]. Only the verification flag needs a person (source register §3). |
| Catalogue | `subjects`, `units`, `topics` hold name, order, label (`fully_verified`, `under_development`, `sample`, `coming_soon`), `sourceRef`, a `version` counter. `upsertCatalogue` overwrites the whole document and increments the counter. Subtopics are an inline array on the topic (max 40) | EXTEND + **REDESIGN** the read path | No version history is kept (only a counter). Anyone with `catalogue.write` changes the live, public catalogue at once, with no review. `fully_verified` needs only a free-text `sourceRef`. |
| Seed catalogue | `SEED_SUBJECTS`: Paper I with ten units, all `under_development`; three Paper II placeholders labelled `sample` | REUSE as fixtures | The file itself says the Paper I list is **not** checked against the official syllabus. It stays unverified until M9.0. |
| Synthetic fixtures | `devtools/demoSeed.ts`: ten small hand-written items and 150 clearly synthetic items (`fx-001`–`fx-150`), two blueprints, three tests. Not imported by `index.ts`, so not in the deployed bundle | REUSE, label only | It writes papers and keys **directly**, bypassing the question workflow. That is acceptable for fixtures and must never be the path for real content. |
| Learning notes | `learningNotes/{id}` with `title`, `body`, `verified`, `topicId`, `keywords`; read only by the mentor retriever (`ai.ts#retrieveSources`); rules deny all client access; **no function writes it** (the one staging document came from the seed) | EXTEND/REDESIGN | There is no authoring path, workflow or versioning for notes. See `learningMaterials` in the data dictionary. |
| `resources` | Appears in the admin list rules and in the `resources.write` permission; no endpoint writes it | Unused | Superseded by `learningMaterials`. |

### 2.2 Workflow, roles and publishing

| Area | What exists [C] | Verdict |
|---|---|---|
| Workflow | `draft → review → approved → published`; `review → draft`, `approved → draft` (reviewer), `published → draft` (publisher). Per-version status. | EXTEND |
| Separation of duties | The approver cannot be the version's creator (`SEPARATION_OF_DUTIES`). No rule on who publishes. | EXTEND |
| Publish gate | `COPYRIGHT_UNKNOWN` blocks publication. `publishMockTest` refuses unpublished question versions, mismatched section counts, synthetic items or an unverified blueprint under a `fully_verified` label, and oversized papers | REUSE |
| Roles | `owner`, `super_admin`, `admin`, `content_editor`, `subject_reviewer`, `support_agent`, `analyst`; permissions in `rbac.ts`; role is a custom claim and a `roles/{uid}` document; owner claim is one-time and resumable | REUSE untouched |
| Audit | `audit()` appends `{actorUid, actorRole, action, target, meta, atMs}` to `auditLogs` **after** the transaction commits (`log()` in `admin.ts`) | EXTEND (see G-8) |
| Admin listing | `adminList` supports one optional `status` filter, ordering by one field, page size ≤ 50, cursor by document id | **REDESIGN** for scale (G-5) |

### 2.3 Student-facing engine and APIs

| Area | What exists [C] | Verdict |
|---|---|---|
| Endpoints | `startExam`, `getExamSession`, `saveResponses`, `submitExam`, `getExamResult` (exam); `listNotebook`, `reviewNotebook`, `notebookQuestion`, `generatePlan`, `askMentor`, `generateReport`, `verifyReport`, `ensureProfile`, `updateProfile`, tickets, leads; `adminXxx` family; payments present but disabled | REUSE untouched |
| Session | Server clock; deterministic deadline; resume by idempotent session id; monotonic autosave sequence; hourly start limit (6) aligned with the deployed index; finalise-on-expiry | REUSE untouched (accepted at M8.8.5) |
| Scoring | `scoreAttempt` computes totals and four breakdowns (section, unit, topic, difficulty) from the answer key. Server only | REUSE; CE-1 adds key policies |
| Analytics | `performanceSnapshots/{uid}` keeps per-topic aggregates; weak/strong topic rules; study-plan builder; spaced-repetition fields on notebook entries | REUSE; they are already keyed by `unitId` and `topicId` |
| Exam UI | `useExam` (state, autosave, clock, submit, local backup) and `ExamScreen`/`QuestionBody` (layout) | REUSE; contract to be frozen (separate document) |

### 2.4 Security

| Area | What exists [C] | Verdict |
|---|---|---|
| Firestore rules | Deny by default. Public read: `subjects`, `units`, `topics`, `examBlueprints`; `mockTests` only when `status == 'published'`; `plans` only when published. Owner-only reads for sessions, results, orders, tickets (queries must filter by uid). `questions/{id=**}`, `publishedPapers`, `answerKeys`, `examResponses`, `errorNotebook`, `learningNotes`, `auditLogs`, `roles`, and others: no client access. All writes denied; writes come from Cloud Functions. | REUSE; one change proposed (S-1) |
| Storage rules | Deny all | REUSE; unchanged for the pilot (S-4 deferred) |
| Answer-key protection | Keys live in a server-only collection and are returned only after submission and the reveal policy | REUSE |

---

## 3. Gaps and risks found by inspection

These are findings from reading the code. Severity is the author's judgement for the **content programme**, not a statement about the accepted exam engine.

| # | Finding | Evidence [C] | Severity | Addressed by |
|---|---|---|---|---|
| G-1 | **The student catalogue read does not scale.** `reads.catalogue()` reads the three whole collections, and it is called from the public syllabus page and the student dashboard. | `apps/web/src/lib/backend.firebase.ts` (`getDocs(collection(db, c))` for `subjects`, `units`, `topics`) | High for cost and speed once content exists | Published catalogue trees (§5.4, S-1) |
| G-2 | **No referential integrity on questions.** `saveQuestion` checks id format only. A question can name a topic that does not exist, or a topic that belongs to another unit or subject. | `services/admin.ts#saveQuestion` | High for data quality | Server-side taxonomy check at save and at submit |
| G-3 | **PYQ verification is self-declared.** `officialPyqVerified` is part of the save payload; the only rule is "if kind is official_pyq then it must be true". The person saving decides. | `ProvenanceSchema`, `refineQuestion`, `SaveQuestionInput` | High for trust | Server-owned verification (ADR-6) |
| G-4 | **Curriculum changes go live with no review or history.** `upsertCatalogue` overwrites the document and bumps a counter; `fully_verified` needs a free-text `sourceRef` set by the same editor. | `services/admin.ts#upsertCatalogue` | High for the "no fabricated syllabus" rule | Curriculum workflow, versions, source linking |
| G-5 | **The admin list cannot filter or search.** One equality filter on `status`, one sort field, no subject, unit, topic, difficulty, provenance, reviewer or text filters. | `services/admin.ts#adminList` | High at thousands of items | Query model with composite indexes (S-3) |
| G-6 | **Head status can mislead.** Saving a new draft of a published question sets the head `status` to `draft` while an older version stays published. After `published → draft`, `publishedVersion` is not cleared. | `saveQuestion`, `transitionQuestion` | Medium | Separate `liveVersion` and `workingStatus` (data dictionary §4) |
| G-7 | **No review comments or rejection reason.** `review → draft` carries no text. | `TransitionInput` | Medium | Comments subcollection and reason codes |
| G-8 | **Audit is written after the commit and outside it.** If the process stops between the two, a state change exists with no audit record. | `log(...)` is called in `.then()` after `d.store.transact` | Medium for "published content must have an audit trail" | In-transaction event record (ADR-10) |
| G-9 | **Reviewers have no subject scope.** Any `subject_reviewer` can approve any subject. | `rbac.ts` | Medium | `staffProfiles.subjectScopes` (separate from `roles`) |
| G-10 | **Scoring has no answer-key policies.** Bulletin §3.5 (6a)–(6c) [O] credits "any listed option", "all attempted", "dropped" cases. The engine knows only exact-set match. | `scoring.ts#scoreQuestion` | Medium; needed the first time a published key is found wrong | CE-1 |
| G-11 | **Pre-submission payload carries `difficulty`, `unitId`, `topicId`** per question. No answer is exposed, but classification is shown to the student during the test, which the real exam does not do. | `PaperQuestionSchema`; `sessionPayload` | Low | CE-3 (optional) |
| G-12 | **Images and diagrams are placeholders.** `QuestionBody` renders "Images are not enabled in this preview"; Storage is deny-all. Data Interpretation (Paper I unit 7) needs tables and charts. | `QuestionBody.tsx`, `storage.rules` | Medium for Paper I completeness | Table blocks first; images later (S-4) |
| G-13 | **No duplicate detection** anywhere. | — | Medium at scale | Fingerprint index (ingestion spec) |
| G-14 | **No bulk import** and no resources/notes admin page (the project's own `FINAL_REPORT.md` lists them as "not started"). | `docs/FINAL_REPORT.md` | Expected | M9.3, M9.6 |
| G-15 | **Documentation drift.** The handoff names a staging subject "History" and tests `mt-unit`/`mt-quick`; the seed code creates "Education" and `mt-mini`/`mt-mini-late`. Staging itself was not inspected. | `docs/AI_HANDOFF.md` §12.2 vs `demoSeed.ts` | Low | Read-only check by Antigravity |
| G-16 | **The live syllabus is unverified.** No syllabus text has been checked against an official file. | source register | Blocking for any "verified" label | M9.0 |
| G-17 | **The web app hard-codes a curriculum fallback.** `useNames()` imports `SEED_SUBJECTS` and shows it whenever the catalogue read has not returned, and the admin question editor's dropdowns use the same fallback. That shows an unverified syllabus as if it were real, and conflicts with the rule that curriculum must not live in frontend code. The **public syllabus page does the same**: when the catalogue read returns no subjects it renders `SEED_SUBJECTS`. `useNames()` (used by eight pages: dashboard, settings, results, notebook, analytics, and the admin question, question-editor and test-editor pages) also triggers the full catalogue read (G-1). | `apps/web/src/lib/names.ts`; `apps/web/src/app/(site)/syllabus/page.tsx` | Medium | Remove both fallbacks in M9.1; show a loading or error state instead |

---

## 4. Target architecture

### 4.1 Layers

```
 OFFICIAL SOURCES (public)         EDITORIAL (private, callable-only)                         STUDENT (public / own data)
 ─────────────────────────         ───────────────────────────────────                         ─────────────────────────
 NTA bulletin, UGC syllabus        sourceDocuments  ──┐
 PDFs (hashed, human-checked)                         ▼
                                   CURRICULUM         subjects ─ syllabusVersions ─ units ─ topics
                                   (versioned)        └── draft → review → verified → published ─────► catalogueTrees/{subject}   (1 doc per subject, public get)
                                                                                                         catalogueTrees/_index
                                   QUESTION BANK      questions/{qid} ─ versions/{n} ─ comments ─ events
                                   (existing store,   fingerprints, pyqPapers
                                    extended)         draft → submitted → in_review → approved → published → retired
                                          ▲
                                   INGESTION          importBatches ─ rows (staged, validated, never auto-publish)
                                          │
                                   LEARNING MATERIAL  learningMaterials ─ versions (same workflow)
                                          │
                                          ▼
                                   ASSEMBLY           mockTests (kind: full | paper1 | paper2 | unit | topic | pyq | custom)
                                   (existing)         questionRefs ─► publishMockTest ─► publishedPapers + answerKeys   (immutable snapshot)
                                                                                                         │
 ┌───────────────────────────── EXAM ENGINE (protected, unchanged) ───────────────────────────────────┴─────────────────┐
 │ startExam · getExamSession · saveResponses · submitExam · getExamResult  ·  server clock · scoring · results           │
 └───────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┘
                                                         ▼
                                   LEARNING LOOP      results · performanceSnapshots (by unit/topic) · errorNotebook · spaced repetition
                                   (existing)         · studyPlans · reports      ── all keyed by the same unitId / topicId ──
                                                         ▲
                                   PRESENTATION       useExam (controller) ─ frozen DTO v1 ─ ExamScreen / future NTA-style skin
```

Every arrow that crosses from the editorial side to the student side passes through a Cloud Function that checks status, role and integrity. Browsers never read editorial data.

### 4.2 Component relationships (new items marked **new**)

| Component | Depends on | Produces | Notes |
|---|---|---|---|
| Source register (`sourceDocuments`) **new** | Person who downloads a file | A hashed record with URL, retrieval date, page count | Evidence for every syllabus record and PYQ |
| Curriculum Manager **new screens** | `sourceDocuments`; existing `adminUpsertCatalogue` pattern | `syllabusVersions`, `units`, `topics` in `draft` | A curriculum change is a proposal until verified and published |
| Catalogue publisher **new function** | Verified curriculum | `catalogueTrees/{subject}`, `catalogueTrees/_index` | The only thing students read |
| Question store (existing) | Taxonomy, `sourceDocuments`, `pyqPapers` | Versions with status | Extended, same paths |
| Duplicate detector **new** | `questionFingerprints` | Exact and near-duplicate flags | Runs at import, at save and at submit |
| Import pipeline **new** | Browser-side parser, staged rows | Draft questions | Never publishes |
| Review queue **new screen** | Question store, `staffProfiles` | Assignments, comments, decisions | Subject-scoped |
| Test assembler (existing) + recipe helper **new** | Published question versions | A draft `mockTests` document | Frozen into a snapshot at publish |
| Learning materials **new** | Taxonomy, same workflow | Notes and concept pages | Replaces ad hoc `learningNotes` for authoring |
| Exam engine (existing) | `publishedPapers`, `answerKeys` | Sessions, results | **Unchanged** |
| Analytics, notebook, plans (existing) | Results keyed by `unitId`/`topicId` | Weak areas, plans, reports | Unchanged; benefit automatically from a real taxonomy |

### 4.3 Request flow for one question, end to end

1. Editor opens the Question Editor, picks subject, unit and topic from the **draft or published** taxonomy (server checks the three ids belong together).
2. `adminSaveQuestion` validates, runs duplicate checks, writes the version (status `draft`) and appends an event, all in one transaction.
3. Editor submits. Automated checks run (answer present, explanation present, language rules, provenance rules). Failures are shown and block submission.
4. A scoped reviewer claims it (`in_review`), comments, then approves or returns it with a reason code. The approver cannot be the author.
5. For official PYQ items, two people complete PYQ verification against the hashed source before approval is allowed.
6. An admin or owner publishes. The version becomes immutable.
7. A test is assembled from published versions. `publishMockTest` freezes questions and key into a new paper snapshot.
8. Students take the test through the unchanged engine. Results flow into the existing analytics, all keyed by the same ids.

---

## 5. Key design decisions

Each decision lists the alternative that was considered and rejected.

### ADR-1 Official syllabus text and UrEducator topics are separate things
* **Decision.** A *unit* mirrors an official unit (number, verbatim title, source page). Under it the official text is kept as **verbatim statements** (`officialText`), exactly as printed. A *topic* is an editorial teaching unit that carries `officialRefs` pointing at the statements it covers, plus `origin: 'official' | 'editorial'`. A topic with no `officialRefs` cannot be labelled verified or "syllabus-aligned".
* **Why.** The one syllabus document read (Statistics, code 107) is units with long bullet lines, not topics and sub-topics (register §5.1). Splitting those lines into topics is an editorial act. Recording that act separately is what keeps invention out of the official layer.
* **Rejected.** Treating every bullet as a topic: it produces unstable ids, uneven granularity and no room for editorial grouping.

### ADR-2 Version each subject's syllabus; version elements by effective range
* **Decision.** `syllabusVersions/{subjectId}_{n}` states which official document(s) a version comes from, its effective range and its verification level. Units and topics carry `introducedIn` and `retiredIn` (version numbers). An unchanged topic simply stays alive across versions, so `topicId` and a student's history never change.
* **Rejected.** Copying the whole tree per version: it breaks analytics keyed on `topicId` and multiplies documents.

### ADR-3 Students read a published catalogue tree, not the working tables
* **Decision.** On curriculum publish, a function builds `catalogueTrees/{subjectId}` (units, topics, names, orders, no editorial fields) and refreshes `catalogueTrees/_index` (88 rows). The student app reads the index plus the one or two trees it needs (Paper I and the chosen subject): about three reads, not roughly ten thousand. Working tables (`subjects`, `units`, `topics`) become staff-only. Requires S-1.
* **Size check.** A tree for one subject (about 10 units, 100–150 topics) is a few tens of kilobytes, far below the 1 MiB document limit. Paper I is smaller still.
* **Fallback if S-1 is not approved.** Keep the public collections, add a `status` field and filter reads on `status == 'published'` (the same pattern already used for `mockTests`). This fixes leakage of drafts but **not** the read-count problem.
* **Rejected.** One document for the whole catalogue: it would exceed 1 MiB at full scale.

### ADR-4 Extend the existing question store; do not add a second one
* **Decision.** Same paths (`questions/{qid}`, `questions/{qid}/versions/{n}`), additive fields only. Version documents remain immutable once approved. A revision of a published question is a new version; the old one stays live until the new one is published.
* **Rejected.** A separate "academic questions" collection: it would duplicate `publishMockTest`, the workflow and the tests.

### ADR-5 Imports are client-parsed, server-validated, staged, and chunked
* **Decision.** The Admin Studio parses CSV, JSON and Excel in the browser and sends normalised rows to the server in chunks of at most 200 rows. The server validates each row with the same schemas used for manual entry and writes it to a staging area. A separate approval step creates draft questions in transactions of at most 100 questions. No Storage upload and no event-triggered function are needed in the first release. See the ingestion spec.
* **Rejected for now.** Storage upload plus a trigger: needs a Storage rules change and new infrastructure; adds attack surface for little gain at this size.

### ADR-6 Provenance and PYQ verification are server-owned
* **Decision.** The save endpoint accepts a *claim* (`kind`, source reference) but never `officialPyqVerified` or any verification result. Verification is a separate server action performed by named verifiers against a registered source document. The label "Official PYQ" is shown only when the server-held status is `dual_verified`.
* **Why.** Today the same person who types the question can mark it verified (G-3). That is the exact failure the assignment forbids.

### ADR-7 The exam engine changes only through approved change requests
* **Decision.** Four engine requests (CE-1 to CE-4) and two presentation requests (PR-1, PR-2) are written up (section 8). Each needs owner approval, a test plan and a rerun of the M8.8.5 acceptance checks on staging. Until approved, the engine and the exam screen are read-only for M9.
* **Why.** It is the part that has been verified live. Content work should not put it at risk.

### ADR-8 Pilot content is text-only; images wait for a Storage design
* **Decision.** Tables become a structured content block (rows and columns), which covers most Data Interpretation items without images. Charts, diagrams and PDF source files wait for S-4. Source PDFs are kept outside the application.

### ADR-9 Stable ids, friendly labels
* **Decision.** Difficulty stays `easy|medium|hard`; the interface shows Easy, Moderate, Difficult. Existing `results.byDifficulty` documents use those keys, so renaming would split history.

### ADR-10 Content state changes write their own event in the same transaction
* **Decision.** Every workflow transition appends `questions/{qid}/events/{id}` inside the transaction that changes the status. The global `auditLogs` entry is still written, but the per-question event is the authoritative trail for "who published what, when, and from which version".

---

## 6. What changes where (reuse map)

| Existing file or function | Change | Risk |
|---|---|---|
| `packages/shared/src/constants.ts` | New enums (statuses, Bloom, format, provenance kinds, verification states) | Low; additive |
| `packages/shared/src/schemas.ts` | New optional fields on question versions; stricter provenance; new content blocks | Medium; every consumer must still parse old documents |
| `packages/shared/src/adminSchemas.ts` | New inputs; `SaveQuestionInput` stops accepting verification fields | Medium |
| `packages/shared/src/rbac.ts` | New permissions; extended transition table | Low; tests exist |
| `functions/src/services/admin.ts` | Taxonomy check in `saveQuestion`; richer `transitionQuestion`; new functions in a **new file** (`content.ts`, `curriculum.ts`, `imports.ts`) so `admin.ts` does not grow further | Medium |
| `functions/src/endpoints.ts` | New endpoint rows | Low |
| `firestore.rules` | S-1 only, plus optional explicit denies | High attention; owner approval; the 57 rules tests must be extended |
| `firestore.indexes.json` | New composite indexes (S-3) | Medium; the query-shape contract test (recommended in Review #004) must exist first |
| `apps/web` admin pages | Extend `catalogue`, `questions`, `questions/edit`, `tests`; add new pages | Medium |
| `apps/web` student pages | `useNames` (which also loses its `SEED_SUBJECTS` fallback, G-17), the syllabus page and the dashboard switch to catalogue trees | Medium |
| `scoring.ts`, `exam.ts`, `session.ts`, `clientExam.ts` | **None in M9 content work** (CE-1 to CE-3 only after approval) | — |
| `apps/web/src/components/exam/QuestionBody.tsx` | PR-1 only: draw the new `table` block and show a neutral notice for any block it cannot draw | Low; additive view code, no state or network |
| `apps/web/src/components/exam/useExam.ts`, `ExamScreen.tsx` | **None in M9** (PR-2, behaviour-preserving, belongs to the later exam-UI milestone) | — |

---

## 7. Cost, scale and limits

Planning numbers, all [P] unless marked.

| Item | Estimate | Check |
|---|---|---|
| Subjects | 88 (87 plus Paper I) [O] | — |
| Units per subject | about 10 (Statistics has 10 [O]; others vary [?]) | — |
| Topics per subject | 100–150 | Tree doc a few tens of KB; limit is 1 MiB [C: Firestore] |
| Questions at maturity | 1,000 per subject → about 88,000 | One head (~1 KB) plus one or two versions (~3 KB) each: a few hundred MB |
| Student catalogue reads | 3 per session (index + Paper I + chosen subject), instead of the whole catalogue | Fixes G-1 |
| Import throughput | 200 rows per validation call; 100 questions per creation transaction (each question writes about four documents: head, version, event, fingerprint) | Stays under 500 writes per transaction |
| Published paper size | Cap is 800 KB (`maxPaperDocBytes`), enforced only inside `publishMockTest`. The staging 150-question paper was written by the seed, which bypasses that check, so its real size is **[?] not measured**. Rich text and tables increase size | Measure at the pilot with a real 150-question paper |
| Admin read cost | Server-side filters with composite indexes; counters kept in `contentStats` (updated once per transaction) instead of counting at view time | Avoids scans |
| Full-text search | Not provided by Firestore. First release: filters plus a short `searchTokens` field. If needed later, an external search service is a separate decision | Out of scope |

---

## 8. Engine change requests (not part of M9 content work)

Each of these edits the protected engine, so each needs owner approval and the M8.8.5 regression (V3 start, V4 resume, V5a autosave, V5b submit and score) rerun on staging.

| ID | Request | Why | Size |
|---|---|---|---|
| **CE-1** | `keyPolicy` on answer-key entries (`single`, `any_of`, `all_correct`, `dropped`) and matching branches in `scoreQuestion` | Bulletin §3.5 (6a)–(6c) [O]; needed when a published key must be corrected | Small, high care |
| **CE-2** | Freeze the exam DTOs in `packages/shared` with a `contractVersion` and contract tests; stop inferring UI types from `ENDPOINTS[...]run` | Lets the UI be redesigned safely | Small |
| **CE-3** | Remove `difficulty`, `unitId`, `topicId` from the pre-submission question payload | Closer to the real exam; removes a hint | Small; analytics read the key, not the payload |
| **CE-4** | Server-side generated practice papers (topic or unit practice on demand) using the same snapshot path | Needed for student-generated topic tests in M9.6 | Medium |

**Presentation requests** (view files only; detailed in `M9_STUDENT_EXAM_UI_SEPARATION.md`):

| ID | Request | Why | Size |
|---|---|---|---|
| **PR-1** | `QuestionBody.tsx` draws the new `table` block and shows a neutral notice for a block it cannot draw (today unknown blocks vanish silently) | Data Interpretation questions (Paper I unit 7) need tables; needed at the M9.4 pilot | Small; additive |
| **PR-2** | `useExam` returns codes instead of sentences and no longer navigates; the page owns routing and wording | Lets a future skin choose its own wording and destinations | Small-medium; behaviour-preserving; belongs to the exam-UI milestone |

---

## 9. Security architecture changes — for separate review

None is implemented. Each is listed so the owner can approve or reject it on its own.

| ID | Change | Type | Why | Without it |
|---|---|---|---|---|
| **S-1** | Make `subjects`, `units`, `topics` staff-only (no client read) and add `catalogueTrees/{id}` with `allow get: if true; allow list: if false; write: if false` | Firestore rules | Draft curriculum must not be public; fixes G-1 | Fall back to the `status` filter (ADR-3). Drafts could leak only if the filter is forgotten, and the read count stays high |
| **S-2** | Add explicit `allow read, write: if false` entries for each new private collection and extend the rules tests | Firestore rules (documentation level) | The catch-all already denies them, and the existing rules-test drift guard **[C]** already fails until each new collection is classified. Explicit lines make intent testable | No functional difference; weaker review trail |
| **S-3** | New composite indexes for content filters and test assembly (see data dictionary §10) | `firestore.indexes.json` | Admin screens and recipes need them | Queries fail with "index required". The in-memory store and the emulator do not catch this, which was the cause of the M8.8 exam-start failure, so a permanent query-shape contract test must come first |
| **S-4** | Storage rules and signed-URL design for images, diagrams and source files | Storage rules | Charts and diagrams | Pilot stays text-only |
| **S-5** | TTL policy on `importBatches` rows | Index overrides | Automatic clean-up of staged rows | Rows kept, or cleaned by a function |
| **S-6** | `staffProfiles/{uid}` with `subjectScopes` (new collection, **`roles` documents are not touched**) | Data | Subject-scoped review (G-9) | Any reviewer can review any subject |
| **S-7** | Server-owned PYQ verification (ADR-6) | Code | G-3 | Self-declared "official PYQ" |
| **S-8** | Turn on App Check enforcement before production (already item P-6 in the handoff) and add per-admin rate limits and import budgets to the new callables | Config and code | Abuse and cost control for bulk operations | Open to scripted abuse by a stolen staff session |
| **S-9** | Rich-text rule: no raw HTML in any content field; restricted Markdown plus LaTeX delimiters only; sanitised on save and again at render; review the Content Security Policy before enabling a maths renderer | Code and config | Stored XSS through content | A staff account could plant script in a question |
| **S-10** | Event record written inside the transition transaction (ADR-10) | Code | G-8 | Possible missing audit entries |

The accepted owner and role records are not modified by any item above.

---

## 10. What stays exactly as it is

* All exam endpoints and their behaviour.
* `publishedPapers` and `answerKeys` immutability.
* Rules for sessions, results, orders, tickets, keys and papers.
* The owner-claim mechanism and every existing `roles/*` document.
* The accepted M8.8.5 milestone history and the `ugc-mock-test-staging` project settings.
* Payments (disabled) and the AI provider (mock only).
* Production (`ugc-mock-test`) and the trial project (`ur-educator`): not touched, not referenced.

---

## 11. Decisions needed from the owner

| ID | Decision | Needed by |
|---|---|---|
| **O-1** | Policy on using official past-year question text in the product (legal advice recommended; the platform records provenance either way). Until decided, no PYQ is ingested. | Before M9.4 |
| **O-2** | Who downloads and hashes the official PDFs, and who is the second verifier | M9.0 |
| **O-3** | Obtain and share the December 2026 **corrigendum** (source register D4) | M9.0 |
| **O-4** | Approve S-1 to S-10 individually | Before the milestone each belongs to |
| **O-5** | Rename workflow state `review` to `submitted` and add `in_review`. Safe only if staging holds no questions; Antigravity confirms with a read-only count | M9.2 |
| **O-6** | Which Paper II subjects come first, and who the subject reviewers are | M9.5 |
| **O-7** | Policy on AI-assisted drafting (recommended: allowed only as a labelled draft, always human-reviewed, never bulk-published) | Before any AI drafting |
| **O-8** | Hindi policy: required for every question, or required only for official PYQ and flagship tests | M9.2 |
| **O-9** | CE-1 to CE-4: approve, defer or reject each | Before the milestone each belongs to |

---

## 12. Not in this milestone

Visual redesign of the exam screen; payments; production deployment; bulk question generation; replacing the synthetic fixtures; any Firestore write; any rules, index, IAM, billing or secret change.
