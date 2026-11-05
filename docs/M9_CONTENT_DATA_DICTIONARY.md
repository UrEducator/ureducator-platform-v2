# M9 — Content Data Dictionary

| | |
|---|---|
| **Milestone** | M9 — Academic Content Foundation (design only) |
| **Baseline** | Commit `694999a` |
| **Author** | Claude (architecture and security lead) |
| **Date** | 5 November 2026 |
| **Status** | PROPOSAL. Nothing here exists in the repository yet except where marked **[C]**. |

**Tags.** **[C]** exists today (verified in code). **[new]** proposed collection or field. **[ext]** proposed extension of an existing collection. Field flags: **R** required, **O** optional, **S** written only by the server, **I** immutable once the owning version is `approved` or later.

**Back-compatibility rule (applies to every table).** Every new field is optional with a stated default, so documents written before M9 still parse. Readers treat a missing field as its default. No existing document needs to be rewritten for M9.1 to ship.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Ids | Pattern `^[A-Za-z0-9_-]{1,80}$` **[C]**. Ids never contain names (names change). Ids are never reused after retirement. |
| Subject id | `s{code}` where `code` is the official subject code as a string, for example `s00` (Paper I), `s08` (Commerce), `s107` (Statistics). Codes are strings because the bulletin prints `015` and `15` for the same subject (register D5). The older fixture ids (`paper1`, `sample-commerce`, …) **[C]** stay as they are. |
| Unit id | `{subjectId}-u{NN}`, for example `s00-u03` |
| Topic id | `{unitId}-t{NNN}`, for example `s00-u03-t012` |
| Sub-topic id | `{topicId}-s{NN}` |
| Question id | `q_{16 hex}` **[C]** (`newId('q')`). Imported questions use `imp_{batchId}_{rowNo}` so a retry cannot create a second copy. |
| Time | Epoch milliseconds, field names end in `Ms` **[C]** |
| Localised text | `{ en: string, hi?: string }` **[C]**. See §3.1 for the language-subject exception. |
| Counters | A `version` integer that increases by one on each accepted change **[C]** |
| Document size | Each document under 1 MiB (Firestore). Planning ceiling 100 KB for editorial documents, 800 KB for a published paper **[C]**. |
| Strings | NFC-normalised, no control characters, no HTML tags in any content field |

---

## 2. Collection map

```
sourceDocuments/{docId}                         [new]  private
pyqPapers/{pyqPaperId}                          [new]  private
subjects/{subjectId}                            [ext]  private after S-1
  syllabusVersions/{subjectId}_{n}  (top-level) [new]  private
units/{unitId}                                  [ext]  private after S-1
topics/{topicId}                                [ext]  private after S-1
catalogueTrees/{subjectId}  and  _index         [new]  public get (S-1)
questions/{qid}                                 [ext]  private      (head)
  versions/{n}                                  [ext]  private      (content, key, explanation, provenance)
  comments/{commentId}                          [new]  private
  events/{eventId}                              [new]  private      (state-change trail)
questionFingerprints/{fingerprint}              [new]  private
questionUsage/{qid}_{paperId}                   [new]  private      (which published papers contain which question version)
importBatches/{batchId}                         [new]  private
  rows/{rowNo}                                  [new]  private
learningMaterials/{mid}  /versions/{n}          [new]  private → published through a read endpoint
staffProfiles/{uid}                             [new]  private
contentStats/{subjectId}                        [new]  private
mockTests/{id}                                  [ext]  public only when published [C]
publishedPapers, answerKeys                     [C]    unchanged except optional keyPolicy (CE-1)
roles/{uid}                                     [C]    NOT modified
```

Relationships:

```
subject 1 ── n syllabusVersion          subject 1 ── n unit ── n topic ── n subtopic (inline)
unit n ── n officialStatement (inline)  topic n ── n officialStatement (officialRefs)
question n ── 1 topic (and unit, subject)    question 1 ── n version ── n comment / event
question n ── 0..1 pyqPaper              version n ── 1 sourceDocument (for PYQ / syllabus)
mockTest n ── n question version (questionRefs) ── frozen into publishedPapers + answerKeys
result.byUnit / byTopic ── keyed by the same unitId / topicId
```

---

## 3. Curriculum

### 3.1 `subjects/{subjectId}` [ext] — one per official subject plus Paper I

Existing fields **[C]**: `paper`, `name {en,hi?}`, `label` (`fully_verified | under_development | sample | coming_soon`), `sourceRef?`, `order`, `version`, `updatedAtMs`, `updatedBy`.

