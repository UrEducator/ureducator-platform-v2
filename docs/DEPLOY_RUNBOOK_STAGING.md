# Staging deployment runbook — Windows PowerShell

Target: project `ugc-mock-test-staging` (number `336521990930`), region `asia-south1`, site `https://ugc-mock-test-staging.web.app`.
Status of this document: **commands prepared, not yet executed against the cloud.** The local scripts were syntax-checked and dry-run in PowerShell 7 on Linux; they have not run on Windows.

## Ground rules (read once)

* Every Firebase/Google command below carries `--project ugc-mock-test-staging`. Do **not** run `firebase use`, `firebase init`, or any `firebase deploy` without `--only` and `--project`.
* `.firebaserc` has no default project on purpose, so a command without `--project` fails instead of guessing.
* Never paste a token, key, password or service-account file into the repo, a terminal log, or chat.
* If any gate prints `STOP`, `FAIL` or `BLOCKER`: stop, send me the output, and do not continue to deployment.
* The scripts read the folder exactly as it is on disk. They never use git history, so uncommitted work is tested as-is (do not use `git archive`).
* Use `npm.cmd` / `npx.cmd` in PowerShell. Plain `npm` / `npx` can fail with "running scripts is disabled on this system".
* Run the scripts with `-ExecutionPolicy Bypass` as shown. That applies to that one process only; it changes no system setting.

## 0. One-time owner actions

| # | Action | Where |
|---|---|---|
| 1 | Enable **Email/Password** sign-in (leave **Anonymous** disabled; enable nothing else) in **ugc-mock-test-staging** only | Firebase console → Authentication → Sign-in method |
| 2 | Confirm `ugc-mock-test-staging.web.app` and `.firebaseapp.com` are in **Authorised domains** | Authentication → Settings |
| 3 | Install **Node.js 24 LTS** (nodejs.org) and **Eclipse Temurin JDK 21 or newer** (the emulator needs Java). Open a NEW PowerShell afterwards | your PC |
| 4 | Owner identity (later, after the first smoke test): tell me the email to use for `OWNER_BOOTSTRAP_EMAIL`. Keep it **empty** until then | see section 8 |
| 5 | Optional, later: App Check reCAPTCHA Enterprise **site key** (public) | Firebase console → App Check |

## 1. Open the project folder

```powershell
cd C:\path\to\ureducator-platform-v2
node --version        # must print v24.x.x
java -version         # must print 21 or newer
```

## 2. Local gate, part 1 (no cloud access at all)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-readiness.ps1
```

What it does, in order, stopping at the first failure: Node 24 check → Java check → `npm ci` → lint (0 warnings) → TypeScript → unit tests (shared + functions) → static rules lint → **Firestore rules tests on the local emulator** (`demo-ureducator`, localhost only) → staging web build + Functions bundle → bundle scans → staging config scan → independent text search for `ugc-mock-test` (production), `ur-educator`, `rzp_live_`.

Expected final lines: `RESULT: NOT READY TO DEPLOY ... GAP The web build has no Firebase API key`. That single gap is expected until step 3. **Any other gap, or any `STOP`, is a blocker.**

The first emulator run downloads `cloud-firestore-emulator-v1.22.0.jar` (about 60 MB) into your user profile (`%USERPROFILE%\.cache\firebase\emulators`). Allow that through any firewall.

## 3. Cloud preflight (read-only)

```powershell
npx.cmd --no-install firebase --version
npx.cmd --no-install firebase login:list
```

Expected: version `15.34.2`; the account listed is `ureducatorsubhash@gmail.com`. If you are not logged in: `npx.cmd --no-install firebase login` (opens the browser; this does not select any project).

```powershell
npx.cmd --no-install firebase apps:list --project ugc-mock-test-staging
npx.cmd --no-install firebase apps:sdkconfig WEB 1:336521990930:web:8ebaa57a7ae7bcf9f019cb --project ugc-mock-test-staging
```

Check in the output: the app id above; `projectId` = `ugc-mock-test-staging`; `messagingSenderId` = `336521990930` (this is the project number). Copy the `apiKey` value (public web config, not a secret) for step 4.

**Billing and budget (console, read-only):** Google Cloud console → project picker → `ugc-mock-test-staging` → Billing: the Blaze account is linked, and Budgets & alerts shows the ₹1,000 alert-only budget. Note the current month-to-date cost. Stop and tell me if it is already above ₹800 or anything unexpected appears.

## 4. Local gate, part 2 (deployable build)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-readiness.ps1 -SkipInstall -WebApiKey "PASTE_THE_PUBLIC_apiKey_HERE"
```

