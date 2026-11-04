# UrEducator 2.0 — Phase M8.1 Staging Deployment Report

Date: 4 November 2026 · Target: `ugc-mock-test-staging` (336521990930) · Result: **NOT DEPLOYED. Stopped at the rules-test gate.**

## Verdict

| Question | Answer |
|---|---|
| Is anything deployed to staging? | **No.** No cloud command of any kind was run in this phase |
| Is there a working staging URL? | **No.** `https://ugc-mock-test-staging.web.app` serves nothing from this build |
| Did the Firestore rules pass behavioural tests? | **Unknown / not run.** The suite exists (57 tests) but the emulator cannot start in my sandbox |
| Why did I stop? | Your rule: "Do not proceed to rule deployment unless the actual emulator security-rule suite passes… If emulator execution is impossible, document the exact blocker and stop before cloud deployment" |
| Is production untouched? | **Yes** (see section 10) |

## 1. Source bundle verification (done, passed)

Checked from a **fresh extraction** of the archive I delivered (not from my working folder):

* File list identical to git `HEAD` (195 files); working tree was clean.
* All packages present: `packages/shared`, `functions`, `apps/web` (76 tracked files, including `src/lib`), `tests`, `scripts`, `docs`.
* `npm ci` succeeded, so the lockfile matches every manifest.
* Lint 0 errors / 0 warnings; TypeScript clean; 37 + 97 unit tests; production build; bundle scans 0 findings.
* `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc` present and staging-only (config gate: 34/34).

After this phase's changes the same checks were re-run in the working tree (below); a final fresh-extract re-check is listed in section 3.

## 2. The rules-test gate

**Mismatch found:** `package.json` ran `vitest --config tests/rules/vitest.config.mts`; the file is `vitest.config.ts`, so `npm run test:rules` could not start. A second defect in that config: `new URL('../../', import.meta.url).pathname` yields `/C:/…` on Windows, which breaks the project root there.

**Other weaknesses fixed:** the old rules test **skipped** itself when no emulator was present, so a green gate could have meant "nothing ran". It also had only 6 tests, and nothing guaranteed the emulator was local or a demo project.

**What exists now**

* `tests/rules/vitest.config.ts` — Windows-safe path.
* `tests/rules/firestore.rules.test.ts` — **57 behavioural tests**, which **fail (never skip)** without an emulator, refuse to run unless the emulator host is loopback and the project id starts with `demo-`, and include a drift guard that fails if a new collection appears in the server code or the rules without being classified.
* `scripts/test-rules.mjs` (`npm run test:rules`) — checks Java 21+, then runs `firebase emulators:exec --only firestore --project demo-ureducator` using the **repo-pinned** `firebase-tools@15.34.2`, with credential variables removed from the child environment. No shell syntax, so it works in PowerShell. Exit 3 = prerequisite missing, 1 = failure, 0 = pass.
* `firebase.json` — every emulator (including hub and logging) now explicitly bound to `127.0.0.1`.

**Coverage against your list**

| Required | Covered by |
|---|---|
| Unauthenticated access | `unauthenticated visitors` (catalogue readable; student/server data, lists and every write refused) |
| Authenticated student access | `authenticated student` (own docs by id and by owner-filtered query; no unfiltered list; no writes to own docs) |
| Cross-student denial | `cross-student access` (read, query incl. `in` queries, write, notebook) |
| Admin and owner permissions | `staff roles get no extra access in rules` — one test per each of the 7 roles, plus a forged-claim test. By design staff act through Cloud Functions, so rules must grant them nothing extra |
| Privileged-field modification denial | 18 table-driven attempts (role, entitlements, subscription, deadline, marks, order status, price, ticket status, notebook `visibleAtMs`, rate-limit reset, report signing key…) each tried three ways, plus forged audit/consent/lead/payment/report/coupon records |
| Server-only collections | all 16 server-only collections: get, list, filtered list, for anonymous, student and owner-claim users |
| Answer-key confidentiality | answer keys, papers, questions, versions, raw responses unreadable even for a student mid-exam; collection-group queries blocked |
| Published vs unpublished | draft/review/wrong-case/missing-status tests refused; unfiltered and `in` queries refused; string `"true"` price refused; students cannot publish or reprice |
| Nested user and purchase paths | notebook entries, `users/*/private`, `users/*/purchases`, `subscriptions/*/history`, `orders/*/refunds`, `results/*/answers`, `examSessions/*/keys`; orders, subscriptions, payment events, coupons |
| Invalid and oversized input | 800 KB payloads, malformed types, 500-element arrays, 1000-character ids, deeply nested paths. Rules contain no client write path, so these are refused by the blanket write denial; the rules do not validate shapes because nothing can be written |