| Field | Type | Flag | Description and validation |
|---|---|---|---|
| `code` | string | R | Official code exactly as normalised: digits, zero-padded to at least two (`"00"`, `"08"`, `"107"`). Unique across subjects. |
| `printedCode` | string | O | The code as printed if different (`"015"` for Population Studies). |
| `officialName` | string | R | Exactly as printed in the bulletin's Annexure II, including umbrella titles. **Never edited by hand after verification.** |
| `name` | `{en, hi?}` | R **[C]** | Display name shown to students. May be shorter than `officialName`. |
| `paper` | `paper1 \| paper2` | R **[C]** | `s00` is `paper1`; all other subjects `paper2`. |
| `mediumPolicy` | `bilingual_en_hi \| language_paper \| english_only \| hindi_only \| unknown` | R, default `unknown` | Set by an editor from the official source. `unknown` blocks publication of tests for that subject. The bulletin has no per-subject table (register §3, D6). |
| `paperLanguages` | array of language codes | O | Languages of the question paper when `mediumPolicy = language_paper`, for example `["ta"]`. |
| `syllabusLanguages` | array of `en \| hi \| other` | O | Which syllabus files exist (register §4). |
| `currentSyllabusVersion` | integer | O, S | Points at the live `syllabusVersions` entry. Set only by the publish function. |
| `status` | `draft \| in_review \| verified \| published \| retired` | R, default `draft` | Curriculum lifecycle (workflow spec §6). Students only ever see `published`. |
| `label` | content label | R **[C]** | `fully_verified` requires `currentSyllabusVersion` with `verification ∈ {verified, dual_verified}`. A free-text `sourceRef` alone no longer qualifies. |
| `active` | boolean | O, default true | False hides the subject from new-attempt pickers without deleting history. |

### 3.2 `sourceDocuments/{docId}` [new] — evidence for syllabus records and PYQs

| Field | Type | Flag | Description |
|---|---|---|---|
| `kind` | `bulletin \| corrigendum \| notice \| syllabus_pdf \| question_paper \| answer_key \| other` | R | |
| `title` | string ≤200 | R | As printed. |
| `publisher` | string | R | For example "National Testing Agency", "University Grants Commission". Used only as a citation. |
| `url` | https URL ≤500 | O | Page the file was found on. Expiring or signed links are not stored. |
| `language` | `en \| hi \| other` | R | |
| `sha256` | 64 hex | R, I | Hash of the file the verifier actually opened. |
| `bytes`, `pages` | integers | R | |
| `retrievedAtMs`, `retrievedBy` | number, uid | R | Who downloaded it and when. |
| `publishedOn` | string `YYYY-MM-DD` | O | Only if the document itself states a date (the December 2026 bulletin does not, register §3). |
| `storageNote` | string | O | Where the evidence copy is kept (outside the app in the pilot). |
| `supersedes` | docId | O | For a corrigendum or replacement. |
| `verification` | `unverified \| verified \| dual_verified` | R, S | Whether the metadata (hash, pages, title) was checked by one or two people. |

### 3.3 `syllabusVersions/{subjectId}_{n}` [new]

| Field | Type | Flag | Description |
|---|---|---|---|
| `subjectId`, `version` | string, integer | R, I | Version 1 is the first verified record. |
| `label` | string | R | Human description, for example "UGC syllabus as listed on 2026-11-05". |
| `effectiveFrom` | string `YYYY-MM` or `unknown` | R | Exam cycle from which it applies. `unknown` is allowed and must be shown as such. Never guessed. |
| `appliesToCycles` | array of strings | O | For example `["2026-12"]`. |
| `sourceDocIds` | array of docId | R | Must be non-empty before `verified`. |
| `unitCount` | integer | R | Must equal the number of official units recorded. |
| `verification` | `unverified \| verified \| dual_verified` | R, S | |
| `verifiedBy` | array of `{uid, atMs}` | S | Two distinct uids for `dual_verified`; neither may be the person who entered the content. |
| `discrepancies` | array of `{ref, note, status}` | O | Differences between sources or languages, carried forward from the register. |
| `supersedes` | integer | O | Previous version number. |
| `status` | `draft \| in_review \| verified \| published \| retired` | R | |
| `createdBy`, `createdAtMs` | | R | |

### 3.4 `units/{unitId}` [ext]

Existing **[C]**: `subjectId`, `name {en,hi?}`, `order`, `objectives[]` (≤20 strings), `version`, `updatedAtMs`, `updatedBy`.

