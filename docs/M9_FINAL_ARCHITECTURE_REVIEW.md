# M9 — Final Architecture Review

| | |
|---|---|
| **Milestone** | M9 — Academic Content Foundation (architecture and design only) |
| **Baseline** | Repository commit `694999a` (M8.8.5 accepted, staging CBT verified) |
| **Author** | Claude (architecture and security lead) |
| **Date** | 5 November 2026 |
| **Status** | PROPOSAL awaiting owner approval. Nothing in the repository, in Firestore, in any cloud project or in any configuration has been changed. |
| **This document** | The eleven-part review requested in the assignment (§15), with a precise handoff for Antigravity. It summarises the other seven documents and adds what only belongs here: the Admin Content Studio specification (part 7), the consolidated tests and acceptance criteria (part 10) and the handoff (part 11). |

**The seven companion documents** (all in `docs/` once Antigravity commits them):
`M9_ACADEMIC_CONTENT_ARCHITECTURE.md` · `M9_OFFICIAL_SOURCE_REGISTER.md` · `M9_CONTENT_DATA_DICTIONARY.md` · `M9_CONTENT_WORKFLOW_SPEC.md` · `M9_CONTENT_INGESTION_SPEC.md` · `M9_STUDENT_EXAM_UI_SEPARATION.md` · `M9_IMPLEMENTATION_ROADMAP.md`

**Evidence tags.** **[C]** read in code at `694999a`. **[O]** observed on an official page on 5 Nov 2026, not yet checked by a person. **[P]** proposal. **[?]** not verified.

---

## 0. Executive summary

**Where UrEducator stands.** The exam engine is verified and its content pipeline is sound in shape: versioned questions, a workflow with separation of duties, role-based permissions, immutable published papers, protected answer keys and deny-by-default rules **[C]**. What it lacks is everything that makes content *academic*: a verified syllabus, a curriculum that cannot change silently, questions that carry classification and trustworthy provenance, a review process that scales, a safe way to bring content in, and learning material beside the questions.

**What the design does.** It extends what exists. It adds fourteen new collections and extends six; it does not touch the exam endpoints, the scoring engine, the session logic, the paper snapshots, the owner claim or any role record. It keeps the official syllabus (verbatim, with source and page) separate from UrEducator's own teaching topics, so that invention is impossible to hide. It makes provenance and "Official PYQ" status a server decision, with two independent verifiers. It stages every import and lets it create **drafts only**. It freezes the boundary between the exam engine and the exam screen so a later redesign needs no backend work.

**What is verified and what is not.**

| Verified by reading code at `694999a` [C] | Observed on official pages, not human-checked [O] | Not verified [?] |
|---|---|---|
| Collections, schemas, workflow, rules, publish and scoring paths, exam controller and view, admin pages, tests present | Exam pattern (50 + 100 questions, 180 minutes, +2, no negative marking, §3.5 credit rules, bilingual rule); 87 subjects plus Paper I with codes | **Any syllabus text** (no unit or topic of any subject was read); the **corrigendum**; `subjects.php`; per-subject medium; staging data; the rules suite (57 tests) was not run here |

**Decisions the owner is asked to make now.** (1) Approve the architecture so Antigravity can commit the documents. (2) Name who downloads and who verifies the official files (O-2) and obtain the corrigendum (O-3) so M9.0 can start. Everything else is decided later, milestone by milestone (roadmap §5).

**What this review did not and could not do.** It did not read live staging data, run the emulator tests, compile code, or verify any syllabus text. It did not use the old repository. It did not make any change anywhere. These limits are repeated where they matter.

**Boundaries kept.** No code, Firestore write, deployment, Hosting change, rules or index change, IAM, billing or secret change, payment activation, production access or change to the trial project. No bulk question generation and no replacement of synthetic data. No visual redesign. No NTA branding. The accepted M8.8.5 history is untouched.

---

## 1. Existing platform capability assessment

Scope of inspection: `docs/FIRESTORE_MODEL.md`, `packages/shared/src/*`, `functions/src/endpoints.ts`, `services/admin.ts`, `exam.ts`, `learning.ts`, `ai.ts`, `domain/*`, `infra/audit.ts`, `devtools/demoSeed.ts`, `firestore.rules`, `storage.rules`, the admin pages under `apps/web/src/app/admin`, the exam components, `lib/backend*.ts`, and the test directories. Full table with evidence: architecture document §2.

**Verdict key.** REUSE: as is. EXTEND: add without changing what exists. REDESIGN: the current shape cannot carry the requirement.

