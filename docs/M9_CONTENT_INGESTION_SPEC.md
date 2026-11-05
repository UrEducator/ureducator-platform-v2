# M9 — Content Ingestion Specification

| | |
|---|---|
| **Milestone** | M9 — Academic Content Foundation (design only) |
| **Baseline** | Commit `694999a` |
| **Author** | Claude (architecture and security lead) |
| **Date** | 5 November 2026 |
| **Status** | PROPOSAL. Implemented in M9.3 after the question workflow (M9.2) exists. No import tool, parser or staging collection is built by this document. |

---

## 1. Purpose and non-negotiables

Bring authored or sourced academic content into the question bank in bulk **without** creating a way around review.

1. **An import can only create drafts.** No format, option, flag, role or retry path creates a question in any state above `draft`.
2. **Nothing is written to the bank before a person approves the batch**, and even then only the rows the person approved.
3. **Every row is validated by the same shared schemas as manual entry**, on the server. The browser's checks are a convenience.
4. **A failure is visible and recoverable**: each bad row is reported with the rule it broke, and a retry never creates duplicates.
5. **Writes are bounded**: small chunks, per-call limits, per-user budgets. No unbounded loop runs on the server.
6. **No automatic extraction from PDF into questions** in the first release (section 9).

---

## 2. Pipeline

```
 file (CSV / JSON / XLSX)                                   PDF source papers (evidence only)
        │                                                              │
        ▼  [browser, admin route only]                                 ▼
 PARSE  → normalise to row objects, compute file SHA-256        register as sourceDocuments (hash, pages)
        │                                                              │
        ▼  chunks of ≤200 rows, ≤1 MB per call                          └──► used as evidence by PYQ verification
 STAGE  adminImportStageRows ──► importBatches/{id}/rows/{rowNo}   status: staged
        │
        ▼  server, per row
 VALIDATE  schema · required · taxonomy · language · provenance · key · duplicates · safety
        │      → status: valid | invalid | duplicate_exact | duplicate_near   (+ issues[])
        ▼
 PREVIEW   counts, issue table, sample rows, failed-rows download           (nothing in the bank yet)
        │
        ▼  person with imports.approve (default: not the uploader)
 APPROVE   choose rows (valid, or valid + acknowledged warnings)           status: approved
        │
        ▼  adminImportCreateDrafts, repeated by the client, ≤100 questions per transaction
 CREATE    head + version(status draft) + event + fingerprint               status: created | failed
        │
        ▼
 normal question workflow: submit → review → approve → publish (workflow spec)
```

---

## 3. What an import cannot do

| Attempt | Outcome |
|---|---|
| A column or JSON field called `status`, `published`, `approved`, `verified`, `officialPyqVerified`, `reviewedBy`, `liveVersion`, `contentHash` | Ignored and reported as warning `IGNORED_FIELD`; never copied |
| `provenance_kind = official_pyq` in a file | Allowed as a **claim** only. The row is created as a draft with `pyqVerification.status = unverified` and goes through section 5 of the workflow spec |
| A role that only has `content_editor` | May stage and validate its own batches; cannot approve a batch |
| Approving a batch the same person uploaded | Refused unless `systemSettings/contentWorkflow.allowSelfApproveImport` is true (default false; owner only) |
| Re-running create on a completed batch | No-op: rows already `created` are skipped |
| Staging rows for a subject or topic that is not `verified+` | Row `invalid` (`TAXONOMY_NOT_VERIFIED`) |
| Loading `synthetic_demo` rows into verified taxonomy | Row `invalid` (V-Q-14) |
| More than the configured share of rows flagged `ai_assisted` without a named human reviewer per row | Batch refused at stage time |

Invariant I-7 in the workflow spec is the automated test for this section.

---

## 4. Formats

All formats map to the same row object (section 4.5). Files are UTF-8. The browser reads them locally; the file itself is never uploaded in the first release (no Storage change, ADR-5).

### 4.1 CSV

* UTF-8, with or without a byte-order mark; comma delimiter; double-quote quoting; one question per row; header row required, names case-insensitive; unknown columns are listed as `IGNORED_FIELD`.
* A cell that begins with `=`, `+`, `-` or `@` is **kept as text** and never evaluated. When the failed-rows file is produced, such cells are prefixed with a single quote so a spreadsheet will not run them (CSV-injection protection).
* Multi-valued cells use `|` (for example `correct = a|c`, `tags = high-yield|pyq-pattern`).

### 4.2 JSON

