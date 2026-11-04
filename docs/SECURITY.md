# Security model

## Controls and where they live

| Control | Implementation | Verified how |
|---|---|---|
| Deny-by-default rules | `firestore.rules` (catch-all deny), `storage.rules` (deny-all) | Read-through + syntax lint (`npm run lint:rules`). **Not emulator-tested** (no emulator in this sandbox) |
| Writes only via server | Every `write` is `false` in rules; Admin SDK bypasses rules | Rules read-through |
| Answer-key protection | Separate `answerKeys` collection, never readable; papers sanitised before storage | Unit tests + E2E response sniffing (no key in any API payload during an exam) |
| Auth + email verification | `auth: 'public' | 'user' | 'verified'` per endpoint | E2E: unverified user cannot start a test or use the mentor |
| RBAC | Custom claim `role`; matrix in `rbac.ts`; checked in each admin service | 4 admin unit tests + E2E per-role navigation and refusals |
| Separation of duties | Approver must differ from author | Unit + E2E pipeline |
| Owner bootstrap | `claimOwner` succeeds once, only for the verified email in `OWNER_BOOTSTRAP_EMAIL`. Empty = disabled | E2E |
| Input validation | Zod schemas on every endpoint, size limits in `LIMITS` | Unit tests |
| Idempotency | Deterministic session ids, `seq` on autosave, idempotent submit | Unit + E2E (double submit, late submit) |
| Rate limiting | Firestore counters per IP/uid; autosave bounded by ownership, `seq`, schema limits, max instances | Unit + E2E (lead form) |
| App Check | Wired (`ENFORCE_APP_CHECK`), **monitor mode** (false) at first; logs `appCheck: present/missing` | Not exercised: needs a reCAPTCHA Enterprise key |
| Environment guard | `assertEnvironment()` refuses to run in a project other than `EXPECTED_PROJECT_ID`, refuses live payments outside production | Unit tests |
| Secrets | None in repo. Razorpay secrets are declared only when payments are enabled | `verify-bundle` scans web and functions output |
| Error hygiene | Students get a reason code + correlation id, never a stack trace | Unit tests |
| Headers | CSP, HSTS, nosniff, frame deny, referrer and permissions policy, `X-Robots-Tag: noindex` in `firebase.json` | Config read; browser-level header check happens after deploy |
| No mock code in deployable builds | Build-time switch + scanner fails on `ur_mock_session`, `x-mock-token`, "Test build only" | `verify-bundle` passes on `apps/web/out`, **fails on `out-mock`** (negative control) |

## Bundle scanner (`scripts/verify-bundle.mjs`)

Fails on: the production project id, `ur-educator`, `rzp_live_` keys, Razorpay-secret-looking values, private keys, service-account JSON, OAuth tokens, source maps, and (web only) `answerKeys`, `_reportKey`, `firebase-admin`, mock-backend signatures.

## Known gaps (honest list)

1. Rules tests exist (`tests/rules`) but are skipped without the Firestore emulator.
2. App Check is not enforced, and no key has been created.
3. CSP allows `'unsafe-inline'` scripts.
4. Report signing key sits in a server-only Firestore doc rather than Secret Manager.
5. `npm audit` reports advisories in transitive dependencies. Production-relevant ones are `@grpc/grpc-js` inside the **browser** `firebase` package (its Node transport is not used in the browser bundle) and `glob`/`minimatch` via `google-gax` (build-time paths). No forced upgrades were applied; revisit at the next dependency bump.
6. No penetration test or external review has been done.