| # | Area (assignment §2) | What exists [C] | Verdict |
|---|---|---|---|
| 1 | Collections and structures | Catalogue (`subjects`, `units`, `topics`, `examBlueprints`), `questions` + `versions`, `mockTests`, server-only `publishedPapers` and `answerKeys`, sessions, responses, results, snapshots, notebook, plans, `learningNotes`, `auditLogs`, `roles`, `systemSettings` | REUSE; new collections added beside them |
| 2 | Question schema | Version: `content`, `correct[]`, `explanation?`, `provenance`, reviewers. Head: subject, unit, topic, difficulty, languages, status, version pointers, preview | EXTEND (classification, provenance, blocks) |
| 3 | Answer-key schema | `answerKeys/{paperId}`: `qid → {correct[], sectionId, unitId, topicId, difficulty, explanation?}`, created with `tx.create` | REUSE; one optional field later (`keyPolicy`, CE-1) |
| 4 | Published paper architecture | Immutable `publishedPapers/{mockTestId_vN}` with a size cap; sessions keep their `paperId` | REUSE (this is the "published exam snapshot" the assignment asks for) |
| 5 | Blueprint configuration | `BlueprintSchema`, `DEFAULT_BLUEPRINT` 50 + 100, 180 minutes, +2/0/0, `officialPatternVerified: false` | REUSE; a person confirms the flag |
| 6 | Admin Studio | Pages: overview, catalogue (one form), questions (one status filter), question editor, tests, test editor, blueprints, people, pricing, leads, support, audit | EXTEND (catalogue, questions, editor, tests); add the new screens (part 7) |
| 7 | Authentication and RBAC | Seven roles; permissions in `rbac.ts`; role as signed claim plus `roles/{uid}`; one-time resumable owner claim; verified email required | REUSE untouched; new permissions added; subject scope in a new `staffProfiles` collection |
| 8 | Content publishing functions | `saveQuestion`, `transitionQuestion`, `publishMockTest`, `upsertCatalogue` | EXTEND (taxonomy check, richer workflow); `upsertCatalogue` flow is **REDESIGN** (no review, no history) |
| 9 | Student APIs | Exam family, notebook, plan, mentor, report, profile, tickets | REUSE untouched |
| 10 | Engine contracts | Five exam callables; `useExam` controller; shared pure functions | REUSE; contract frozen with CE-2 |
| 11 | Synthetic fixtures | 10 hand-written and 150 clearly synthetic items, 2 blueprints, 3 tests; write papers and keys directly | REUSE as labelled fixtures; never the path for real content |
| 12 | Security rules | Deny by default; public read only for catalogue, published tests and plans; storage deny-all | REUSE; one change proposed (S-1) |

**Count.** Of the twelve areas: 8 REUSE (1, 3, 4, 5, 9, 10, 11, 12, with the small additions noted) and 4 EXTEND (2, 6, 7, 8). Two parts inside them are **REDESIGN**: the catalogue *write* path (area 8: no review, no history) and the student catalogue *read* path (area 1: whole-collection reads). Nothing is rebuilt; fixtures are kept and labelled.

---

## 2. Gaps and risks

### 2.1 Gaps found by inspection (all [C]; full list G-1 to G-17 in architecture §3)

| Rank | Gap | Why it matters | Fix lands in |
|---|---|---|---|
| 1 | **G-3** PYQ verification is self-declared by whoever saves the question | An unverified item can be labelled official | M9.2 (S-7) |
| 2 | **G-4** Curriculum edits go live instantly, unreviewed, with no history; "fully verified" needs only a typed reference | Violates "never fabricate units or topics" | M9.1 |
| 3 | **G-2** No referential integrity: a question can name a topic that does not exist or belongs elsewhere | Corrupts analytics and tests | M9.2 |
| 4 | **G-16** The live syllabus is unverified | Nothing can be called verified until people check it | M9.0 |
| 5 | **G-1** The student catalogue read loads three whole collections (about ten thousand reads per visit at full scale) | Cost and speed | M9.1 (S-1) |
| 6 | **G-17** The web app falls back to a hard-coded curriculum | Shows an unverified syllabus as real | M9.1 |
| 7 | **G-5** Admin list cannot filter or search | Unusable at thousands of items | M9.2 (S-3) |
| 8 | **G-10** Scoring has no answer-key policies for corrected keys | Needed the first time a published key is wrong | CE-1 before first PYQ test |
| 9 | **G-8** Audit written after the commit | A change could exist without a record | M9.2 (S-10) |
| 10 | **G-9** Reviewers have no subject scope | Wrong person approving | M9.2 (S-6) |
| 11 | **G-6, G-7, G-11, G-12, G-13, G-14, G-15** | Status ambiguity, no review comments, classification shown during the test, no tables/images, no duplicate detection, no bulk import, doc drift | Various |

New findings made while writing the later documents (also folded into the specifications):
* **U-5** The paper snapshot copies the whole `content` object; therefore nothing private may ever be placed inside it (rule UR-2, UI separation §5.2). The rich-text flag was moved inside `content` for this reason.
* **No lookup of "which published tests contain this question"**; added `questionUsage` (data dictionary §7.1) so content incidents can be handled.
* **No optimistic concurrency** on editor saves; added `rev` and `expectedRev`.

### 2.2 Risks (full table with mitigations: roadmap §8)

The most important five: **R-1** the legal position on official PYQ text (decision O-1; nothing official is ingested until it is made); **R-2** the syllabus may not be capturable reliably (human transcription, hashes, two verifiers); **R-3** reviewer capacity is the real bottleneck (measure it in the pilot); **R-4** a wrong key reaching students (separation of duties, explanations, a random audit gate, the content-incident procedure, CE-1); **R-6** repeating the M8.8 missing-index failure (query-shape contract test X-1 before any index).

---

## 3. Recommended academic data architecture

```
 OFFICIAL SOURCES        EDITORIAL (private, callable-only)                           STUDENT
 (hashed PDFs)           sourceDocuments ─┐
                         CURRICULUM       ▼
                         subjects ─ syllabusVersions ─ units ─ topics
                         draft → in_review → verified → published ───────────► catalogueTrees/{subject}  +  _index   (public get)
                         QUESTION BANK    questions ─ versions ─ comments ─ events   (+ fingerprints, usage, pyqPapers)
                         draft → submitted → in_review → approved → published → retired
                         INGESTION        importBatches ─ rows (drafts only, never auto-publish)
                         LEARNING         learningMaterials ─ versions (same workflow)
                         ASSEMBLY         mockTests ─► publishMockTest ─► publishedPapers + answerKeys (immutable)
 ┌──────────────── EXAM ENGINE (protected, unchanged) ───────────────────────────────────────────────┐
 │ startExam · getExamSession · saveResponses · submitExam · getExamResult · server clock · scoring │
 └───────────────────────────────────────────────────────────────────────────────────────────────────┘
                         LEARNING LOOP    results · snapshots · notebook · spaced repetition · plans · reports  (all keyed by unitId / topicId)
                         PRESENTATION     useExam ─ frozen DTO v1 ─ ExamScreen / future skin
```

