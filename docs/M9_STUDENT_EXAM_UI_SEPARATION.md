# M9 — Student Exam UI Separation

| | |
|---|---|
| **Milestone** | M9 — Academic Content Foundation (design only) |
| **Baseline** | Commit `694999a` |
| **Author** | Claude (architecture and security lead) |
| **Date** | 5 November 2026 |
| **Status** | PROPOSAL. **No visual redesign is started or designed here.** This document only fixes the boundary so that a later, separate exam-screen milestone can change how the exam looks without touching content, grading or session logic. |

Evidence tags: **[C]** read in code at `694999a`; **[P]** proposal; **[?]** not verified.

---

## 1. Why this document exists

The assignment asks for a student exam screen that can later be restyled toward a familiar computer-based test layout, and says the CBT engine must not be disturbed while the academic content system is built. Both are met by one thing: a clear line between **what the exam knows** (server, session, answers, timing) and **how the exam is drawn** (layout, colours, palette shape, text).

Good news from inspection: the line mostly exists already. This document records where it is, where it leaks, and the smallest steps to make it dependable.

Three rules for M9:

1. **No restyling.** No layout, colour, typography or component changes to the exam screen in M9.
2. **No behaviour change.** Autosave, clock, submission, resume and local backup in `useExam` do not change.
3. **Content may add blocks, not meaning.** New question content (for example a table) is rendered by the view; the engine only carries it.

---

## 2. What exists today [C]

```
 Server (Cloud Functions)                          Browser
 ────────────────────────                          ───────────────────────────────────────────────
 startExam / getExamSession ──► session payload ──► useExam.ts (controller, 132 lines)
 saveResponses  ◄── dirty batch + seq ───────────── │  load · restore local backup · autosave · clock · submit · navigation
 submitExam     ◄── final responses ─────────────── │
                                                    ▼
                                           ExamScreen.tsx (view, 149 lines)  ── QuestionBody.tsx (content renderer, 21 lines)
                                           header · language toggle · timer · save state · section tabs
                                           question · options · palette · dialogs · mobile palette
                                                    ▲
                                           shared: Bubble, PaletteLegend (brand), Dialog/Button/Alert (ui)

 packages/shared/clientExam.ts : pure functions for responses, palette counts, save acknowledgement, time offset, warnings
 packages/shared/session.ts    : paletteStatus(), deadline helpers
```

| Piece | Owns | Does not own |
|---|---|---|
| `useExam` (controller) | Session load; reconciliation of server and device-backup answers; dirty tracking; monotonic autosave sequence; single in-flight save; retry back-off; server-offset clock; auto-submit at zero; leave-page guard; `goTo`, `choose`, `clear`, `mark`, `submit`; time-spent accounting | Any markup or styling |
| `clientExam.ts`, `session.ts` | Pure, tested rules | Anything with state |
| `ExamScreen` (view) | Layout, header, language toggle, palette arrangement, dialogs, copy | Calling the backend, timing, persistence |
| `QuestionBody` (renderer) | How a question's blocks are drawn | Which blocks exist |
| Server `sessionPayload` | What a student may see during the test | Presentation |

The student sees only: `sessionId`, clocks, `status`, `lastSeq`, `language`, `testTitle`, a reduced `blueprint` (duration, sections, marking, languages), the ordered `questions` and their saved `responses` **[C]**. No answer key, explanation or provenance is in this payload, and the paper is parsed through `PublishedPaperSchema`, which drops unknown fields **[C]**.

### 2.1 The engine's public boundary [C]

Everything the exam screen may ever ask the server is these five callables. Nothing else is needed to run an exam.

