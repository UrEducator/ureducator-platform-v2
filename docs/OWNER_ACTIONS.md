# What I need from the owner (exact blockers)

Everything that could be built and verified without cloud credentials has been. These are the remaining items and why each is needed.

| # | Blocker | Why it blocks | Exact action |
|---|---|---|---|
| 1 | **No authenticated route to Google from the build environment** | The sandbox can reach only the npm registry and GitHub. The linked PC bridge was offline on the last attempt, so the Firebase CLI could not be checked. Nothing can be deployed from here | Either (a) bring the PC online with the Claude desktop app open so deployment can be driven from there, or (b) run `docs/DEPLOY_RUNBOOK_STAGING.md` yourself (every command is pinned to `ugc-mock-test-staging`) |
| 2 | **Email/Password sign-in is not enabled in staging** | Students cannot sign up until a provider exists | Console → Authentication → Sign-in method → enable Email/Password. Keep Anonymous off |
| 3 | **No owner identity authorised** | `OWNER_BOOTSTRAP_EMAIL` is empty, so nobody can become owner (this is intentional) | Tell me which email should own staging admin, or set it yourself in `functions/.env.ugc-mock-test-staging` |
| 4 | **No App Check key** | App Check runs in monitor mode with no site key | Create a reCAPTCHA Enterprise key for the staging origin; supply the public site key only |
| 5 | **No private GitHub repository** | `gh` token invalid and no GitHub connector, so the repo exists locally only (git history intact) | Authorise a GitHub connection or create an empty private repo `ureducator-platform-v2` and give push access; then `git push` |
| 6 | **App Hosting not used** | Needs a GitHub link. The static-export design deploys to ordinary Firebase Hosting instead (ADR-001). This is the staging-only alternative; it is a reported decision, not a silent switch | Say so if you specifically want App Hosting in `asia-southeast1` later |
| 7 | **Business decisions (non-blocking)** | Prices, GST, refund policy, brand copy are deliberately unset/unpublished | Decide when ready; the system holds them as configurable data |

Not blockers, but still open: verification of the UGC-NET syllabus and exam pattern against official NTA documents (nothing is labelled "Fully verified"), real question content (only 10 original + 150 synthetic demo items exist), Razorpay test keys (payment phase), Vertex AI enablement (live AI is off).