Required final line: `RESULT: READY. All local gates passed. Nothing has been deployed.`

## 5. Deploy (strict order; stop on the first error)

```powershell
# 5.1 Firestore rules + indexes
npx.cmd --no-install firebase deploy --only firestore:rules,firestore:indexes --project ugc-mock-test-staging

# 5.2 Storage rules (deny-all, unchanged in meaning)
npx.cmd --no-install firebase deploy --only storage --project ugc-mock-test-staging

# 5.3 Cloud Functions Gen 2 (min instances 0, max 5)
npx.cmd --no-install firebase deploy --only functions --project ugc-mock-test-staging

# 5.4 Web app to the existing staging Hosting site
npx.cmd --no-install firebase deploy --only hosting --project ugc-mock-test-staging
```

Notes for 5.3: the first Functions deploy may offer to enable APIs (Cloud Functions, Cloud Build, Artifact Registry, Cloud Run). Read the prompt; it must name `ugc-mock-test-staging`. Accepting enables APIs in the staging project only. No secrets are created because payments are off. If the CLI reports a billing, permission or quota problem, stop and send me the message.

## 6. Automated smoke test against the real URL (read-only)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-staging.ps1
```

Checks: landing page 200; staging banner text; `X-Robots-Tag: noindex`; CSP header; `robots.txt`; key routes; `publicConfig` says staging / payments off / live AI off / test mode; eight protected callables refuse an anonymous caller (HTTP 401); Firestore REST (anonymous) refuses answer keys, papers, questions, leads, audit logs, report key, users, sessions and unfiltered test lists, and allows the public catalogue.

## 7. Interactive smoke test (a person in a browser; synthetic data only)

Use a throwaway email address you control. Do not use real student data. The catalogue starts empty unless you seed sample content (section 9); without sample tests, steps 6–12 cannot be done.

| # | Do | Expect |
|---|---|---|
| 1 | Open `https://ugc-mock-test-staging.web.app` | Landing page, yellow "Staging preview" banner |
| 2 | Sign up with Email/Password | Verification email arrives |
| 3 | Open the link, then sign in | Dashboard loads; sign out and back in works |
| 4 | Open **Tests** | Sample tests listed, each labelled "Sample content" |
| 5 | Start `mt-mini` | Instructions, then the exam screen with the question palette |
| 6 | Answer 3 questions, mark one for review | Palette shows answered / marked states |
| 7 | Wait for "Saved", then press F5 | Answers still there, timer continues from the server time |
| 8 | Submit | Result with score; correct answers shown only on the review |
| 9 | Download the PDF report | PDF with the line "Practice Examination Performance Report — Not an Official NTA Scorecard." |
| 10 | Open **Notebook** and **Planner** | Entries for missed questions; a generated plan |
| 11 | Open **Mentor**, ask a question | Answer labelled "test assistant" |
| 12 | While the exam is in progress, open DevTools → Network | No response contains the correct option or explanations |
| 13 | As this normal student open `/admin` | "Staff only" message, no data |

## 8. Owner bootstrap (only when you have chosen the owner email)

1. Edit `functions\.env.ugc-mock-test-staging`: set `OWNER_BOOTSTRAP_EMAIL=you@example.com` (the exact email you will register).
2. Run section 2 and section 4 again, then redeploy Functions only (5.3).
3. Register that email on the staging site and verify it.
4. Open `/app/claim-owner` and press the button. It works once, and only for that verified email.
5. Sign out and in (the role reaches your token on refresh), then open `/admin`.
6. From People you can assign the other roles. Roles never come from email prefixes.

## 9. Optional synthetic content

```powershell
gcloud auth application-default login
node .\scripts\seed-staging.mjs --project ugc-mock-test-staging --confirm-write-synthetic-staging-data
```

Writes the labelled-sample catalogue and tests `mt-mini`, `mt-mini-late`, `mt-full`. Any other project id is refused. This write path has not been run against real Firestore yet; if it errors, send me the message. Alternative: after section 8, create content in the admin studio.

## 10. Rollback

* Hosting: Firebase console → Hosting → release history → roll back.
* Functions: `npx.cmd --no-install firebase functions:delete NAME --region asia-south1 --project ugc-mock-test-staging`
* Seed data uses fixed ids and can be deleted in the console.

## 11. Stop conditions

Stop and report if: the project id shown anywhere is not `ugc-mock-test-staging`; a production id appears in a deployment target; `rzp_live_` is found; any rules test fails; a secret would be printed; billing or permissions behave unexpectedly; month-to-date staging spend reaches about ₹800.