| Callable | Auth and limits [C] | In (summary) | Out (summary) |
|---|---|---|---|
| `startExam` | verified user; 30 per hour per uid; the engine also limits sessions per hour | `mockTestId`, `language`, `clientRequestId` | The session payload (below). Resumes an open attempt instead of creating a second one |
| `getExamSession` | signed-in owner of the session | `sessionId` | The same payload; ends the session if the deadline plus grace has passed |
| `saveResponses` | signed-in owner | `sessionId`, monotonic `seq`, changed `responses`, `currentQid?` | `{ ok, status, lastSeq, serverNowMs }`; duplicate and stale sequence numbers are harmless |
| `submitExam` | signed-in owner; 60 per hour | `sessionId`, `clientRequestId`, `finalSeq`, optional final `responses`, `reason` | Idempotent; late answers after the deadline are not accepted |
| `getExamResult` | signed-in owner | `sessionId` | Summary and breakdowns; the question review (key, explanation) only after the reveal time |

### 2.2 The assignment's two lists, mapped to where they live today [C]

**Core engine (must not change in M9)**

| Responsibility | Lives in |
|---|---|
| Session management, resume | `exam.ts` (`startExam`, `getSession`). The detail page calls `startExam` (which resumes an open attempt) and routes to `/app/exam?s=<sessionId>`; `useExam` then loads the session with `getExamSession` |
| Server clock and timer | `deadlineMs`, `serverNowMs` from the server; `remainingWithOffset` in `clientExam.ts` follows server time |
| Question delivery | `sessionPayload` (allowlist, section 5.1) |
| Autosave | `saveResponses` (server) and the single-flight loop in `useExam` |
| Mark for review | Stored as `marked` on each response; set by `useExam.mark`. The **button** is presentation |
| Answer-key protection | `answerKeys` collection, server only; returned only through `getExamResult` and its reveal policy |
| Submission | `submitExam` and `useExam.submit` |
| Server-side scoring and result calculation | `scoring.ts`, `exam.ts#finalise` |

**Student-facing presentation (free to change in the later milestone)**

| Responsibility | Lives in |
|---|---|
| Layout, header, timer appearance, status colours | `ExamScreen.tsx` and `Bubble`/`PaletteLegend` in the brand components |
| Question display | `QuestionBody.tsx`, `Options` inside `ExamScreen` |
| Question palette | `PalettePanel` (arrangement) over `paletteStatus` (meaning) |
| Navigation controls | Buttons in `ExamScreen` calling `goTo`, `mark`, `clear` |
| Language selector | Toggle in `ExamScreen` calling `setLang` |
| Instructions | `/app/tests/detail` page: instruction text, the "I have read" checkbox and the Start/Resume button (the entitlement, window and attempt checks it relies on are server-side) |
| Responsive behaviour | Tailwind classes and the mobile palette sheet |

---

## 3. Where the line leaks (coupling points)

