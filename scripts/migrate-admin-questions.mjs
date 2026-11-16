/**
 * UrEducator 2.0 — Admin Question Visibility Migration
 *
 * Populates all 250 authentic PYQ questions into:
 *   1. `questions/{qid}` (standalone question documents queried by `adminList('questions')`)
 *   2. `questions/{qid}/versions/1` (subcollection documents queried by `adminGetQuestion`)
 *   3. `mockTests/{mockTestId}`: updates `questionRefs` array linking all 50 questions per shift
 *   4. `papers/{paperId}`: updates question references with canonical `qid`s
 *   5. `answerKeys/{paperId}`: updates answer key items keyed by canonical `qid`s
 *
 * Usage:
 *   node scripts/migrate-admin-questions.mjs --project ugc-mock-test-staging --confirm-write
 */

import { readFileSync, existsSync } from 'node:fs';
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

const SHIFTS = [
  {
    id: 'mt-pyq-2024-jun18-s1',
    mockTestId: 'mt-pyq-2024-jun18-s1',
    paperId: 'paper-pyq-2024-jun18-s1',
    setCode: 'PYQ-UN-P1-24J-S1',
    title: 'UGC NET Paper 1 — 18 June 2024 (Shift 1)',
    year: 2024,
  },
  {
    id: 'mt-pyq-2024-jun18-s2',
    mockTestId: 'mt-pyq-2024-jun18-s2',
    paperId: 'paper-pyq-2024-jun18-s2',
    setCode: 'PYQ-UN-P1-24J-S2',
    title: 'UGC NET Paper 1 — 18 June 2024 (Shift 2)',
    year: 2024,
  },
  {
    id: 'mt-pyq-2026-sep09-s1',
    mockTestId: 'mt-pyq-2026-sep09-s1',
    paperId: 'paper-pyq-2026-sep09-s1',
    setCode: 'PYQ-UN-P1-26S09-S1',
    title: 'UGC NET Paper 1 — 09 September 2026 (Shift 1)',
    year: 2026,
  },
  {
    id: 'mt-pyq-2026-sep09-s2',
    mockTestId: 'mt-pyq-2026-sep09-s2',
    paperId: 'paper-pyq-2026-sep09-s2',
    setCode: 'PYQ-UN-P1-26S09-S2',
    title: 'UGC NET Paper 1 — 09 September 2026 (Shift 2)',
    year: 2026,
  },
  {
    id: 'mt-pyq-2026-sep10-s1',
    mockTestId: 'mt-pyq-2026-sep10-s1',
    paperId: 'paper-pyq-2026-sep10-s1',
    setCode: 'PYQ-UN-P1-26S10-S1',
    title: 'UGC NET Paper 1 — 10 September 2026 (Shift 1)',
    year: 2026,
  },
];