| Field | Type | Flag | Description and validation |
|---|---|---|---|
| `unitNo` | integer ≥1 | R | The official unit number. Contiguous within a syllabus version. |
| `officialTitle` | `{en?, hi?}` | R | Verbatim as printed. Never edited after verification. At least one language. |
| `introducedIn` | integer | R | Syllabus version where it first appears. |
| `retiredIn` | integer | O | First version where it no longer appears. |
| `officialText` | array of `{ no, text {en?,hi?}, page, sourceDocId }` | O | The verbatim statements under the unit. Each `text` language is typed or visually checked, **never pasted from a PDF text layer** (register §5). Cap 60 statements per unit, 1,500 characters each. |
| `status` | curriculum status | R | |
| `objectives` | array of strings | O **[C]** | Learning objectives are editorial and labelled as such in the interface. |

### 3.5 `topics/{topicId}` [ext]

Existing **[C]**: `subjectId`, `unitId`, `name`, `order`, `subtopics[{id,name}]` (≤40), `version`, `updatedAtMs`, `updatedBy`.

| Field | Type | Flag | Description and validation |
|---|---|---|---|
| `origin` | `official \| editorial` | R | `official`: the topic equals one official statement. `editorial`: a UrEducator grouping. Editorial topics are shown to students as "UrEducator topic". |
| `officialRefs` | array of `{unitNo, statementNos[]}` | R for `verified+` | Which verbatim statements this topic covers. A topic without refs cannot be `verified`, cannot be labelled "syllabus-aligned", and cannot carry `fully_verified` content. |
| `prerequisiteTopicIds` | array of topicId (≤8) | O | Same subject, or Paper I. Must be acyclic (checked on save). Used for study order and plan hints. |
| `objectives` | array of strings (≤10, ≤300 each) | O | Editorial. |
| `subjectNotes` | `{en?, hi?}` ≤2,000 chars | O | Short subject-specific note shown beside the topic. Long material belongs in `learningMaterials`. |
| `subtopics` | array of `{id, name {en,hi?}}` | O **[C]** | Name becomes localised (was a plain string). Old plain-string entries read as `{en: name}`. Promote to a collection only if sub-topics need their own notes (not in the first release). |
| `introducedIn`, `retiredIn` | integers | R, O | As for units. |
| `typicalWeight` | `{ min, max }` integers | O | Expected questions per full paper, **only** when taken from a documented source or from analysis of verified PYQs; never guessed. Feeds recipes. |
| `status` | curriculum status | R | |

### 3.6 `catalogueTrees/{subjectId}` and `catalogueTrees/_index` [new] — the only catalogue students read

Written by the publish function only. Public `get`, no `list`, no client write (S-1).

`_index`: `{ updatedAtMs, builtFromVersions, subjects: [{ id, code, paper, name, label, mediumPolicy, unitCount, treeVersion }] }` (about 88 entries).

`{subjectId}`: `{ id, code, name, label, treeVersion, syllabusVersion, units: [{ id, unitNo, name, order, topics: [{ id, name, order, subtopics: [{id,name}] }] }] }`. No editorial notes, no objectives unless published for students, no source ids.

Validation: built only from `published` elements within the effective range of the live syllabus version; size must stay under 400 KB or the build fails with a clear message.

---

## 4. Question bank

### 4.1 Head: `questions/{qid}` [ext]

Existing **[C]**: `subjectId`, `unitId`, `topicId`, `subtopicId?`, `difficulty`, `languages[]`, `preview`, `status`, `currentVersion`, `publishedVersion?`, `updatedAtMs`.

**Fix for G-6.** Two fields replace the single ambiguous status: `workingStatus` (status of `currentVersion`) and `liveVersion` (the version students can be given, or absent). For back-compat `status` keeps meaning `workingStatus`, and `publishedVersion` keeps meaning `liveVersion` but is **cleared** on retire or unpublish.