| # | Finding | Evidence [C] | Risk to a future redesign | Remedy |
|---|---|---|---|---|
| U-1 | **The UI's data type is inferred from the server function.** `ExamData = Out<'getExamSession'>` is `Awaited<ReturnType<ENDPOINTS[...]['run']>>`. Any change to what `sessionPayload` returns silently changes the UI's types. | `useExam.ts`, `lib/types.ts` | A server edit can break a skin with no test failing | CE-2: a named, versioned DTO in `packages/shared` |
| U-2 | **The controller decides the next URL.** It calls `router.replace('/app/results?s=…')` after submit and on an ended session. | `useExam.ts` (`submit`, `flush`) | A new shell, an embedded exam or a test harness cannot choose its own destination | Return `status: 'ended'` and let the page route (PR-2) |
| U-3 | **User-facing sentences live in the controller** (screen-reader announcements, the offline submit message). | `useExam.ts` | Translation and tone changes need controller edits | Controller returns codes (`ten_minutes`, `offline`); the view owns wording (PR-2) |
| U-4 | **Content blocks are drawn by a fixed list.** `QuestionBody` draws passage, statements, match lists, a placeholder for images. A new block (table) is silently ignored. | `QuestionBody.tsx` | New content would be dropped on screen with no warning | PR-1: block renderer with an explicit "unsupported block" fallback |
| U-5 | **The paper snapshot copies the whole `content` object.** `publishMockTest` stores `content: v.content` as is. | `services/admin.ts#publishMockTest` | Anything placed inside `content` reaches students | Rule UR-2 below: nothing private may ever be placed inside `content` |
| U-6 | **Classification travels with every question during the test.** `PaperQuestion` includes `unitId`, `topicId`, `difficulty`; the UI does not use them. Scoring reads the answer key, not the payload. | `schemas.ts#PaperQuestionSchema`; `exam.ts` line using `k.unitId`; no use in `components/exam` | A skin could show them; they are a hint | CE-3 (already G-11) |
| U-7 | **Palette arrangement lives in the view and reads `blueprint.sections`.** That is correct, but the grouping rule (by section) is inline. | `ExamScreen#PalettePanel` | Low | Keep; document as view logic |
| U-8 | **E2E tests find controls by `data-testid`.** `option-<id>`, `mark`, `clear`, `save-next`, `open-submit`, `confirm-submit`, `submit-summary`, `timer`, `save-state`, plus `start-test` on the detail page. | `ExamScreen.tsx`, `tests/e2e/specs/*` | A skin that drops them breaks the suite | Treat the ids as part of the contract (section 6) |
| U-9 | **Language fallback is decided in the view.** The view shows English when Hindi text is missing and prints a note. | `ExamScreen`, `pickText` | Low | Keep; contract says Hindi may be absent per question (section 5.3) |
| U-10 | **Device-backup keys and shape** (`ur_exam_backup_<sid>`) are internal to the controller. | `useExam.ts` | Good as is | Keep private; document so no skin reads it |

None of these is a defect in the accepted engine. They are friction for later change.

---

## 4. Target layering [P]

```
 ┌─ Content (M9) ────────────────┐   authored, reviewed, published; frozen into the paper snapshot
 │  question version             │
 └──────────────┬────────────────┘
                │ publishMockTest copies an allowlist only (section 5.1)
 ┌──────────────▼────────────────┐
 │  Exam contract v1 (shared)    │   ExamSessionDTO, ExamQuestionDTO, ControllerState, ControllerCommands
 └──────────────┬────────────────┘   versioned, contract-tested, no UI imports, no Firebase imports
 ┌──────────────▼────────────────┐
 │  Controller  (useExam)        │   unchanged behaviour; returns state + commands only
 └──────────────┬────────────────┘
 ┌──────────────▼────────────────┐
 │  Exam shell (page)            │   chooses routes, wires controller to a skin
 └──────────────┬────────────────┘
 ┌──────────────▼────────────────┐
 │  Skin (today: ExamScreen)     │   layout and wording only. A future NTA-style skin replaces this layer
 │  + Question renderer          │   block registry: stem, passage, statements, match, table, image, group
 └───────────────────────────────┘
```

Rules for each boundary are in section 6.

---

## 5. The contract

### 5.1 What a student may receive during a test (allowlist) [P]

`ExamQuestionDTO` = exactly:

| Field | Source | Notes |
|---|---|---|
| `qid`, `version` | paper | Identity only |
| `sectionId` | paper | |
| `content.type` | question version | `mcq_single` or `mcq_multi` |
| `content.format` | question version | `plain` or `rich` (moved inside `content`; see data dictionary §4.3) |
| `content.stem`, `passage?`, `statements?`, `matchLists?`, `table?`, `image?` | question version | Localised text `{en, hi?}` |
| `content.options[]` | question version | `id` `a`–`f`, localised text |

Never sent before submission and the reveal policy: `correct`, `keyPolicy`, `explanation`, `conceptNote`, `resources`, `provenance` (including PYQ year, shift, source, verification state), `bloom`, `knowledgeDomain`, `estSolveSec`, `tags`, `searchTokens`, reviewer names, review comments, `checks`, `contentHash`, `dupState`, batch ids, `authoringMethod`, `aiDisclosure`.

