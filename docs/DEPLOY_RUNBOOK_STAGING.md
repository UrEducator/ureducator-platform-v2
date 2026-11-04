# Staging deployment runbook (`ugc-mock-test-staging` only)

**Rules for every command below**

* Every Firebase/Google command carries `--project ugc-mock-test-staging`. No unqualified `firebase deploy`. No `firebase use`. `.firebaserc` has an alias but **no default** project, so an unqualified command fails by design.
* Never run any of this against `ugc-mock-test` (production) or `ur-educator`.
* Do not paste tokens, keys or passwords anywhere in the repo or in chat.

Status: **not executed**. The sandbox that built this cannot reach Google APIs and has no Firebase login, so nothing below has been run against the cloud.

## 0. One-time owner actions (console, ~10 minutes)

1. **Auth**: Firebase console → project `ugc-mock-test-staging` → Authentication → Sign-in method → enable **Email/Password** (and email-link only if wanted). Leave **Anonymous disabled**.
2. **Authorised domains**: confirm `ugc-mock-test-staging.web.app` and `.firebaseapp.com` are listed.
3. **Owner identity**: decide the email that will own the staging admin area. Put it in `functions/.env.ugc-mock-test-staging` as `OWNER_BOOTSTRAP_EMAIL=...` (this is not a secret, but it is an identity: you choose it, nobody else can). Leave empty to keep ownership claiming disabled.
4. **App Check (optional now, recommended before real students)**: create a reCAPTCHA Enterprise key for the staging web origin, register it in App Check, and give the site key to the web build as `NEXT_PUBLIC_APPCHECK_SITE_KEY`. Keep `ENFORCE_APP_CHECK=false` until metrics show legitimate traffic carries tokens.

## 1. Prepare (any machine with Node 24 and the repo)

```bash
node --version                      # must be v24.x
npm ci
npm run lint && npm run typecheck && npm test
```

## 2. Get the public web config (not a secret)

```bash
firebase apps:sdkconfig WEB 1:336521990930:web:8ebaa57a7ae7bcf9f019cb --project ugc-mock-test-staging
```

Use the printed `apiKey`, `authDomain`, `messagingSenderId` for the variables in step 3. The `appId` is `1:336521990930:web:8ebaa57a7ae7bcf9f019cb`.

## 3. Build

```bash
export NEXT_PUBLIC_APP_ENV=staging
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=ugc-mock-test-staging
export NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey from step 2>
export NEXT_PUBLIC_FIREBASE_APP_ID=1:336521990930:web:8ebaa57a7ae7bcf9f019cb
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ugc-mock-test-staging.firebaseapp.com
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=336521990930
rm -rf apps/web/out apps/web/.next
npm run build
npm run prepare:deploy              # creates dist/functions
npm run verify:bundle && npm run verify:functions   # both must print "0 finding(s)"
npm run lint:rules
```

## 4. Check what is selected, then deploy (rules + indexes first)

```bash
firebase apps:list --project ugc-mock-test-staging   # read-only; confirms the CLI is logged in and can see the staging project
firebase deploy --only firestore:rules,firestore:indexes --project ugc-mock-test-staging
firebase deploy --only storage --project ugc-mock-test-staging     # deny-all rules, same as now
firebase deploy --only functions --project ugc-mock-test-staging
firebase deploy --only hosting --project ugc-mock-test-staging
```

The first Functions deploy may ask to enable APIs (typically Cloud Functions, Cloud Build, Artifact Registry, Cloud Run). Enabling them in the staging project is within the authorisation; check the prompt names `ugc-mock-test-staging` before accepting. Do not create secrets: payments are off, so no `defineSecret` is bound.

Cost guard: functions run with `minInstances: 0`, `maxInstances: 5`. Stop and report if staging spend nears ₹800.

## 5. Optional synthetic content (sample data only)

```bash
gcloud auth application-default login   # or run where credentials already exist
node scripts/seed-staging.mjs --project ugc-mock-test-staging --confirm-write-synthetic-staging-data
```

Creates the catalogue (labelled honestly), blueprint(s), `mt-mini`, `mt-mini-late`, `mt-full` — all labelled **sample**. Any other project id is refused.

## 6. Smoke test on the live staging URL

1. Open `https://ugc-mock-test-staging.web.app` → home page loads, response header `X-Robots-Tag: noindex`.
2. Sign up with a throwaway address → confirm email → onboarding.
3. Start `mt-mini` → answer → reload mid-exam (answers and timer survive) → submit → result → Hindi toggle on review → download PDF.
4. Notebook, planner, mentor (answers come from the **test assistant**).
5. As owner: `/app/claim-owner` (only if `OWNER_BOOTSTRAP_EMAIL` is set and matches), then `/admin`.
6. Browser DevTools → Network: no response during an exam contains correct answers.
7. `npm run verify:bundle` against what is actually served (e.g. `curl` the JS chunks) if desired.

## 7. Rollback

* Hosting: Console → Hosting → release history → roll back to the previous release (or redeploy a previous build with the commands above).
* Functions: `firebase functions:delete <name> --region asia-south1 --project ugc-mock-test-staging`.
* Data: synthetic docs use fixed ids (`demo-*`, `mt-*`, `n-sampling`) and can be removed from the console.