**Honest limits of what I did**

* **Executed here: no.** I ran `npm run test:rules` in the sandbox. Result, verbatim: `Error: Failed to make request to https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar`. Java 21 is installed; the Google download host is unreachable from my environment, and I found no other reachable source for the emulator (checked npm and PyPI package names, Maven Central, the Google Cloud SDK component host, and the installed SDK).
* I verified that the suite **type-checks and lints**, and that without an emulator it exits non-zero rather than passing. I could **not** observe any assertion run, so some assertion may need adjusting once it meets the real emulator. If a test fails on your PC, send me the output; do not deploy rules.
* Static linting (`npm run lint:rules`) still exists, is labelled as static, and is not counted as a behavioural test.

## 3. Windows PowerShell procedure (done; dry-run in PowerShell 7 on Linux)

* `scripts/verify-readiness.ps1` — Node 24 check, Java check, `npm ci`, lint, TypeScript, unit tests, static rules lint, **emulator rules tests**, staging web build + Functions bundle, bundle scan (web and `functions/lib` + `dist/functions`), staging config scan, and an independent `Select-String` search for the production id, `ur-educator` and `rzp_live_`. Stops at the first failure. Ends `READY` only when nothing was skipped and a web API key was supplied; otherwise `NOT READY` with the gaps listed.
* `scripts/smoke-staging.ps1` — 36 read-only checks against the real URL, functions and Firestore REST (see runbook section 6).
* `docs/DEPLOY_RUNBOOK_STAGING.md` — rewritten for PowerShell: `npm.cmd`/`npx.cmd`, no Bash syntax, no `git archive`, every cloud command pinned to `--project ugc-mock-test-staging`, no `firebase use`.
* New `npm run verify:config` (34 checks: staging-only `.firebaserc` with no default project, hosting site, region, Functions runtime, noindex header, loopback emulators, env file values, instance limits, no production identifiers).
* **Dry runs performed:** gate with the emulator step skipped → every other step passed and the result was `NOT READY` with exactly two gaps (rules not run; no web API key), exit 2. Gate with the emulator step enabled → stopped at that step with the blocker above, exit 1. Config gate against a deliberately unsafe copy → 10 checks failed as they should. Smoke script against a local fake server → 36/36 on a healthy fake, 16/36 with 20 detected failures on a deliberately broken fake; and it fails cleanly (exit 1, no exceptions) when the site is unreachable.
* **Not run:** on Windows or Windows PowerShell 5.1 (syntax kept 5.1-compatible; no `&&`, `??`, `$IsWindows`).

## 4. Staging configuration (verified by the config gate, 34/34)

| Setting | Value |
|---|---|
| Project / region / site | `ugc-mock-test-staging` / `asia-south1` / `ugc-mock-test-staging` |
| Auth | Email/Password to be enabled by the owner; Anonymous stays disabled (owner console action) |
| `PAYMENTS_ENABLED` / `PAYMENT_MODE` | `false` / `test` |
| `AI_LIVE_ENABLED` | `false` (mock provider) |
| `ENFORCE_APP_CHECK` | `false` (monitor mode) |
| Functions instances | min 0 (code), max 5 (`MAX_INSTANCES=5`) |
| `OWNER_BOOTSTRAP_EMAIL` | **empty** — owner claiming disabled; no administrator account created |
| `.firebaserc` | alias → staging only; **no default project** |

