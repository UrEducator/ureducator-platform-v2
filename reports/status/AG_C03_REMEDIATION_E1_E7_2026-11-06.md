# UrEducator 2.0 — Antigravity C-03 Final Remediation Report (E-1 through E-7)

> [!NOTE] F-Round Corrections Notice (11 November 2026)
> In accordance with Claude's independent review addendum (G-8):
> 1. Baseline assertion count is verified as **25 assertions** (not 20).
> 2. Baseline 75-probe comparison is clarified as **13 OK / 60 GAP / 2 CRASH** (shim-assisted comparison); reviewed checker is **72 OK / 3 GAP / 0 CRASH**.
> 3. Intermediate milestones (82 and 148 assertions) are marked as **historical, not independently reproduced**.
> 4. Final F-round test assertion count is **326 passed, 0 failed, 0 skipped**.
> 5. SHA-256 validation is scoped to format and value validation (does not compute PDF bytes or read MANIFEST.json).
> 6. Devanagari validation is scoped to presence of at least one Devanagari character (weak check; see T-5).

**Date**: 6 November 2026 (Updated 11 November 2026)  
**Primary Writer / Developer**: Google Antigravity  
**Independent Reviewer**: Claude (Senior Architecture & Security Lead)  
**Coordinator**: ChatGPT  
**Working Repository**: `C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2`  
**Branch**: `main`  
**Baseline Commit**: `d34b2230847e4f11bf3f52f6d6e7b3f93bdaf0bb`  
**Target Release**: UGC NET Paper I Private Pilot (14 November 2026)  
**Status**: **COMPLETE — AWAITING CLAUDE RE-REVIEW AND OWNER APPROVAL**

---

## 1. Repository Identity, Baseline Ancestry & Staging Isolation

Before and throughout this remediation round, repository identity, branch, baseline ancestry, and staging isolation were strictly verified in accordance with Phase 0 rules:

- **Repository Root**: `C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2`
- **Current Branch**: `main`
- **Current HEAD**: `d34b2230847e4f11bf3f52f6d6e7b3f93bdaf0bb`
- **Baseline Ancestry Check**: `git merge-base --is-ancestor d34b223 HEAD` exited with code `0`.
- **Staging Isolation**: `git diff --staged` produced 0 lines (clean index).
- **Prohibited Workspaces**: The separate Desktop School ERP repository (`C:\Users\subha\Desktop\UrEducator Ecosystem`) was **never accessed or modified**.

---

## 2. Itemized Response to E-1: Documentation Correction & Traceability Restoration

All three prior documentation reports were updated to restore exact historical facts, probe results, test assertion progression, and task traceability:

### 2.1 Documents Updated
1. [`reports/status/PAPER1_CORRECT_REPOSITORY_RESTART_2026-11-06.md`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/reports/status/PAPER1_CORRECT_REPOSITORY_RESTART_2026-11-06.md):
   - **Baseline History Correction (Lines 56–60)**: Corrected to state that `scripts/test-curriculum-checker.mjs` was **already present** in baseline `d34b223` (introduced in commit `0502038`). Baseline `scripts/check-curriculum.mjs` was **not an empty stub** that unconditionally exited 0; it had real validation logic and exit paths (exiting 1 on missing args, missing file, invalid JSON, or invalid validation result). C-03 added the `--release` flag, exit code 2 for flag errors, V3 dual-verification enforcement, NFKC identity normalization, format/value SHA-256 validation, anti-promotion guards, and symlink-safe entry guards.
   - **Probe Progression (Section 3.4)**: Documented that the unchanged 75-probe harness cannot run directly against baseline `d34b223` because baseline `check-curriculum.mjs` does not export `CANONICAL_PAPER_1_UNITS`. With a one-line import shim, Claude measured **13 OK / 60 GAP / 2 CRASH** against baseline (shim-assisted comparison). In the reviewed E-round, the checker achieved **72 OK, 3 GAP, 0 CRASH** (exit 0), and this exact result is confirmed in the final F-round:
     - Probe `V6` corresponds to **T-7** (Stable reviewer IDs and ordered, calendar-valid dates).
     - Probe `V12` corresponds to **T-2** (Record Hindi-capable verifier proficiency).
     - Probe `B7` corresponds to **T-3** (Per-language provenance).
     - The remaining gaps did **not** correspond to T-1 or T-8.
   - **Restoration of Original T-1 through T-8 (Section 3.5)**: Fully aligned with the canonical task definitions.
   - **Clear Separation of Operational Tasks O-1 through O-4 (Section 3.6)**: Distinctly separates code governance from external operational prerequisites.
   - **Test Count Progression (Section 3.2, 5)**: Clarified baseline (25, independently verified: 25 passed, 0 failed, exit 0), initial C-03 (82, historical AG-reported), post C-1..C-5 (148, AG-reported on Windows / 145 pass + 1 fail on Linux), reviewed E-round (209 assertions, reproduced), and final F-round (**326 assertions**, 0 skipped, exit 0).
   - **Hash Validation Scope**: Explicitly documented as SHA-256 format and value validation only (does not read `content-sources/MANIFEST.json` or hash external PDF bytes).

