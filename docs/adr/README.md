# Architecture decision records

Each record: context → decision → consequences. Status is **accepted** unless stated.

## ADR-001 — Static export on Firebase Hosting instead of App Hosting
* Context: the brief prefers Firebase App Hosting (asia-southeast1) and says to report the blocker if GitHub authorisation prevents it. App Hosting builds from a GitHub repository; no GitHub authorisation exists in this environment.
* Decision: build Next.js with `output: 'export'` and serve the static files from ordinary Firebase Hosting. This is the staging-only alternative, reported here rather than switched silently. All dynamic data comes from callables and rules-protected reads; ids travel in query strings.
* Consequences: no Node server to run or pay for, simple rollback, nothing server-rendered per request. Trade-offs: no per-request SSR or middleware, no image optimisation (`images.unoptimized`), CSP needs `'unsafe-inline'` scripts. Revisit App Hosting when a GitHub connection exists.

## ADR-002 — Cloud Functions Gen2, Node 24, `asia-south1`
* Decision: all backend code as Gen2 callables in `asia-south1`, matching Firestore (Mumbai) to avoid cross-region latency and egress. Node 24 (`nodejs24` runtime). `minInstances: 0`, `maxInstances` from config (5 in staging), concurrency 40.
* Consequences: cold starts on the first call after idle (acceptable for staging; revisit `minInstances` only with measured need and owner approval because it costs money).

## ADR-003 — One endpoint table, store port, in-memory store for tests
* Decision: every callable is declared once in `endpoints.ts` (auth, schema, limits). Business logic depends on a `Store` interface with `MemoryStore` and `FirestoreStore`.
* Consequences: unit tests and the browser harness run the exact production pipeline quickly and deterministically. Risk: behaviours specific to real Firestore (indexes, transaction contention, rules) are not exercised by those tests; they need emulator/staging verification.

## ADR-004 — Server-clock exams with deterministic sessions
* Decision: session ids are derived deterministically; deadlines are server timestamps; autosave carries a monotonic `seq`; submit is idempotent; late saves are refused after a grace window.
* Consequences: a double-clicked start cannot create two attempts, a replayed save cannot overwrite newer answers, and the client clock cannot extend an exam.

## ADR-005 — Reveal policy
* Decision: each mock test has `revealPolicy` = `immediate` or `after_close`. With `after_close`, scores show immediately but correct answers, explanations and notebook entries are held back until the test window closes (`visibleAtMs`).
* Consequences: supports scheduled all-India style mocks without leaking the key to early finishers.

## ADR-006 — Report signing key in `systemSettings/_reportKey` (stopgap)
* Decision: reports are HMAC-signed with a random key created on first use and stored in a server-only collection (rules deny all client access).
* Consequences: works without Secret Manager access or extra IAM during staging. Better: move to Secret Manager with a dedicated service account and key rotation before production. Status: accepted as a temporary measure.

## ADR-007 — Local E2E harness
* Decision: Playwright drives a static mock build against an in-memory server that runs the real endpoint table over HTTP, with fake auth (per-token claim snapshots), a controllable clock and `/read/*` routes that mirror the rules' visibility.
* Consequences: fast, hermetic browser tests of the whole flow with no cloud access. The mock backend is compiled only when `NEXT_PUBLIC_BACKEND=mock` and `NEXT_PUBLIC_APP_ENV=local-test`, writes to a separate `out-mock` folder, and `verify-bundle` fails if its signatures appear in a deployable build.

## ADR-008 — Honest content labelling
* Decision: nothing is labelled "Fully verified" until a human checks it against official documents. Paper I units are "Under development"; Paper II subjects are "Sample content". Demo questions are original or plainly synthetic and carry provenance.
* Consequences: the public site never claims official coverage that has not been verified.

## ADR-009 — ESLint 9 rather than 10
* Decision: `eslint-plugin-jsx-a11y@6.10.2` does not declare ESLint 10 support, so the repo pins ESLint 9.39.5. React-Compiler-oriented rules in `eslint-plugin-react-hooks` 7 are off (the app does not use the Compiler); `rules-of-hooks` and `exhaustive-deps` stay on.