Until CE-3: `unitId`, `topicId`, `difficulty` are also present **[C]** and are tolerated, not relied on. After CE-3 they are removed.

**Enforcement (already partly in place, to be made explicit)**
* The paper is stored from a fixed shape, and `loadPaper` re-parses it with a schema that strips unknown keys **[C]**.
* A contract test builds a question version with **every private field populated**, publishes it into a paper in the in-memory store, calls `startExam`, and asserts that the response contains no key outside the allowlist (deep check, including inside `content`).
* A second test asserts that the stored `publishedPapers` document contains no private key either (defence in depth: rules already deny client reads, but the data itself should be clean).

### 5.2 Rules that keep students from receiving private data [P]

| ID | Rule |
|---|---|
| UR-1 | `PaperQuestion` is an allowlist. Adding a field requires an explicit schema change, a contract-test update and security review. New question fields default to **private**. |
| UR-2 | **Nothing private may be placed inside `content`.** `publishMockTest` copies `content` whole **[C]**, so the content block is student-visible by definition. Explanation, notes, provenance and classification stay beside it in the version document. |
| UR-3 | The answer key is created with the paper and returned only through `getExamResult` and its reveal policy **[C]**. No M9 feature adds a second path. |
| UR-4 | A skin may not call `backend.call` for exam endpoints. It receives state and commands from the controller. |
| UR-5 | A skin may not compute time, scores, palette status or save sequence numbers; it renders what the controller and `paletteStatus` give it. |
| UR-6 | A skin may not read or write browser storage for exam data. |
| UR-7 | Result pages (after submission) may show PYQ details, difficulty, topic and explanations according to the reveal policy. They are not part of the exam screen. |

### 5.3 Language behaviour [P]

* A question's languages are those present in its text. Hindi may be missing for a given question; the view falls back to English and says so **[C]**.
* The language toggle lists only languages in `blueprint.languages` **[C]**. Subject-level medium rules (for example language papers) are a content matter; the blueprint for such a test lists only the languages that apply.
* Every rendered text carries `lang` so screen readers and fonts choose correctly **[C]** (`lang={lang}` in `QuestionBody`).
* A Devanagari-capable font must be available to the exam screen. The font choice is part of the later redesign; the contract only requires that the page declares `lang`.

### 5.4 Content blocks [P]

The renderer is a registry keyed by block name. M9 defines which blocks may exist; the later redesign decides how they look.

| Block | Present today [C] | M9 | Notes |
|---|---|---|---|
| `stem` | yes | — | Always required |
| `passage` | yes | — | Shown above the stem |
| `statements` | yes | — | Ordered I, II, III… |
| `matchLists` | yes | — | List I / List II |
| `options` | yes | — | A–F letters shown by the view |
| `table` | no | **add** | Header row plus rows of text cells; no merged cells; horizontal scroll on narrow screens. Needed for Data Interpretation (Paper I) |
| Passage / data-set sharing | no | **no new block** | In the first release each member of a passage or data set repeats the shared `passage`/`table` (data dictionary §4.10), and the assembler keeps members contiguous. `setKey` is a private head field and is **not** sent to students. Showing a shared block once would need `setKey` added to the allowlist under rule UR-1 |
| `image` | placeholder text | unchanged | Real images need S-4 |
| Math | no | **add (when approved)** | Inline `$…$`, display `$$…$$`; requires S-9 and a Content Security Policy review |
| Unknown block | silently ignored | **explicit fallback** | The renderer shows a neutral notice "This part of the question cannot be displayed" and the controller records a client warning, so a missing renderer is visible in testing instead of silently dropped |

Rich text: `content.format = 'rich'` means restricted Markdown (bold, italic, lists, line breaks) plus LaTeX delimiters, **never HTML**. The renderer must not use `dangerouslySetInnerHTML` for content; it parses to elements. This is S-9.