2. [`reports/status/AG_C03_CORRECTIONS_2026-11-06.md`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/reports/status/AG_C03_CORRECTIONS_2026-11-06.md):
   - **Section 1 (Lines 18–31)**: Added E-1 scope corrections, baseline history, 72/3/0 probe characterization, and test count progression.
   - **Section 3 Table (Line 132)**: Updated probe summary to `72 OK, 3 GAP, 0 CRASH`.
   - **Section 3.1 & 3.2**: Restored original T-1 through T-8 definitions and operational O-1 through O-4 tasks.

3. [`reports/status/AG_C03_FINAL_CORRECTIONS_2026-11-06.md`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/reports/status/AG_C03_FINAL_CORRECTIONS_2026-11-06.md):
   - **Section 2 (C-6)**: Updated itemized documentation correction notes to reflect true baseline history, 72/3/0 probe results, and original T-1..T-8 meanings.
   - **Section 6**: Updated summary of code governance accomplished vs open operational tasks (O-1..O-4) and deferred schema enhancements (T-1..T-8).

### 2.2 Canonical T-1 through T-8 and O-1 through O-4 Definitions
- **T-1**: English/Hindi release model (`releaseLanguages`, `--release --lang`).
- **T-2**: Record Hindi-capable verifier proficiency.
- **T-3**: Per-language provenance.
- **T-4**: Canonical unit identity, including locked English unit titles.
- **T-5**: Hindi text sanity and language-quality checks.
- **T-6**: Schema enforcement and consistency between schema and checker.
- **T-7**: Stable reviewer IDs and ordered, calendar-valid dates.
- **T-8**: Cross-check SHA-256 values against `content-sources/MANIFEST.json`.
- **O-1**: Human verifier recruitment (two distinct human verifiers).
- **O-2**: Independent visual Hindi typing from source PDF.
- **O-3**: Ingestion and SHA-256 capture of official NTA source PDFs.
- **O-4**: External visual transcription audit bundle.

---

## 3. Itemized Response to E-2: Split Placeholder Policies

### 3.1 Problem Statement
In previous iterations, broad regex matching against tokens like `DUMMY`, `PENDING`, `UNKNOWN`, and `परीक्षण` created unacceptable risks of false positives on legitimate academic terms in UGC NET Paper I (e.g. `Computer-Based Testing`, `Dummy variables`, `Pending cases`, `Unknown parameters`, `कंप्यूटर आधारित परीक्षण`, `परिकल्पना परीक्षण`, `सार्थकता परीक्षणों`).

### 3.2 Implementation in `scripts/check-curriculum.mjs`
Two separate, clearly delineated placeholder policies were implemented:

1. **Policy A — Strict Identity Names (`isPlaceholderName`)**:
   - Applied strictly to human identities (`transcriber.name`, `verifier.name`, `secondVerifier.name`).
   - Rejects exact placeholder keywords or prefixes case-insensitively:
     ```javascript
     const NAME_PLACEHOLDER_REGEX = /(?<![\p{L}\p{N}])(?:TODO|TBD|PLACEHOLDER|LOREM\s+IPSUM|DUMMY|FIXME|TEST\s+FIXTURE|परीक्षण|PENDING|UNKNOWN)(?![\p{L}\p{N}])/iu;
     ```
   - Also catches `^PENDING_` prefixes and strips zero-width/control characters prior to checking.

