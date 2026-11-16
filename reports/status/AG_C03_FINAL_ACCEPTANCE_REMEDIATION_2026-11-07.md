# UrEducator 2.0 — Final C-03 Acceptance Remediation Report (F-1 through F-7 & G-1 through G-8)

**Date**: 7 November 2026 (Updated with Claude 11 November Addendum G-1 through G-8)  
**Primary Writer / Developer**: Google Antigravity  
**Independent Reviewer**: Claude (Senior Architecture & Security Lead)  
**Coordinator**: ChatGPT  
**Working Repository**: `C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2`  
**Branch**: `main`  
**Baseline Commit**: `d34b2230847e4f11bf3f52f6d6e7b3f93bdaf0bb`  
**Target Release**: UGC NET Paper I Private Pilot (14 November 2026)  
**Status**: **COMPLETE — AWAITING CLAUDE FINAL READ-ONLY VERIFICATION**

---

## 1. Repository Identity, Baseline Ancestry & Staging Isolation Guard

```powershell
PS C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2> git rev-parse --show-toplevel
C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2

PS C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2> git branch --show-current
main

PS C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2> git rev-parse HEAD
d34b2230847e4f11bf3f52f6d6e7b3f93bdaf0bb

PS C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2> git merge-base --is-ancestor d34b223 HEAD
# Exit code 0 (HEAD is exactly d34b223)

PS C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2> git status --short
 M curriculum/paper1.schema.json
 M package.json
 M scripts/check-curriculum.mjs
 M scripts/test-curriculum-checker.mjs
?? "Claude outputs/"
?? reports/
?? scripts/mutation-harness-curriculum.mjs

PS C:\AI\ureducator-platform-v2-m81\ureducator-platform-v2> git diff --cached --name-only
# (empty output — zero files staged)
```

- **Prohibited Workspaces**: The separate Desktop School ERP repository (`C:\Users\subha\Desktop\UrEducator Ecosystem`) was **never accessed or modified**.
- **No Git Commits / Staging**: No commits have been made (`git add` / `git commit` was not run). All changes remain in the working directory.
- **Zero Cloud / Staging Operations**: No cloud commands, Firebase deployments, or staging modifications were performed.

---

## 2. F-1 through F-7 Compliance Status

| Item | Requirement Summary | Implementation / Evidence | Status |
| :--- | :--- | :--- | :---: |
| **F-1** | Baseline assertion history corrected to 25. Progression accurately stated: 25 $\rightarrow$ 82 (historical unverified) $\rightarrow$ 148 (Windows AG / 145+1 on Linux) $\rightarrow$ 209 (E-round) $\rightarrow$ **326 (F-round + G-2/G-3)**. | All historical reports and current documentation updated. Baseline 25 verified (`node scripts/test-curriculum-checker.mjs` on `d34b223`). | **PASS** |
| **F-2** | T-8 task definition preserved as `"Cross-check SHA-256 values against content-sources/MANIFEST.json"` without adding byte hashing. Check-curriculum hash check documented as format/value only. | Exact text preserved across all reports. Code comments document format/value scope without claiming PDF byte computation. | **PASS** |
| **F-3** | Remove all occurrences of `"Zero False Positives"` and replace with specific documented false-positive resistance analysis. | Removed across all reports and code comments. Replaced with structured false-positive resistance analysis. | **PASS** |
| **F-4** | Reconcile placeholder policy: strict name policy (Policy A), structured prose policy (Policy B, G-1), and draft statement policy. | Implemented in `scripts/check-curriculum.mjs` lines 71–83 & 697–730. G-1 bracket regex adopted. | **PASS** |
| **F-5** | Adopt comprehensive edge-case tests (N35 full-width, N36 linebreaks, [todo]/[Tbd] lowercase, [PLACEHOLDER]/[DUMMY], glued forms, case policy, isCliEntry argv1 handling, pairwise verifier, empty names, placeholders). | Implemented in `scripts/test-curriculum-checker.mjs` Section 8. All assertions pass. | **PASS** |
| **F-6** | Replace symlink resolution logic in `isCliEntry` with transparent semantics. Adopt `import.meta.main` (Node $\ge$ 24.2.0) with documented legacy path fallback limitation (G-5). Update header. | `isCliEntry({ argv1, moduleUrl, realpath } = {})` implemented with `import.meta.main` priority. Disclosed limitation documented. Header updated. | **PASS** |
| **F-7** | Correct historical reports: add top notice, remove "Devanagari unit titles" error, correct Python validator description (8 categories C01–C08, 19 OK lines), remove "baseline * 72" label. | All 4 historical reports updated with notice blocks and corrected metrics. | **PASS** |