### 5.5 Controller contract (the surface a skin may use) [P]

From today's `useExam` return **[C]**, frozen as `ExamController` v1:

State: `phase` (`loading | ready | submitting | error`), `error` `{message, ended}`, `data` (session DTO), `resp` (responses by `qid`), `cur` (index), `q` (current question), `lang`, `remaining` (ms), `warning` (`none | ten_minutes | one_minute | ended`), `announce`, `saveState` (`saved | saving | unsaved | offline`), `lastSavedAt`, `submitError`, `counts` (palette counts), `offsetMs`.

Commands: `goTo(i)`, `choose(optionId)`, `clear()`, `mark(on)`, `setLang(l)`, `flush()`, `submit(reason)`.

Changes proposed by PR-2 (small, behaviour-preserving): `announce` becomes a code instead of a sentence; the post-submit redirect moves out of the controller into the shell (the controller exposes `phase: 'ended'` with the result link target as data).

### 5.6 Behaviour the contract guarantees (existing tests plus new) [P]

| Behaviour | Existing test [C] | Added in the redesign milestone |
|---|---|---|
| Server-offset clock; ten-minute and one-minute warnings | `packages/shared/src/__tests__/clientExam.test.ts` (`remainingWithOffset`, `timeWarning`) | A skin-independent check that the displayed time equals `remaining` |
| Test auto-submits at zero; late submit cannot add answers; second submit is idempotent | `tests/e2e/specs/exam-edge.spec.ts` | — |
| Autosave sequence is monotonic; stale, duplicate and ended acknowledgements | `clientExam.test.ts` (`interpretSave`); `applySave` in `session.test.ts` | — |
| Answers survive reload; offline answers sync when the connection returns | `exam-edge.spec.ts` (two tests) | — |
| Palette states: not visited / not answered / answered / marked / answered and marked | `session.test.ts` (`paletteStatus`, `paletteCounts`); `student-flow.spec.ts` | The skin must show all five states and a count of each |
| Submit shows a summary and needs confirmation | `student-flow.spec.ts` | — |
| 150-question layout (50 + 100), 300 marks, 180 minutes | `exam-edge.spec.ts` | — |
| Phone layout without sideways scrolling; palette opens as a sheet | `mobile.spec.ts` | — |
| No automatically detectable accessibility violations on key pages | `student-flow.spec.ts` | Run on the new skin |
| Explicit keyboard-only operation of options and navigation | not found by name | **Add** |

---

## 6. Data-test-id contract

A skin must keep these test ids so the same end-to-end suite verifies any skin **[C]**:

`start-test` (detail page), `option-<id>`, `mark`, `clear`, `save-next`, `open-submit`, `confirm-submit`, `submit-summary`, `timer`, `save-state`.

New ids required when the corresponding block exists: `question-table`, `question-passage`, `lang-en`, `lang-hi`, `palette`. They are additive.

---

## 7. What M9 changes in the web app, and what it does not

| Change | Where | When | Approval | Risk |
|---|---|---|---|---|
| **PR-1** Render the `table` block and the unsupported-block fallback | `QuestionBody.tsx` only | M9.4 pilot (needed for Data Interpretation) | Owner approval; it is a view file used by the live exam | Low. Additive; no state, no network. The M8.8.5 browser flow rerun on staging |
| **PR-2** Controller returns codes instead of sentences and no longer navigates | `useExam.ts` and the exam page | Redesign milestone, not M9 | Owner approval | Medium: behaviour-preserving refactor of the accepted controller. Not required for the content programme |
| **CE-2** Named, versioned DTOs and contract tests | `packages/shared` | Early (M9.1 or M9.2) | Owner approval | Small; types only, plus tests |
| **CE-3** Remove classification from the pre-submission payload | `schemas.ts`, `admin.ts#publishMockTest`, `exam.ts` | Optional | Owner approval | Small; existing papers already stored with the fields remain readable (schema keeps them optional) |
| Remove the `SEED_SUBJECTS` fallbacks | `lib/names.ts` and `app/(site)/syllabus/page.tsx` | M9.1 | Within M9 (not exam files) | Low |