2. **Policy B — Structured-Only Prose Placeholders (`containsProsePlaceholder`)**:
   - Applied to content fields: subject names (`doc.subjectName.*`), unit titles (`unit.title.*`), and verified statement text (`stmt.text.*`).
   - Requires explicit placeholder syntax:
     - **Bracketed/Delimited Markers**: `\[\s*(?:TODO|TBD|PLACEHOLDER|LOREM\s+IPSUM|DUMMY|FIXME|TEST\s+FIXTURE|परीक्षण|PENDING|UNKNOWN)[\s\S]*?\]` and `_\s*(?:TODO|TBD|PLACEHOLDER|DUMMY|FIXME|PENDING|UNKNOWN)\s*_`.
     - **Uppercase Token Indicators**: Standalone uppercase tokens followed by colon or prefix/suffix (e.g. `\b(?:TODO|FIXME|TBD)\s*:` or `\b(?:TODO|FIXME|TBD)_[a-zA-Z0-9]+`).
     - **Explicit Development Phrases**: `lorem\s+ipsum` and `test\s+fixture` (case-insensitive).
   - **Legitimate Academic Prose Accepted**:
     - `Computer-Based Testing` $\rightarrow$ **PASS**
     - `Dummy variables in regression analysis` $\rightarrow$ **PASS**
     - `Pending cases and administrative law` $\rightarrow$ **PASS**
     - `Unknown parameters in statistical estimation` $\rightarrow$ **PASS**
     - `कंप्यूटर आधारित परीक्षण` $\rightarrow$ **PASS**
     - `परिकल्पना परीक्षण` $\rightarrow$ **PASS**
     - `सार्थकता परीक्षणों का अनुप्रयोग` $\rightarrow$ **PASS**
   - **Test Markers Rejected**:
     - `[TODO: finish]` $\rightarrow$ **REJECTED**
     - `[परीक्षण - सामग्री नहीं]` $\rightarrow$ **REJECTED**
     - `[TEST FIXTURE - NOT OFFICIAL CONTENT]` $\rightarrow$ **REJECTED**
     - `TODO: clarify statement` $\rightarrow$ **REJECTED**
     - `Lorem ipsum dolor sit amet` $\rightarrow$ **REJECTED**

---

## 4. Itemized Response to E-3: Portable Test Suite

### 4.1 Node Native APIs & Clean Temp Directory Management
[`scripts/test-curriculum-checker.mjs`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/scripts/test-curriculum-checker.mjs) was updated to achieve complete portability without relying on Windows-specific `cmd /c mklink`:
- **Directory Resolution**: Anchored to `REPO_ROOT` using `fileURLToPath(import.meta.url)` and `dirname`:
  ```javascript
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const REPO_ROOT = resolve(__dirname, '..');
  ```
- **Isolated Temp Dirs**: Uses `fs.mkdtempSync(join(os.tmpdir(), 'ureducator-cli-test-'))`.
- **Native Symlinks / Junctions**:
  ```javascript
  const isWindows = process.platform === 'win32';
  symlinkSync(scriptsDir, linkPath, isWindows ? 'junction' : 'dir');
  ```
  On Windows, directory junctions (`'junction'`) do not require elevated administrator rights or Developer Mode.
- **Guaranteed Cleanup**: Encapsulated in a `try...finally` block invoking `fs.rmSync(tempDir, { recursive: true, force: true })`, ensuring **zero orphaned artifacts** are created in `scripts/` or the repository.
- **Working Directory Independence**: Tested and verified running from repo root (`npm run test:curriculum`), from `scripts/` (`node test-curriculum-checker.mjs`), or from temporary directories. Both produce 209/209 passing assertions.

---

## 5. Itemized Response to E-4: Permanent Regression Suite & Mutant Coverage

The permanent test suite in `scripts/test-curriculum-checker.mjs` was expanded from 148 to **209 automated assertions**, systematically covering all identified mutants and edge cases:

| Mutant ID | Vulnerability / Edge Case Addressed | Test Assertion Location | Result |
| :--- | :--- | :--- | :---: |
| **N13, N14** | Case-insensitive & normalized pairwise verifier collisions (T==V1, T==V2, V1==V2, with NFKC full-width and whitespace evasion) | Section 3 (`V3`, `V4`, `V5`, `V7`, pairwise matrix) | **PASS** |
| **N20, N21** | Word boundary handling before and after placeholders with Latin, Devanagari, and punctuation boundary conditions | Section 1 (`N20: Word boundary after...`, `N21: Non-boundary before Latin...`) | **PASS** |
| **N27, N31** | Whitespace variants (tabs, newlines, multi-spaces) in `LOREM IPSUM` and `TEST FIXTURE` | Section 1 (`N27: LOREM IPSUM with tabs...`, `N31: TEST FIXTURE with tabs...`) | **PASS** |
| **N34** | Distinguishing `UNKNOWN` as an identity name (strictly rejected) vs. legitimate prose usage (e.g. `unknown parameters`, `Unknown Systems` accepted) | Section 1 (`N34: UNKNOWN rejected...`, `N34: unknown parameters accepted...`) | **PASS** |
| **N35–N37** | Obscured placeholders embedded with zero-width spaces, soft-hyphens, or word-joiners in `subjectName`, `unit.title`, and `stmt.text` | Section 5 (`N35: Obscured [TO\u200BDO] in subjectName.en rejected`, `N36`, `N37`) | **PASS** |
| **N45** | Draft statement placeholder policy: unverified draft statement permits placeholders during authoring, but strictly fails release | Section 5 (`N45: Unverified draft statement permits...`, `N45: Draft statement fails strict release check`) | **PASS** |
| **N46, N47** | Dual-signature requirements on populated V3 documents with placeholder verifiers | Section 3 (`V1: secondVerifier placeholder TBD rejected`, `V2`) | **PASS** |
| **N61** | `isCliEntry` fail-closed safety: if `realpathSync` throws, fallback verifies script identity and executes `main()` | Section 7 (`N61: isCliEntry returns true (fails closed)...`) | **PASS** |
| **N71** | CLI invocation failure modes: 0 args (usage), multiple files (usage), non-existent file (error) exit code 1 | Section 7 (`N71: CLI invoked with zero arguments...`, `multiple files...`, `non-existent file...`) | **PASS** |
| **N77** | Attestation date format validation (`YYYY-MM-DD`) and non-string type confusion | Section 3 (`V8: Empty attestation date rejected`, `V9: Garbage date rejected`) | **PASS** |