The ten decisions (ADR-1 to ADR-10, architecture §5), in one line each:

1. Official syllabus text is stored verbatim and separately; editorial topics point at it.
2. Syllabi are versioned per subject; elements carry effective ranges, so `topicId` and student history never change.
3. Students read published catalogue trees (about three reads per session), not working tables.
4. The existing question store is extended; there is no second store.
5. Imports are parsed in the browser, validated and staged on the server, approved by a person, and create drafts in small transactions.
6. Provenance and PYQ verification are server-owned.
7. The engine changes only through numbered, separately approved requests.
8. The pilot is text-only with table blocks; images wait for a Storage design.
9. Stable ids, friendly labels (difficulty stays `easy|medium|hard`).
10. Every state change writes its own event in the same transaction.

**Scale and cost** (architecture §7): 88 subjects, about 10 units and 100 to 150 topics each, up to about 88,000 questions at maturity; a catalogue tree is tens of KB against a 1 MiB limit; imports create at most 100 questions (about 400 writes) per transaction.

**Not over-engineered.** No search service, no Storage upload pipeline, no event triggers, no new roles, no second question store, no group documents (shared passages are repeated and tied by `setKey`) until the pilot proves a need.

---

## 4. Complete data dictionary

Full text: `M9_CONTENT_DATA_DICTIONARY.md`. Coverage, counted from the collection map (§2) and the rule tables (§9):

| Item | Count / content |
|---|---|
| New collections or sub-collections | 14: `sourceDocuments`, `pyqPapers`, `syllabusVersions`, `catalogueTrees`, `comments`, `events`, `questionFingerprints`, `questionUsage`, `importBatches`, `rows`, `learningMaterials`, `learningMaterials/versions`, `staffProfiles`, `contentStats` |
| Extended collections | 6: `subjects`, `units`, `topics`, `questions`, `questions/versions`, `mockTests` |
| Not modified | `roles`, `publishedPapers`, `answerKeys` (one optional field later), all exam, result and learning-loop collections |
| Validation rules | 26 (16 question rules V-Q-01 to V-Q-16, 10 curriculum rules V-C-01 to V-C-10) |
| Planned query shapes | 9 on `questions`, plus materials, batches and comments (§10). The final index list is generated by the query-shape test, not typed by hand |
| Versioning | One table (§11): question versions, papers, syllabus, trees, materials, blueprint |
| Assignment coverage | A line-by-line coverage check against assignment §4 and §5 is in §12 |

**Open schema questions for the owner.** (a) `knowledgeDomain` is read as the knowledge dimension of the revised Bloom taxonomy (factual, conceptual, procedural, metacognitive); confirm. (b) Whether question groups need their own documents (deferred). (c) Whether `Moderate` should replace `medium` in stored data (recommended: no, labels only).

---

## 5. Official curriculum source register

Full text: `M9_OFFICIAL_SOURCE_REGISTER.md`. Summary:

| Item | Status |
|---|---|
| Sources | 11 entries (S1 to S9, plus S2a and S3b); official pages read: NTA home, bulletin listing, the December 2026 bulletin (about 100,000 of 104,802 characters), the UGC syllabus catalogue |
| Verification levels | Every entry is **V0 or V1**. **Nothing is V2/V3.** That is deliberate |
| Exam pattern | Recorded with bulletin section references; matches `DEFAULT_BLUEPRINT` on the numbers; needs two-person confirmation before `officialPatternVerified` is set |
| Subject catalogue | 88 rows (87 subjects plus Paper I); two official lists agree mechanically; 29 rows marked "language subject (inferred)" are the author's inference |
| Syllabus content | **None verified.** Fetches returned an unrelated PDF, expiring pre-signed links, and corrupted Hindi text. Reasons recorded so nobody repeats the attempt |
| Amendments after June 2019 | None found in the pages reached; the search was incomplete. The correct statement is "no amendment found in the pages reached", not "none exists" |
| Open items | D1 to D12 (blocked URLs, unread **corrigendum**, code spellings, file availability, Hindi corruption, count drift, doc drift, scoring rule gap) |
| Procedure | M9.0 (§8): capture and hash, two-person pattern check, two-person Paper I transcription, discrepancy log, freeze |

---

## 6. Content workflow design

Full text: `M9_CONTENT_WORKFLOW_SPEC.md`.

* **States.** `draft → submitted → in_review → approved → published → retired`. "Revised" is version n+1 in `draft` while n stays live.
* **Separation of duties.** Approver, claimer and verifiers differ from the author; verifiers differ from each other; publisher differs from the author unless the owner records an override (small-team setting).
* **Subject scope.** Reviewers act only on subjects in their `staffProfiles` scope.
* **Official PYQ.** The label appears only when the server holds `dual_verified`; editing resets it.
* **Review.** A queue with claim timeouts and capacity, an eight-item checklist stored with the approval, typed comments, duplicate decisions.
* **Batch operations.** Idempotent, bounded (50 to 100 per call), one event per item.
* **Imports.** Drafts only; no option, flag or role skips a step.
* **Incidents.** Retire, unpublish affected tests (found through `questionUsage`), correct, republish; running exams are never edited.
* **Curriculum.** Its own lifecycle (`draft → in_review → verified → published → retired`) with dual verification for pattern facts.
* **Twelve security invariants** (I-1 to I-12), each an automated test in M9.2.