Not changed in M9: `useExam` behaviour, `ExamScreen` layout and wording, palette shape, colours, fonts, the exam route, the detail/instructions page, results pages.

**PR-1 is the only exam-screen edit M9 needs, and only for tables.** If the owner prefers not to touch the exam screen during M9, the Paper I pilot ships without Data Interpretation table items and they follow in the redesign milestone.

---

## 8. Future visual redesign strategy (not started; recorded so the boundary is tested against it)

**Approach: build the new screen beside the old one, behind a switch, and reuse the same tests.**

1. **Prerequisites.** CE-2 (frozen DTOs) accepted; PR-2 done; the contract tests in section 9 green. No server change is needed after that.
2. **A second skin, not a rewrite.** The new screen implements `ExamController` consumption only. It reuses `useExam` untouched and the question renderer (extended through PR-1). The current `ExamScreen` stays as the fallback skin.
3. **Selection by setting, not by code branch.** The exam page picks the skin from a staff-controlled setting (for example `systemSettings/examUi`, read by the page). The owner can switch back instantly. This is a new setting document and therefore a rules and data item to be reviewed in that milestone, not now.
4. **Same tests.** The end-to-end suite in section 6 runs against both skins (the test ids are the contract). Accessibility, mobile and the behaviour table in section 5.6 must pass on the new skin before it is offered.
5. **Staged rollout.** Staging only first; then an opt-in flag for a small set of users; then default. Production steps follow the project's authorisation rules.
6. **What the redesign may change.** Header strip and candidate panel; side palette with the five states and counts; section tabs; question panel; wording of buttons such as "Save & Next", "Mark for Review & Next", "Clear Response"; instruction and system-check screens; colours, typography, iconography; full-screen prompts; responsive behaviour; Devanagari typography.
7. **What it may not change.** Anything in the core-engine table in section 2.2; the allowlist in section 5.1; the rules in section 5.2.
8. **Identity and marks.** The redesign uses UrEducator's own identity. It must not use NTA or government logos, emblems or wording that suggests an official platform. A familiar *workflow* (palette, marking states, section tabs) is fine; copying official branding is not.
9. **Content and the skin evolve independently.** Because questions reach the screen only as allowlisted blocks (section 5.4), a new skin needs no change to the question bank, workflow or imports, and new content blocks need no change to the engine.

---

## 9. Tests for this boundary

| # | Test | Level |
|---|---|---|
| T-U1 | Every private field populated on a question → published paper → `startExam` payload has only allowlisted keys (deep) | Integration, emulator or in-memory |
| T-U2 | Stored paper document has no private keys | Integration |
| T-U3 | `ExamSessionDTO` snapshot: adding or removing a field fails the test until the contract version is bumped | Contract (needs CE-2) |
| T-U4 | A question with an unknown block renders the fallback and does not crash | Component |
| T-U5 | A `table` block renders header and rows, scrolls horizontally at 320 px, has a caption | Component and mobile e2e (PR-1) |
| T-U6 | `content.format = 'rich'` containing `<script>` or `<img onerror>` renders as text, never as elements | Component (S-9) |
| T-U7 | Hindi-only and English-only questions render correctly; missing Hindi falls back with the notice | Component |
| T-U8 | The M8.8.5 browser flow (start, resume, autosave, submit, score) passes unchanged on staging after PR-1 | Staging acceptance |
| T-U9 | No file under `components/exam` imports from `firebase/*` or calls `backend.call` except `useExam` | Static check (UR-4) |

---

## 10. Not decided here

Visual design, layout, typography, colour, iconography, animation, instructions screens, candidate panel, calculator or rough-work tools, full-screen enforcement, proctoring. All belong to the separate redesign milestone and need their own assignment.
