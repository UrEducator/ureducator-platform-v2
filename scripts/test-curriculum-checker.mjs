#!/usr/bin/env node
/**
 * UrEducator 2.0 — Test Suite for Local Curriculum Checker
 * Demonstrates positive and negative validation cases for Paper I syllabus transcription.
 * Uses synthetic structural fixtures only; contains ZERO actual syllabus content.
 */

import { validateSyllabus } from './check-curriculum.mjs';

function createMockSyllabus(overrides = {}) {
  const base = {
    $schema: './paper1.schema.json',
    subjectCode: '00',
    subjectName: {
      en: 'General Paper on Teaching & Research Aptitude (Paper-I)',
      hi: 'सामान्य प्रश्नपत्र: शिक्षण और शोध अभिवृत्ति (प्रश्नपत्र-I)'
    },
    syllabusVersion: 1,
    status: 'draft',
    verification: 'unverified',
    effectiveFrom: 'unknown',
    sourceDocuments: [
      {
        docId: 'S4-TEST-DOC',
        title: 'Mock Test Source Document',
        language: 'both',
        sha256: '0000000000000000000000000000000000000000000000000000000000000000'
      }
    ],
    transcription: {
      transcriber: { name: 'Person_Transcriber_1', date: '2026-11-05' },
      verifier: { name: 'Person_Verifier_2', date: '2026-11-05' }
    },
    units: [
      {
        unitNo: 1,
        title: {
          en: 'Synthetic Mock Unit 1 [TEST FIXTURE - NOT OFFICIAL CONTENT]',
          hi: 'सिंथेटिक मॉक यूनिट 1 [परीक्षण फ़िक्सर - आधिकारिक सामग्री नहीं]'
        },
        statements: [
          {
            statementNo: 1,
            text: {
              en: 'Synthetic statement 1.1 [TEST FIXTURE]',
              hi: 'सिंथेटिक विवरण 1.1 [परीक्षण फ़िक्सर]'
            },
            page: 1,
            sourceDocId: 'S4-TEST-DOC'
          },
          {
            statementNo: 2,
            text: {
              en: 'Synthetic statement 1.2 [TEST FIXTURE]',
              hi: 'सिंथेटिक विवरण 1.2 [परीक्षण फ़िक्सर]'
            },
            page: 1,
            sourceDocId: 'S4-TEST-DOC'
          }
        ]
      },
      {
        unitNo: 2,
        title: {
          en: 'Synthetic Mock Unit 2 [TEST FIXTURE - NOT OFFICIAL CONTENT]',
          hi: 'सिंथेटिक मॉक यूनिट 2 [परीक्षण फ़िक्सर - आधिकारिक सामग्री नहीं]'
        },
        statements: [
          {
            statementNo: 1,
            text: {
              en: 'Synthetic statement 2.1 [TEST FIXTURE]',
              hi: 'सिंथेटिक विवरण 2.1 [परीक्षण फ़िक्सर]'
            },
            page: 2,
            sourceDocId: 'S4-TEST-DOC'
          }
        ]
      }
    ]
  };

  return { ...base, ...overrides };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

console.log('Running Curriculum Checker Test Suite...');
console.log('------------------------------------------------------------------------');

// 1. Empty starter document passes as preparation state
{
  const emptyStarter = {
    $schema: './paper1.schema.json',
    subjectCode: '00',
    subjectName: {
      en: 'General Paper on Teaching & Research Aptitude (Paper-I)',
      hi: 'सामान्य प्रश्नपत्र: शिक्षण और शोध अभिवृत्ति (प्रश्नपत्र-I)'
    },
    syllabusVersion: 1,
    status: 'draft',
    verification: 'unverified',
    effectiveFrom: 'unknown',
    sourceDocuments: [],
    transcription: {
      transcriber: { name: 'PENDING_TRANSCRIPTION', date: '' },
      verifier: { name: 'PENDING_VERIFICATION', date: '' }
    },
    units: []
  };

  const res = validateSyllabus(emptyStarter);
  assert(res.valid === true, 'Empty starter document is structurally valid');
  assert(res.isStarter === true, 'Empty starter correctly identified as preparation state');
  assert(res.warnings.some((w) => w.includes('PREPARATION_STARTER')), 'Empty starter emits preparation starter warning');
  assert(res.errors.length === 0, 'Empty starter has 0 errors');
}

// 2. Properly populated sample passes structural validation
{
  const sample = createMockSyllabus();
  const res = validateSyllabus(sample);
  assert(res.valid === true, 'Properly populated sample passes validation');
  assert(res.isStarter === false, 'Populated sample is not marked as starter');
  assert(res.summary.unitCount === 2, 'Summary reports correct unit count (2)');
  assert(res.summary.totalStatements === 3, 'Summary reports correct statement count (3)');
  assert(res.summary.coverage.pageCoveragePercent === 100, 'Page citation coverage is 100%');
  assert(res.summary.coverage.hindiCoveragePercent === 100, 'Hindi coverage is 100%');
  assert(res.summary.coverage.englishCoveragePercent === 100, 'English coverage is 100%');
}

// 3. Missing page references fail
{
  const sample = createMockSyllabus();
  // Remove page reference from Unit 1 Statement 1
  delete sample.units[0].statements[0].page;
  const res = validateSyllabus(sample);
  assert(res.valid === false, 'Missing statement page reference causes validation failure');
  assert(res.errors.some((e) => e.includes('page reference')), 'Error message indicates missing page reference');
}

// 4. Missing Hindi content fails
{
  // Missing Hindi unit title
  const sample1 = createMockSyllabus();
  delete sample1.units[0].title.hi;
  const res1 = validateSyllabus(sample1);
  assert(res1.valid === false, 'Missing Hindi unit title causes validation failure');
  assert(res1.errors.some((e) => e.includes('missing Hindi title')), 'Error message indicates missing Hindi title');

  // Missing Hindi statement text
  const sample2 = createMockSyllabus();
  delete sample2.units[0].statements[0].text.hi;
  const res2 = validateSyllabus(sample2);
  assert(res2.valid === false, 'Missing Hindi statement text causes validation failure');
  assert(res2.errors.some((e) => e.includes('missing Hindi statement text')), 'Error message indicates missing Hindi statement');
}

// 5. Duplicate or non-contiguous unit numbers fail
{
  // Non-contiguous units (Unit 1, Unit 3)
  const sample1 = createMockSyllabus();
  sample1.units[1].unitNo = 3;
  const res1 = validateSyllabus(sample1);
  assert(res1.valid === false, 'Non-contiguous unit numbering (1, 3) causes validation failure');
  assert(res1.errors.some((e) => e.includes('non-contiguous unit numbering')), 'Error indicates non-contiguous units');

  // Duplicate unit numbers (Unit 1, Unit 1)
  const sample2 = createMockSyllabus();
  sample2.units[1].unitNo = 1;
  const res2 = validateSyllabus(sample2);
  assert(res2.valid === false, 'Duplicate unit numbering (1, 1) causes validation failure');
  assert(res2.errors.some((e) => e.includes('duplicate unitNo')), 'Error indicates duplicate unitNo');
}

// 6. Missing or identical verifier/transcriber identities fail
{
  // Missing verifier
  const sample1 = createMockSyllabus({
    transcription: {
      transcriber: { name: 'Person_A', date: '2026-11-05' },
      verifier: { name: '', date: '' }
    }
  });
  const res1 = validateSyllabus(sample1);
  assert(res1.valid === false, 'Missing verifier identity causes validation failure');
  assert(res1.errors.some((e) => e.includes('Missing verifier identity')), 'Error indicates missing verifier');

  // Identical transcriber and verifier (Self-verification violation)
  const sample2 = createMockSyllabus({
    transcription: {
      transcriber: { name: 'Same_Person', date: '2026-11-05' },
      verifier: { name: 'Same_Person', date: '2026-11-05' }
    }
  });
  const res2 = validateSyllabus(sample2);
  assert(res2.valid === false, 'Identical transcriber and verifier causes validation failure');
  assert(res2.errors.some((e) => e.includes('verifier') && e.includes('identical to transcriber')), 'Error indicates dual verification violation');
}

console.log('------------------------------------------------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
}
