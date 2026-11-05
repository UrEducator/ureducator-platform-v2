# M9 — Content Workflow Specification

| | |
|---|---|
| **Milestone** | M9 — Academic Content Foundation (design only) |
| **Baseline** | Commit `694999a` |
| **Author** | Claude (architecture and security lead) |
| **Date** | 5 November 2026 |
| **Status** | PROPOSAL. Builds on the workflow that exists today **[C]**: `draft → review → approved → published`, per-version status, separation of duties on approval, a copyright gate on publication, and an audit log. |

---

## 1. Principles

1. **One path to students.** Nothing reaches a student unless a person other than its author reviewed it and an authorised publisher released it. Imports, scripts and fixtures included.
2. **Published means immutable.** A version that is approved or published is never changed. A correction is a new version.
3. **A running exam never changes.** Students are served from a frozen paper snapshot. Editing, retiring or replacing a question cannot reach a session already started **[C]**.
4. **Verification is done by the server and by people, not declared by the author.**
5. **Every state change leaves a record in the same transaction** (ADR-10), so there is no published item without a trail.
6. **Small team first.** The design works with one owner, one admin and two or three editors or reviewers, with explicit, recorded overrides instead of silent shortcuts.

---

## 2. Question lifecycle

### 2.1 States

| State | Meaning | Students can get it? |
|---|---|---|
| `draft` | Being written or revised. Editable in place. | No |
| `submitted` | Automated checks passed; waiting in the review queue. | No |
| `in_review` | A subject reviewer has claimed it and is reviewing (the assignment's "Subject Review"). | No |
| `approved` | Content and key accepted. Waiting for a publisher. Immutable. | No |
| `published` | Live. May be placed into tests. Immutable. | Only through a published test snapshot |
| `retired` | Withdrawn from new use. Existing snapshots are unaffected. Immutable. | Only inside snapshots that already contain it |

The assignment's "Retired or Revised" maps as follows. **Revised** is not a state: it is version n+1 in `draft` while version n stays `published`. When n+1 is published, n becomes `retired` with reason `superseded`. **Retired** is a state.

Mapping from today's names **[C]**: `review` becomes `submitted`; `in_review` is new; `retired` is new. The rename is safe only if staging holds no questions (owner decision O-5; Antigravity confirms with a read-only count). Until then readers treat a stored `review` as `submitted`.

### 2.2 Diagram

```
                withdraw
        ┌───────────────────────────┐
        ▼                           │
     DRAFT ──submit──► SUBMITTED ──claim──► IN_REVIEW ──approve──► APPROVED ──publish──► PUBLISHED ──retire──► RETIRED
        ▲                  ▲                    │  │                  │                     │
        │                  └──── release ───────┘  │                  │                     └─ edit = new version n+1 (DRAFT);
        │                                          │                  │                        when n+1 publishes, n → RETIRED (superseded)
        └──────── return with reason ──────────────┴──────────────────┘
                    (change_request or rejection)
```

### 2.3 Transitions

"Scope" means the actor's `staffProfiles.subjectScopes` must contain the question's subject code (admins and the owner are implicitly all).

| # | From → To | Who (permission) | Preconditions | Effects |
|---|---|---|---|---|
| T1 | `draft → submitted` | Author or any editor (`questions.submit`) | All V-Q rules pass (data dictionary §9.1); no unresolved change request; for `official_pyq`, a complete `pyq` claim | Stores `checks`; sets `submittedBy/At`; event |
| T2 | `submitted → draft` | Author (withdraw) | — | Event |
| T3 | `submitted → in_review` | Reviewer in scope (`questions.review`) | Reviewer ≠ author; reviewer under `capacity` (warn only) | Sets `assignedReviewer`; event |
| T4 | `in_review → submitted` | The assigned reviewer, or admin | — | Clears assignment (release) |
| T5 | `in_review → approved` | The assigned reviewer (`questions.review`) | Reviewer ≠ author; **no unresolved change requests**; `dupState ≠ flagged` (the reviewer must clear or reject first); for `official_pyq`: `pyqVerification.status = dual_verified`; reviewer confirmed the checklist (§4.2) | Sets `approvedBy/At`; version becomes immutable; event |
| T6 | `in_review → draft` | The assigned reviewer | **Reason code and comment are mandatory** | Creates a `change_request` or `rejection` comment; author notified in the queue |
| T7 | `approved → draft` | Reviewer in scope, or admin | Reason and comment | Version stays immutable; the author continues on version n+1 (a new draft copied from it) |
| T8 | `approved → published` | Publisher (`questions.publish`: admin, super_admin, owner) | `copyrightStatus ≠ unknown` **[C]**; taxonomy still `verified+`; subject `mediumPolicy ≠ unknown`; `contentHash` unchanged; **publisher ≠ author** (see §3.2) | Sets `liveVersion`; if an older version was live it becomes `retired` (superseded) in the same transaction; event; `contentStats` updated |
| T9 | `published → retired` | `questions.retire` (admin, super_admin, owner) | Reason code and comment; the interface shows the draft and published tests that reference the question | Clears `liveVersion`; blocks new test assembly; **existing snapshots untouched**; event |
| T10 | `retired → (new draft)` | Editor | — | Copies content into a new version in `draft`. A retired version is never reopened |

**Removed:** today's `published → draft` **[C]**. Moving a published version back to draft would alter an immutable version. It is replaced by T9 plus a new draft (T10).

**Two kinds of return, one rule.** Any return to `draft` needs a reason and a comment, so authors are told what to fix and the record shows why.

### 2.4 Reason codes

`wrong_key`, `wrong_topic`, `unclear_stem`, `weak_distractor`, `bad_explanation`, `language_issue`, `duplicate`, `source_mismatch`, `copyright`, `outdated_syllabus`, `other`.

---

## 3. Roles and separation of duties

### 3.1 Permission matrix (proposal; `ROLES` unchanged **[C]**)

| Action | content_editor | subject_reviewer | admin | super_admin | owner |
|---|---|---|---|---|---|
| Create and edit own drafts | ✔ | ✘ | ✔ | ✔ | ✔ |
| Submit (T1), withdraw (T2) | ✔ | ✘ | ✔ | ✔ | ✔ |
| Claim, review, comment (T3, T4) | ✘ | ✔ (in scope) | ✔ | ✔ | ✔ |
| Approve, return (T5–T7) | ✘ | ✔ (in scope) | ✔ | ✔ | ✔ |
| Verify PYQ (§5) | ✘ | ✔ (in scope) | ✔ | ✔ | ✔ |
| Publish (T8) | ✘ | ✘ | ✔ | ✔ | ✔ |
| Retire (T9) | ✘ | ✘ | ✔ | ✔ | ✔ |
| Run an import (stage) | ✔ | ✘ | ✔ | ✔ | ✔ |
| Approve an import batch | ✘ | ✘ | ✔ | ✔ | ✔ |
| Edit curriculum drafts | ✔ | ✘ | ✔ | ✔ | ✔ |
| Review curriculum | ✘ | ✔ | ✔ | ✔ | ✔ |
| Publish curriculum | ✘ | ✘ | ✔ | ✔ | ✔ |
| Assemble and publish tests | assemble only | ✘ | ✔ | ✔ | ✔ |
| Manage `staffProfiles` | ✘ | ✘ | ✘ | ✘ | ✔ (and `roles.assign` holders) |
| Read answer keys in the editor | ✔ (own and reviewed items) | ✔ | ✔ | ✔ | ✔ |

All require a verified email address **[C]** and are checked on the server for every call. The browser hides buttons for comfort only.

### 3.2 Separation-of-duties rules

| Rule | Status |
|---|---|
| The approver of a version is not its creator | exists **[C]** |
| The reviewer who claims a version is not its creator | new |
| The publisher is not the creator | new, **configurable** (below) |
| PYQ verifiers are two different people, neither the creator | new |
| A curriculum verifier is not the person who entered the content | new |
| Nobody changes their own role **[C]**; nobody assigns the owner role **[C]** | exists |

**Small-team override.** With one admin and the owner as the only publishers, "publisher ≠ author" can block work. `systemSettings/contentWorkflow` holds `requireDistinctPublisher` (default **true**) and `ownerMayOverride` (default **true**). When the owner publishes their own item with an override, the event records `override: 'owner_self_publish'`, the interface shows it in the publishing dashboard, and the owner can turn the override off. An override is never available to an admin.

### 3.3 Subject scope

Reviewer scope comes from `staffProfiles.subjectScopes` (data dictionary §6.1). The server reads the profile on claim, review, approve and verify. A reviewer with no profile can review nothing. Existing `roles` documents are not changed (S-6).

---

## 4. Review

### 4.1 Queue

* Sorted oldest first; filters by subject, unit, topic, provenance, batch, author, age.
* "Claim next" takes the oldest item in the reviewer's scope that they did not author.
* A claim expires after 24 hours of inactivity and returns to `submitted`.
* A reviewer can hold at most `capacity` claims (default 25).
* Batch actions (§8) apply to claimed items only.

### 4.2 Reviewer checklist (shown in the interface; each box must be ticked to approve)

1. The stem is accurate, unambiguous and answerable without outside assumptions.
2. Exactly the keyed option(s) are correct; distractors are plausible and clearly wrong.
3. The explanation is correct and matches the key.
4. The topic and unit are right; difficulty and Bloom level are reasonable.
5. Hindi and English say the same thing (if both are present).
6. No copied text from a source that is not registered; provenance and copyright are right.
7. No duplicate or near-duplicate (the detector's list was looked at).
8. For PYQ: verification is `dual_verified` (the system enforces this).

The ticked boxes are stored in the `approval_note` comment.

### 4.3 Comments

Types: `comment`, `change_request`, `approval_note`, `rejection` (data dictionary §4.7). Rules: a `change_request` must be marked resolved by the author (with a reply) before T1 can run again; comments are append-only; no personal data in comment text.

### 4.4 Duplicates

`dupState = flagged` (near-duplicate found at save or import) blocks T5 until the reviewer chooses one of: **not a duplicate** (state becomes `cleared_by_reviewer`, with a note), **return to the author** (T6, reason `duplicate`), or **retire the other item** (admin). Exact duplicates are refused at save.

---

## 5. Official PYQ verification

Only items with `provenance.kind = official_pyq` use this path. The label "Official PYQ" appears only when the server-held `pyqVerification.status` is `dual_verified` (ADR-6).

| Step | Who | What they do | Server rule |
|---|---|---|---|
| 0 | Anyone with `questions.write` | Registers the question paper and the answer key as `sourceDocuments` (hash, pages) and, if new, the `pyqPapers` entry | A source with `verification = unverified` cannot be used |
| 1 | Author | Enters the question as a **claim** with the structured `pyq` block (cycle, subject code, question number, source page) | `officialPyqVerified` is not accepted from the client |
| 2 | Verifier A | Opens the registered paper at the stated page and checks **text** against the entry, both languages if both are present | Records a `text` step with `match` or `mismatch` |
| 3 | Verifier B (a different person) | Checks the **answer key** against the official key document (and its status: provisional, final, revised, dropped) | Records a `key` step |
| 4 | Server | Sets `dual_verified` when a matching `text` step and a matching `key` step exist from two different uids, neither the author | — |

**Reset rule.** Any later change to `content`, `correct` or `keyPolicy` returns the status to `unverified`.

**Revised or dropped key.** If the official key was revised or the question was dropped, the item carries `keyStatus` accordingly. A `dropped` item can be published for study with an explanatory note but cannot be placed in a scored test until CE-1 exists.

**Legal gate.** No PYQ may be created until the owner has made decision O-1 (policy on using official question text). The workflow supports PYQs; it does not decide whether they may be used.

---

## 6. Curriculum workflow

States for a subject's syllabus version, its units and its topics: `draft → in_review → verified → published → retired`.

| Transition | Who | Preconditions |
|---|---|---|
| `draft → in_review` | Editor (`curriculum.write`) | Source documents registered; units and statements entered; no unchecked Hindi text pasted from a PDF layer (the editor ticks "typed or visually checked") |
| `in_review → verified` (level `verified`) | Reviewer (`curriculum.review`), not the editor | Reviewer compared each unit's title and statements with the registered PDF; discrepancies logged |
| `verified → verified` (level `dual_verified`) | A second reviewer | Same check, independent |
| `verified → published` | Admin or owner (`curriculum.publish`) | V-C rules pass; `dual_verified` is required for the **exam-pattern facts** and recommended for syllabus text; the owner chooses. The publish function builds the catalogue trees |
| `published → retired` | Admin or owner | A newer version is published, or the subject is withdrawn |

**Changing a published syllabus.** Create version n+1 as a copy, edit it, and compare it side by side with n (the Content Version History screen). Publishing n+1 sets `retiredIn` on units and topics that disappear, `introducedIn` on new ones, and rebuilds the tree. Existing questions on a retired topic are listed for re-mapping; they stay valid for old tests.

**Labels.** `fully_verified` is derived, not typed: it is available only when the live syllabus version is verified and (for tests) the V-C and V-Q gates pass. The free-text `sourceRef` alone no longer qualifies **[C → changed]**.

---

## 7. Learning materials

Same states, transitions, scope and separation rules as questions, with these differences: a note cannot be approved without at least one citation (a registered source or a named textbook); no PYQ path; the reviewer checklist replaces items 2 and 3 with "facts accurate and consistent with the syllabus statement" and "no unattributed copying". Materials are shown to students only when `published`, through a read function, never directly from Firestore.

---

## 8. Batch operations

| Operation | Who | Limits |
|---|---|---|
| Submit selected drafts | Editor | ≤100 per call; each item still passes V-Q rules, failures are reported per item |
| Return selected items with one reason | Reviewer | ≤50 per call, claimed items only |
| Approve selected items | Reviewer | ≤50 per call; the checklist is ticked once and stored on each; items with unresolved flags are skipped and listed |
| Publish selected approved items | Admin or owner | ≤50 per call; each is its own transition and event; a partial failure never leaves a half-published item |
| Retire selected | Admin or owner | ≤50 per call |
| Assign reviewer | Admin | ≤100 |
| Change classification (unit, topic, difficulty, Bloom, tags) | Editor on drafts; admin on others | ≤100; changes to non-draft items are written as a metadata event and re-run V-Q-08 |

Every batch call is idempotent (repeating it changes nothing further) and writes one event per item.

---

## 9. AI-assisted drafting policy (proposal, decision O-7)

* Allowed only as a **labelled draft** (`authoringMethod = ai_assisted`, `aiDisclosure` with the tool and a named human reviewer).
* Never bulk-generated into the system. The ingestion path refuses a file where more than a configurable share of rows are `ai_assisted` without a per-row reviewer.
* Always goes through the normal review; a subject reviewer who is not the human reviewer named in the disclosure must approve.
* AI is never a source of truth for an answer key or for an official PYQ.
* The mentor feature **[C]** answers only from published, cited material; this policy does not change that.

---

## 10. Interplay with imports

An import creates **drafts only**, tagged with `batchId`. A batch approval by `imports.approve` only decides which staged rows become drafts; it does not submit, approve or publish anything. Each created question then follows T1–T8. There is no import option, flag or role that skips a step. (Ingestion spec §3.)

---

## 11. From published questions to a test

1. An editor assembles a draft test: manually or from a recipe, which resolves deterministically to `questionRefs` for review.
2. `publishMockTest` **[C]** checks: every referenced version is `published`; section counts match the blueprint; no unknown sections; paper size; `fully_verified` conditions.
3. M9 adds: topics inside the subject; `setKey` groups contiguous; for `fully_verified` all items non-synthetic and PYQs `dual_verified`; syllabus version `verified+`; subject `mediumPolicy` known.
4. The call creates the immutable `publishedPapers/{id}_vN` and `answerKeys/{id}_vN` and sets the test `published`.
5. Unpublish stops new attempts only **[C]**. Running sessions keep their `paperId`.

---

## 12. When a published question turns out to be wrong ("content incident")

Because published items are immutable and papers are snapshots, the repair is explicit and traceable.

| Step | Action | Effect on students |
|---|---|---|
| 1 | Anyone files a content report (ticket category `content` **[C]**) | None |
| 2 | A reviewer triages: confirm or dismiss. Confirmed → `retire` the question (T9) with reason | New tests cannot use it |
| 3 | Admin unpublishes affected tests (**[C]**); the affected tests are found through `questionUsage` (data dictionary §7.1) | No new attempts. Running sessions finish normally |
| 4 | Editor creates the corrected version (T10), it goes through T1–T8, a corrected test is published as paper version n+1 | New attempts get the correct paper |
| 5 | Decision on finished attempts: leave, or re-score. Re-scoring needs CE-1 and a new re-score function. It is not built in the first release | Results change only by an explicit, logged, owner-approved action |

No step edits a running exam.

---

## 13. Records, audit and retention

| Record | Where | Written | Kept |
|---|---|---|---|
| State change | `questions/{qid}/events/*` | Same transaction as the change | Permanently |
| Global audit | `auditLogs` **[C]** | After commit (existing helper) | Per existing policy |
| Comments | `questions/{qid}/comments/*` | On action | Permanently |
| Content hash | version document | At submit and again at publish | Permanently |
| Publish log | derived view over events with `to = published` | — | — |

Never stored in events or comments: answers in free text, tokens, personal data **[C comment on `audit()`]**. Events are append-only: no endpoint updates or deletes them.

---

## 14. Policy settings (`systemSettings/contentWorkflow`, owner-editable)

| Key | Default | Meaning |
|---|---|---|
| `requireDistinctPublisher` | true | Publisher must differ from the author |
| `ownerMayOverride` | true | Owner may self-publish with a recorded override |
| `nearDupBlocksApproval` | true | Flagged near-duplicates block T5 |
| `pyqRequiresDualVerification` | true | Cannot be switched off for `official_pyq` |
| `claimTimeoutHours` | 24 | |
| `reviewerCapacity` | 25 | |
| `aiAssistedShareLimit` | 0.2 | Import refuses files above this share |
| `explanationRequired` | true | For `original` and `adapted` |
| `hindiRequiredFor` | `official_pyq` | `all`, `official_pyq`, or `none` (decision O-8) |

---

## 15. Security invariants (each becomes an automated test in M9.2)

| ID | Invariant |
|---|---|
| I-1 | A student session or token can never read `questions`, `questionFingerprints`, `questionUsage`, `importBatches`, `learningMaterials`, `staffProfiles`, `contentStats`, `sourceDocuments`, `pyqPapers` or their subcollections |
| I-2 | A client request can never set `workingStatus`, `liveVersion`, `pyqVerification`, `checks`, `contentHash`, `dupState` or any `*By` / `*AtMs` field |
| I-3 | No call sequence available to `content_editor` alone reaches `published` |
| I-4 | A version in `approved`, `published` or `retired` is never modified (hash test) |
| I-5 | Approver ≠ author, claimer ≠ author, verifiers ≠ author and ≠ each other, enforced for every role except where `ownerMayOverride` is recorded |
| I-6 | A reviewer outside the subject scope gets `FORBIDDEN` on claim, review, approve and verify |
| I-7 | An import of any size produces zero questions in states above `draft` |
| I-8 | Editing, retiring or replacing a question changes no existing `publishedPapers` or `answerKeys` document and no running session |
| I-9 | Every transition produces exactly one event in the same transaction; a forced failure after the status write leaves neither |
| I-10 | `official_pyq` cannot be approved without `dual_verified`; editing resets it |
| I-11 | `synthetic_demo` cannot be attached to a `verified` or `published` taxonomy element or to a `fully_verified` test |
| I-12 | Existing `roles/*` documents and the owner claim are unchanged by any M9 function |