| Field | Type | Flag | Description and validation |
|---|---|---|---|
| `paper` | `paper1 \| paper2` | R, S | Copied from the subject. For filters. |
| `subjectCode` | string | R, S | Copied from the subject. |
| `syllabusVersion` | integer | R, S | Subject's live syllabus version when the question was last classified. |
| `unitId`, `topicId` | ids | R **[C]** | Server checks the chain subject → unit → topic exists, is `verified` or `published`, and is within its effective range (V-Q-08). |
| `subtopicId` | id | O **[C]** | Must exist on the topic. |
| `setKey` | string ≤40 | O | Shared by questions that belong to one passage or data set. The assembler keeps them together. |
| `difficulty` | `easy \| medium \| hard` | R **[C]** | Shown as Easy, Moderate, Difficult. |
| `bloom` | `remember \| understand \| apply \| analyze \| evaluate \| create` | R before submit | `create` is allowed only for learning activities; exam questions flagged with a warning. |
| `format` | `direct \| statement_based \| assertion_reason \| match \| passage_set \| data_set \| sequence \| numerical` | R before submit | How the item is built. Separate from `content.type`, which is how it is answered. |
| `knowledgeDomain` | `factual \| conceptual \| procedural \| metacognitive` | R before submit | The knowledge dimension of the revised Bloom taxonomy. **[P] interpretation of the assignment's "knowledge domain"; owner to confirm.** |
| `estSolveSec` | integer 10–600 | R before submit | Author's estimate. Replaced for analysis by observed time once data exists. |
| `languages` | array of `en`,`hi` | R **[C]** | Must equal the languages for which every text field is present (V-Q-06). |
| `provenanceKind` | enum | R, S | Copied from the live or current version. For filters. |
| `pyqKey` | string | O, S | `{cycle}_{subjectCode}_{shift}_Q{no}`. Unique among non-retired questions (duplicate rule). |
| `fingerprint` | string (hex, 32) | R, S | See §4.6. |
| `dupState` | `clear \| flagged \| cleared_by_reviewer` | R, S, default `clear` | |
| `authoringMethod` | `human \| ai_assisted` | R, default `human` | AI assistance is disclosed, never hidden (workflow spec §9). |
| `workingStatus` | question status | R, S | `draft \| submitted \| in_review \| approved \| published \| retired` |
| `currentVersion` | integer | R **[C]** | |
| `liveVersion` / `publishedVersion` | integer | O, S **[C]** | Cleared when no version is live. |
| `assignedReviewer` | uid | O, S | Set when claimed. |
| `batchId` | string | O, S | Import batch that created it. |
| `tags` | array ≤8 of strings ≤30 | O | Editorial tags (for example `high-yield`). |
| `searchTokens` | array ≤12 of lowercase strings | S | Derived server-side from the English stem (ingestion spec §7.5): lowercase, split on non-letters, drop tokens shorter than 3 characters and a short stop-word list, remove duplicates, keep the first 12. English only in the first release. Powers query shape 8. A convenience, **not** full-text search. |
| `sig` | array of 16 integers | S | MinHash signature of the normalised 3-word shingles of the English stem and options; used for near-duplicate detection without reading version documents (ingestion spec §7.3). |
| `rev` | integer | S | Incremented by every write to the head. Save calls send `expectedRev`; a mismatch returns `STALE_EDIT` so two editors cannot silently overwrite each other (Studio spec, final review part 7). |
| `preview` | string ≤140 | S **[C]** | |
| `createdBy`, `createdAtMs` | | R | |
| `retiredAtMs`, `retiredReason` | | O, S | |

### 4.2 Version: `questions/{qid}/versions/{n}` [ext]

Existing **[C]**: `version`, `content`, `correct[]`, `explanation?`, `provenance`, `createdBy`, `reviewedBy?`, `status`, `createdAtMs`, `statusChangedAtMs`.

Rule **[C]**: a draft version is edited in place; saving any version past `draft` creates the next version, so an approved or published version is never changed. M9 keeps that rule and adds `contentHash` so tampering would be visible.

| Field | Type | Flag | Description and validation |
|---|---|---|---|
| `status` | question status | R, S | Per-version. |
| `content` | object | R **[C]** | §4.3. Immutable from `approved`. |
| `correct` | array of option ids | R **[C]** | Immutable from `approved`. |
| `keyPolicy` | `single \| any_of \| all_correct \| dropped` | O, default `single` | Used by scoring only after CE-1 is approved. Until then the editor may only save `single` or the existing multi-answer behaviour. |
| `explanation` | `{en, hi?}` | R before submit for `original`/`adapted`; recommended for PYQ | **[C]** field. May use LaTeX. |
| `conceptNote` | `{en, hi?}` ≤1,500 | O | Short conceptual explanation beyond the answer rationale. |
| `resources` | array ≤5 of `{kind: material \| reference, ref, title}` | O | `material` points at a published `learningMaterials` id. `reference` is plain text (a title and citation), not a link, in the first release. |
| `provenance` | object | R | §4.4. |
| `pyqVerification` | object | S | §4.5. Only the verification function writes it. |
| `checks` | `{ruleset, at, passed, failures[]}` | S | Result of the automated checks run at submit. |
| `contentHash` | sha-256 hex | S | Over canonical `content` + `correct` + `keyPolicy`. |
| `createdBy`, `createdAtMs` | | R | |
| `submittedBy/AtMs`, `reviewedBy/AtMs`, `approvedBy/AtMs`, `publishedBy/AtMs`, `retiredBy/AtMs` | | S | Who and when for each step. |