---

## 7. Admin Content Studio specification

The assignment lists thirteen screens. This part defines each one's purpose, who may use it, filters and search, batch operations and review states, and how the whole studio stays usable with thousands of questions. It extends the existing admin pages (`/admin/catalogue`, `/admin/questions`, `/admin/questions/edit`, `/admin/tests`, `/admin/audit`) rather than replacing them.

### 7.1 Behaviour shared by every screen

| # | Rule |
|---|---|
| C-1 | **Server-side lists.** Filtering, sorting and paging happen on the server with indexes; page size at most 50; cursor paging. No screen loads a whole collection. Combinations of filters that have no index are disabled in the interface instead of failing. |
| C-2 | **Filters live in the address bar,** so a view can be bookmarked, shared with a colleague and restored with the back button. Remembering the last view on the device is a convenience only (wrapped so it never breaks the page). |
| C-3 | **Search in the first release** is: exact id, exact PYQ key, and a single word from `searchTokens` combined with a subject filter. It is not full-text search. A search service is a later, separate decision. |
| C-4 | **Counters** (totals by status, unit, provenance, difficulty, Bloom, PYQ progress) come from `contentStats`, never from counting at view time. |
| C-5 | **No silent overwrite.** Saves send `expectedRev`; if someone else saved first the editor gets `STALE_EDIT`, a side-by-side view and a choice. |
| C-6 | **Unsent edits are kept on the device** and offered back after a refresh. |
| C-7 | **Every action is checked on the server** (permission, scope, state, separation of duties) and writes an event. The browser hides buttons for comfort only. |
| C-8 | **Batch operations** follow workflow spec §8: bounded, idempotent, per-item result report, one event per item, partial failure never leaves a half-changed item. |
| C-9 | **Keyboard-first review:** next and previous item, open comments, approve and return only when the checklist is complete. |
| C-10 | **Accessible by default:** labelled controls, visible focus, sufficient contrast, `lang` on Hindi text and Hindi inputs, tables with captions. |
| C-11 | **Clear states:** every list has loading, empty and error messages that say what to do next. |
| C-12 | **Nothing private in a URL:** ids and filters only; never keys, explanations or personal data. |
| C-13 | **Roles see what they may use.** An editor sees no verification or publishing controls; a reviewer sees only items in scope. |

### 7.2 The thirteen screens

For each screen: **Who** lists the permissions (existing in plain, new ones from data dictionary §6.2); **States** the review states it shows or changes.

**1. Curriculum Manager** — *M9.1; extends `/admin/catalogue`.*
Purpose: one place to see the state of the whole curriculum.
* Content: a table of the 88 subjects with status (`listed`, `draft`, `in_review`, `verified`, `dual_verified`, `published`, `retired`), syllabus version, verification level, source-document count, unit and topic counts, and content counts. Tabs: Subjects, Source register, Waiting for review.
* Filters: paper; status; verification level; language-subject flag; has units; has published questions. Search: code or name.
* Batch: export the overview. State-changing curriculum actions are deliberately one at a time.
* Who: all staff read; `curriculum.write` edits drafts; `curriculum.review` verifies; `curriculum.publish` publishes.
* States: the curriculum lifecycle (workflow §6).

**2. Subject Manager** — *M9.1.*
Purpose: maintain one subject and its syllabus versions.
* Content: official name exactly as printed (immutable once verified) and display name; code and printed code; paper; medium policy; label (derived, never typed); syllabus versions; registered sources (file, URL, retrieval date, hash, pages); "start a new version" (copies the current one).
* Rules: V-C-01, V-C-06; a version cannot be marked verified without a hashed source.
* Who: `curriculum.write`, `.review`, `.publish`. States: as above.

**3. Unit and Topic Manager** — *M9.1.*
Purpose: edit the tree of one subject version.
* Content: **units** (official number, verbatim title, verbatim statements with page) and **topics** (editorial name, objectives, prerequisites, `officialRefs`, typical weight, sub-topics). A topic without `officialRefs` is marked "editorial" and cannot be called syllabus-aligned. Side-by-side compare with the previous version.
* Filters: unit; origin (official or editorial); status; has questions; missing official reference; retiring. Search: name or id.
* Batch: reorder; move topics (shows the number of affected questions first); retire; up to 50 per call.
* Rules: V-C-02 to V-C-10; ids never reused.
* Who: `curriculum.write` and `.review`.

**4. Question Bank Manager** — *M9.2; extends `/admin/questions`.*
Purpose: find and manage thousands of questions.
* Filters: paper; subject; unit; topic; sub-topic; difficulty; Bloom; format; language; provenance kind; PYQ verification state; working status; live or not; author; reviewer; batch; duplicate flag; tag; date range. Sorting: updated, created. Search: id, PYQ key, token.
* Columns: preview, subject/unit/topic, difficulty, Bloom, provenance, status, languages, reviewer, updated; configurable.
* Batch: submit drafts; assign reviewer; change classification; retire; export the filtered list (up to 5,000 rows, server-paged; exports that include keys need `questions.write` and are audited).
* Counters at the top from `contentStats`. Empty state explains which filter hides results.
* Who: all editorial roles read what their role may see; actions per the permission matrix.