## 5. Local source changes in this phase

| File | Change | Why |
|---|---|---|
| `package.json` | `test:rules` → runner script; new `test:rules:run`, `verify:config`; `verify:functions` also scans `dist/functions`; `firebase-tools@15.34.2` pinned (dev) | Fix the broken gate; deterministic CLI |
| `tests/rules/vitest.config.ts`, `firestore.rules.test.ts` | Rewritten (see section 2) | Real behavioural coverage; Windows path; fail-not-skip |
| `scripts/test-rules.mjs` | New | Cross-platform emulator runner |
| `scripts/verify-staging-config.mjs` | New | Config gate |
| `scripts/verify-readiness.ps1`, `scripts/smoke-staging.ps1` | New | Windows procedure |
| `scripts/prepare-deploy.mjs` | npm is now invoked via node + `npm_execpath` | **Windows bug:** spawning `npm` without a shell fails on current Node |
| `functions/src/infra/dispatch.ts` + test | Sign-in is checked **before** input validation | An anonymous caller no longer learns request shapes from error messages; also makes unauthenticated calls return 401 consistently. Backend tests 97 → 98 |
| `firebase.json` | `hub` and `logging` emulators bound to 127.0.0.1 | "Bind emulator hosts to localhost" |
| `package-lock.json` | Updated for `firebase-tools` | |
| `docs/*` | Runbook rewritten; owner actions, security, test report updated; this report | |

## 6. Tests executed and actual results (this phase, working tree)

| Check | Result |
|---|---|
| ESLint `--max-warnings 0` | 0 / 0 |
| TypeScript, all workspaces | clean |
| Shared / functions unit tests | 37 passed / **98** passed |
| Production web build + Functions bundle | success |
| `verify:bundle` (web, 249 files) / `verify:functions` (`functions/lib` + `dist/functions`) | 0 findings / 0 findings |
| `verify:config` | 34/34 |
| Independent search (PowerShell `Select-String`) for production id, `ur-educator`, `rzp_live_` | no matches |
| Browser E2E (headless Chromium) | **18 passed** (re-run after the dispatch change) |
| **Firestore rules on the emulator** | **NOT RUN — blocked (section 2)** |

## 7. Cloud resources deployed

None. No API enabled, no function, rule, index, document or Hosting release was created or changed in any project.

## 8. Hosting URL, Auth, Firestore/Storage security, Functions, smoke tests

| Item | Status |
|---|---|
| Hosting URL | none live |
| Authentication | Foundation only (Auth enabled, no providers, per your earlier setup). Email/Password awaits your console action |
| Firestore / Storage security | Staging database exists with deny-all (owner-created). The new rules are **not** deployed and **not** behaviourally verified |
| Functions | 34 callables built and tested locally; none deployed |
| Smoke tests | **Not run.** Nothing to test yet. The scripted and manual smoke procedures are ready |

## 9. Remaining owner actions

See `docs/OWNER_ACTIONS.md`. In short: run the readiness gate on Windows and send me the output; enable Email/Password in staging; run the read-only preflight and send me the output; check billing; then say "go deploy staging".

## 10. Billing observations and production isolation

* **Billing:** no data. I cannot read billing from here, and this phase incurred no cloud usage.
* **Production untouched — declaration:** no command of any kind targeted `ugc-mock-test` (production) or `ur-educator` in this phase; no Firebase or Google command was run at all. No project was created, no global active project was changed (`.firebaserc` has no default; no `firebase use`). No owner or administrator account was created. No payment key or secret was requested or printed. Repository and build scans show the production id, the old project id and live Razorpay patterns appear only in negative unit tests and in the scanners that look for them.