### 4.3 `content` [ext of C]

Existing **[C]**: `type` (`mcq_single` or `mcq_multi`), `stem`, `passage?`, `statements?`, `matchLists?`, `image?` {storagePath, alt}, `options` (2–6, ids `a`–`f`), each text `{en, hi?}`, max 4,000 characters.

| Addition | Description and validation |
|---|---|
| `format` (`plain` or `rich`) | Default `plain`. `rich` = restricted Markdown plus LaTeX delimiters, never HTML (S-9). **Lives inside `content`** because `publishMockTest` copies only `content` into the student paper **[C]**; a flag kept beside it would never reach the renderer. |
| `table?` | `{ caption?: text, columns: text[1..12], rows: text[][≤30] }`, each cell ≤200 characters, all rows the same width. Covers most Data Interpretation items without images (ADR-8). |
| `image?` | Unchanged shape. Not usable until S-4. Save is refused when `storagePath` is set and S-4 is not approved. |
| Math | Inline `$…$` or `\(…\)` in `plain` or `rich` text; display `$$…$$`. Delimiters must balance. Rendering is a presentation concern. |
| Option count | NET items have four options; fewer or more is a warning, not an error. |

### 4.4 `provenance` [ext of C]

Existing **[C]**: `kind` (`original | synthetic_demo | licensed | official_pyq`), `source?`, `sourceYear?`, `copyrightStatus` (`own_work | licensed | public_domain | unknown`), `officialPyqVerified`.

Mapping to the assignment's four categories:

| Assignment term | `kind` | Notes |
|---|---|---|
| Official PYQ | `official_pyq` **[C]** | Requires the `pyq` claim and server-held verification. |
| Original practice question | `original` **[C]** | |
| Adapted question | `adapted` **[new]** | Requires `adaptedFrom`. |
| Synthetic technical fixture | `synthetic_demo` **[C]** | Shown as "Synthetic technical fixture". Cannot enter a `fully_verified` test **[C]**. |
| (kept) Licensed third-party | `licensed` **[C]** | Requires `licence`. Owner approval to use at all. |

| Field | Type | Flag | Description |
|---|---|---|---|
| `kind` | enum | R | |
| `copyrightStatus` | enum | R **[C]** | `unknown` blocks publication **[C]**. |
| `source`, `sourceYear` | string, int | O **[C]** | Free text citation. For PYQ the structured `pyq` block is the source of truth. |
| `authoringMethod` | `human \| ai_assisted` | R, default `human` | |
| `aiDisclosure` | `{tool, humanReviewerUid}` | R if `ai_assisted` | A named human reviewer is mandatory. |
| `adaptedFrom` | `{kind: pyq \| external \| question, ref, note}` | R if `adapted` | `note` says what was changed. |
| `licence` | `{licensor, reference, expiresAtMs?}` | R if `licensed` | |
| `pyq` | object | R if `official_pyq` | Below. |
| ~~`officialPyqVerified`~~ | boolean | **removed from the save payload** | Kept readable on old documents. New rule derives "verified" from `pyqVerification.status`. |

`provenance.pyq` (a claim by the author, not a verification):

| Field | Type | Description |
|---|---|---|
| `examCycle` | `YYYY-MM` | For example `2024-06` |
| `year` | integer | |
| `session` | `June \| December \| other` | |
| `examDate`, `shift` | string, string | O |
| `paperType` | `paper1 \| paper2` | |
| `subjectCode` | string | Must match the question's subject for `paper2`; `00` for `paper1` |
| `questionNo` | integer 1–150 | As in the source paper |
| `officialQuestionId` | string | O. The identifier printed in the official answer key, if any |
| `sourceDocId`, `sourcePage` | docId, integer | R. The registered question paper and the page |
| `keySourceDocId`, `keyStatus` | docId, `provisional \| final \| revised \| dropped` | R. The answer key used |
| `sourceLanguage` | `en \| hi \| both` | Which language the text was taken from |

### 4.5 `pyqVerification` [new, server-owned]

```
{ status: 'unverified' | 'text_checked' | 'key_checked' | 'dual_verified',
  steps: [ { by: uid, atMs, kind: 'text' | 'key' | 'metadata', result: 'match' | 'mismatch', note?, pagesSeen?: [n] } ],
  lastResetAtMs?: number }
```