* A single object `{ "schemaVersion": 1, "questions": [ … ] }`. Each question has the nested shape of the row object.
* Maximum 2,000 questions per file; larger banks are split into several files (several batches).

### 4.3 Excel

* `.xlsx` only. `.xlsm`, `.xls` and files with macros or external links are refused.
* The first worksheet named `Questions` is read. Every cell is read as text; formulas are never evaluated (the cached value is used and flagged `FORMULA_CELL` as a warning); dates must be typed as text (for example `2024-06`).
* A spreadsheet-reading library is a **new dependency** for the admin area only (decision for Antigravity: choose, pin an exact version, check its licence, load it lazily on the import page, and keep it out of the student bundle; the existing `verify-bundle` scanner must still pass).

### 4.4 Manual and structured entry

The Question Editor (the same code path and schemas) is the manual route. A "Save and add another" mode and a template-based quick-entry form support high-volume typing without any import.

### 4.5 Row object (columns / fields)

`R` required, `C` required if the stated condition holds, `O` optional.

| Column | Req | Notes |
|---|---|---|
| `rowRef` | O | The author's own reference (shown in reports) |
| `subjectCode` | R | Official code string, for example `00`, `08` |
| `unitNo` | R | Official unit number; resolved to the unit id for the live syllabus version |
| `topicId` | R | Editorial topic id (ids, not names, so renames cannot break files). A "taxonomy export" from the Curriculum Manager provides them |
| `subtopicId` | O | Must exist on the topic |
| `setKey` | O | Group key for passage or data-set questions |
| `difficulty` | R | `Easy`, `Moderate`, `Difficult` (stored as `easy`, `medium`, `hard`); lowercase storage ids are also accepted |
| `bloom` | R | `remember … create` |
| `format` | R | `direct`, `statement_based`, `assertion_reason`, `match`, `passage_set`, `data_set`, `sequence`, `numerical` |
| `knowledgeDomain` | R | `factual`, `conceptual`, `procedural`, `metacognitive` |
| `estSolveSec` | R | 10–600 |
| `type` | R | `mcq_single` or `mcq_multi` |
| `stem_en`, `stem_hi` | R, C | `stem_en` always (the platform's primary text); `stem_hi` required when `languages` includes `hi` |
| `passage_en/hi`, `statement_1_en` … `statement_8_en` (and `_hi`) | O | |
| `list1_1_en` … / `list2_1_en` … | O | Match lists (`match` format) |
| `table_json` | O | A JSON string `{columns:[…], rows:[[…]]}` |
| `opt_a_en` … `opt_f_en` (and `_hi`) | R | At least two; four expected |
| `correct` | R | Option letters joined by a vertical bar, for example `a\|c` |
| `explanation_en`, `explanation_hi` | C | Required for `original` and `adapted` |
| `concept_note_en`, `concept_note_hi` | O | |
| `languages` | R | `en` or `en\|hi` |
| `provenance_kind` | R | `original`, `adapted`, `official_pyq`, `licensed`; `synthetic_demo` only into sample taxonomy |
| `copyright_status` | R | `own_work`, `licensed`, `public_domain`, `unknown` |
| `source`, `source_year` | O | Free text |
| `adapted_from_kind`, `adapted_from_ref`, `adapted_note` | C | Required for `adapted` |
| `licence_licensor`, `licence_ref` | C | Required for `licensed` |
| `pyq_cycle`, `pyq_year`, `pyq_session`, `pyq_date`, `pyq_shift`, `pyq_paper_type`, `pyq_subject_code`, `pyq_question_no`, `pyq_official_qid`, `pyq_source_doc_id`, `pyq_source_page`, `pyq_key_doc_id`, `pyq_key_status`, `pyq_source_language` | C | Required for `official_pyq` |
| `authoring_method` | R, default `human` | `human` or `ai_assisted` |
| `ai_tool`, `ai_reviewer_uid` | C | Required for `ai_assisted` |
| `tags` | O | ≤8 |

Template files (a CSV header row and a one-row example marked as an example, not content) are produced by the Bulk Import Manager. The example row text is a placeholder such as "EXAMPLE ONLY — replace" and is refused if left unchanged (`TEMPLATE_ROW`).

---

## 5. Staging model

### 5.1 `importBatches/{batchId}`

| Field | Description |
|---|---|
| `createdBy`, `createdAtMs` | |
| `fileName` (sanitised, ≤120 chars), `fileSha256`, `format`, `schemaVersion` | The browser computes the hash so a re-upload of the same file is noticed |
| `rowCount` | Declared at the start; staging fails if the total differs when the client finishes |
| `status` | `staging → validated → awaiting_approval → approved → creating → completed \| completed_with_errors \| cancelled \| expired` |
| `counts` | `{ staged, valid, invalid, duplicateExact, duplicateNear, warnings, approved, created, failed, skipped }` |
| `options` | `{ allowWarnings: boolean }` set at approval |
| `approvedBy`, `approvedAtMs` | |
| `lease` | `{ owner, expiresAtMs }` so two tabs cannot create at once |
| `expireAt` | For a TTL policy (S-5), or cleaned up by a function if not approved |

### 5.2 `importBatches/{batchId}/rows/{rowNo}`

`{ rowNo, status, issues: [{rule, severity: 'error'|'warning', field, message}], normalized: <question payload as the save endpoint would take it>, fingerprint, dupOf: [{qid, score}], createdQid?, attempts, lastError? }`

Row status: `staged → valid | invalid | duplicate_exact | duplicate_near → approved → created | failed | skipped`.

### 5.3 Limits (configuration; values are the author's starting proposal and must be measured)

| Limit | Value |
|---|---|
| Rows per batch | 2,000 |
| Rows per stage call | 200, and payload ≤1 MB |
| Open (not completed or cancelled) batches per user | 3 |
| Rows staged per user per day | 6,000 |
| Questions created per transaction | 100 |
| Create calls in flight per batch | 1 (lease) |
| Reads allowed for duplicate checks per batch | 20,000; above that the batch is refused with "split the file" |
| Staged text size per row | 200 KB |

---

## 6. Validation

Each rule produces `{rule, severity, field, message}`. Errors make the row `invalid`; warnings must be acknowledged at approval.

| Stage | Checks | Rule ids |
|---|---|---|
| 1 Structure | Header present; known columns; no duplicate headers; row count matches; file hash recorded | `FILE_*` |
| 2 Schema | Types, enum values, lengths, option ids, `correct` ⊆ options, single-answer has one key | V-Q-01 to V-Q-04 |
| 3 Required fields | Everything marked R or C in §4.5 | `REQUIRED_*` |
| 4 Taxonomy | Subject code exists and is `verified+`; unit number resolves in the live syllabus version; topic belongs to that unit; sub-topic exists | V-Q-08 |
| 5 Language | `languages` matches the text present; Hindi share of Devanagari letters ≥60%; the subject's `mediumPolicy` primary-language text present; mixed-script warning | V-Q-06, V-Q-15 |
| 6 Provenance and source | Required blocks for the kind; for `official_pyq` the `pyq_source_doc_id` and key document exist and are registered; `pyq_subject_code` matches; question number in range; `pyqKey` not already used | V-Q-09 |
| 7 Answer key and explanation | Key present; explanation present when required; explanation does not simply restate "option X is correct" without reasoning (warning, heuristic) | V-Q-04, V-Q-05 |
| 8 Duplicates | Section 7 | V-Q-11 |
| 9 Safety | No HTML tags; LaTeX delimiters balance; no control characters; no URLs in stems (warning) | V-Q-01, V-Q-12 |
| 10 Policy | `synthetic_demo` placement; `ai_assisted` share; `TEMPLATE_ROW` | V-Q-14 |

Validation is deterministic: the same row produces the same issues. Rules carry a `ruleset` version so a later change to the rules does not silently change old reports.

---

## 7. Duplicate detection

### 7.1 Normalisation (shared by import, manual save and the fingerprint index)

Unicode NFC; lowercase for Latin letters; remove punctuation and runs of whitespace; remove LaTeX control sequences but keep their arguments; map Devanagari digits to ASCII digits; sort options before hashing so reordering does not hide a duplicate. Hindi text is normalised the same way and compared only with Hindi.

### 7.2 Exact

`fingerprint` = first 32 hex of SHA-256 over normalised English stem + sorted normalised English options + sorted normalised correct-option texts. Checked in three places: within the file (in memory), against `questionFingerprints/{fingerprint}` (point reads, at most 100 per call), and again inside the create transaction using `tx.create` so a race cannot create two. A match makes the row `duplicate_exact` (not creatable).

`pyqKey` (`{cycle}_{subjectCode}_{shift}_Q{no}`) is checked the same way for official PYQs.

### 7.3 Near

For each topic present in the batch, the server loads the heads of non-retired questions for that topic **once** (about 8–50 per topic at the scale in the architecture document, section 7), each head carrying a small MinHash signature of the normalised 3-word shingles (`sig`, 16 integers). The similarity between a row and a candidate is the fraction of matching signature slots. At or above **0.80** the row becomes `duplicate_near` with the candidate ids and scores; it can still be created, but it arrives with `dupState = flagged` and blocks approval until a reviewer decides (workflow spec §4.4). Shingle signatures for the incoming rows are computed in memory.

Cross-topic near-duplicates are not searched in the first release (the cost is not justified at pilot size); exact duplicates are caught everywhere through the fingerprint index. This is a stated limit, not an oversight.

### 7.4 Budget

Reads = (number of distinct topics in the batch × heads per topic) + (up to one point read per row for the fingerprint). The 20,000-read cap in §5.3 bounds it. The head's `sig` field is the reason near-duplicate checks do not need to read version documents.

### 7.5 Derived fields computed at creation

Computed by the server, never accepted from a file or a client: `fingerprint` (7.2), `sig` (7.3), `searchTokens` (English stem: lowercase, split on non-letters, drop tokens shorter than 3 characters and a short stop-word list, remove duplicates, keep the first 12), `preview` (first 140 characters of the English stem), `contentHash`, `rev` (starts at 1) and the subject's `paper`/`subjectCode`/`syllabusVersion` copies. The same function runs for manual saves, so imported and typed questions are indistinguishable except for `batchId`.

---

## 8. Approval and creation

### 8.1 Preview

The Bulk Import Manager shows: totals by status; a table of issues grouped by rule with counts; filters by status, rule and unit; the first 50 valid rows rendered exactly as a student would see them (including Hindi); and a **failed-rows download** (CSV with the original row number, the rule ids and plain-language messages; CSV-injection protected).

### 8.2 Approval

* Done by a person with `imports.approve` who is not the uploader (default).
* The approver chooses: *valid rows only*, or *valid rows plus rows with warnings* (each warning type acknowledged by name). Rows with errors, `duplicate_exact`, or unreviewed `duplicate_near` rows are not selectable (near-duplicates may be selected knowing they will be flagged).
* The approver ticks a statement that the content has been spot-checked: sample size at least `min(30, 10%)`, chosen at random by the system and shown in the preview; ticks are stored.
* The action sets selected rows to `approved` and the batch to `approved`. It creates **nothing** in the bank.

### 8.3 Creation

`adminImportCreateDrafts({ batchId })` is called repeatedly by the browser. Each call:

1. Takes or refreshes the batch lease (refuses if another call holds it).
2. Takes the next `approved` rows, at most 5 chunks of 100 per call (a design budget to keep within the function time limit; Antigravity to measure and adjust).
3. For each chunk, one transaction: re-check taxonomy status; `tx.create` the head, version (`status: draft`, `batchId` set), event (`action: import.create`) and fingerprint documents; question id `imp_{batchId}_{rowNo}`. If a create fails because the id or fingerprint already exists, the row is marked `created` (same batch and row: a retry) or `duplicate_exact` (someone else created the same text meanwhile).
4. Updates the row statuses and `counts`, and the subject's `contentStats` **once per call** (not per chunk) to stay within the sustained write rate on that document.
5. Returns `{ created, failed, remaining }`. The browser loops until `remaining = 0`.

If the browser closes mid-way, the batch stays `creating` with the lease expiring; reopening resumes. Nothing runs without a person's browser driving it, so there is no unattended bulk job.

### 8.4 Retry and cancel

* **Retry failed**: re-queues only rows in `failed` (with `attempts < 3`). Rows already `created` are never touched.
* **Cancel**: allowed before creation or between calls; remaining staged rows are deleted by a clean-up call or expire. Created drafts stay (they are ordinary drafts) and can be bulk-returned or retired by an admin.
* **Same file again**: the same `fileSha256` as a completed batch triggers a warning; duplicate detection catches the rows regardless.

---

## 9. PDF source documents

**Decision: PDFs are evidence, not a data source, in the first release.**

* Syllabus and question-paper PDFs are registered as `sourceDocuments` with their hash. Questions and syllabus statements are **typed or visually checked** by a person against the PDF.
* **Why not automatic extraction.** The one syllabus PDF that opened in the research session returned corrupted Devanagari text (source register §5). Legacy-font Hindi PDFs commonly do this. Automatic extraction would put wrong Hindi into the bank and make it look official. Even for English, the cost of a wrong key or a wrong option in an "official" item is high.
* **Assisted entry (allowed).** In the Question Editor a side panel can show a PDF the editor opens **from their own computer** (the file stays local), with fields for page and question number. This reduces mistakes without any upload or Storage change.
* **Later (not M9).** OCR or model-assisted extraction may be added as a *drafting aid* for English text, always flagged `ai_assisted`, always followed by the PYQ verification steps. It is not designed here.

---

## 10. Firestore limits and write budget

| Constraint | Design response |
|---|---|
| 500 writes per transaction or batch | 100 questions × 4 documents = 400 writes, +1 for the event batch marker at most; stays under 500 |
| 1 MiB per document | Question versions are a few KB; staged rows ≤200 KB by validation |
| Sustained writes to one document | `contentStats` updated once per create call; `importBatches/{id}` updated once per call |
| Function time limit | Fixed chunk counts per call; no loops that depend on data size on the server |
| Read cost | Duplicate checks bounded by the read cap; no full-collection scans |
| Index requirements | Listing batches and rows needs the shapes in data dictionary §10; they must be checked by the query-shape contract test |
| Cost of a mistake | 2,000-row batch ≈ 8,000 document writes to create, ≈ 2,000 to stage; deleting staged rows is another 2,000 (or TTL). Per-user daily budgets cap abuse |
| Orphaned data | Unapproved batches expire; created drafts remain but are only drafts |

Estimated elapsed time for a 2,000-row batch: stage ~10 calls, create ~4 calls of 500 rows, plus validation. **This is an estimate to be measured in the M9.3 emulator and staging runs, not a promise.**

---

## 11. Security

* Every import endpoint: authenticated, verified email, permission check on the server, App Check once enforced, rate limit, payload cap, audit entry (`import.stage`, `import.approve`, `import.create`, `import.cancel`) with counts only, never row text.
* No endpoint returns answer keys of other users' staged rows to anyone without `questions.write`/`review`; students have no access (invariant I-1).
* Filenames are sanitised and never used as paths. The file itself is not stored.
* Nothing in a row is trusted: all fields are re-validated at creation (taxonomy may have changed since staging).
* No HTML anywhere. Rich text is a restricted Markdown subset with LaTeX delimiters (S-9).
* Rows that name a person or contain emails or phone numbers are flagged (`PERSONAL_DATA`, warning) because questions should not contain them.
* Existing `roles/*` and `systemSettings/ownerClaim` are never read or written by import code.

---

## 12. Testing

| Level | Cases |
|---|---|
| Unit | Normaliser (Latin, Devanagari, digits, LaTeX); fingerprint stability under option reordering; MinHash similarity on known pairs; CSV parser (BOM, quotes, the vertical-bar separator, injection prefixes); each validation rule with passing and failing rows |
| Integration (emulator, in-memory store) | Stage → validate → approve → create produces only `draft`; retry after a forced failure creates each row exactly once; two simultaneous create calls (lease); cancel; same file twice; row count mismatch; a `content_editor` attempting approval; a reviewer outside scope |
| Boundary | 1,999 / 2,000 / 2,001 rows; 199 / 200 / 201 rows per call; a 1 MB payload; a batch that hits the read cap |
| Adversarial | Formula cells; HTML in stem; 10 MB cell; control characters; Hindi in Latin letters; a file claiming `status: published`; an `official_pyq` row naming an unregistered source |
| Security | Invariants I-1, I-2, I-7, I-12 |
| Fault | Process stops after the head is written and before the version (cannot happen inside one transaction; the test proves it) |
| Performance | Measure the stage, validate and create rates; record in the milestone report |

**Acceptance for M9.3** is in the roadmap.

---

## 13. Error codes (user-facing text lives in the interface, not here)

`FILE_EMPTY`, `FILE_TOO_LARGE`, `FILE_ROWCOUNT_MISMATCH`, `UNKNOWN_COLUMN` (warning), `IGNORED_FIELD` (warning), `REQUIRED_<field>`, `SCHEMA_<field>`, `TAXONOMY_UNKNOWN`, `TAXONOMY_NOT_VERIFIED`, `TAXONOMY_MISMATCH`, `LANG_MISMATCH`, `LANG_SCRIPT`, `PROVENANCE_<kind>`, `PYQ_SOURCE_UNREGISTERED`, `PYQ_KEY_EXISTS`, `KEY_MISSING`, `KEY_INVALID`, `EXPLANATION_REQUIRED`, `DUP_EXACT`, `DUP_NEAR` (warning), `UNSAFE_CONTENT`, `TEMPLATE_ROW`, `AI_SHARE_EXCEEDED`, `BATCH_LEASED`, `BATCH_STATE`, `BUDGET_EXCEEDED`, `FORMULA_CELL` (warning), `PERSONAL_DATA` (warning).
