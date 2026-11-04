# UrEducator 2.0 — Architecture

Status: greenfield build, local-verified, **not yet deployed**. Target: Firebase project `ugc-mock-test-staging` only.

## 1. Shape of the system

```
Browser (static Next.js export)  ──HTTPS callable──▶  Cloud Functions Gen2 (Node 24, asia-south1)  ──Admin SDK──▶  Firestore (asia-south1)
        │  Firebase Auth (ID token, custom claim `role`)                    │
        └── direct Firestore reads: ONLY public catalogue + the signed-in student's own docs (rules enforce this)
```

* **Web** (`apps/web`): Next.js 16 App Router, strict TypeScript, Tailwind 4, `output: 'export'` (plain static files, served by Firebase Hosting, no Node server to pay for). Dynamic ids travel in query strings (`/app/exam?s=…`) because a static export has no runtime routing.
* **Functions** (`functions`): one endpoint table (`src/endpoints.ts`, 34 callables). Each entry declares auth level, Zod input, rate limit, memory and timeout. The same table is wrapped by `infra/callable.ts` for Cloud Functions and by `infra/dispatch.ts` for the local test harness, so tests exercise the real pipeline.
* **Shared** (`packages/shared`): Zod schemas, scoring, analytics, RBAC matrix, catalogue seed, spaced repetition, study plan. Used by both sides so validation and scoring rules cannot drift.
* **Store port** (`functions/src/domain/store.ts`): `MemoryStore` (tests) and `FirestoreStore` (production). All business logic in `services/*` is written against the port.

## 2. Monorepo layout

| Path | Purpose |
|---|---|
| `packages/shared` | Types, schemas, scoring, RBAC, analytics (37 unit tests) |
| `functions/src/services` | exam, admin, learning, reports, ai, leads, payments |
| `functions/src/infra` | config (fail-closed), dispatch, callable adapter, rate limit, audit, errors |
| `functions/src/devtools` | demo seed + seed CLI. **Never imported by `index.ts`, never deployed** |
| `apps/web/src/app` | `(site)` public pages, `app/(shell)` student pages, `admin/*` content studio |
| `apps/web/src/lib` | `Backend` interface, Firebase and mock implementations, auth, hooks |
| `tests/e2e` | Local harness (in-memory real endpoints over HTTP) + Playwright specs |
| `tests/rules` | Firestore rules tests (need the emulator; skipped here) |
| `scripts` | `prepare-deploy`, `verify-bundle`, `lint-rules`, `seed-staging` |

## 3. Exam engine (the part that must not leak)

1. `startExam` (verified email required) picks the mock test, loads the **sanitised** `publishedPapers/{id}` (stems and options only), creates `examSessions/{deterministicId}` with a **server-clock deadline**, and returns the questions. Answer keys live in `answerKeys/{id}`, which no client can read.
2. `saveResponses` is idempotent and sequence-numbered (`seq` must increase; stale writes are ignored). The client keeps answers on the device while offline and resyncs.
3. `submitExam` is idempotent. A submit after the deadline plus a short grace window is refused for new answers; the session is finalised from what was already saved. A session past its deadline is also auto-finalised when next read.
4. Scoring is server-side: 2 marks per correct answer, no negative marking, multi-select is all-or-nothing. Blueprint is configurable; the default practice blueprint is Paper I 50 Q + Paper II 100 Q = 150 Q, 300 marks, 180 minutes. `officialPatternVerified` stays `false` until someone with `settings.write` confirms it against official NTA documents.
5. `getExamResult` returns scores immediately. Correct answers and explanations follow the test's `revealPolicy`: `immediate` or `after_close` (locked until the test window closes). Error-notebook entries carry `visibleAtMs` so the notebook cannot be used to read answers early.

## 4. Roles

Seven roles via the custom claim `role` (never email-prefix checks): owner, super_admin, admin, content_editor, subject_reviewer, support_agent, analyst. The matrix lives in `packages/shared/src/rbac.ts` and is enforced in every admin service call. Roles reach a user's token only on refresh. Question approval needs a different person from the author (separation of duties). `roles.assign` is owner-only; nobody can assign a role at or above their own.

## 5. Optional subsystems (all off by default)

* **AI mentor**: `MockAiProvider` by default. `VertexGeminiProvider` exists but is unexercised and only reachable with `AI_LIVE_ENABLED=true`.
* **Payments**: architecture only. `PAYMENTS_ENABLED=false`, `PAYMENT_MODE=test`. Server-side catalogue, HMAC signature verification with constant-time compare, webhook idempotency. `createOrder`/`verifyPayment` reject with `PAYMENTS_DISABLED`. The webhook function is not even exported while payments are off. `assertEnvironment()` refuses live mode outside production.
* **Reports**: pdf-lib PDF returned as base64, HMAC-signed id and QR code, watermark, and the line "Practice Examination Performance Report — Not an Official NTA Scorecard."

## 6. Known limits

* Report signing key is stored in `systemSettings/_reportKey` (server-only collection). A stopgap; Secret Manager is the better home (ADR-006).
* CSP needs `'unsafe-inline'` for scripts because Next.js emits inline bootstrap scripts in a static export. Hash-based CSP is future work.
* Firestore rules and indexes have been reviewed by reading and linted for syntax, not run against an emulator or the cloud.