Written only by the PYQ verification function. Rules: a step requires a registered `sourceDocId` with `verification ≠ unverified`; `dual_verified` requires matching `text` and `key` steps from **two different uids**, neither the author; **any later change to `content` or `correct` resets the status to `unverified`** and records `lastResetAtMs`. The interface label "Official PYQ" is shown only for `dual_verified`.

### 4.6 `questionFingerprints/{fingerprint}` [new]

`{ qid, version, subjectId, topicId, createdAtMs }`. Document id is the exact-match fingerprint: SHA-256 (first 32 hex) of the normalised English stem plus the sorted normalised English options plus the sorted normalised `correct` texts. Normalisation: Unicode NFC, lowercase, remove punctuation and whitespace runs, remove LaTeX control sequences, map Devanagari digits to ASCII. Near-duplicate detection is described in the ingestion spec §6.

### 4.7 `questions/{qid}/comments/{commentId}` [new]

| Field | Type | Description |
|---|---|---|
| `version` | integer | Version the comment is about |
| `authorUid`, `atMs` | | |
| `kind` | `comment \| change_request \| approval_note \| rejection` | |
| `reason` | code | For `change_request` and `rejection`: `wrong_key`, `wrong_topic`, `unclear_stem`, `weak_distractor`, `bad_explanation`, `language_issue`, `duplicate`, `source_mismatch`, `copyright`, `other` |
| `text` | string ≤1,000 | No personal data |
| `field` | string | O. Which field it points at (`stem`, `option:b`, `explanation`, …) |
| `resolved`, `resolvedBy`, `resolvedAtMs` | | A change request must be resolved before re-submission |

### 4.8 `questions/{qid}/events/{eventId}` [new] — the authoritative trail (ADR-10)

`{ atMs, actorUid, actorRole, version, from, to, action, reason?, contentHash }`. Written **inside** the same transaction as the status change. Never edited or deleted. The existing `auditLogs` entry is still written as a global trail.

### 4.9 `pyqPapers/{id}` [new] — the register of official papers

Document id `{examCycle}_{subjectCode}_{shift}`, for example `2024-06_08_S1`.

`{ examCycle, subjectCode, paperType, date?, shift?, totalQuestions, sourceDocId, keySourceDocId?, keyStatus, coverage: {transcribed, verified}, status: 'registered' | 'transcribing' | 'complete', createdBy, createdAtMs }`. The PYQ Verification Manager works from this list. `coverage` is updated by the same transaction that links a question (never by counting at view time).

### 4.10 Question groups — deferred

A shared passage or data set is held in the first release by repeating `passage`/`table` in each member question and tying them with `setKey`. If this proves painful in the pilot, add `questionGroups/{gid}` (versioned like questions) and have `publishMockTest` copy the group text into each `PaperQuestion`, which the engine already supports. No engine change either way.

---

## 5. Learning materials [new]

`learningMaterials/{mid}` (head) and `/versions/{n}`, same pattern, states and rules as questions.

| Field | Type | Flag | Description |
|---|---|---|---|
| `kind` | `unit_note \| topic_note \| concept \| formula_sheet \| revision_summary \| study_guide` | R | |
| `subjectId`, `unitId`, `topicId?` | ids | R, R, O | Same taxonomy checks as questions |
| `title` | `{en, hi?}` | R | ≤160 characters |
| `body` | `{en, hi?}` | R (version) | Restricted Markdown plus LaTeX, ≤20,000 characters per language |
| `readingMinutes` | integer | S | Derived |
| `objectives` | array ≤8 | O | |
| `citations` | array ≤10 of `{sourceDocId?, text}` | R | At least one: a registered source or a stated textbook or reference (title and author). No uncited notes are publishable |
| `label` | content label | R | |
| `workingStatus`, `liveVersion` | | S | As for questions |
| `keywords` | array ≤12 | O | Used by the mentor retriever |
| `authoringMethod`, `aiDisclosure` | | | As for questions |

Back-compat: the existing `learningNotes` documents **[C]** keep working for the mentor until M9.6 moves retrieval to published `learningMaterials`.

---

## 6. Staff and permissions

### 6.1 `staffProfiles/{uid}` [new] — leaves `roles/*` untouched (S-6)

`{ uid, subjectScopes: string[] (subject codes, ≤20, or ["*"] for admin/owner), languages: ['en'|'hi'], active, capacity?: integer (open reviews at once), updatedBy, updatedAtMs }`.

A reviewer may claim or decide only items whose `subjectCode` is in `subjectScopes`. `admin`, `super_admin`, `owner` are implicitly `*`. A missing profile means no scope, so a reviewer without a profile can review nothing.

### 6.2 Permissions to add to `PERMISSIONS` [ext of C]

