# What I need from the owner (updated for Phase M8.1)

Deployment is **blocked at the rules gate**, not by anything you did wrong: the Firestore emulator can only be downloaded from Google, and the build sandbox cannot reach that host. Per the M8.1 rules, nothing is deployed until the emulator rules suite passes. The suite is written and ready; it has to run once on your Windows PC.

## Do these in order

| # | You do | Where | Needed for |
|---|---|---|---|
| 1 | Install **Node.js 24 LTS** and **Eclipse Temurin JDK 21+**, open a NEW PowerShell | your PC | the emulator rules tests |
| 2 | Run the local gate and paste me the **whole output**: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-readiness.ps1` | repo folder | proves the 57 rules tests pass on the real emulator |
| 3 | Enable **Email/Password** sign-in in **ugc-mock-test-staging** only. Leave **Anonymous** off | Firebase console → Authentication → Sign-in method | students can register |
| 4 | Run the read-only cloud preflight (runbook section 3) and paste the output: `login:list`, `apps:list`, `apps:sdkconfig` (all with `--project ugc-mock-test-staging`) | PowerShell | confirms account, project id and number, gives the public web API key |
| 5 | Check billing in the console (Blaze linked, ₹1,000 alert-only budget, month-to-date cost) and tell me the number | Google Cloud console → Billing | cost guard |
| 6 | Say **"go deploy staging"** once steps 2–5 look good (or run runbook section 5 yourself) | chat | the actual deployment |

Later (not blocking the first staging release): choose the owner email for `OWNER_BOOTSTRAP_EMAIL`; App Check reCAPTCHA Enterprise site key; private GitHub repo.

## Why I cannot do steps 2–6 myself right now

* The PC bridge to your computer was offline on every attempt in this session, so I could not run anything on Windows or the Firebase CLI.
* My sandbox cannot reach Google download or API hosts, so I cannot run the emulator or any cloud command from here.