**5. Question Editor** — *M9.2; extends `/admin/questions/edit`.*
Purpose: author or revise one question.
* Content: classification (taxonomy pickers limited to verified or published elements), difficulty, Bloom, format, knowledge domain, estimated time; content blocks (stem, passage, statements, match lists, table, options) with English and Hindi side by side; provenance panel specific to the kind; tags; duplicate panel.
* Actions: Save draft; Save and add another; Submit for review (runs the checks and lists failures by rule id); Create revision (for a non-draft item).
* Rules: V-Q-01 to V-Q-16 shown inline; non-draft versions are read-only.
* Who: `questions.write`, `questions.submit`. States: `draft` (editable), others read-only.

**6. Question Preview** — *M9.2.*
Purpose: see exactly what a student will see.
* Content: the same question renderer the exam uses (extended by PR-1), in English and Hindi, at desktop and phone width; a "what the student's payload contains" view built from the allowlist, to demonstrate nothing private is sent; the key hidden by default and shown only to roles allowed to read keys.
* Who: any editorial role. Read-only. Also embedded in the Review Queue.

**7. Answer and Explanation Editor** — *M9.2.*
Purpose: a focused view for the key, the explanation and the concept note.
* Content: key selection (single or multiple; key policy field present but limited to `single` until CE-1); explanation and concept note in both languages with LaTeX preview; related resources.
* For reviewers: stem and key side by side with a checklist item "I solved it independently before reading the key". For the pilot audit, a *blind* mode hides the key until the auditor has answered.
* Who: author edits drafts; reviewers read and comment. Rules: V-Q-04, V-Q-05, V-Q-07.

**8. PYQ Verification Manager** — *M9.2.*
Purpose: make "Official PYQ" mean something.
* Content: queue of `official_pyq` claims; per item the registered paper (`pyqPapers`), the source document and page, the key document and its status (provisional, final, challenged); the two verification steps (text and key) by two different people; discrepancy notes; a register of which official papers have been entered and how many of their questions are verified.
* Filters: cycle; year; shift; subject; verification state; verifier. Search: PYQ key.
* Batch: assign verifier (up to 100). **No batch verify:** each check is a deliberate human act.
* Who: `questions.verify_pyq`, in scope. States: `unverified → single_verified → dual_verified`, or `disputed`; edit resets to `unverified`.

**9. Bulk Import Manager** — *M9.3.*
Purpose: stage, check, approve and create draft questions from files.
* Content: upload and map columns; templates; batch list with status; per-batch preview (counts, issues grouped by rule, 50 sample rows rendered as a student sees them); failed-rows download; approve; create (progress); retry failed; cancel.
* Filters: batch status; uploader; date. Within a batch: row status, rule, unit.
* Who: `imports.run` stage; `imports.approve` approve (not the uploader by default). States: ingestion spec §5.
* Guarantee: creates drafts only.

**10. Review Queue** — *M9.2.*
Purpose: let reviewers work through thousands of items efficiently.
* Content: items in the reviewer's scope, oldest first; "Claim next"; the item with preview, key, explanation, provenance and duplicate panel; the checklist; comments; Approve; Return with a reason code.
* Filters: subject; unit; topic; provenance; batch; author; age; mine/unassigned. Search: id.
* Batch: return with one reason (up to 50); approve claimed items (up to 50, checklist ticked once, items with flags skipped and listed).
* Rules: claims expire after 24 hours; capacity 25; reviewer is not the author; duplicate flags block approval.
* Who: `questions.review` in scope. States: `submitted → in_review → approved | draft`.

**11. Publishing Dashboard** — *M9.2 for questions; extended in M9.4 for tests.*
Purpose: see what is ready, what blocks it, and what is live.
* Content: approved questions awaiting publish by subject and unit; publish; tests in preparation with readiness checks (counts against the blueprint, synthetic items present, unverified items, label eligibility); recently published and retired; owner overrides (`owner_self_publish`) listed; a content-incident panel (reports, retire, affected tests via `questionUsage`).
* Filters: subject; unit; status; date. Batch: publish selected approved items (up to 50); retire selected.
* Who: `questions.publish`, `tests.publish`; retire needs `questions.retire`. States: `approved → published`, `published → retired`.

**12. Content Version History** — *M9.1 for curriculum; M9.2 for questions and materials.*
Purpose: answer "who changed what, when and why".
* Content: a timeline from `events` and `versions`; compare any two versions field by field; reason codes; the content hash and a "verify integrity" check; for a question, the published tests that contain each version (`questionUsage`); for a syllabus, the units and topics introduced or retired in each version.
* Filters: actor; action; date range; kind. Read-only; links to the global audit page.
* Who: all editorial roles read.

**13. Content Quality Dashboard** — *basic counters in M9.2 and M9.4; full version in M9.6.*
Purpose: show where content is thin, slow or risky.
* Content: coverage by unit and topic (published questions against a target the owner sets); status funnel; review turnaround; return reasons; duplicate rate; Hindi coverage; provenance mix; official PYQ verified share; AI-assisted share; questions with no recent attempts; later, observed difficulty from attempts compared with authored difficulty.
* Filters: subject; unit; period. Batch: none. Export CSV.
* Who: `stats.read`.

### 7.3 Which milestone ships which screen