| Permission | Granted to (proposal) |
|---|---|
| `curriculum.write` | `content_editor`, `admin`, `super_admin`, `owner` |
| `curriculum.review` | `subject_reviewer`, `admin`, `super_admin`, `owner` |
| `curriculum.publish` | `admin`, `super_admin`, `owner` |
| `questions.submit` | same as `questions.write` (kept separate for clarity) |
| `questions.verify_pyq` | `subject_reviewer`, `admin`, `super_admin`, `owner` |
| `questions.retire` | `admin`, `super_admin`, `owner` |
| `imports.run` | `content_editor`, `admin`, `super_admin`, `owner` |
| `imports.approve` | `admin`, `super_admin`, `owner` |
| `materials.write`, `materials.review`, `materials.publish` | as for questions |
| `stats.read` | all editorial roles |

`ROLES` stay as they are **[C]**. No new role is introduced.

---

## 7. Assembly [ext of C]

`mockTests/{id}` keeps all existing fields **[C]**. Additions:

| Field | Type | Description |
|---|---|---|
| `assembly` | `manual \| recipe` | Default `manual` |
| `recipe` | `{ scope: {subjectId, unitIds?, topicIds?}, count, difficultyMix: {easy, medium, hard}, allowKinds: provenance kinds[], excludeSynthetic: boolean, seed: string }` | The recipe resolves **deterministically** to `questionRefs` for the editor to review. It never runs at exam time. |
| `syllabusVersion` | integer | Version the test was built against |

`publishMockTest` additions (none touches the engine): every referenced question's topic is within the test's subject scope; questions with the same `setKey` are contiguous; `fully_verified` additionally requires all questions non-synthetic, all PYQ items `dual_verified`, the subject's syllabus version `verified+`, and the blueprint verified **[C]** partially.

---

### 7.1 `questionUsage/{qid}_{paperId}` [new]

`{ qid, version, paperId, mockTestId, atMs }`, created with `tx.create` inside the `publishMockTest` transaction, one per question in the paper (at most 200, so at most about 203 writes in that transaction, below the 500 limit **[C: maxQuestionsPerPaper = 200]**). Never changed afterwards, because papers are immutable. It answers "which published tests contain this question?" without scanning papers, which the content-incident procedure (workflow spec §12) and the Content Version History screen need. Query: `qid ==` (single-field, automatic index).

---

## 8. Statistics [new]

