# Firestore data model

Database: `(default)`, Native mode, `asia-south1`, in project `ugc-mock-test-staging`. All writes go through Cloud Functions (Admin SDK). Browsers may only read the rows marked **client read**.

| Collection / path | Contents | Client read | Notes |
|---|---|---|---|
| `subjects`, `units`, `topics` | Versioned UGC-NET catalogue with `label` (fully_verified / under_development / sample / coming_soon) | public | Nothing is `fully_verified` until a human checks official documents |
| `examBlueprints/{id}` | Sections, counts, marks, duration, `officialPatternVerified` | public | |
| `mockTests/{id}` | Title, kind, blueprint, paper ref, access, label, `revealPolicy`, status | published only | Query must include `status == 'published'` |
| `plans/{id}` | Configurable price (paise), entitlements, `published` | published only | Created unpublished; only owner/super_admin can publish a price |
| `publishedPapers/{id}` | Sanitised questions (no answers) | **never** | Served only via `startExam` |
| `answerKeys/{id}` | Correct options, explanations | **never** | |
| `questions/{id}` + `versions/{n}` | Editorial bank: provenance, workflow status, `preview`, author/reviewer | **never** | Draft → Review → Approved → Published |
| `examSessions/{id}` | uid, order, deadline (server clock), status, `seq` | own | Query must include `uid == auth.uid` |
| `examResponses/{id}` | Saved answers | **never** | |
| `results/{id}` | Scores, section/unit/topic breakdown | own | |
| `performanceSnapshots/{uid}` | Rolling analytics aggregate | own (get) | |
| `studyPlans/{uid}` | Generated plan | own (get) | |
| `errorNotebook/{uid}/entries/{id}` | Wrong/skipped items, spaced-repetition state, `visibleAtMs` | **never** | Served via `listNotebook` |
| `learningNotes/{id}` | Verified notes used by the mentor | **never** | |
| `users/{uid}` | Profile, onboarding | own (get) | |
| `subscriptions/{uid}`, `orders/{id}`, `paymentEvents/{id}`, `coupons/{id}` | Payment architecture (empty while disabled) | own subscription / own orders | |
| `supportTickets/{id}` | Student tickets | own | |
| `leads/{id}`, `consentRecords/{id}` | Marketing leads with explicit consent | **never** | Rate limited per IP |
| `reports/{id}` | Issued PDF report metadata | **never** | Verified via `verifyReport` |
| `auditLogs/{id}` | Who did what (never contains answers) | **never** | |
| `systemSettings/{id}` | Includes `_reportKey` | **never** | |
| `rateLimits/{id}` | Counters; TTL on `expireAt` | **never** | |
| `roles/{id}` | Role records | **never** | |

Composite indexes (`firestore.indexes.json`): `examSessions(uid, startedAtMs desc)`, `results(uid, submittedAtMs desc)`, `supportTickets(uid, createdAtMs desc)`, `mockTests(status, title)`, `plans(published, pricePaise)`. A read-through of every query in `functions/src` and `apps/web/src/lib/backend.firebase.ts` found no query that needs an index beyond these. This was checked by reading, not by running against Firestore.