| Milestone | Screens |
|---|---|
| M9.1 | Curriculum Manager, Subject Manager, Unit and Topic Manager, Content Version History (curriculum) |
| M9.2 | Question Bank Manager, Question Editor, Question Preview, Answer and Explanation Editor, PYQ Verification Manager, Review Queue, Publishing Dashboard (questions), Content Version History (questions), Content Quality Dashboard (counters) |
| M9.3 | Bulk Import Manager |
| M9.4 | Publishing Dashboard (tests and readiness), Content Quality Dashboard (pilot metrics) |
| M9.6 | Content Quality Dashboard (full coverage and learning analytics); learning-material editing reuses the Question Editor pattern |

### 7.4 Built for thousands of questions

| Concern | Design |
|---|---|
| Finding things | Filters on indexed fields; saved in the address bar; counters from `contentStats` |
| Reviewing fast | Claim next, keyboard shortcuts, checklist stored once, batch return and approve with limits, duplicate panel in place |
| Avoiding collisions | Claims with timeout; `rev` checks; optimistic UI never overwrites |
| Quality at volume | Automated checks at submit; near-duplicate flags; blind audit sample; return reasons tracked |
| Cost | Cursor paging, bounded exports, counters instead of scans, no per-keystroke writes |
| Accountability | One event per change; version history; owner overrides visible |

---

## 8. CBT presentation separation design

Full text: `M9_STUDENT_EXAM_UI_SEPARATION.md`. Summary:

* **The split already exists.** `useExam` (controller, 132 lines) owns session load, device backup, autosave, clock, submit and navigation; `ExamScreen` (view, 149 lines) and `QuestionBody` (renderer, 21 lines) own layout. Five callables are the whole engine boundary.
* **Where it leaks (U-1 to U-10).** UI types are inferred from the server function; the controller picks the next URL and holds user-facing sentences; content blocks are drawn from a fixed list so a new block would vanish silently; the paper copies the whole `content` object; classification travels with questions during the test; end-to-end tests rely on ten test ids.
* **The contract.** An allowlist of what a student may receive during a test; rules UR-1 to UR-7 (nothing private in `content`, a skin never calls the backend, never keeps time, never touches storage); a controller surface frozen as `ExamController` v1; a test-id contract.
* **Changes in M9:** one small view change (PR-1, render tables and show a neutral notice for unknown blocks). **Later:** CE-2 (frozen DTOs), PR-2 (controller returns codes, page routes), optional CE-3.
* **Redesign strategy.** Build a second skin beside the current one behind a staff-controlled setting, reuse the same controller and the same end-to-end suite, roll out on staging first with an easy switch back. No NTA or government branding.
* **Not started.** No layout, colour, typography or component of the exam screen is touched in M9.

---

## 9. Prioritised implementation roadmap

Full text: `M9_IMPLEMENTATION_ROADMAP.md` (milestones, dependencies, complexity, risks, testing strategy).

| Priority | Item | Why first |
|---|---|---|
| 0 | Owner approval; docs commit | Preserves the design in the repository |
| 1 | **M9.0** Official sources and Paper I syllabus verification | Nothing may be called verified before this; mostly human work, small code |
| 1 (parallel) | **X-1** Query-shape vs index contract test | Must exist before any index; prevents a repeat of M8.8 |
| 2 | **M9.1** Catalogue and data model | The taxonomy everything else hangs on; fixes the read-cost and fake-syllabus problems |
| 3 | **M9.2** Question bank and workflows | The heart of the programme: trust, provenance, review |
| 4 | **M9.3** Bulk ingestion | Needed for volume; not needed for the pilot |
| 5 | **M9.4** Paper I pilot (gate) | Proves the chain and measures reviewer capacity before any mass effort |
| 6 | **M9.5** Paper II by subject | Repeats a proven recipe in the owner's priority order |
| 7 | **M9.6** Learning content and analytics | Completes the ecosystem on one taxonomy |
| Later | Exam-UI redesign | Separate assignment; needs CE-2 and PR-2 |

**Recommendation: a small Paper I pilot (about 300 reviewed items) before any mass ingestion,** as the assignment asks. The pilot is also the only way to turn the planning estimates in this package into measurements.

---

## 10. Tests and acceptance criteria for each milestone

The full lists are under each milestone in the roadmap (§4) and in the specifications. This is the consolidated gate table: a milestone is done only when every row passes with numbers reported.

| Milestone | Must pass | Evidence required in the report |
|---|---|---|
| **Docs commit** | Only eight new files under `docs/`; no other change | `git diff --stat` |
| **M9.0** | S3 and S6 captured and hashed; register §3 re-confirmed at V3; Paper I English and Hindi captured, hashed, transcribed and checked by a second person; 87 codes confirmed; D1 to D12 closed or accepted | Manifest with hashes; verifier names; discrepancy log |
| **M9.1** | Paper I shown as verified with page references; all other subjects `listed` with no units; a student page load reads at most 3 catalogue documents; no curriculum in frontend code; V-C rules pass; rules tests (existing 57 plus new) pass; query-shape test passes; X-4 regression unchanged; synthetic exams still run | Test counts; measured read count; X-4 output |
| **M9.2** | Invariants I-1 to I-12 pass with negative controls; permission matrix passes for every role and transition; editor alone cannot reach `published`; editing a published question creates v(n+1) while v(n) stays live; admin list filters on indexes; old documents still parse; adversarial save (status, verification, reviewer fields) ignored; forced failure in a transaction leaves no half state | Test counts; invariant table; matrix output |
| **M9.3** | Any import creates only drafts; retry never duplicates; concurrent create blocked by the lease; malicious file neutralised; failed-rows file safe in a spreadsheet; throughput measured at 200, 1,000 and 2,000 rows | Throughput numbers; clean-up proof |
| **M9.4** | Every published item has a verified chain, explanation, reviewer ≠ author, provenance; random 10% audit by a third person finds **no wrong key**; two practice tests run on staging with X-4 unchanged; analytics show weak and strong topics under the real taxonomy; measured paper size against the 800 KB cap; throughput and cost recorded; **owner signs the gate** | Audit sheet; size; throughput; cost |
| **M9.5 (per subject)** | Syllabus verified and published; topics reviewed with `officialRefs`; subject reviewer in scope; every unit above the owner's threshold; a published practice test; medium policy known | Subject-ready checklist |
| **M9.6** | A weak topic leads to syllabus lines, published notes and a practice set drawn only from published questions; the plan updates after the next test; coverage dashboard matches database counts | End-to-end trace; reconciliation |
| **Every milestone** | Unit, integration, rules, end-to-end and bundle scans green; no engine file changed except through an approved CE or PR; M8.8.5 regression on staging after any deploy; report with verified-versus-assumed list | Report in the standard format |