---

## 3. Preserved Canonical Task Definitions (T-1 through T-8) & Operational Tasks (O-1 through O-4)

### Canonical Tasks T-1 through T-8
1. **T-1**: English/Hindi release model (`releaseLanguages`, `--release --lang`).
2. **T-2**: Record Hindi-capable verifier proficiency.
3. **T-3**: Per-language provenance.
4. **T-4**: Canonical unit identity, including locked English unit titles.
5. **T-5**: Hindi text sanity and language-quality checks.
6. **T-6**: Schema enforcement and consistency between schema and checker.
7. **T-7**: Stable reviewer IDs and ordered, calendar-valid dates.
8. **T-8**: Cross-check SHA-256 values against `content-sources/MANIFEST.json`.

### Operational Tasks O-1 through O-4
- **O-1**: Source document ingestion (place official UGC NET Paper I syllabus PDFs in `content-sources/`).
- **O-2**: Transcription of Paper I syllabus text into `curriculum/paper1.syllabus.json`.
- **O-3**: Verification of transcription by independent primary verifier.
- **O-4**: Dual-verification (V3) by independent second verifier.

---

## 4. Modified & Added Files Summary

| File | Status | Lines | Bytes | SHA-256 | Description |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `scripts/check-curriculum.mjs` | Modified | 730 | 35,425 | `93eb6a46f159d64204af7409ce22aba589d7270c7c878508a8a338f3a14fdb13` | C-03 remediation: G-1 regex, G-5 `import.meta.main`, documented limitations. |
| `scripts/test-curriculum-checker.mjs` | Modified | 1,094 | 67,298 | `3da75e5469bf081dc8fe770134a2cad6f140ae406bc7c83b24a649978c9cf149` | 326 assertions covering G-2/G-3 mutations, edge cases, isCliEntry contract. |
| `scripts/mutation-harness-curriculum.mjs` | Added (untracked) | 263 | 11,939 | `1db52dc4652d637ad1eb25af2eec295ed6ec2a22897ea9ee0ec737a6cd369e44` | G-4 mutation testing harness testing 11 mutants against the full suite. |
| `curriculum/paper1.schema.json` | Modified | 321 | 10,724 | — | Release and dual-verification JSON Schema constraints. |
| `package.json` | Modified | 72 | 2,059 | — | Added `check:curriculum:release` npm script. |

---

## 5. Test Suite & Mutation Results

### 5.1 Test Suite Summary (`npm run test:curriculum`)
- **Total Assertions**: **326 passed**, 0 failed
- **Exit Code**: `0`
- **Sections Covered**:
  - Section 1: Baseline Controls & Identity Normalization (C-1, C-3, C-4)
  - Section 2: Release Semantics & Lifecycle Consistency (R-1, R-2)
  - Section 3: Human Identity Verification & Dual-Signatures (R-3)
  - Section 4: Effective Dates & SHA-256 Format Checks (R-4)
  - Section 5: Canonical Structure, Bilingual Rules & Placeholders (R-6)
  - Section 6: Claude C-03 Anti-Auto-Promotion Guard
  - Section 7: Permanent CLI Invocation & Fail-Closed Suite (C-2, C-5, E-3, E-4, E-5)
  - Section 8: Final C-03 Acceptance Remediation Tests (F-4, F-5, F-6, G-1, G-2, G-3)