---

## 6. Itemized Response to E-5: CLI Fail-Closed Entry Guard

### 6.1 Vulnerability in Previous Implementation
In C-2, `isCliEntry()` used a `try...catch` block around `realpathSync`. If `realpathSync` encountered a filesystem permissions error, missing junction target, or network drive anomaly, it caught the error and returned `false`, causing the CLI to exit with code 0 without executing `main()` or reporting an error.

### 6.2 Hardened Fail-Closed Implementation in `scripts/check-curriculum.mjs`
```javascript
export function isCliEntry(
  argvPath = process.argv[1],
  metaUrl = import.meta.url,
  customRealpath = realpathSync
) {
  if (!argvPath) return false;
  let invokedRaw;
  let targetRaw;
  try {
    invokedRaw = resolve(argvPath);
    targetRaw = resolve(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
  // Fast path: exact raw path match (e.g. direct invocation)
  if (invokedRaw === targetRaw) {
    return true;
  }
  // Slow path: resolve symlinks and compare canonical targets
  try {
    const invokedReal = customRealpath(invokedRaw);
    const targetReal = customRealpath(targetRaw);
    return invokedReal === targetReal;
  } catch {
    // Fail-closed fallback: if realpath fails on same-basename invocation, execute main()
    return basename(invokedRaw) === basename(targetRaw);
  }
}
```
The implementation includes a fast raw-path shortcut (`invokedRaw === targetRaw`), symlink canonical target comparison via `realpathSync`, and a fail-closed same-basename fallback if `realpath` throws. Parameters are injectable for automated unit testing (F-6).

---

## 7. Comprehensive Verification Suite Execution Evidence

All ten verification checks were executed in the repository and passed:

| # | Check / Scope | Command Executed | Exit Code | Result Summary |
| :- | :--- | :--- | :-: | :--- |
| 1 | **Curriculum Test Suite** | `npm run test:curriculum` | `0` | **326 passed, 0 failed, 0 skipped** across 8 sections |
| 2 | **Normal Curriculum Audit** | `npm run check:curriculum` | `0` | **PASS (Structurally valid draft template, 0 units, 0 stmts)** |
| 3 | **Release Gate Audit** | `npm run check:curriculum:release` | `1` | **FAIL (Fail-closed: requires V3 dual_verified, empty doc rejected)** |
| 4 | **Official Python Validator** | `python docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py --self-test` | `0` | **8 check categories C01-C08, 19 OK lines, TOTAL ERRORS: 0** |
| 5 | **Shared Package Tests** | `npm test` in `packages/shared` | `0` | **37 passed, 0 failed** (6 test suites) |
| 6 | **Functions Backend Tests** | `npm test` in `functions` | `0` | **121 passed, 0 failed** (9 test suites) |
| 7 | **TypeScript Typecheck** | `npm run typecheck` | `0` | **0 errors** across shared, web, and functions |
| 8 | **ESLint** | `npm run lint` | `0` | **0 errors, 0 warnings** |
| 9 | **Production Build** | `npm run build` | `0` | **Compiled successfully; 41/41 Next.js static pages generated** |
| 10 | **Protected Files Identity** | `git diff d34b223 -- <25 protected files>` | `0` | **100% byte-identical (Empty diff across all 25 files)** |