---

## 11. Antigravity implementation handoff

**Status of this handoff.** It becomes effective only when the owner writes, in chat, that the M9 architecture is approved. Until then Antigravity does nothing for M9. Approval of the architecture is **not** approval of any deployment, data write, rules change or index change; each of those needs its own explicit "yes".

### 11.1 Standing rules for all M9 work

1. Work only in `ureducator-platform-v2`. Never use the old repository. Never touch production `ugc-mock-test` or the trial project `ur-educator`. Cloud work, when authorised, is `ugc-mock-test-staging` only.
2. No deploy, rules, index, data, IAM, billing, secret or Hosting action without an explicit authorisation for that action. Razorpay and payments stay disabled.
3. Do not change the exam engine files except through an approved CE or PR: `scoring.ts`, `exam.ts`, `session.ts`, `clientExam.ts`, `useExam.ts`, `ExamScreen.tsx`, the exam endpoints. Do not change `roles/*`, the owner claim, or `publishedPapers`/`answerKeys` behaviour.
4. Do not start the exam-screen redesign. Do not use NTA or government logos or wording.
5. No bulk question generation. No replacement of synthetic fixtures. No fabricated syllabus: where a fact is missing, leave it empty and say so.
6. Tests first; every new field is optional or defaulted so existing documents parse; every security guard has a test that is shown to fail without it.
7. Report in the standard format with a verified-versus-assumed table. Stop at each milestone for Claude's review and the owner's sign-off.
8. Antigravity is the only implementer. Claude reviews and does not edit the repository.

### 11.2 Immediate tasks after approval (no application code)

**Task A — commit the architecture (docs only).**
* Copy the eight documents into `docs/`: the seven named in §12 of the assignment and `M9_FINAL_ARCHITECTURE_REVIEW.md`. Do not edit their content.
* Make one commit containing only those files. Do not touch any other file.
* Evidence: `git status` and `git diff --stat` showing eight added files and nothing else.
* Acceptance: the commit exists on Antigravity's working branch; the accepted M8.8.5 history is unchanged.