`contentStats/{subjectId}`: `{ updatedAtMs, byStatus: {draft, submitted, in_review, approved, published, retired}, byUnit: { [unitId]: {status counts} }, byProvenance, byDifficulty, byBloom, pyq: {transcribed, verified} }`. Updated once per transaction that changes a status (sum of the transaction's changes). A reconcile call recomputes it on request. Dashboards read only these documents.

---

## 9. Validation rules

Server-side, using the same shared schemas as the browser. A rule marked **block** stops the save or the transition; **warn** is shown and recorded.

### 9.1 Questions

| ID | Rule | Effect |
|---|---|---|
| V-Q-01 | English stem non-empty, ≤4,000 characters, no HTML tags | block |
| V-Q-02 | Options 2–6 (NET style is four) | block / warn if ≠4 |
| V-Q-03 | Option texts differ after normalisation; no option equals the stem | block |
| V-Q-04 | `correct` ⊆ option ids; count matches `keyPolicy` and `type` | block |
| V-Q-05 | Explanation present before submit for `original` and `adapted` | block |
| V-Q-06 | `languages` includes `hi` only if the stem, every option and the explanation have Hindi text; Hindi text is at least 60% Devanagari letters (excluding digits, LaTeX, Latin acronyms) | block / warn |
| V-Q-07 | No leakage: stem and options must not contain the phrases "correct answer", "right answer", "answer is"; the explanation is never part of `content` | warn |
| V-Q-08 | Taxonomy chain valid, elements `verified+`, inside effective range; sub-topic exists | block |
| V-Q-09 | Provenance gates: `official_pyq` needs the `pyq` claim and registered sources; `adapted` needs `adaptedFrom`; `licensed` needs `licence`; `ai_assisted` needs a human reviewer; `copyrightStatus ≠ unknown` before publish **[C]** | block |
| V-Q-10 | `estSolveSec` 10–600; `bloom`, `format`, `knowledgeDomain` set before submit | block |
| V-Q-11 | Exact duplicate (fingerprint, or same `pyqKey`) | block; near-duplicate flags `dupState = flagged` |
| V-Q-12 | LaTeX delimiters balance; no HTML; length caps | block |
| V-Q-13 | Table limits (§4.3) | block |
| V-Q-14 | `synthetic_demo` cannot be saved against a `verified` or `published` taxonomy element | block |
| V-Q-15 | Medium policy: the primary-language text required by the subject's `mediumPolicy` is present | block |
| V-Q-16 | Self-approval and self-verification refused **[C for approval]** | block |

### 9.2 Curriculum

| ID | Rule |
|---|---|
| V-C-01 | A syllabus version needs ≥1 `sourceDocId`, each with a hash and `verification ≠ unverified`, before it can be `verified` |
| V-C-02 | `unitCount` equals the units recorded; `unitNo` contiguous from 1 |
| V-C-03 | Every verified unit has ≥1 `officialText` statement with a page number |
| V-C-04 | Every `officialRefs` entry resolves to an existing statement |
| V-C-05 | `dual_verified` needs two different verifiers, neither the author |
| V-C-06 | `fully_verified` label only on a subject whose live syllabus version is `verified+` |
| V-C-07 | Prerequisites acyclic and in scope |
| V-C-08 | `introducedIn ≤ retiredIn - 1`; an element cannot be retired while it has live questions without a replacement or an owner override |
| V-C-09 | Ids unique and never reused |
| V-C-10 | Tree build size < 400 KB |

---

## 10. Query shapes and indexes (input to S-3)

The final index list must be generated from the real query shapes by the permanent query-shape contract test recommended in Review #004 (item P-1), **not** from this table. Planned shapes on `questions` (all with `limit` and a cursor):

| # | Filter and order | Used by |
|---|---|---|
| 1 | `workingStatus ==` · order `updatedAtMs desc` | Status lists, review queue |
| 2 | `subjectCode ==` and `workingStatus ==` · `updatedAtMs desc` | Question Bank Manager |
| 3 | `subjectCode ==`, `unitId ==`, `workingStatus ==` · `updatedAtMs desc` | Unit view |
| 4 | `topicId ==`, `workingStatus ==`, `difficulty ==` | Test recipes |
| 5 | `assignedReviewer ==`, `workingStatus ==` · `updatedAtMs desc` | "My reviews" |
| 6 | `batchId ==`, `workingStatus ==` | Batch review |
| 7 | `provenanceKind ==`, `workingStatus ==` · `updatedAtMs desc` | PYQ manager |
| 8 | `searchTokens array-contains`, `subjectCode ==` · `updatedAtMs desc` | Search |
| 9 | `pyqKey ==` | Duplicate rule (single field, automatic) |

Also: `learningMaterials` (`topicId`, `workingStatus`, `kind`), `importBatches` (`createdBy`, `createdAtMs desc`), `questions/*/comments` (`resolved`, `atMs`).

---

## 11. Versioning rules in one place

| Thing | Rule |
|---|---|
| Question version | Draft edited in place; every change after `draft` creates version n+1; versions from `approved` are never changed |
| Published paper | Created once as `{mockTestId}_v{n}` with its key **[C]**; never edited |
| Syllabus | New `syllabusVersions` entry per change; units and topics live across versions by `introducedIn`/`retiredIn` |
| Catalogue tree | Rebuilt on publish; `treeVersion` increases; students always read the latest published tree |
| Learning material | Same as questions |
| Blueprint | Existing server-owned version **[C]** |

---

## 12. Coverage check against the assignment (§4–§5)

| Required item | Where it lives |
|---|---|
| Question id, paper, subject and code, unit, topic, subtopic, syllabus version, language | Head §4.1 |
| Stem, options, correct references, explanation, additional conceptual explanation, related resources, images, maths | Version §4.2, content §4.3 |
| Difficulty (Easy, Moderate, Difficult) | `difficulty` with labels |
| Bloom level | `bloom` |
| Question format | `format` (structure) and `content.type` (answering) |
| Knowledge domain | `knowledgeDomain` (**interpretation to confirm**) |
| Estimated solving time | `estSolveSec` |
| Provenance: PYQ, original, adapted, synthetic | `provenance.kind` §4.4 |
| PYQ year, session, subject code, source reference, question number or id, verification, document and page | `provenance.pyq` + `pyqVerification` §4.4–4.5 |
| Unverified never labelled official PYQ | `pyqVerification.status = dual_verified` is the only path to the label |
| Subject codes, versions, English and Hindi, units, topics, objectives, prerequisites, notes, question association, difficulty distribution, topic-wise tests | §3, §7 (`typicalWeight`, `recipe`) |
| No hard-coded curriculum in the frontend | `catalogueTrees` (§3.6); removal of the `SEED_SUBJECTS` fallback (architecture G-17) |