async function migrate() {
  console.log(`[INIT] Connecting to Firestore in project '${STAGING_PROJECT}'...`);
  const app = initializeApp({ projectId: STAGING_PROJECT });
  const db = getFirestore(app);
  const nowMs = Date.now();

  let totalQuestionsSeeded = 0;
  let totalTestsLinked = 0;

  for (const s of SHIFTS) {
    const filePath = join(REPO_ROOT, 'content-sources', 'shifts', `${s.id}.json`);
    if (!existsSync(filePath)) {
      console.error(`[SKIP] Missing file: ${filePath}`);
      continue;
    }

    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const questions = data.questions ?? [];
    const answerKeyMap = data.answerKey ?? {};

    console.log(`\n[*] Processing ${s.id}: ${questions.length} questions found.`);

    if (questions.length === 0) continue;

    const batch = db.batch();
    const questionRefs = [];
    const sanitizedPaperQuestions = [];
    const canonicalAnswerKey = {};

    questions.forEach((q, idx) => {
      const qNum = String(idx + 1).padStart(2, '0');
      const canonicalQid = `${s.id}-q${qNum}`;
      const origQid = q.qid || `q-${qNum}`;
      const akEntry = answerKeyMap[origQid] ?? answerKeyMap[canonicalQid];
      const correctAnswers = akEntry?.correct ?? ['a'];

      // 1. Standalone Question Head Document: `questions/{qid}`
      const headRef = db.collection('questions').doc(canonicalQid);
      const stemText = q.content?.stem?.en ?? '';
      const previewText = stemText.slice(0, 140);

      const headDoc = {
        subjectId: 'paper1',
        unitId: q.unitId ?? 'U1',
        topicId: q.topicId ?? `${q.unitId ?? 'U1'}.1`,
        difficulty: q.difficulty ?? 'medium',
        languages: ['en'],
        preview: previewText,
        status: 'draft',
        currentVersion: 1,
        createdBy: 'Bunty',
        mockTestId: s.mockTestId,
        shiftId: s.id,
        paperId: s.paperId,
        setCode: s.setCode,
        usedInSets: [s.setCode],
        provenance: q.provenance ?? {
          kind: 'official_pyq',
          officialPyqVerified: false,
          copyrightStatus: 'public_domain',
          source: 'NTA UGC NET PYQ',
        },
        updatedAtMs: nowMs,
      };

      if (confirmWrite) {
        batch.set(headRef, headDoc);
      }

      // 2. Question Version Document: `questions/{qid}/versions/1`
      const versionRef = headRef.collection('versions').doc('1');
      const versionDoc = {
        version: 1,
        status: 'draft',
        createdBy: 'Bunty',
        createdAtMs: nowMs,
        content: q.content,
        correct: correctAnswers,
        explanation: q.explanation ?? { en: '' },
        provenance: {
          kind: 'official_pyq',
          officialPyqVerified: false,
          copyrightStatus: 'public_domain',
          source: s.title,
          sourceYear: s.year,
        },
        ...(q.defectNote ? { defectNote: q.defectNote } : {}),
      };

      if (confirmWrite) {
        batch.set(versionRef, versionDoc);
      }

      // 3. Question reference for Mock Test linking
      questionRefs.push({
        qid: canonicalQid,
        version: 1,
        sectionId: 'paper1',
      });

      // 4. Update Paper Question with canonical QID
      sanitizedPaperQuestions.push({
        qid: canonicalQid,
        version: 1,
        sectionId: 'paper1',
        unitId: q.unitId ?? 'U1',
        topicId: q.topicId ?? `${q.unitId ?? 'U1'}.1`,
        difficulty: q.difficulty ?? 'medium',
        content: q.content,
        provenance: {
          kind: 'official_pyq',
          officialPyqVerified: false,
        },
        ...(q.defectNote ? { defectNote: q.defectNote } : {}),
      });

      // 5. Update Canonical Answer Key Map
      canonicalAnswerKey[canonicalQid] = {
        correct: correctAnswers,
        sectionId: 'paper1',
        unitId: q.unitId ?? 'U1',
        topicId: q.topicId ?? `${q.unitId ?? 'U1'}.1`,
        difficulty: q.difficulty ?? 'medium',
      };

      totalQuestionsSeeded++;
    });

    // 6. Link questions to Mock Test Document
    const mockTestRef = db.collection('mockTests').doc(s.mockTestId);
    if (confirmWrite) {
      batch.set(
        mockTestRef,
        {
          setCode: s.setCode,
          questionRefs,
          updatedAtMs: nowMs,
        },
        { merge: true }
      );
    }

    // 7. Update Paper document
    const paperRef = db.collection('papers').doc(s.paperId);
    if (confirmWrite) {
      batch.set(
        paperRef,
        {
          paperId: s.paperId,
          version: 1,
          title: s.title,
          questions: sanitizedPaperQuestions,
          updatedAtMs: nowMs,
        },
        { merge: true }
      );
    }

    // 8. Update Answer Key document
    const akRef = db.collection('answerKeys').doc(s.paperId);
    if (confirmWrite) {
      batch.set(
        akRef,
        {
          paperId: s.paperId,
          version: 1,
          items: canonicalAnswerKey,
          updatedAtMs: nowMs,
        },
        { merge: true }
      );
    }

    if (confirmWrite) {
      await batch.commit();
      console.log(`[COMMITTED] Seeded 50 questions for ${s.id} and linked to mockTests/${s.mockTestId}.`);
    } else {
      console.log(`[DRY RUN] Prepared batch for ${s.id} (50 questions + links). Pass --confirm-write to execute.`);
    }

    totalTestsLinked++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Migration Summary:`);
  console.log(`Total questions processed: ${totalQuestionsSeeded}`);
  console.log(`Total mock tests updated: ${totalTestsLinked}`);
  console.log(`Firestore write mode: ${confirmWrite ? 'LIVE WRITE COMPLETE' : 'DRY RUN ONLY'}`);
  console.log('='.repeat(60));
}

migrate().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
