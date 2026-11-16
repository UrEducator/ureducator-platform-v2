/**
 * UrEducator 2.0 — Phase F: Question Bank & Scalable Taxonomy Migration
 *
 * Backfills:
 *   1. `setCode` for the 5 existing PYQ mock tests using the taxonomy standard:
 *      [SOURCE]-[EXAM]-[SUBJECT]-[TYPE]-[ID]
 *      - mt-pyq-2024-jun18-s1 -> PYQ-UN-P1-24J-S1
 *      - mt-pyq-2024-jun18-s2 -> PYQ-UN-P1-24J-S2
 *      - mt-pyq-2026-sep09-s1 -> PYQ-UN-P1-26S09-S1
 *      - mt-pyq-2026-sep09-s2 -> PYQ-UN-P1-26S09-S2
 *      - mt-pyq-2026-sep10-s1 -> PYQ-UN-P1-26S10-S1
 *
 *   2. `usedInSets` array for all 250 existing questions in `questions/{qid}`
 *      and version documents in `questions/{qid}/versions/1`.
 *
 * Usage:
 *   Dry-run:
 *     node scripts/migrate-phase-f-taxonomy.mjs --project ugc-mock-test-staging
 *   Live migration:
 *     node scripts/migrate-phase-f-taxonomy.mjs --project ugc-mock-test-staging --confirm-write
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const STAGING_PROJECT = 'ugc-mock-test-staging';
const REPO_ROOT = resolve(process.cwd());

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => {
  const i = args.indexOf(n);
  return i >= 0 && i < args.length - 1 ? args[i + 1] : undefined;
};

const project = value('--project');
const confirmWrite = flag('--confirm-write');

if (!project || project !== STAGING_PROJECT) {
  console.error(`[ERROR] Must specify --project ${STAGING_PROJECT}`);
  process.exit(1);
}

const TAXONOMY_MAP = {
  'mt-pyq-2024-jun18-s1': {
    setCode: 'PYQ-UN-P1-24J-S1',
    title: 'UGC NET Paper 1 — 18 June 2024 (Shift 1)',
  },
  'mt-pyq-2024-jun18-s2': {
    setCode: 'PYQ-UN-P1-24J-S2',
    title: 'UGC NET Paper 1 — 18 June 2024 (Shift 2)',
  },
  'mt-pyq-2026-sep09-s1': {
    setCode: 'PYQ-UN-P1-26S09-S1',
    title: 'UGC NET Paper 1 — 09 September 2026 (Shift 1)',
  },
  'mt-pyq-2026-sep09-s2': {
    setCode: 'PYQ-UN-P1-26S09-S2',
    title: 'UGC NET Paper 1 — 09 September 2026 (Shift 2)',
  },
  'mt-pyq-2026-sep10-s1': {
    setCode: 'PYQ-UN-P1-26S10-S1',
    title: 'UGC NET Paper 1 — 10 September 2026 (Shift 1)',
  },
};

async function migrate() {
  console.log(`[INIT] Connecting to Firestore in project '${STAGING_PROJECT}'...`);
  console.log(`[MODE] ${confirmWrite ? 'LIVE WRITE CONFIRMED' : 'DRY-RUN (use --confirm-write to execute)'}`);
  
  const app = initializeApp({ projectId: STAGING_PROJECT });
  const db = getFirestore(app);
  const nowMs = Date.now();

  let totalTestsUpdated = 0;
  let totalQuestionsUpdated = 0;

  for (const [testId, info] of Object.entries(TAXONOMY_MAP)) {
    console.log(`\n============================================================`);
    console.log(`Processing Shift: ${testId}`);
    console.log(`Set Code:         ${info.setCode}`);
    console.log(`============================================================`);

    // 1. Update Mock Test document in mockTests/{testId}
    const testRef = db.collection('mockTests').doc(testId);
    const testSnap = await testRef.get();
    if (!testSnap.exists) {
      console.warn(`[WARN] Mock test doc ${testId} not found in Firestore!`);
    } else {
      console.log(`[TEST] Found existing test: "${testSnap.data()?.title}"`);
      if (confirmWrite) {
        await testRef.set(
          {
            setCode: info.setCode,
            updatedAtMs: nowMs,
          },
          { merge: true }
        );
        console.log(`[OK] Updated mockTests/${testId} with setCode: ${info.setCode}`);
      } else {
        console.log(`[DRY-RUN] Would update mockTests/${testId} with setCode: ${info.setCode}`);
      }
      totalTestsUpdated++;
    }

    // Update local shift file if present
    const localFilePath = join(REPO_ROOT, 'content-sources', 'shifts', `${testId}.json`);
    if (existsSync(localFilePath)) {
      try {
        const fileContent = JSON.parse(readFileSync(localFilePath, 'utf8'));
        fileContent.setCode = info.setCode;
        if (confirmWrite) {
          writeFileSync(localFilePath, JSON.stringify(fileContent, null, 2) + '\n', 'utf8');
          console.log(`[FILE] Updated local shift file: ${testId}.json with setCode: ${info.setCode}`);
        }
      } catch (err) {
        console.warn(`[WARN] Could not update local file ${localFilePath}: ${err.message}`);
      }
    }

    // 2. Update all 50 questions for this shift
    const batch = db.batch();
    let batchCount = 0;

    for (let qIdx = 1; qIdx <= 50; qIdx++) {
      const qNum = String(qIdx).padStart(2, '0');
      const canonicalQid = `${testId}-q${qNum}`;

      const qRef = db.collection('questions').doc(canonicalQid);
      const vRef = qRef.collection('versions').doc('1');

      if (confirmWrite) {
        // Merge usedInSets on the top-level question doc
        batch.set(
          qRef,
          {
            usedInSets: [info.setCode],
            mockTestId: testId,
            shiftId: testId,
            provenance: {
              kind: 'official_pyq',
              officialPyqVerified: false,
              copyrightStatus: 'public_domain',
              source: 'NTA UGC NET PYQ',
            },
            updatedAtMs: nowMs,
          },
          { merge: true }
        );

        // Merge usedInSets on version 1 doc
        batch.set(
          vRef,
          {
            usedInSets: [info.setCode],
          },
          { merge: true }
        );

        batchCount += 2;
      }
      totalQuestionsUpdated++;
    }

    if (confirmWrite && batchCount > 0) {
      await batch.commit();
      console.log(`[OK] Committed batch update for 50 questions (and versions) of ${testId}`);
    } else if (!confirmWrite) {
      console.log(`[DRY-RUN] Would update 50 questions for ${testId} with usedInSets: [${info.setCode}]`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`MIGRATION SUMMARY`);
  console.log(`============================================================`);
  console.log(`Total Mock Tests Updated:  ${totalTestsUpdated} / 5`);
  console.log(`Total Questions Updated:   ${totalQuestionsUpdated} / 250`);
  console.log(`Status:                    ${confirmWrite ? 'COMPLETED SUCCESSFULLY' : 'DRY-RUN FINISHED'}`);
  console.log(`============================================================\n`);
}

migrate().catch((e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