**Task B — read-only staging facts (needs the owner's explicit authorisation, read-only).**
Settle the open items with counts, not content. Using a read-only method (console or an Admin SDK script that issues no writes):
1. Count `questions` documents by `status`, and count `versions` documents. (Needed for decision O-5.)
2. List the ids and labels of `subjects`, `units`, `topics`. (Settles D11.)
3. List `mockTests` ids with `status`, `blueprintId`, `paperId`.
4. Count `learningNotes`.
5. For the 150-question test's paper and answer-key documents, report the serialised size in bytes. (Settles the unmeasured 800 KB question.)
6. Do not read or report anything under `roles`, `systemSettings`, `users` or any student data.
* Output: one short text report. No document bodies except ids, statuses and sizes. No writes of any kind.

**Task C — prepare M9.0 (local files only; no network needed).**
1. Add `content-sources/README.md` (how to capture and hash a source) and `content-sources/MANIFEST.json` as an empty template with the fields: file name, source page URL, retrieval date, size, page count, SHA-256, captured by.
2. Add a local script (for example `scripts/hash-source.mjs`) that prints the SHA-256 and size of a file given as an argument. No network access.
3. Add `curriculum/subjects.provisional.json` exactly as supplied with this package (88 rows, status `listed`, verification `V1`, `units: null`). Do not edit its content.
4. Define the transcription format for the Paper I syllabus as a JSON Schema file in `curriculum/` (not in `packages/shared`; it moves into the shared package in M9.1): per unit the official number, verbatim title (English and Hindi), verbatim statements with their page numbers, the source document id, the transcriber, the verifier and dates. Add `curriculum/paper1.syllabus.json` with **no units** (an empty, valid file) and a checker script in plain Node, with no new dependency, that validates a file against the rules and prints coverage (units contiguous from 1; every statement has a page; both languages present; verifier differs from transcriber).
5. Do **not** fill in any syllabus text. People do that in M9.0.
* Acceptance: schema, template, scripts and the starter file committed; checker passes on the empty file and fails on deliberately broken examples (test cases included); no application code changed; no network use.

**Then stop** and send Claude the report for review. M9.0 itself is human work (roadmap §4).

### 11.3 M9.1 kickoff (issued after M9.0 sign-off and O-4 decisions)

An outline now, so nothing is a surprise; the detailed prompt will be written then.

* First: the query-shape contract test (X-1) and the X-4 regression script; then shared schemas; then functions; then pages; rules last.
* Files: new `packages/shared/src/curriculum.ts`; additive enums in `constants.ts`; new `functions/src/services/curriculum.ts` and a pure tree builder in `functions/src/domain/`; new endpoint rows in `endpoints.ts`; new pages under `apps/web/src/app/admin/curriculum/`; extend `/admin/catalogue`; remove the `SEED_SUBJECTS` fallbacks from `apps/web/src/lib/names.ts` and `apps/web/src/app/(site)/syllabus/page.tsx`; student pages read trees; S-1 in `firestore.rules` with extended `tests/rules` **only after approval**. Note the rules test's drift guard: every new collection added to `domain/paths.ts` must be classified in `tests/rules/firestore.rules.test.ts` or that test fails (private ones in `SERVER_ONLY`; `catalogueTrees` in a new public-get-only list; `subjects`, `units`, `topics` leave `PUBLIC_OPEN` if S-1 is approved).
* Not touched: engine files, `admin.ts` question functions (those are M9.2), `roles/*`.
* Authorisation requests expected: emulator-only first; then staging rules, then staging indexes (each separate), then staging functions, then staging data load of M9.0 files.

### 11.4 Authorisation request template (use for every cloud step)

> **Action:** (one sentence) **Project:** `ugc-mock-test-staging` **Exact command or call:** (verbatim) **What changes:** (documents, rules, indexes, functions) **What does not:** (explicit) **Reversible by:** (exact rollback) **Evidence after:** (what will be reported) **Needs:** the owner's "yes" in chat for this action.

### 11.5 Stop and ask when

* A source file cannot be captured, a syllabus statement is ambiguous, or Hindi text looks corrupted.
* Staging contains unexpected data, or a count differs from the documents.
* A test in the engine area fails, or a change would need an engine file outside an approved CE or PR.
* A required decision (O-1 to O-9) has not been made.
* Anything would be written to a cloud project.

### 11.6 Copy-ready prompt for Tasks A to C

> **UrEducator 2.0 — M9 Tasks A–C (docs commit, read-only staging facts, M9.0 preparation)**
>
> **Context.** M8.8.5 is accepted at commit `694999a`. The owner has approved the M9 architecture package (8 documents). This assignment contains no application code changes and no cloud writes.
>
> **Hard boundaries.** Work only in `ureducator-platform-v2`. Do not use the old repository. Do not touch production `ugc-mock-test` or the trial project `ur-educator`. No deployment, Hosting, rules, index, IAM, billing, secret or payment action. No Firestore writes. No changes to engine files (`scoring.ts`, `exam.ts`, `session.ts`, `clientExam.ts`, `useExam.ts`, `ExamScreen.tsx`, exam endpoints), to `roles/*`, or to the owner claim. Do not generate questions. Do not fabricate any syllabus text.
>
> **Task A.** Copy the eight supplied documents into `docs/` without editing them and make one commit containing only those files. Report `git status` and `git diff --stat`.
>
> **Task B (read-only; proceed only if the owner has authorised read access to `ugc-mock-test-staging` in this chat).** Report: counts of `questions` by `status` and of `versions`; ids and labels of `subjects`, `units`, `topics`; `mockTests` ids with status, blueprintId, paperId; count of `learningNotes`; the serialised size in bytes of the 150-question test's paper and answer-key documents. Read nothing under `roles`, `systemSettings`, `users` or student data. Issue no writes.
>
> **Task C.** Add `content-sources/README.md` and an empty `content-sources/MANIFEST.json` template; a local hashing script; `curriculum/subjects.provisional.json` exactly as supplied; a JSON Schema file for the Paper I syllabus transcription format; an empty valid `curriculum/paper1.syllabus.json`; and a plain-Node checker script with no new dependency and with tests (valid-empty passes; broken examples fail). Do not add anything to `packages/shared`. No network use. No syllabus content.
>
> **Acceptance.** (1) One docs-only commit. (2) Task B report contains counts and sizes only. (3) Task C files committed, checker tests pass, full existing test suite still passes with unchanged counts. (4) `git diff` shows no change to any engine file. (5) A report in the standard format with a verified-versus-assumed table and the list of authorisations used.
>
> **Stop** after reporting. Do not begin M9.1.

### 11.7 Files supplied with this package

The eight documents and `subjects.provisional.json` (starter data at verification level V1, to be replaced by human-verified data in M9.0).

---

## 12. Decisions requested from the owner (consolidated)

| ID | Decision | When |
|---|---|---|
| — | **Approve the architecture** (permits the docs commit and Tasks A to C) | Now |
| O-2 | Who downloads and hashes official files; who is the second verifier | Before M9.0 |
| O-3 | Obtain the December 2026 corrigendum and the updated bulletin | Before M9.0 |
| O-4 | Approve or reject S-1 to S-10 individually | Before the milestone each belongs to |
| O-5 | Rename workflow state `review` to `submitted` (after Task B's count) | Before M9.2 |
| O-8 | Hindi policy: required for all, for official PYQ only, or optional | Before M9.2 |
| O-7 | AI-assisted drafting policy | Before M9.3 |
| O-6 | Paper II priorities and subject reviewers | Before M9.4/M9.5 |
| O-1 | Legal position on official PYQ text (take legal advice) | **Before any PYQ is ingested** |
| O-9 | CE-1 to CE-4 and PR-1 and PR-2: approve, defer or reject each | Before the milestone each belongs to |

**Recommended first moves.** Approve the package; approve Tasks A and C; authorise Task B read-only; name the people for O-2; obtain the corrigendum (O-3). These need no deployment and unlock M9.0.
