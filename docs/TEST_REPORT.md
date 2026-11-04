# Test report (local, 4 Nov 2026)

All results below were produced in the build sandbox. **None touched Google Cloud.**

| Check | Command | Result |
|---|---|---|
| Lint (ESLint 9, typescript-eslint, react-hooks, jsx-a11y) | `npx eslint . --max-warnings 0` | 0 errors, 0 warnings |
| Typecheck | `npm run typecheck` (web, functions, shared) | Clean |
| Shared unit tests | `npm test -w @ureducator/shared` | 37 passed (6 files) |
| Functions unit tests | `npm test -w functions` | 97 passed (5 files) |
| Production build | `npm run build` (shared → functions → web) | Success; every route prerendered as static content, web export 4.4 MB, functions bundle 1.9 MB |
| Bundle scan, web | `npm run verify:bundle` | 249 files, 0 findings |
| Bundle scan, functions | `npm run verify:functions` | 1 file, 0 findings |
| Scanner negative control | `node scripts/verify-bundle.mjs apps/web/out-mock` | Reports findings (mock signatures) as it must |
| Demo seed not shipped | `grep seedDemo functions/lib/index.js` | 0 matches |
| Seed CLI guards | 7 invocations (no project, wrong project, prod id, no confirm flag, bad emulator use, env mismatch) | All refused, exit 2. The *write* path was not run (no Firestore here) |
| Browser E2E (headless Chromium, real endpoint pipeline on an in-memory store) | `npx playwright test -c tests/e2e/playwright.config.ts` | **18 passed** |
| Accessibility | axe-core WCAG 2 A/AA inside the E2E suite | No violations on landing, login, signup, syllabus, pricing |
| Mobile | 390 px viewport | No horizontal overflow on 9 pages; palette opens as a sheet; tap targets ≥ 40 px |

## What the E2E suite covers

Sign-up → email confirmation → exam → autosave → submit → result → Hindi review → PDF download → notebook → planner → mentor; reload/resume on server clock; offline then resync; timeout auto-submit; late-submit refusal and idempotent submit; locked review under `after_close`; cross-student access refusal; 150-question 50+100 / 300 marks / 180 min layout; public pages with honest labels and no prices; lead consent and rate limit; open-redirect guard; owner claim once; role assignment; editor → reviewer → admin → student pipeline; per-role navigation and server refusals; separation of duties; audit entries contain no answers; no answer key in any API response during an exam.

## What has NOT been verified

* Firestore Security Rules behaviour (rules tests exist but need the emulator; syntax is checked server-side only at deploy time).
* Real Firebase Auth, App Check, Firestore, Cloud Functions cold starts and IAM.
* Real email delivery; the confirmation step is simulated by the test harness.
* Live AI (Vertex) and payments (disabled by design).
* Load, cost per exam and latency under real traffic.
* Staging-variant web build with the real Firebase web config.