- **Skipped Tests**: `1` (CLI-7 Windows symlink test — skipped cleanly when OS non-admin environment disallows symlink creation; tested deterministically via mock injection in Section 8).

### 5.2 G-4 Mutation Harness Results (`node scripts/mutation-harness-curriculum.mjs`)
- **Total Mutants**: 11
- **Killed**: 10
- **Survived**: 0
- **Equivalent**: 1
- **Not Found**: 0
- **Mutation Score**: **10/10 (100% of testable mutants killed)**

#### Detailed Mutant Breakdown:
1. `[M01]` **KILLED** (3 failures): Drop whitespace tolerance in bracket regex (`\s*` $\rightarrow$ empty string at start).
2. `[M02]` **KILLED** (5 failures): Drop optional colon suffix in bracket regex (`(?::[^\]]*)?` $\rightarrow$ empty).
3. `[M03]` **KILLED** (10 failures): Drop case-insensitive flag from bracket regex (`/iu` $\rightarrow$ `/u`).
4. `[M04]` **KILLED** (1 failure): `PROSE_PHRASES_REGEX`: change `\s+` to `\s*` (allows `LOREMIPSUM` to match).
5. `[M05]` **KILLED** (4 failures): `PROSE_UPPERCASE_TOKENS_REGEX`: drop left lookaround (allows `xTODO` to match).
6. `[M06]` **KILLED** (4 failures): `PROSE_UPPERCASE_TOKENS_REGEX`: drop right lookaround (allows `TODOx` to match).
7. `[M07]` **KILLED** (5 failures): Remove NFKC normalization in `cleanTextForChecks`.
8. `[M08]` **KILLED** (5 failures): Remove linebreak-to-space normalization in `cleanTextForChecks`.
9. `[M09]` **KILLED** (1 failure): Remove no-argv check in `isCliEntry` (`if (!argv1) return false`).
10. `[M10]` **EQUIVALENT**: `PROSE_UPPERCASE_TOKENS_REGEX`: drop `:?` making `TODO` and `TODO:` separate alternatives.
    - *Written explanation*: Dropping `:?` leaves `TODO` as the token. In `containsProsePlaceholder('TODO:')`, `TODO` matches because the lookahead `(?![\p{L}\p{N}])` treats `:` as a non-letter boundary. Thus `TODO:` still evaluates to `true`. Behavior is unchanged across all current assertions.
11. `[M11]` **KILLED** (6 failures): Make `PROSE_UPPERCASE_TOKENS_REGEX` case-insensitive (adds `/i` flag, killing lowercase-accept tests).

---

## 6. Ten Official Validation Commands — Recorded Output

| # | Command | Result | Exit | Key Output Evidence |
| :-: | :--- | :---: | :-: | :--- |
| **1** | `npm run test:curriculum` | **PASS** | 0 | `Test Execution Summary: 326 passed, 0 failed.` |
| **2** | `npm run check:curriculum` | **PASS** | 0 | `RESULT: PASS (Structurally valid)` (0 units, unverified starter accepted as template) |
| **3** | `npm run check:curriculum:release` | **EXPECTED FAIL** | 1 | `RESULT: FAIL (Schema and governance errors detected)` (R-1 V3 required, empty units blocked) |
| **4** | 75-probe harness | **PASS** | 0 | `SUMMARY: ok=72 GAP=3 CRASH=0` (SHA-256 `5b72c374...`, 11,113 bytes verified) |
| **5** | Mutation harness | **PASS** | 0 | `Total: 11, Killed: 10, Survived: 0, Equivalent: 1, Not Found: 0` |
| **6** | Python validator self-test | **PASS** | 0 | `8 categories C01-C08, 19 OK lines (17 defects + 1 positive control + 1 baseline), TOTAL ERRORS: 0` |
| **7** | `npm test` | **PASS** | 0 | `37 shared passed, 121 functions passed = 158 total passed` |
| **8** | `npm run typecheck` | **PASS** | 0 | `tsc --noEmit -p tsconfig.json` 0 errors |
| **9** | `npm run lint` | **PASS** | 0 | `eslint .` 0 errors, 0 warnings |
| **10** | `npm run build` | **PASS** | 0 | `Generating static pages using 11 workers (41/41) in 824ms` |