### 7.1 Protected Files Verified Byte-Identical (25 Files)
1. `docs/M9_OFFICIAL_CURRICULUM_DATA.json`
2. `docs/M9_OFFICIAL_CURRICULUM_DATA.schema.json`
3. `docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py`
4. `firestore.rules`
5. `firestore.indexes.json`
6. `functions/src/services/admin.ts`
7. `functions/src/services/ai.ts`
8. `functions/src/services/exam.ts`
9. `functions/src/services/leads.ts`
10. `functions/src/services/learning.ts`
11. `functions/src/services/payments.ts`
12. `functions/src/services/reports.ts`
13. `functions/src/infra/dispatch.ts`
14. `packages/shared/src/scoring.ts`
15. `packages/shared/src/blueprint.ts`
16. `packages/shared/src/rbac.ts`
17. `packages/shared/src/schemas.ts`
18. `packages/shared/src/session.ts`
19. `packages/shared/src/clientExam.ts`
20. `packages/shared/src/catalogue.ts`
21. `packages/shared/src/constants.ts`
22. `packages/shared/src/i18n.ts`
23. `packages/shared/src/index.ts`
24. `packages/shared/src/analytics.ts`
25. `packages/shared/src/adminSchemas.ts`

### 7.2 Nonexistent Paths Disclosed & Corrected
The audit explicitly notes that the following three paths do not exist in the repository and must not be counted as verified files:
1. `functions/src/services/dispatch.ts` does not exist; the actual file is `functions/src/infra/dispatch.ts` (verified byte-identical).
2. `functions/src/services/platform.ts` does not exist as a service in this repository.
3. `packages/shared/src/learning.ts` does not exist; relevant actual learning files include `functions/src/services/learning.ts` (verified byte-identical) and shared learning test files.

---

## 8. Status of Deferred Tasks (T-1 through T-8) and Prerequisites

In strict adherence to instructions, **T-1 through T-8 remain DEFERRED**. Antigravity has not implemented any deferred schema features, pending formal architecture review and release gating:

- **T-1 (English/Hindi release model)**: DEFERRED. Requires decouple flags (`--release --lang`, `releaseLanguages`).
- **T-2 (Record Hindi-capable verifier proficiency)**: DEFERRED. Requires schema fields for language proficiency attestations.
- **T-3 (Per-language provenance)**: DEFERRED. Requires statement-level language provenance.
- **T-4 (Canonical unit identity, including locked English unit titles)**: DEFERRED. Requires strict unit title locking across language variants.
- **T-5 (Hindi text sanity and language-quality checks)**: DEFERRED. Requires lexical/glyph corpus checkers.
- **T-6 (Schema enforcement and consistency between schema and checker)**: DEFERRED. Requires JSON schema Draft-07 / validator sync.
- **T-7 (Stable reviewer IDs and ordered, calendar-valid dates)**: DEFERRED. Requires reviewer registry and chronological validation.
- **T-8 (Cross-check SHA-256 values against `content-sources/MANIFEST.json`)**: DEFERRED. Requires external manifest file verification.

---

## 9. Working Tree Status & Staging Audit

```powershell
PS C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2> git status
On branch main
Your branch is ahead of 'origin/main' by 15 commits.
  (use "git push" to publish your local commits)

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   curriculum/paper1.schema.json
	modified:   package.json
	modified:   scripts/check-curriculum.mjs
	modified:   scripts/test-curriculum-checker.mjs

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	Claude outputs/
	reports/

no changes added to commit (use "git add" and/or "git commit -a")
```

- **Modified Tracked Files**: Exactly 4 files (`curriculum/paper1.schema.json`, `package.json`, `scripts/check-curriculum.mjs`, `scripts/test-curriculum-checker.mjs`).
- **Untracked Directories**: `Claude outputs/` and `reports/` only.
- **Staged Changes**: **0 files staged** (`git diff --staged` is empty).
- **Commits Created**: **0 commits created**.

---

## 10. Checkpoint 2 Prerequisites & Boundary Compliance

In strict compliance with the sprint boundaries:
1. **Checkpoint 2 Prerequisites Preserved**: The starter syllabus `curriculum/paper1.syllabus.json` remains in its unverified template state (0 units, 0 statements).
2. **Zero Syllabus Transcription**: No syllabus transcription has taken place.
3. **Zero Question Generation**: No questions have been generated or ingested.
4. **CBT Engine Untouched**: The CBT engine (`functions/src/services/exam.ts`, `packages/shared/src/scoring.ts`) and Firestore rules remain byte-identical to `d34b223`.
5. **Strict STOP**: All implementation is halted. Antigravity is stopped and awaiting Claude's independent re-review verdict and Owner approval prior to initiating Gate 2.