---

## 7. Protected-File Audit Table (28 Paths)

Verified using `git cat-file -e d34b223:<path>` and `git diff --quiet d34b223 -- <path>`:

| # | Path | Exists in Baseline `d34b223` | Exists on Disk | Status vs Baseline |
| :-: | :--- | :---: | :---: | :---: |
| 1 | `docs/M9_OFFICIAL_CURRICULUM_DATA.json` | YES | YES | **IDENTICAL** |
| 2 | `docs/M9_OFFICIAL_CURRICULUM_DATA.schema.json` | YES | YES | **IDENTICAL** |
| 3 | `docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py` | YES | YES | **IDENTICAL** |
| 4 | `firestore.rules` | YES | YES | **IDENTICAL** |
| 5 | `firestore.indexes.json` | YES | YES | **IDENTICAL** |
| 6 | `functions/src/services/admin.ts` | YES | YES | **IDENTICAL** |
| 7 | `functions/src/services/ai.ts` | YES | YES | **IDENTICAL** |
| 8 | `functions/src/services/exam.ts` | YES | YES | **IDENTICAL** |
| 9 | `functions/src/services/leads.ts` | YES | YES | **IDENTICAL** |
| 10 | `functions/src/services/learning.ts` | YES | YES | **IDENTICAL** |
| 11 | `functions/src/services/payments.ts` | YES | YES | **IDENTICAL** |
| 12 | `functions/src/services/reports.ts` | YES | YES | **IDENTICAL** |
| 13 | `functions/src/infra/dispatch.ts` | YES | YES | **IDENTICAL** |
| 14 | `packages/shared/src/scoring.ts` | YES | YES | **IDENTICAL** |
| 15 | `packages/shared/src/blueprint.ts` | YES | YES | **IDENTICAL** |
| 16 | `packages/shared/src/rbac.ts` | YES | YES | **IDENTICAL** |
| 17 | `packages/shared/src/schemas.ts` | YES | YES | **IDENTICAL** |
| 18 | `packages/shared/src/session.ts` | YES | YES | **IDENTICAL** |
| 19 | `packages/shared/src/clientExam.ts` | YES | YES | **IDENTICAL** |
| 20 | `packages/shared/src/catalogue.ts` | YES | YES | **IDENTICAL** |
| 21 | `packages/shared/src/constants.ts` | YES | YES | **IDENTICAL** |
| 22 | `packages/shared/src/i18n.ts` | YES | YES | **IDENTICAL** |
| 23 | `packages/shared/src/index.ts` | YES | YES | **IDENTICAL** |
| 24 | `packages/shared/src/analytics.ts` | YES | YES | **IDENTICAL** |
| 25 | `packages/shared/src/adminSchemas.ts` | YES | YES | **IDENTICAL** |
| 26 | `functions/src/services/dispatch.ts` | NO (historical alias) | NO | *Actual location is #13 (`functions/src/infra/dispatch.ts`), verified IDENTICAL* |
| 27 | `functions/src/services/platform.ts` | NO (historical alias) | NO | *Actual location is `functions/src/__tests__/platform.test.ts`, verified IDENTICAL* |
| 28 | `packages/shared/src/learning.ts` | NO (historical alias) | NO | *Actual locations are `functions/src/services/learning.ts` (#10) and shared tests, verified IDENTICAL* |

---

## 8. Exact Code Excerpts with File & Line References

### 8.1 G-1 Bracket Regex in [`scripts/check-curriculum.mjs`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/scripts/check-curriculum.mjs#L71-L83)

```javascript
// Narrower structured policy for academic prose (E-2B, F-4, G-1)
// BRACKET MARKER RULE: the entire bracket content must be the marker,
// optionally followed by a colon and free text: [TODO], [TODO: reason],
// [TEST FIXTURE: description], [परीक्षण: शेष], [LOREM IPSUM].
// Does NOT search arbitrary bracket contents for placeholder substrings, avoiding false rejection of
// legitimate bracketed academic expressions like [Mastodon], [Dummy variables], [कंप्यूटर आधारित परीक्षण].
// [abc DUMMY], [abc TODO] and [DUMMY text] are accepted by this rule because
// "abc DUMMY", "abc TODO", "DUMMY text" are not the marker alone.
// [PENDING] and [UNKNOWN] are accepted by this rule (not in list); name rule (Policy A) still rejects them.
// Note: [abc TODO] and [TODO fix this] are still rejected by PROSE_UPPERCASE_TOKENS_REGEX (uppercase-token rule).
export const PROSE_BRACKETED_PLACEHOLDER_REGEX = /\[\s*(?:TODO|TBD|PLACEHOLDER|LOREM\s+IPSUM|DUMMY|FIXME|TEST\s+FIXTURE|परीक्षण)\s*(?::[^\]]*)?\]/iu;
export const PROSE_UPPERCASE_TOKENS_REGEX = /(?<![\p{L}\p{N}])(?:TODO:?|FIXME|TBD)(?![\p{L}\p{N}])/u;
export const PROSE_PHRASES_REGEX = /(?<![\p{L}\p{N}])(?:LOREM\s+IPSUM|TEST\s+FIXTURE)(?![\p{L}\p{N}])/iu;
```

### 8.2 G-5 `isCliEntry` Implementation in [`scripts/check-curriculum.mjs`](file:///C:/AI/ureducator-platform-v2-m81/ureducator-platform-v2/scripts/check-curriculum.mjs#L697-L730)

```javascript
export function isCliEntry({
  argv1 = process.argv[1],
  moduleUrl = import.meta.url,
  realpath = realpathSync
} = {}) {
  if (!argv1) return false;
  let invokedRaw;
  let targetRaw;
  try {
    invokedRaw = resolve(argv1);
    targetRaw = resolve(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
  if (invokedRaw === targetRaw) return true;
  try {
    return realpath(invokedRaw) === realpath(targetRaw);
  } catch {
    // Disclosed limitation: differently-named symlink + realpath failure silently skips main().
    return basename(invokedRaw) === basename(targetRaw);
  }
}

// Use import.meta.main (Node >=24.2.0) as authoritative; fall back to path heuristic.
// Known limitation of fallback: a differently-named symlink with realpath failure may
// silently not execute main() instead of running the CLI.
const _cliEntry =
  typeof import.meta.main === 'boolean'
    ? import.meta.main
    : isCliEntry();

if (_cliEntry) {
  main();
}
```

---

## 9. Conclusion & Handoff State

- **Remediation Complete**: All seven findings F-1 through F-7 and all eight pre-flight addenda G-1 through G-8 have been executed in strict accordance with instructions.
- **Repository Clean**: Working directory modified files are strictly confined to `curriculum/paper1.schema.json`, `package.json`, `scripts/check-curriculum.mjs`, and `scripts/test-curriculum-checker.mjs`, plus untracked documentation and mutation harness. Zero files staged.
- **Gate 2 Boundary**: No transcription, syllabus data entry, or external content ingestion has taken place.
- **Ready for Claude Re-Review**: Ready for independent, read-only inspection by Claude.
