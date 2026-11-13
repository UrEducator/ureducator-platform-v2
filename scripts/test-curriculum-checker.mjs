#!/usr/bin/env node
/**
 * UrEducator 2.0 — Permanent Test Suite for Local Curriculum Checker
 * Validates Paper I syllabus transcription records against academic governance rules.
 * Incorporates Claude C-03 Review Corrections (R-1 through R-7) and the 75-probe regression harness.
 * Uses synthetic structural fixtures only; contains ZERO actual syllabus content.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import {
  validateSyllabus,
  CANONICAL_PAPER_1_UNITS,
  normalizeIdentity,
  isPlaceholderName,
  containsProsePlaceholder,
  containsPlaceholder,
  isCliEntry,
  PROSE_BRACKETED_PLACEHOLDER_REGEX
} from './check-curriculum.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const clone = (o) => JSON.parse(JSON.stringify(o));
const H = 'a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e';

function create10Units() {
  return CANONICAL_PAPER_1_UNITS.map((u) => ({
    unitNo: u.unitNo,
    title: {
      en: u.titleEn,
      hi: u.titleHi
    },
    statements: [
      {
        statementNo: 1,
        text: {
          en: `Statement ${u.unitNo}.1`,
          hi: `विवरण ${u.unitNo}.1`
        },
        page: u.unitNo,
        sourceDocId: 'DOC-EN'
      }
    ]
  }));
}

function createBaseFixture() {
  return {
    subjectCode: '00',
    subjectName: {
      en: 'General Paper on Teaching & Research Aptitude (Paper-I)',
      hi: 'सामान्य प्रश्नपत्र: शिक्षण और शोध अभिवृत्ति (प्रश्नपत्र-I)'
    },
    syllabusVersion: 1,
    status: 'in_review',
    verification: 'unverified',
    effectiveFrom: '2024-06',
    sourceDocuments: [
      {
        docId: 'DOC-EN',
        title: 'Mock Source Document',
        language: 'both',
        sha256: H
      }
    ],
    transcription: {
      transcriber: { name: 'Alice Smith', date: '2026-11-05' },
      verifier: { name: 'Bob Jones', date: '2026-11-05' }
    },
    units: create10Units()
  };
}

function createV3Fixture() {
  const d = createBaseFixture();
  d.verification = 'dual_verified';
  d.transcription.secondVerifier = { name: 'Carol White', date: '2026-11-06' };
  d.transcription.isManuallyTypedFromVisual = true;
  return d;
}

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

console.log('Running UrEducator 2.0 Curriculum Checker Test Suite...');
console.log('========================================================================');

// SECTION 1: Baseline Controls & Identity Normalization (C-1, C-3, C-4)
console.log('\n--- Section 1: Baseline Controls & Identity Normalization ---');
{
  // C-1: normalizeIdentity normalization matrix
  assert(normalizeIdentity('  Alice  ') === 'Alice', 'normalizeIdentity collapses whitespace');
  assert(normalizeIdentity('Bob\u200B') === 'Bob', 'normalizeIdentity strips zero-width space');
  assert(normalizeIdentity('Carol\uFEFF') === 'Carol', 'normalizeIdentity strips byte-order mark');
  assert(normalizeIdentity('Ｂｏｂ') === 'Bob', 'normalizeIdentity normalizes full-width ASCII via NFKC');
  assert(normalizeIdentity('Alice\tSmith') === 'Alice Smith', 'normalizeIdentity converts horizontal tabs to spaces');
  assert(normalizeIdentity('Alice\nSmith') === 'Alice Smith', 'normalizeIdentity converts newlines to spaces');
  assert(normalizeIdentity('Alice\r\v\f\u0085\u2028\u2029Smith') === 'Alice Smith', 'normalizeIdentity converts all linebreaks/formfeeds to spaces');
  assert(normalizeIdentity('Char\u00ADles') === 'Charles', 'normalizeIdentity strips soft-hyphen (\\u00AD)');
  assert(normalizeIdentity('Da\u200Evid') === 'David', 'normalizeIdentity strips left-to-right mark (\\u200E)');
  assert(normalizeIdentity('E\u2060ve') === 'Eve', 'normalizeIdentity strips word-joiner (\\u2060)');
  assert(normalizeIdentity('A\u034Flice') === 'Alice', 'normalizeIdentity strips combining grapheme joiner (\\u034F)');
  assert(normalizeIdentity('A\uFE00lice') === 'Alice', 'normalizeIdentity strips variation selector (\\uFE00)');
  assert(normalizeIdentity('A\u180Elice') === 'Alice', 'normalizeIdentity strips Mongolian vowel separator (\\u180E)');
  assert(normalizeIdentity('  डॉ. राजेश कुमार  ') === 'डॉ. राजेश कुमार', 'normalizeIdentity preserves Devanagari vowel signs, matras, and dots intact');
  assert(normalizeIdentity('Dr. Robert Mockler') === 'Dr. Robert Mockler', 'normalizeIdentity preserves academic title and legitimate name');

  // C-3: isPlaceholderName & containsPlaceholder word-boundary matrix
  assert(isPlaceholderName('Mockler') === false, 'isPlaceholderName does not flag legitimate name Mockler');
  assert(isPlaceholderName('Dr. Robert Mockler') === false, 'isPlaceholderName does not flag Dr. Robert Mockler');
  assert(isPlaceholderName('Mastodon') === false, 'isPlaceholderName does not flag Mastodon (contains TODO as substring)');
  assert(isPlaceholderName('Teaching Aptitude') === false, 'isPlaceholderName does not flag Teaching Aptitude');
  assert(isPlaceholderName('TODO') === true, 'isPlaceholderName flags TODO');
  assert(isPlaceholderName('[TODO]') === true, 'isPlaceholderName flags [TODO]');
  assert(isPlaceholderName('TODO:') === true, 'isPlaceholderName flags TODO:');
  assert(isPlaceholderName('_TODO_') === true, 'isPlaceholderName flags _TODO_');
  assert(isPlaceholderName('TODO_fix') === true, 'isPlaceholderName flags TODO_fix');
  assert(isPlaceholderName('fix_TODO') === true, 'isPlaceholderName flags fix_TODO');
  assert(isPlaceholderName('TO\u200BDO') === true, 'isPlaceholderName flags TO\\u200BDO (obscured with zero-width char)');
  assert(isPlaceholderName('TBD') === true, 'isPlaceholderName flags TBD');
  assert(isPlaceholderName('PLACEHOLDER') === true, 'isPlaceholderName flags PLACEHOLDER');
  assert(isPlaceholderName('Lorem ipsum') === true, 'isPlaceholderName flags Lorem ipsum');
  assert(isPlaceholderName('Lorem   ipsum') === true, 'isPlaceholderName flags Lorem   ipsum (multiple spaces)');
  assert(isPlaceholderName('Lorem\nipsum') === true, 'isPlaceholderName flags Lorem\\nipsum (with newline)');
  assert(isPlaceholderName('DUMMY') === true, 'isPlaceholderName flags DUMMY');
  assert(isPlaceholderName('FIXME') === true, 'isPlaceholderName flags FIXME');
  assert(isPlaceholderName('TEST FIXTURE') === true, 'isPlaceholderName flags TEST FIXTURE');
  assert(isPlaceholderName('परीक्षण') === true, 'isPlaceholderName flags Devanagari placeholder परीक्षण');
  assert(isPlaceholderName('PENDING_TRANSCRIPTION') === true, 'isPlaceholderName flags PENDING_TRANSCRIPTION');
  assert(isPlaceholderName('PENDING_VERIFICATION') === true, 'isPlaceholderName flags PENDING_VERIFICATION');

  // E-4 (N20/N21): Independent testing of both sides of Unicode placeholder boundaries
  assert(isPlaceholderName('TODO_after') === true, 'N20: Word boundary after placeholder (TODO_after)');
  assert(isPlaceholderName('before_TODO') === true, 'N21: Word boundary before placeholder (before_TODO)');
  assert(isPlaceholderName('xTODO') === false, 'N20: Non-boundary before Latin letter (xTODO)');
  assert(isPlaceholderName('TODOx') === false, 'N21: Non-boundary after Latin letter (TODOx)');
  assert(isPlaceholderName('अTODO') === false, 'N20: Non-boundary before Devanagari letter (अTODO)');
  assert(isPlaceholderName('TODOअ') === false, 'N21: Non-boundary after Devanagari letter (TODOअ)');
  assert(isPlaceholderName('(TODO)') === true, 'N20/N21: Punctuation boundaries (TODO)');

  // E-4 (N27/N31): Flexible whitespace in multi-word placeholders
  assert(containsProsePlaceholder('Lorem\t\t\n  Ipsum') === true, 'N27: LOREM IPSUM with tabs and linebreaks');
  assert(containsProsePlaceholder('TEST\t\n  FIXTURE') === true, 'N31: TEST FIXTURE with tabs and linebreaks');

  // E-2 / E-4 (N34): Stricter name placeholder policy vs. permissive academic prose policy
  assert(isPlaceholderName('UNKNOWN') === true, 'N34: UNKNOWN rejected as human identity name');
  assert(containsProsePlaceholder('Estimation of unknown parameters in population models.') === false, 'N34: unknown parameters accepted in academic prose');
  assert(containsProsePlaceholder('Study of Unknown Systems') === false, 'N34: Unknown Systems accepted in academic prose');
  assert(containsProsePlaceholder('Computer-Based Testing') === false, 'E-2: Computer-Based Testing accepted in academic prose');
  assert(containsProsePlaceholder('Dummy variables in regression') === false, 'E-2: Dummy variables accepted in academic prose');
  assert(containsProsePlaceholder('Pending cases in dispute resolution') === false, 'E-2: Pending cases accepted in academic prose');
  assert(containsProsePlaceholder('Placeholder values in templates') === false, 'E-2: Placeholder values accepted in academic prose');
  assert(containsProsePlaceholder('कंप्यूटर आधारित परीक्षण') === false, 'E-2: कंप्यूटर आधारित परीक्षण accepted in academic prose');
  assert(containsProsePlaceholder('परिकल्पना परीक्षण') === false, 'E-2: परिकल्पना परीक्षण accepted in academic prose');
  assert(containsProsePlaceholder('सार्थकता परीक्षणों का विश्लेषण') === false, 'E-2: सार्थकता परीक्षणों accepted in academic prose');

  // E-2: Structured placeholders in academic prose
  assert(containsProsePlaceholder('[TODO]') === true, 'E-2: [TODO] rejected in academic prose');
  assert(containsProsePlaceholder('[परीक्षण]') === true, 'E-2: [परीक्षण] rejected in academic prose');
  assert(containsProsePlaceholder('[TEST FIXTURE]') === true, 'E-2: [TEST FIXTURE] rejected in academic prose');
  assert(containsProsePlaceholder('[TEST FIXTURE - NOT OFFICIAL CONTENT]') === true, 'E-2: Bracketed test fixture marker rejected in prose');
  assert(containsProsePlaceholder('TODO: add explanation') === true, 'E-2: Uppercase TODO: rejected in academic prose');
  assert(containsProsePlaceholder('FIXME later') === true, 'E-2: Uppercase FIXME rejected in academic prose');
  assert(containsProsePlaceholder('Status is TBD') === true, 'E-2: Uppercase TBD rejected in academic prose');
  assert(containsPlaceholder('Chapter 1 TODO review') === true, 'containsPlaceholder detects placeholder in arbitrary string');

  const v3Doc = createV3Fixture();
  const c0 = validateSyllabus(v3Doc);
  assert(c0.valid === true, 'Control C0: Valid V3 document passes regular validation');
  // C-4 check: V3 with Hindi emits advisory notice
  assert(
    c0.warnings.some((w) => w.includes('Hindi-capable verifier proficiency is not machine-verified — T-2 remains open.')),
    'C-4: Valid V3 emits advisory notice for T-2 without failing'
  );

  const c0r = validateSyllabus(v3Doc, { releaseCheck: true });
  assert(c0r.valid === true, 'Control C0r: Valid V3 document passes --release check');
}

// SECTION 2: Release Semantics & Lifecycle Consistency (R-1, R-2)
console.log('\n--- Section 2: Release Semantics & Lifecycle Consistency (R-1, R-2) ---');
{
  // Empty starter
  const emptyStarter = {
    subjectCode: '00',
    subjectName: { en: 'Paper I', hi: 'प्रश्नपत्र I' },
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

  const starterDraft = validateSyllabus(emptyStarter);
  assert(starterDraft.valid === true, 'Empty starter passes as draft template');
  assert(starterDraft.isStarter === true, 'Identified as starter preparation template');

  const starterRelease = validateSyllabus(emptyStarter, { releaseCheck: true });
  assert(starterRelease.valid === false, 'Empty starter fails --release check');
  assert(starterRelease.errors.some((e) => e.includes('RELEASE_VALIDATION_FAILURE')), 'Emits RELEASE_VALIDATION_FAILURE for empty starter release');

  // R1: --release on unverified
  const r1 = validateSyllabus(createBaseFixture(), { releaseCheck: true });
  assert(r1.valid === false, 'R1: --release on unverified populated document fails');
  assert(r1.errors.some((e) => e.includes('strictly requires V3 verification')), 'R1 error states V3 dual_verified required');

  // R2: --release on V2 single verifier
  const v2Doc = createBaseFixture();
  v2Doc.verification = 'verified';
  v2Doc.transcription.isManuallyTypedFromVisual = true;
  const r2 = validateSyllabus(v2Doc, { releaseCheck: true });
  assert(r2.valid === false, 'R2: --release on V2 (single verifier) document fails');

  // R5: published requires V3
  const r5 = createBaseFixture();
  r5.status = 'published';
  const resR5 = validateSyllabus(r5);
  assert(resR5.valid === false, 'R5: status=published with verification=unverified fails');

  // R6: published with V2
  const r6 = clone(v2Doc);
  r6.status = 'published';
  const resR6 = validateSyllabus(r6);
  assert(resR6.valid === false, 'R6: status=published with verification=verified (V2) fails');

  // R7: V3 in draft status passes with warning
  const r7 = createV3Fixture();
  r7.status = 'draft';
  const resR7 = validateSyllabus(r7);
  assert(resR7.valid === true, 'R7: dual_verified in status=draft passes');
  assert(resR7.warnings.some((w) => w.includes("status is 'draft'")), 'R7 emits lifecycle draft warning');

  // P7, P8, P9: Empty units lifecycle restrictions
  const p7 = createBaseFixture();
  p7.units = [];
  p7.status = 'published';
  assert(validateSyllabus(p7).valid === false, 'P7: Empty units + status=published fails');

  const p8 = createBaseFixture();
  p8.units = [];
  p8.verification = 'verified';
  assert(validateSyllabus(p8).valid === false, 'P8: Empty units + verification=verified fails');

  const p9 = createBaseFixture();
  p9.units = [];
  p9.status = 'verified';
  assert(validateSyllabus(p9).valid === false, 'P9: Empty units + status=verified fails');

  const p10 = createBaseFixture();
  p10.units = [];
  p10.status = 'in_review';
  assert(validateSyllabus(p10).valid === true, 'P10: Empty units + status=in_review passes as draft starter');
}

// SECTION 3: Human Identity Verification & Dual-Signatures (R-3)
console.log('\n--- Section 3: Human Identity Verification & Dual-Signatures (R-3) ---');
{
  // V1, V2: secondVerifier placeholder names
  const v1 = createV3Fixture();
  v1.transcription.secondVerifier.name = 'TBD';
  assert(validateSyllabus(v1).valid === false, 'V1: secondVerifier placeholder TBD rejected');

  const v2 = createV3Fixture();
  v2.transcription.secondVerifier.name = 'PENDING_SECOND_REVIEW';
  assert(validateSyllabus(v2).valid === false, 'V2: secondVerifier PENDING_SECOND_REVIEW rejected');

  // V3: secondVerifier == transcriber (T == V2)
  const v3 = createV3Fixture();
  v3.transcription.secondVerifier.name = 'Alice Smith';
  const rV3 = validateSyllabus(v3);
  assert(rV3.valid === false, 'V3: secondVerifier == transcriber rejected');
  assert(
    rV3.errors.some((e) => e.includes("Dual verification violation (V3): secondVerifier ('Alice Smith') cannot be identical to transcriber ('Alice Smith')")),
    'V3 (T==V2): exact error message for secondVerifier == transcriber'
  );

  // V4: secondVerifier == verifier (case + whitespace) (V1 == V2)
  const v4 = createV3Fixture();
  v4.transcription.secondVerifier.name = '  bob jones  ';
  const rV4 = validateSyllabus(v4);
  assert(rV4.valid === false, 'V4: secondVerifier == verifier (case + whitespace) rejected');
  assert(
    rV4.errors.some((e) => e.includes("Dual verification violation (V3): secondVerifier ('  bob jones  ') cannot be identical to primary verifier ('Bob Jones')")),
    'V4 (V1==V2): exact error message for secondVerifier == primary verifier'
  );

  // V5: secondVerifier == verifier + zero-width char
  const v5 = createV3Fixture();
  v5.transcription.secondVerifier.name = 'Bob Jones\u200B';
  assert(validateSyllabus(v5).valid === false, 'V5: secondVerifier == verifier with zero-width char rejected');

  // Pair collision evasion via full-width ASCII (NFKC defense)
  const fwCollision = createV3Fixture();
  fwCollision.transcription.secondVerifier.name = 'Ａｌｉｃｅ Ｓｍｉｔｈ';
  assert(validateSyllabus(fwCollision).valid === false, 'Dual verification evasion via full-width ASCII rejected');

  // V7: verifier == transcriber (T == V1)
  const v7 = createV3Fixture();
  v7.transcription.verifier.name = 'Alice Smith';
  const rV7 = validateSyllabus(v7);
  assert(rV7.valid === false, 'V7: verifier == transcriber rejected');
  assert(
    rV7.errors.some((e) => e.includes("Independent verification violation: verifier ('Alice Smith') cannot be identical to transcriber ('Alice Smith')")),
    'V7 (T==V1): exact error message for verifier == transcriber'
  );

  // V8: Empty attestation dates
  const v8 = createV3Fixture();
  v8.transcription.transcriber.date = '';
  assert(validateSyllabus(v8).valid === false, 'V8: Empty attestation date rejected');

  // V9: Garbage date
  const v9 = createV3Fixture();
  v9.transcription.secondVerifier.date = 'not-a-date';
  assert(validateSyllabus(v9).valid === false, 'V9: Garbage date rejected');

  // V10, V11: isManuallyTypedFromVisual boolean requirement
  const v10 = createV3Fixture();
  v10.transcription.isManuallyTypedFromVisual = 'true';
  assert(validateSyllabus(v10).valid === false, 'V10: isManuallyTypedFromVisual as string rejected');

  const v11 = createV3Fixture();
  delete v11.transcription.isManuallyTypedFromVisual;
  assert(validateSyllabus(v11).valid === false, 'V11: isManuallyTypedFromVisual absent on V3 rejected');

  // V13: Legitimate name containing Mock (e.g. Mockler) passes
  const v13 = createV3Fixture();
  v13.transcription.verifier.name = 'Dr. Robert Mockler';
  assert(validateSyllabus(v13).valid === true, 'V13: Legitimate name Mockler accepted without false positive');

  // V14: Non-string name (type confusion)
  const v14 = createV3Fixture();
  v14.transcription.transcriber.name = 12345;
  assert(validateSyllabus(v14).valid === false, 'V14: Non-string transcriber name rejected');

  // E-4 (N13/N14): Case-insensitive pairwise identity checks (uppercase vs lowercase)
  const n13T_V1 = createV3Fixture();
  n13T_V1.transcription.transcriber.name = 'ALICE SMITH';
  n13T_V1.transcription.verifier.name = 'alice smith';
  const rN13 = validateSyllabus(n13T_V1);
  assert(rN13.valid === false, 'N13: ALICE SMITH vs alice smith (T==V1) rejected');
  assert(
    rN13.errors.some((e) => e.includes("Independent verification violation: verifier ('alice smith') cannot be identical to transcriber ('ALICE SMITH')")),
    'N13: exact error for case-insensitive T==V1 collision'
  );

  const n13T_V2 = createV3Fixture();
  n13T_V2.transcription.transcriber.name = 'ALICE SMITH';
  n13T_V2.transcription.secondVerifier.name = 'alice smith';
  const rN13_2 = validateSyllabus(n13T_V2);
  assert(rN13_2.valid === false, 'N13: ALICE SMITH vs alice smith (T==V2) rejected');
  assert(
    rN13_2.errors.some((e) => e.includes("Dual verification violation (V3): secondVerifier ('alice smith') cannot be identical to transcriber ('ALICE SMITH')")),
    'N13: exact error for case-insensitive T==V2 collision'
  );

  const n14V1_V2 = createV3Fixture();
  n14V1_V2.transcription.verifier.name = 'BOB JONES';
  n14V1_V2.transcription.secondVerifier.name = 'bob jones';
  const rN14 = validateSyllabus(n14V1_V2);
  assert(rN14.valid === false, 'N14: BOB JONES vs bob jones (V1==V2) rejected');
  assert(
    rN14.errors.some((e) => e.includes("Dual verification violation (V3): secondVerifier ('bob jones') cannot be identical to primary verifier ('BOB JONES')")),
    'N14: exact error for case-insensitive V1==V2 collision'
  );

  // E-4 (N46/N47): Transcriber, primary verifier, and second verifier placeholder rejection in populated V3
  const n46Doc = createV3Fixture();
  n46Doc.transcription.transcriber.name = 'TODO';
  const rN46 = validateSyllabus(n46Doc);
  assert(rN46.valid === false, 'N46: Populated V3 with transcriber=TODO rejected');
  assert(
    rN46.errors.some((e) => e.includes("Placeholder transcriber 'TODO' rejected for verified content")),
    'N46: exact error for populated V3 placeholder transcriber'
  );

  const n47Doc = createV3Fixture();
  n47Doc.transcription.verifier.name = 'TBD';
  const rN47 = validateSyllabus(n47Doc);
  assert(rN47.valid === false, 'N47: Populated V3 with verifier=TBD rejected');
  assert(
    rN47.errors.some((e) => e.includes("Placeholder verifier 'TBD' rejected for verified content")),
    'N47: exact error for populated V3 placeholder primary verifier'
  );

  const n47_2Doc = createV3Fixture();
  n47_2Doc.transcription.secondVerifier.name = 'DUMMY';
  const rN47_2 = validateSyllabus(n47_2Doc);
  assert(rN47_2.valid === false, 'N47: Populated V3 with secondVerifier=DUMMY rejected');
  assert(
    rN47_2.errors.some((e) => e.includes("Placeholder secondVerifier 'DUMMY' rejected for verified content")),
    'N47: exact error for populated V3 placeholder second verifier'
  );

  // E-4 (N77): Strict attestation date shape validation (YYYY-MM-DD)
  const n77Slash = createV3Fixture();
  n77Slash.transcription.transcriber.date = '2026/11/05';
  const rN77Slash = validateSyllabus(n77Slash);
  assert(rN77Slash.valid === false, 'N77: Slashes in attestation date rejected');
  assert(
    rN77Slash.errors.some((e) => e === "transcription.transcriber.date must be a valid 'YYYY-MM-DD' date (got '2026/11/05')"),
    'N77: exact error message for slash-separated date'
  );

  const n77MonthOnly = createV3Fixture();
  n77MonthOnly.transcription.verifier.date = '2026-11';
  const rN77Month = validateSyllabus(n77MonthOnly);
  assert(rN77Month.valid === false, 'N77: Month-only attestation date rejected for verifier');
  assert(
    rN77Month.errors.some((e) => e === "transcription.verifier.date must be a valid 'YYYY-MM-DD' date (got '2026-11')"),
    'N77: exact error message for month-only date'
  );

  const n77Text = createV3Fixture();
  n77Text.transcription.secondVerifier.date = 'Nov 5 2026';
  const rN77Text = validateSyllabus(n77Text);
  assert(rN77Text.valid === false, 'N77: Text-format attestation date rejected for secondVerifier');
  assert(
    rN77Text.errors.some((e) => e === "transcription.secondVerifier.date must be a valid 'YYYY-MM-DD' date (got 'Nov 5 2026')"),
    'N77: exact error message for text-format date'
  );
}

// SECTION 4: Effective Dates & SHA-256 Format Checks (R-4)
console.log('\n--- Section 4: Effective Dates & SHA-256 Format Checks (R-4) ---');
{
  // Strict YYYY-MM dates
  for (const badDate of ['UNKNOWN', 'TBD', 'n/a', '2024-13', '0000-00', 'soon', 'Unknown', 'unknown']) {
    const d = createV3Fixture();
    d.effectiveFrom = badDate;
    assert(validateSyllabus(d).valid === false, `Invalid effectiveFrom date '${badDate}' rejected`);
  }

  const dAbsent = createV3Fixture();
  delete dAbsent.effectiveFrom;
  assert(validateSyllabus(dAbsent).valid === false, 'Absent effectiveFrom on V3 rejected');

  // Hashes: zero hash, empty file hash, uppercase, short, trailing newline
  const h1 = createV3Fixture();
  h1.sourceDocuments[0].sha256 = '0'.repeat(64);
  assert(validateSyllabus(h1).valid === false, 'H1: All-zero SHA-256 hash rejected');

  const h2 = createV3Fixture();
  h2.sourceDocuments[0].sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  assert(validateSyllabus(h2).valid === false, 'H2: Empty file SHA-256 hash rejected');

  const h3 = createV3Fixture();
  h3.sourceDocuments[0].sha256 = 'A'.repeat(64);
  assert(validateSyllabus(h3).valid === false, 'H3: Uppercase SHA-256 rejected');

  const h4 = createV3Fixture();
  h4.sourceDocuments[0].sha256 = H.slice(0, 63);
  assert(validateSyllabus(h4).valid === false, 'H4: 63-character SHA-256 rejected');

  const h5 = createV3Fixture();
  h5.sourceDocuments[0].sha256 = H + '\n';
  assert(validateSyllabus(h5).valid === false, 'H5: SHA-256 with trailing newline rejected');

  const h6 = createV3Fixture();
  h6.sourceDocuments = [];
  assert(validateSyllabus(h6).valid === false, 'H6: V3 with 0 source documents rejected');

  const h7 = createV3Fixture();
  h7.sourceDocuments.push({ docId: 'DOC-EN', title: 'Duplicate', language: 'both', sha256: H });
  assert(validateSyllabus(h7).valid === false, 'H7: Duplicate docId in sourceDocuments rejected');

  const h8 = createV3Fixture();
  h8.sourceDocuments[0].language = 'fr';
  assert(validateSyllabus(h8).valid === false, 'H8: Invalid source language fr rejected');

  const h9 = createV3Fixture();
  h9.units[0].statements[0].sourceDocId = 'UNREGISTERED-DOC';
  assert(validateSyllabus(h9).valid === false, 'H9: Unregistered sourceDocId in statement rejected');

  const h10 = createV3Fixture();
  delete h10.units[0].statements[0].sourceDocId;
  assert(validateSyllabus(h10).valid === false, 'H10: Missing sourceDocId in statement rejected');
}

// SECTION 5: Canonical Structure, Bilingual Rules & Placeholders (R-6)
console.log('\n--- Section 5: Canonical Structure, Bilingual Rules & Placeholders (R-6) ---');
{
  // U1, U2: Unit counts
  const u1 = createV3Fixture();
  u1.units.push({ ...clone(u1.units[0]), unitNo: 11 });
  assert(validateSyllabus(u1).valid === false, 'U1: 11 units rejected');

  const u2 = createV3Fixture();
  u2.units = u2.units.slice(0, 9);
  assert(validateSyllabus(u2).valid === false, 'U2: 9 units rejected');

  // U3: Non-canonical unit titles
  const u3 = createV3Fixture();
  u3.units.forEach((u, i) => {
    u.title = { en: `Random Subject Unit ${i + 1}`, hi: `अनियमित इकाई ${i + 1}` };
  });
  assert(validateSyllabus(u3).valid === false, 'U3: Non-canonical Paper I unit titles rejected');

  // U4: Unit with 0 statements
  const u4 = createV3Fixture();
  u4.units[0].statements = [];
  assert(validateSyllabus(u4).valid === false, 'U4: Unit with 0 statements rejected');

  // B1, B2: Missing English / Hindi text
  const b1 = createV3Fixture();
  b1.units[2].statements[0].text.en = '';
  assert(validateSyllabus(b1).valid === false, 'B1: Empty English statement text rejected');

  const b2 = createV3Fixture();
  b2.units[2].statements[0].text.hi = '';
  assert(validateSyllabus(b2).valid === false, 'B2: Empty Hindi statement text rejected');

  // B3: Hindi text copied from English (no Devanagari)
  const b3 = createV3Fixture();
  b3.units[2].statements[0].text.hi = 'Statement 3.1';
  assert(validateSyllabus(b3).valid === false, 'B3: Non-Devanagari Hindi statement text rejected');

  // B4, B5: Single character / punctuation text
  const b4 = createV3Fixture();
  b4.units[2].statements[0].text.hi = 'x';
  assert(validateSyllabus(b4).valid === false, 'B4: Single non-Devanagari char in Hindi rejected');

  const b5 = createV3Fixture();
  b5.units[2].statements[0].text.en = '.';
  b5.units[2].statements[0].text.hi = '.';
  assert(validateSyllabus(b5).valid === false, 'B5: Single period statements rejected');

  // B6: Hindi unit title written in English
  const b6 = createV3Fixture();
  b6.units[2].title.hi = 'Comprehension';
  assert(validateSyllabus(b6).valid === false, 'B6: Hindi unit title without Devanagari rejected');

  // B9: Missing statementNo
  const b9 = createV3Fixture();
  delete b9.units[3].statements[0].statementNo;
  assert(validateSyllabus(b9).valid === false, 'B9: Missing statementNo rejected');

  // B10: Duplicate identical statement in unit
  const b10 = createV3Fixture();
  b10.units[3].statements.push(clone(b10.units[3].statements[0]));
  assert(validateSyllabus(b10).valid === false, 'B10: Duplicate identical statement in unit rejected');

  // B11, B12: Page number boundaries
  const b11 = createV3Fixture();
  b11.units[0].statements[0].page = 1.5;
  assert(validateSyllabus(b11).valid === false, 'B11: Non-integer page reference 1.5 rejected');

  const b12 = createV3Fixture();
  b12.units[0].statements[0].page = 99999;
  assert(validateSyllabus(b12).valid === false, 'B12: Page reference 99999 exceeding doc bounds rejected');

  // B13, B14: Placeholders in statements
  const b13 = createV3Fixture();
  b13.units[0].statements[0].text.en = 'TODO: fix later';
  assert(validateSyllabus(b13).valid === false, 'B13: TODO: in verified English statement rejected');

  const b14 = createV3Fixture();
  b14.units[0].statements[0].text.en = 'Lorem ipsum dolor sit amet';
  assert(validateSyllabus(b14).valid === false, 'B14: Lorem ipsum in verified statement rejected');

  // E-2 / E-4: Structured placeholder rejection in statements, titles, and subjectName
  const b14Fixme = createV3Fixture();
  b14Fixme.units[0].statements[0].text.en = 'Statement with FIXME flag';
  assert(validateSyllabus(b14Fixme).valid === false, 'E-2: FIXME in verified statement rejected');

  const b14HiBracket = createV3Fixture();
  b14HiBracket.units[0].statements[0].text.hi = 'विवरण [परीक्षण] फ़िक्सर';
  assert(validateSyllabus(b14HiBracket).valid === false, 'E-2: [परीक्षण] bracketed placeholder in verified Hindi statement rejected');

  const b14Mastodon = createV3Fixture();
  b14Mastodon.units[0].statements[0].text.en = 'Study on Mastodon communication network';
  assert(validateSyllabus(b14Mastodon).valid === true, 'E-2: Mastodon (word containing todo) is NOT rejected');

  // E-2: Genuine academic prose containing "परीक्षण", "Testing", "Dummy", "Unknown", "Pending", "Placeholder"
  const bAcademicEn = createV3Fixture();
  bAcademicEn.units[0].statements[0].text.en = 'Computer-Based Testing and dummy variables in regression with unknown parameters and placeholder values in templates for pending cases.';
  assert(validateSyllabus(bAcademicEn).valid === true, 'E-2: Legitimate English academic vocabulary accepted in statement');

  const bAcademicHi = createV3Fixture();
  bAcademicHi.units[0].statements[0].text.hi = 'कंप्यूटर आधारित परीक्षण, परिकल्पना परीक्षण एवं सार्थकता परीक्षणों का तुलनात्मक अध्ययन।';
  assert(validateSyllabus(bAcademicHi).valid === true, 'E-2: Legitimate Hindi academic vocabulary (परीक्षण) accepted in statement');

  const bAcademicSubj = createV3Fixture();
  bAcademicSubj.subjectName.en = 'Computer-Based Testing and Unknown Systems';
  bAcademicSubj.subjectName.hi = 'कंप्यूटर आधारित परीक्षण एवं शोध पद्धति';
  assert(validateSyllabus(bAcademicSubj).valid === true, 'E-2: Academic vocabulary accepted in subjectName');

  const bAcademicUnit = createV3Fixture();
  bAcademicUnit.units[0].title.en = 'Teaching Aptitude: Computer-Based Testing and Hypothesis Testing';
  bAcademicUnit.units[0].title.hi = 'शिक्षण अभिवृत्ति एवं परिकल्पना परीक्षण';
  assert(validateSyllabus(bAcademicUnit).valid === true, 'E-2: Academic vocabulary accepted in unit titles');

  // E-4 (N35–N37): Invisible character obfuscation in actual fields
  const bSubjObscured = createV3Fixture();
  bSubjObscured.subjectName.en = 'General Paper [TO\u200BDO]';
  const rSubjObscured = validateSyllabus(bSubjObscured);
  assert(rSubjObscured.valid === false, 'N35: Obscured [TO\\u200BDO] in subjectName.en rejected');
  assert(rSubjObscured.errors.some((e) => e.includes("Placeholder text found in English subject name ('General Paper [TO\u200BDO]')")), 'N35: Exact error for subjectName obscured placeholder');

  const bUnitObscured = createV3Fixture();
  bUnitObscured.units[0].title.en = 'Teaching Aptitude [TO\u00ADDO]';
  const rUnitObscured = validateSyllabus(bUnitObscured);
  assert(rUnitObscured.valid === false, 'N36: Obscured [TO\\u00ADDO] with soft-hyphen in unit title.en rejected');
  assert(rUnitObscured.errors.some((e) => e.includes("placeholder text found in English unit title ('Teaching Aptitude [TO\u00ADDO]')")), 'N36: Exact error for unit title obscured placeholder');

  const bStmtEnObscured = createV3Fixture();
  bStmtEnObscured.units[0].statements[0].text.en = 'Statement with [TO\u2060DO] word joiner';
  const rStmtEnObscured = validateSyllabus(bStmtEnObscured);
  assert(rStmtEnObscured.valid === false, 'N37: Obscured [TO\\u2060DO] in English statement rejected');
  assert(rStmtEnObscured.errors.some((e) => e.includes("placeholder text found in verified English statement ('Statement with [TO\u2060DO] word joiner')")), 'N37: Exact error for English statement obscured placeholder');

  const bStmtHiObscured = createV3Fixture();
  bStmtHiObscured.units[0].statements[0].text.hi = 'विवरण [परी\u200Bक्षण] फ़िक्सर';
  const rStmtHiObscured = validateSyllabus(bStmtHiObscured);
  assert(rStmtHiObscured.valid === false, 'N37: Obscured [परी\\u200Bक्षण] in Hindi statement rejected');
  assert(rStmtHiObscured.errors.some((e) => e.includes("placeholder text found in verified Hindi statement ('विवरण [परी\u200Bक्षण] फ़िक्सर')")), 'N37: Exact error for Hindi statement obscured placeholder');

  // E-4 (N45): Draft-statement placeholder policy (unverified drafts permit placeholders; release checks block them)
  const draftWithPlaceholder = createBaseFixture();
  draftWithPlaceholder.status = 'draft';
  draftWithPlaceholder.verification = 'unverified';
  draftWithPlaceholder.units[0].statements[0].text.en = 'Draft statement with [TODO] still in progress';
  draftWithPlaceholder.units[0].statements[0].text.hi = 'प्रारूप विवरण जिसमें [परीक्षण] कार्य प्रगति पर है';
  assert(validateSyllabus(draftWithPlaceholder).valid === true, 'N45: Unverified draft statement permits placeholders during authoring');
  assert(validateSyllabus(draftWithPlaceholder, { releaseCheck: true }).valid === false, 'N45: Draft statement fails strict release check (demands dual_verified R-1)');

  // Structured placeholders in titles and subject names
  const bSubjEn = createV3Fixture();
  bSubjEn.subjectName.en = 'General Paper [TODO]';
  const rSubjEn = validateSyllabus(bSubjEn);
  assert(rSubjEn.valid === false, 'E-2: Structured [TODO] in subjectName.en rejected');

  const bSubjHi = createV3Fixture();
  bSubjHi.subjectName.hi = 'सामान्य प्रश्नपत्र [परीक्षण]';
  const rSubjHi = validateSyllabus(bSubjHi);
  assert(rSubjHi.valid === false, 'E-2: Structured [परीक्षण] in subjectName.hi rejected');

  const bUnitEn = createV3Fixture();
  bUnitEn.units[0].title.en = 'Teaching Aptitude [FIXME]';
  const rUnitEn = validateSyllabus(bUnitEn);
  assert(rUnitEn.valid === false, 'E-2: Structured [FIXME] in unit title.en rejected');

  const bUnitHi = createV3Fixture();
  bUnitHi.units[0].title.hi = 'शिक्षण अभिवृत्ति [परीक्षण]';
  const rUnitHi = validateSyllabus(bUnitHi);
  assert(rUnitHi.valid === false, 'E-2: Structured [परीक्षण] in unit title.hi rejected');

  // Structural check: invalid subjectCode 01 (C-5)
  const bBadCode = createBaseFixture();
  bBadCode.subjectCode = '01';
  const rBadCode = validateSyllabus(bBadCode);
  assert(rBadCode.valid === false, 'Invalid subjectCode 01 rejected');
  assert(
    rBadCode.errors.some((e) => e === "Invalid subjectCode: expected '00' for Paper I, got '01'"),
    'Exact error message on invalid subjectCode: expected 00 for Paper I, got 01'
  );

  // B15: Fractional syllabus version
  const b15 = createV3Fixture();
  b15.syllabusVersion = 1.5;
  assert(validateSyllabus(b15).valid === false, 'B15: Non-integer syllabusVersion 1.5 rejected');

  // B16, B17: Null entries in arrays
  const b16 = createV3Fixture();
  b16.units[0] = null;
  assert(validateSyllabus(b16).valid === false, 'B16: null entry in units array rejected');

  const b17 = createV3Fixture();
  b17.sourceDocuments = [null];
  assert(validateSyllabus(b17).valid === false, 'B17: null entry in sourceDocuments array rejected');
}

// SECTION 6: Claude C-03 Anti-Auto-Promotion Guard
console.log('\n--- Section 6: Claude C-03 Anti-Auto-Promotion Guard ---');
{
  const p1 = createBaseFixture();
  p1.importAsOfficialContent = true;
  assert(validateSyllabus(p1).valid === false, 'P1: importAsOfficialContent=true on unverified rejected');

  const p2 = createBaseFixture();
  p2.importPolicy = { importAsOfficialContent: true };
  assert(validateSyllabus(p2).valid === false, 'P2: Nested importPolicy.importAsOfficialContent=true on unverified rejected');

  const p3 = createBaseFixture();
  p3.releaseStatus = 'RELEASED';
  assert(validateSyllabus(p3).valid === false, 'P3: releaseStatus=RELEASED on unverified rejected');

  const p4 = createBaseFixture();
  p4.importEligible = 'false';
  assert(validateSyllabus(p4).valid === false, 'P4: importEligible as string rejected');

  const p5 = createV3Fixture();
  p5.importEligible = true;
  p5.importAsOfficialContent = true;
  assert(validateSyllabus(p5).valid === true, 'P5: V3 valid + both import flags true passes');

  const p6 = createV3Fixture();
  p6.units = [];
  p6.importEligible = true;
  assert(validateSyllabus(p6).valid === false, 'P6: V3 empty units + importEligible rejected');

  const p11 = createBaseFixture();
  delete p11.units;
  assert(validateSyllabus(p11).valid === false, 'P11: Missing units key rejected');

  const p12 = createBaseFixture();
  p12.units = {};
  assert(validateSyllabus(p12).valid === false, 'P12: units as object not array rejected');
}

// SECTION 7: Permanent CLI Invocation & Fail-Closed Suite (C-2, C-5, E-3, E-4, E-5)
console.log('\n--- Section 7: Permanent CLI Invocation & Fail-Closed Suite (C-2, C-5, E-3, E-4, E-5) ---');
{
  const scriptPath = join(REPO_ROOT, 'scripts', 'check-curriculum.mjs');
  const starterPath = join(REPO_ROOT, 'curriculum', 'paper1.syllabus.json');

  // CLI-1: Normal check on starter syllabus -> exit 0
  const cli1 = spawnSync(process.execPath, [scriptPath, starterPath], { encoding: 'utf8' });
  assert(cli1.status === 0, 'CLI-1: Normal check on starter exits with code 0');
  assert(cli1.stdout.includes('RESULT: PASS (Structurally valid)'), 'CLI-1: Normal check outputs RESULT: PASS (Structurally valid)');

  // CLI-2: Starter syllabus with --release flag -> exit 1
  const cli2 = spawnSync(process.execPath, [scriptPath, starterPath, '--release'], { encoding: 'utf8' });
  assert(cli2.status === 1, 'CLI-2: Starter syllabus with --release exits with code 1');
  assert(cli2.stdout.includes('RESULT: FAIL (Schema and governance errors detected)'), 'CLI-2: Release check outputs RESULT: FAIL');
  assert(cli2.stdout.includes("Release validation failure (R-1): --release strictly requires V3 verification ('dual_verified')"), 'CLI-2: Error explains strict V3 requirement');

  // CLI-3: Unknown option --relase -> exit 2
  const cli3 = spawnSync(process.execPath, [scriptPath, starterPath, '--relase'], { encoding: 'utf8' });
  assert(cli3.status === 2, 'CLI-3: Unknown option --relase exits with code 2');
  assert(cli3.stderr.includes('Unknown option: --relase'), 'CLI-3: Stderr reports Unknown option: --relase');

  // CLI-4: Incorrect case --Release -> exit 2
  const cli4 = spawnSync(process.execPath, [scriptPath, starterPath, '--Release'], { encoding: 'utf8' });
  assert(cli4.status === 2, 'CLI-4: Incorrect case --Release exits with code 2');
  assert(cli4.stderr.includes('Unknown option: --Release'), 'CLI-4: Stderr reports Unknown option: --Release');

  // CLI-5: Option with argument --release=1 -> exit 2
  const cli5 = spawnSync(process.execPath, [scriptPath, starterPath, '--release=1'], { encoding: 'utf8' });
  assert(cli5.status === 2, 'CLI-5: Option with argument --release=1 exits with code 2');
  assert(cli5.stderr.includes('Unknown option: --release=1'), 'CLI-5: Stderr reports Unknown option: --release=1');

  // E-3: Portable temporary directory management with fs.mkdtempSync and safe cleanup
  const tempDir = mkdtempSync(join(os.tmpdir(), 'ureducator-cli-test-'));
  try {
    // CLI-6: Target path containing spaces + --release -> exit 1, runs validation
    const spacePath = join(tempDir, 'temp syllabus space test.json');
    copyFileSync(starterPath, spacePath);
    const cli6 = spawnSync(process.execPath, [scriptPath, spacePath, '--release'], { encoding: 'utf8' });
    assert(cli6.status === 1, 'CLI-6: Target path with spaces + --release exits with code 1');
    assert(cli6.stdout.includes('Target: temp syllabus space test.json'), 'CLI-6: Path with spaces is correctly preserved');
    assert(cli6.stdout.includes("Release validation failure (R-1): --release strictly requires V3 verification ('dual_verified')"), 'CLI-6: Validation executed completely');

    // CLI-7: CLI invoked via native symlink or directory junction (Node fs.symlinkSync API)
    const isWindows = process.platform === 'win32';
    const scriptsDir = join(REPO_ROOT, 'scripts');
    const linkPath = join(tempDir, 'scripts-link');
    let linkCreated = false;
    try {
      symlinkSync(scriptsDir, linkPath, isWindows ? 'junction' : 'dir');
      linkCreated = true;
    } catch (err) {
      skipped++;
      console.warn(`[SKIP] CLI-7: Symlink creation not permitted in this OS environment: ${err.message}`);
    }

    if (linkCreated) {
      const scriptViaLink = join(linkPath, 'check-curriculum.mjs');
      const cli7 = spawnSync(process.execPath, [scriptViaLink, starterPath, '--release'], {
        encoding: 'utf8',
        cwd: tempDir // Also tests invocation from an outside working directory
      });
      assert(cli7.status === 1, 'CLI-7: CLI invoked via symlink/junction exits with code 1 (does NOT silently exit 0)');
      assert(cli7.stdout.includes('RESULT: FAIL'), 'CLI-7: Validation runs and produces failure report when invoked via symlink/junction');
    }

    // E-4 (N71): CLI usage errors: missing file, no arguments, multiple arguments
    const cliNoArgs = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
    assert(cliNoArgs.status === 1, 'N71: CLI invoked with zero arguments exits with code 1');
    assert(cliNoArgs.stderr.includes('Usage: node scripts/check-curriculum.mjs'), 'N71: Stderr shows usage instructions when zero arguments provided');

    const cliMultiFiles = spawnSync(process.execPath, [scriptPath, starterPath, spacePath], { encoding: 'utf8' });
    assert(cliMultiFiles.status === 1, 'N71: CLI invoked with multiple files exits with code 1');
    assert(cliMultiFiles.stderr.includes('Usage: node scripts/check-curriculum.mjs'), 'N71: Stderr shows usage instructions when multiple files provided');

    const missingFilePath = join(tempDir, 'non-existent-syllabus-12345.json');
    const cliMissingFile = spawnSync(process.execPath, [scriptPath, missingFilePath], { encoding: 'utf8' });
    assert(cliMissingFile.status === 1, 'N71: CLI invoked with non-existent file exits with code 1');
    assert(cliMissingFile.stderr.includes('Error: File not found:'), 'N71: Stderr shows File not found error');

  } finally {
    // E-3: Strict cleanup of temporary directory; zero artifacts left in repo or scripts/
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored if already removed
    }
  }

  // E-5 (N61): CLI entry guard fail-closed behavior on realpath failure
  const origArgv1 = process.argv[1];
  try {
    process.argv[1] = '/virtual/mount/non-existent-dir/check-curriculum.mjs';
    assert(isCliEntry() === true, 'N61: isCliEntry returns true (fails closed to main()) when target matches check-curriculum.mjs even if realpath throws');

    process.argv[1] = '/virtual/mount/non-existent-dir/other-imported-library.mjs';
    assert(isCliEntry() === false, 'N61: isCliEntry returns false for other imported libraries when realpath throws');
  } finally {
    process.argv[1] = origArgv1;
  }
}

// SECTION 8: Final C-03 Acceptance Remediation Tests (F-4, F-5, F-6, G-1, G-2, G-3)
console.log('\n--- Section 8: Final C-03 Acceptance Remediation Tests (F-4, F-5, F-6, G-1, G-2, G-3) ---');
{
  // -------------------------------------------------------------------------
  // G-2 / G-1: PROSE_BRACKETED_PLACEHOLDER_REGEX direct tests
  // The bracket rule: [<MARKER>] or [<MARKER>: free text] is rejected.
  // The whole bracket content must be the marker (optionally + colon + text).
  // [abc DUMMY], [DUMMY text], [abc TODO] are accepted by this rule because
  // the whole content is not the marker.
  // Note: [abc TODO] IS still rejected by containsProsePlaceholder() via
  // PROSE_UPPERCASE_TOKENS_REGEX. These two tests document that distinction.
  // -------------------------------------------------------------------------

  // G-2 / P01 / P02: Bracket rule — exact markers (case-insensitive)
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[TODO]') === true, 'G-2/P01: [TODO] rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[TBD]') === true, 'G-2/P01: [TBD] rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[FIXME]') === true, 'G-2/P01: [FIXME] rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[PLACEHOLDER]') === true, 'G-2/P01: [PLACEHOLDER] rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[DUMMY]') === true, 'G-2/P01: [DUMMY] rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[LOREM IPSUM]') === true, 'G-2/P01/G-1: [LOREM IPSUM] rejected by bracket regex (G-1 adds LOREM IPSUM)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[TEST FIXTURE]') === true, 'G-2/P01: [TEST FIXTURE] rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[परीक्षण]') === true, 'G-2/P01: [परीक्षण] rejected by bracket regex');

  // G-2 / P02: Case-insensitive bracket markers
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[todo]') === true, 'G-2/P02: [todo] lowercase rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[Tbd]') === true, 'G-2/P02: [Tbd] mixed-case rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[fixme]') === true, 'G-2/P02: [fixme] lowercase rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[Lorem Ipsum]') === true, 'G-2/P02/G-1: [Lorem Ipsum] case-insensitive rejected (G-1 adds LOREM IPSUM)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[lorem ipsum]') === true, 'G-2/P02/G-1: [lorem ipsum] all-lowercase rejected (G-1 adds LOREM IPSUM)');

  // G-2: Colon+text suffix accepted in bracket rule (G-1 restricts to colon only, not dashes)
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[TODO: fix this]') === true, 'G-2/G-1: [TODO: fix this] rejected (colon suffix allowed)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[PLACEHOLDER: add unit]') === true, 'G-2/G-1: [PLACEHOLDER: add unit] rejected (colon suffix allowed)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[परीक्षण: शेष]') === true, 'G-2/G-1: [परीक्षण: शेष] rejected (colon suffix allowed)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[TEST FIXTURE: description]') === true, 'G-2/G-1: [TEST FIXTURE: description] rejected (colon suffix allowed)');

  // G-2: Whitespace tolerance inside brackets
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[ todo ]') === true, 'G-2: [ todo ] with spaces rejected by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[\nTODO\n]') === true, 'G-2: [\\nTODO\\n] with internal newlines rejected (cleanTextForChecks normalizes)');

  // G-2 / G-1: Dash separators are NOT treated as colon equivalents (G-1 uses only colon separator)
  // [TODO - reason] is accepted by bracket regex because dash is not the colon separator
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[TODO - reason]') === false, 'G-2/G-1: [TODO - reason] accepted by bracket regex (dash is not separator in G-1)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[TEST FIXTURE - NOT OFFICIAL CONTENT]') === false, 'G-2/G-1: [TEST FIXTURE - NOT OFFICIAL] accepted by bracket regex (dash not separator)');
  // Note: containsProsePlaceholder('[TEST FIXTURE - NOT OFFICIAL CONTENT]') is true via PROSE_PHRASES_REGEX
  assert(containsProsePlaceholder('[TEST FIXTURE - NOT OFFICIAL CONTENT]') === true, 'G-2: [TEST FIXTURE - NOT OFFICIAL CONTENT] rejected by containsProsePlaceholder (phrase rule)');

  // G-2 / P03: Exact whole-bracket semantics (embedded marker ≠ whole content)
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[Dummy variables]') === false, 'G-2/P03: [Dummy variables] accepted by bracket regex (whole bracket ≠ marker)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[DUMMY text]') === false, 'G-2/P03: [DUMMY text] accepted by bracket regex (whole bracket ≠ marker)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[abc DUMMY]') === false, 'G-2/P03: [abc DUMMY] accepted by bracket regex (whole bracket ≠ marker)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[abc dummy]') === false, 'G-2/P03: [abc dummy] accepted by bracket regex (case-insensitive whole-bracket check)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[abc todo]') === false, 'G-2/P03: [abc todo] accepted by bracket regex (whole bracket ≠ marker)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[abc Todo]') === false, 'G-2/P03: [abc Todo] accepted by bracket regex (whole bracket ≠ marker)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[abc TODO]') === false, 'G-2/P03/F-5#5: [abc TODO] accepted by bracket regex (whole bracket ≠ marker)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[TODO fix this]') === false, 'G-2/P03: [TODO fix this] accepted by bracket regex (content after marker without colon)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[Mastodon]') === false, 'G-2/P03: [Mastodon] accepted by bracket regex (legitimate word)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[कंप्यूटर आधारित परीक्षण]') === false, 'G-2/P03/F-4: [कंप्यूटर आधारित परीक्षण] accepted by bracket regex');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[परीक्षण परिणाम]') === false, 'G-2/P03: [परीक्षण परिणाम] accepted by bracket regex (whole bracket ≠ marker)');

  // G-2: [PENDING] and [UNKNOWN] accepted by bracket rule (not in marker list)
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[PENDING]') === false, 'G-2: [PENDING] accepted by bracket regex (PENDING not in bracket list)');
  assert(PROSE_BRACKETED_PLACEHOLDER_REGEX.test('[UNKNOWN]') === false, 'G-2: [UNKNOWN] accepted by bracket regex (UNKNOWN not in bracket list)');
  // containsProsePlaceholder also accepts them (not uppercase token either — PENDING/UNKNOWN not in PROSE_UPPERCASE_TOKENS_REGEX)
  assert(containsProsePlaceholder('[PENDING]') === false, 'G-2: [PENDING] accepted by containsProsePlaceholder');
  assert(containsProsePlaceholder('[UNKNOWN]') === false, 'G-2: [UNKNOWN] accepted by containsProsePlaceholder');
  // Names however still reject PENDING and UNKNOWN
  assert(isPlaceholderName('PENDING') === true, 'G-2: PENDING still rejected as human identity name (name policy)');
  assert(isPlaceholderName('UNKNOWN') === true, 'G-2: UNKNOWN still rejected as human identity name (name policy)');

  // G-2 (P10/P11/P13): Uppercase-token left and right boundary + case policy
  // [abc TODO] and [TODO fix this] are accepted by BRACKET rule but rejected by UPPERCASE_TOKENS rule
  assert(containsProsePlaceholder('[abc TODO]') === true, 'G-2/P10: [abc TODO] rejected by containsProsePlaceholder (uppercase-token rule catches bare TODO)');
  assert(containsProsePlaceholder('[TODO fix this]') === true, 'G-2/P10: [TODO fix this] rejected by containsProsePlaceholder (uppercase-token rule catches bare TODO)');
  // Lowercase versions are accepted everywhere
  assert(containsProsePlaceholder('[abc todo]') === false, 'G-2/P13: [abc todo] accepted (lowercase not caught by uppercase-token rule)');
  assert(containsProsePlaceholder('todo: ordinary lowercase note') === false, 'G-2/P13: Lowercase todo: accepted in prose');
  assert(containsProsePlaceholder('Todo: Note') === false, 'G-2/P13: Title-case Todo: accepted in prose');
  assert(containsProsePlaceholder('tbd note') === false, 'G-2/P13: Lowercase tbd accepted in prose');
  assert(containsProsePlaceholder('fixme note') === false, 'G-2/P13: Lowercase fixme accepted in prose');

  // G-2 (P20/P21): Glued LOREM IPSUM and TEST FIXTURE phrase boundaries
  assert(containsProsePlaceholder('xLOREM IPSUM') === false, 'G-2/P20: xLOREM IPSUM glued prefix accepted');
  assert(containsProsePlaceholder('LOREM IPSUMx') === false, 'G-2/P21: LOREM IPSUMx glued suffix accepted');
  assert(containsProsePlaceholder('xTEST FIXTURE') === false, 'G-2/P20: xTEST FIXTURE glued prefix accepted');
  assert(containsProsePlaceholder('TEST FIXTUREx') === false, 'G-2/P21: TEST FIXTUREx glued suffix accepted');
  assert(containsProsePlaceholder('xTODO:') === false, 'G-2/P20: xTODO: glued prefix accepted');
  assert(containsProsePlaceholder('FIXMEx') === false, 'G-2/P21: FIXMEx glued suffix accepted');
  assert(containsProsePlaceholder('TODOx') === false, 'G-2/P21: TODOx glued suffix accepted');
  assert(containsProsePlaceholder('xFIXME') === false, 'G-2/P20: xFIXME glued prefix accepted');
  assert(containsProsePlaceholder('TBDx') === false, 'G-2/P21: TBDx glued suffix accepted');
  assert(containsProsePlaceholder('xTBD') === false, 'G-2/P20: xTBD glued prefix accepted');

  // G-2 (N35): NFKC normalization in academic prose (full-width chars)
  assert(containsProsePlaceholder('Research statement with ＴＯＤＯ: check') === true, 'G-2/N35/F-5#1: Full-width ＴＯＤＯ: in academic prose is rejected');
  assert(containsProsePlaceholder('Research statement with ＦＩＸＭＥ note') === true, 'G-2/N35/F-5#1: Full-width ＦＩＸＭＥ in academic prose is rejected');
  assert(containsProsePlaceholder('ＴＯＤＯ:') === true, 'G-2/N35: Full-width ＴＯＤＯ: alone rejected');
  assert(containsProsePlaceholder('ＦＩＸＭＥ') === true, 'G-2/N35: Full-width ＦＩＸＭＥ alone rejected');

  // G-2 (N36): Whitespace normalization (linebreaks in prose phrases)
  assert(containsProsePlaceholder('Statement with LOREM\nIPSUM text') === true, 'G-2/N36/F-5#2: LOREM\\nIPSUM with newline is rejected');
  assert(containsProsePlaceholder('Statement with LOREM\tIPSUM text') === true, 'G-2/N36/F-5#2: LOREM\\tIPSUM with tab is rejected');
  assert(containsProsePlaceholder('Statement with TEST\nFIXTURE content') === true, 'G-2/N36: TEST\\nFIXTURE with newline is rejected');
  assert(containsProsePlaceholder('Statement with TEST\tFIXTURE content') === true, 'G-2/N36: TEST\\tFIXTURE with tab is rejected');

  // G-2: Lowercase bracketed markers rejected (via bracket regex case-insensitive flag)
  assert(containsProsePlaceholder('Statement with [todo] marker') === true, 'G-2/F-5#3: Lowercase bracketed [todo] is rejected');
  assert(containsProsePlaceholder('Statement with [Tbd] marker') === true, 'G-2/F-5#3: Mixed-case bracketed [Tbd] is rejected');
  assert(containsProsePlaceholder('Statement with [fixme] marker') === true, 'G-2/F-5#3: Lowercase bracketed [fixme] is rejected');

  // G-2: Bracketed PLACEHOLDER, DUMMY, LOREM IPSUM
  assert(containsProsePlaceholder('Statement with [PLACEHOLDER] marker') === true, 'G-2/F-5#4: Bracketed [PLACEHOLDER] is rejected');
  assert(containsProsePlaceholder('Statement with [DUMMY] marker') === true, 'G-2/F-5#4: Bracketed [DUMMY] is rejected');
  assert(containsProsePlaceholder('Statement with [LOREM IPSUM] marker') === true, 'G-2/G-1: Bracketed [LOREM IPSUM] is rejected (G-1 adds LOREM IPSUM to bracket list)');
  assert(containsProsePlaceholder('[lorem ipsum]') === true, 'G-2/G-1: [lorem ipsum] lowercase rejected');

  // G-2: Uppercase prose tokens
  assert(containsProsePlaceholder('Statement with TODO: verify') === true, 'G-2/F-5#7: Uppercase TODO: is rejected');
  assert(containsProsePlaceholder('Statement with FIXME note') === true, 'G-2/F-5#7: Uppercase FIXME is rejected');
  assert(containsProsePlaceholder('Statement with TBD note') === true, 'G-2/F-5#7: Uppercase TBD is rejected');
  assert(containsProsePlaceholder('LOREM IPSUM') === true, 'G-2: LOREM IPSUM phrase rejected (case-insensitive)');
  assert(containsProsePlaceholder('lorem ipsum') === true, 'G-2: lorem ipsum lowercase phrase rejected');
  assert(containsProsePlaceholder('TEST FIXTURE') === true, 'G-2: TEST FIXTURE phrase rejected');

  // G-2: Legitimate academic vocabulary accepted
  assert(containsProsePlaceholder('Statement with [Dummy variables] text') === false, 'G-2/F-4: [Dummy variables] is accepted in academic prose');
  assert(containsProsePlaceholder('Statement with [कंप्यूटर आधारित परीक्षण] text') === false, 'G-2/F-4: [कंप्यूटर आधारित परीक्षण] is accepted in academic prose');
  assert(containsProsePlaceholder('Statement with [Mastodon] text') === false, 'G-2/F-4: [Mastodon] is accepted in academic prose');
  assert(containsProsePlaceholder('Statement with [परीक्षण परिणाम] text') === false, 'G-2: [परीक्षण परिणाम] accepted in academic prose (not whole-bracket marker)');

  // G-2: Standalone bracketed marker rejected
  assert(containsProsePlaceholder('Statement with [परीक्षण] marker') === true, 'G-2/F-4: [परीक्षण] standalone bracket marker is rejected');
  assert(containsProsePlaceholder('Statement with [TEST FIXTURE] marker') === true, 'G-2/F-4: [TEST FIXTURE] standalone bracket marker is rejected');

  // G-2 (N66): No-argv import behaviour — isCliEntry returns false when argv1 is null or empty
  assert(isCliEntry({ argv1: null }) === false, 'H-4/G-2/N66: isCliEntry({argv1:null}) returns false when argv1 is null');
  assert(isCliEntry({ argv1: '' }) === false, 'G-2/N66/F-5#8/F-6: isCliEntry({argv1:""}) returns false for empty argv[1]');

  // G-2 / G-5 / F-6: CLI entry guard with injectable params (new object-destructuring signature)
  const mockTarget = resolve('scripts/check-curriculum.mjs');
  const mockTargetUrl = pathToFileURL(mockTarget).href;
  const mockSameDir = resolve('scripts/other-check.mjs');
  const mockSymlink = resolve('scripts/symlink-check.mjs');
  const mockDiffLink = resolve('scripts/different-name-link.mjs');

  assert(isCliEntry({ argv1: mockTarget, moduleUrl: mockTargetUrl }) === true, 'G-2/G-5/F-6: isCliEntry returns true on exact direct invocation');
  assert(isCliEntry({ argv1: mockSameDir, moduleUrl: mockTargetUrl, realpath: (p) => p }) === false, 'G-2/G-5/F-6: isCliEntry returns false for same-named script in different dir when realpath differs');
  assert(isCliEntry({ argv1: mockDiffLink, moduleUrl: mockTargetUrl, realpath: () => mockTarget }) === true, 'G-2/G-5/F-6: isCliEntry returns true on different-basename symlink when realpath matches');
  assert(isCliEntry({ argv1: mockSymlink, moduleUrl: mockTargetUrl, realpath: () => mockTarget }) === true, 'G-2/G-5/F-6: isCliEntry returns true on same-name symlink when realpath matches');
  // Disclosed limitation (G-5): differently-named symlink + realpath failure silently skips main()
  assert(isCliEntry({ argv1: mockDiffLink, moduleUrl: mockTargetUrl, realpath: () => { throw new Error('EACCES'); } }) === false, 'G-2/G-5/F-6: isCliEntry returns false when realpath throws for different-basename symlink (disclosed limitation)');
  // Same-basename with realpath failure falls back to true via basename comparison
  assert(isCliEntry({ argv1: mockTarget, moduleUrl: mockTargetUrl, realpath: () => { throw new Error('EACCES'); } }) === true, 'G-2/G-5/F-6: isCliEntry returns true when realpath throws for same-basename invocation (basename fallback)');

  // H-4: isCliEntry with non-file moduleUrl or malformed URL must return false
  assert(isCliEntry({ argv1: mockTarget, moduleUrl: 'https://example.com/check-curriculum.mjs' }) === false, 'H-4: isCliEntry returns false for non-file moduleUrl');
  assert(isCliEntry({ argv1: mockTarget, moduleUrl: 'not-a-valid-url' }) === false, 'H-4: isCliEntry returns false for malformed moduleUrl');

  // H-4: Spawn CLI through differently-named symlink/wrapper forcing realpath failure
  // In Node >=24.2.0, import.meta.main is native. In our child process wrapper that invokes
  // the helper with simulated realpath throw, assert the documented outcome.
  {
    const tempDirSym = mkdtempSync(join(os.tmpdir(), 'ureducator-h4-symlink-'));
    try {
      const childScript = join(tempDirSym, 'test-h4-symlink.mjs');
      const targetForward = mockTarget.replace(/\\/g, '/');
      const code = `import { isCliEntry } from "file:///${targetForward}";
const diffLink = "/virtual/different-name-checker.mjs";
const targetUrl = "file:///${targetForward}";
const outcome = isCliEntry({
  argv1: diffLink,
  moduleUrl: targetUrl,
  realpath: () => { throw new Error("EACCES: permission denied"); }
});
process.stdout.write("FALLBACK_OUTCOME:" + outcome);
`;
      writeFileSync(childScript, code);
      const res = spawnSync(process.execPath, [childScript], { encoding: 'utf8' });
      assert(res.status === 0 && res.stdout.includes('FALLBACK_OUTCOME:false'), 'H-4: CLI helper returns false when spawned via differently-named link with realpath failure');
    } finally {
      try { rmSync(tempDirSym, { recursive: true, force: true }); } catch (_e) { /* ignore cleanup error */ }
    }
  }

  // G-3: Draft-statement placeholder policy
  // Policy: unverified draft statements may contain placeholders; subject/unit names checked even in drafts
  {
    // Draft + placeholder statement text → passes ordinary check
    const draftStmt = createBaseFixture();
    draftStmt.status = 'draft';
    draftStmt.verification = 'unverified';
    draftStmt.units[0].statements[0].text.en = 'Draft statement with [TODO] still in progress';
    draftStmt.units[0].statements[0].text.hi = 'प्रारूप विवरण जिसमें [परीक्षण] कार्य प्रगति पर है';
    assert(validateSyllabus(draftStmt).valid === true, 'G-3/N45: Unverified draft statement permits placeholder markers during authoring');
    assert(validateSyllabus(draftStmt, { releaseCheck: true }).valid === false, 'G-3/N45: Draft statement with placeholder fails strict --release check (demands dual_verified R-1)');

    // Verified + same placeholder statement text → fails
    const verifiedStmt = createV3Fixture();
    verifiedStmt.units[0].statements[0].text.en = 'Verified statement with [TODO] is not allowed';
    assert(validateSyllabus(verifiedStmt).valid === false, 'G-3: Verified statement with [TODO] placeholder rejected');

    // Draft + placeholder unit title → fails (unit titles checked even in drafts)
    const draftUnitTitle = createBaseFixture();
    draftUnitTitle.status = 'draft';
    draftUnitTitle.verification = 'unverified';
    draftUnitTitle.units[0].title.en = 'Teaching Aptitude [TODO]';
    assert(validateSyllabus(draftUnitTitle).valid === false, 'G-3/N45: Draft unit title with [TODO] placeholder is still rejected (titles checked in drafts)');
  }

  // F-5 #9: Existing pairwise verifier case-insensitive checks
  {
    const d1 = createV3Fixture();
    d1.transcription.verifier.name = 'alice smith'; // matches transcriber 'Alice Smith' case-insensitively
    const r1 = validateSyllabus(d1);
    assert(r1.valid === false, 'F-5 #9: transcriber == verifier (case-insensitive) fails validation');
    assert(r1.errors.some(e => e.includes("verifier ('alice smith') cannot be identical to transcriber ('Alice Smith')")), 'F-5 #9: Exact error for transcriber == verifier case mismatch');

    const d2 = createV3Fixture();
    d2.transcription.secondVerifier.name = '  alice smith  '; // matches transcriber 'Alice Smith' case+whitespace
    const r2 = validateSyllabus(d2);
    assert(r2.valid === false, 'F-5 #9: transcriber == secondVerifier (case+whitespace) fails validation');
    assert(r2.errors.some(e => e.includes("secondVerifier ('  alice smith  ') cannot be identical to transcriber ('Alice Smith')")), 'F-5 #9: Exact error for transcriber == secondVerifier mismatch');

    const d3 = createV3Fixture();
    d3.transcription.secondVerifier.name = '  BOB JONES  '; // matches primary verifier 'Bob Jones' case+whitespace
    const r3 = validateSyllabus(d3);
    assert(r3.valid === false, 'F-5 #9: verifier == secondVerifier (case+whitespace) fails validation');
    assert(r3.errors.some(e => e.includes("secondVerifier ('  BOB JONES  ') cannot be identical to primary verifier ('Bob Jones')")), 'F-5 #9: Exact error for verifier == secondVerifier mismatch');
  }

  // F-5 #10: Empty-name validation
  {
    const d1 = createV3Fixture();
    d1.transcription.transcriber.name = '';
    const r1 = validateSyllabus(d1);
    assert(r1.valid === false, 'F-5 #10: Empty transcriber name fails validation');
    assert(r1.errors.some(e => e.includes('transcription.transcriber.name must be non-empty string')), 'F-5 #10: Exact error for empty transcriber name');

    const d2 = createV3Fixture();
    d2.transcription.verifier.name = '   ';
    const r2 = validateSyllabus(d2);
    assert(r2.valid === false, 'F-5 #10: Whitespace-only verifier name fails validation');
    assert(r2.errors.some(e => e.includes('transcription.verifier.name must be non-empty string')), 'F-5 #10: Exact error for whitespace verifier name');

    const d3 = createV3Fixture();
    d3.transcription.secondVerifier.name = '   ';
    const r3 = validateSyllabus(d3);
    assert(r3.valid === false, 'F-5 #10: Whitespace-only secondVerifier name on V3 fails validation');
    assert(r3.errors.some(e => e.includes('second independent human verifier is required')), 'F-5 #10: Exact error for whitespace secondVerifier name');
  }

  // F-5 #11: Existing placeholder handling for transcriber and primary verifier
  {
    const d1 = createV3Fixture();
    d1.transcription.transcriber.name = 'TODO';
    const r1 = validateSyllabus(d1);
    assert(r1.valid === false, 'F-5 #11: Transcriber name TODO fails validation');
    assert(r1.errors.some(e => e.includes("Placeholder transcriber 'TODO' rejected")), 'F-5 #11: Exact error for transcriber placeholder TODO');

    const d2 = createV3Fixture();
    d2.transcription.transcriber.name = 'DUMMY';
    const r2 = validateSyllabus(d2);
    assert(r2.valid === false, 'F-5 #11: Transcriber name DUMMY fails validation');
    assert(r2.errors.some(e => e.includes("Placeholder transcriber 'DUMMY' rejected")), 'F-5 #11: Exact error for transcriber placeholder DUMMY');

    const d3 = createV3Fixture();
    d3.transcription.verifier.name = 'PLACEHOLDER';
    const r3 = validateSyllabus(d3);
    assert(r3.valid === false, 'F-5 #11: Primary verifier name PLACEHOLDER fails validation');
    assert(r3.errors.some(e => e.includes("Placeholder verifier 'PLACEHOLDER' rejected")), 'F-5 #11: Exact error for primary verifier placeholder PLACEHOLDER');

    const d4 = createV3Fixture();
    d4.transcription.verifier.name = 'PENDING_VERIFICATION';
    const r4 = validateSyllabus(d4);
    assert(r4.valid === false, 'F-5 #11: Primary verifier name PENDING_VERIFICATION fails validation');
    assert(r4.errors.some(e => e.includes("Placeholder verifier 'PENDING_VERIFICATION' rejected")), 'F-5 #11: Exact error for verifier placeholder PENDING_VERIFICATION');

    const d5 = createV3Fixture();
    d5.transcription.secondVerifier.name = 'TBD';
    const r5 = validateSyllabus(d5);
    assert(r5.valid === false, 'F-5 #11: Second verifier name TBD fails validation');
    assert(r5.errors.some(e => e.includes("Placeholder secondVerifier 'TBD' rejected")), 'F-5 #11: Exact error for secondVerifier placeholder TBD');
  }

  // -------------------------------------------------------------------------
  // H-4: Additional field-level tests through validateSyllabus
  // -------------------------------------------------------------------------

  // H-4 #1: Transcriber, verifier, secondVerifier names with \u200B (zero-width) and \u00A0 (NBSP)
  {
    // Transcriber containing zero-width space in placeholder name
    const d1 = createV3Fixture();
    d1.transcription.transcriber.name = 'TODO\u200B';
    const r1 = validateSyllabus(d1, { releaseCheck: true });
    assert(r1.valid === false, 'H-4: Transcriber with zero-width space in placeholder fails in release mode');
    assert(r1.errors.some(e => e.includes('Placeholder transcriber')), 'H-4: Transcriber placeholder error emitted');

    // Verifier containing NBSP in placeholder name
    const d2 = createV3Fixture();
    d2.transcription.verifier.name = 'TBD\u00A0';
    const r2 = validateSyllabus(d2, { releaseCheck: true });
    assert(r2.valid === false, 'H-4: Verifier with NBSP in placeholder fails in release mode');
    assert(r2.errors.some(e => e.includes('Placeholder verifier')), 'H-4: Verifier placeholder error emitted');

    // Second verifier containing zero-width space in placeholder name
    const d3 = createV3Fixture();
    d3.transcription.secondVerifier.name = 'DUMMY\u200B';
    const r3 = validateSyllabus(d3, { releaseCheck: true });
    assert(r3.valid === false, 'H-4: SecondVerifier with zero-width space in placeholder fails in release mode');
    assert(r3.errors.some(e => e.includes('Placeholder secondVerifier')), 'H-4: SecondVerifier placeholder error emitted');

    // Transcriber with pure zero-width space
    const d4 = createV3Fixture();
    d4.transcription.transcriber.name = '\u200B';
    const r4 = validateSyllabus(d4, { releaseCheck: true });
    assert(r4.valid === false, 'H-4: Pure zero-width space transcriber fails in release mode');

    // Verifier with pure NBSP
    const d5 = createV3Fixture();
    d5.transcription.verifier.name = '\u00A0';
    const r5 = validateSyllabus(d5, { releaseCheck: true });
    assert(r5.valid === false, 'H-4: Pure NBSP verifier fails in release mode');

    // Second verifier with zero-width + NBSP
    const d6 = createV3Fixture();
    d6.transcription.secondVerifier.name = '\u200B\u00A0';
    const r6 = validateSyllabus(d6, { releaseCheck: true });
    assert(r6.valid === false, 'H-4: Pure zero-width + NBSP secondVerifier fails in release mode');

    // Pairwise collision evasion via zero-width space
    const d7 = createV3Fixture();
    d7.transcription.secondVerifier.name = 'Alice\u200BSmith';
    d7.transcription.transcriber.name = 'AliceSmith';
    const r7 = validateSyllabus(d7, { releaseCheck: true });
    assert(r7.valid === false, 'H-4: secondVerifier == transcriber collision with zero-width space rejected');

    // Pairwise collision evasion via NBSP
    const d8 = createV3Fixture();
    d8.transcription.secondVerifier.name = 'Bob\u00A0Jones';
    d8.transcription.verifier.name = 'Bob Jones';
    const r8 = validateSyllabus(d8, { releaseCheck: true });
    assert(r8.valid === false, 'H-4: secondVerifier == primary verifier collision with NBSP rejected');
  }

  // H-4 #2: Prose containing TO\u0001DO, TO\u034FDO, TO\uFE0FDO and LOREM\u0085IPSUM in statement text
  {
    const proseCases = [
      { text: 'Research statement with TO\u0001DO marker', desc: 'TO\\u0001DO (control char)' },
      { text: 'Research statement with TO\u034FDO marker', desc: 'TO\\u034FDO (combining grapheme joiner)' },
      { text: 'Research statement with TO\uFE0FDO marker', desc: 'TO\\uFE0FDO (variation selector)' },
      { text: 'Statement containing LOREM\u0085IPSUM text', desc: 'LOREM\\u0085IPSUM (NEL character)' },
    ];

    for (const c of proseCases) {
      const d = createV3Fixture();
      d.units[0].statements[0].text.en = c.text;
      const r = validateSyllabus(d);
      assert(r.valid === false, `H-4: Statement with ${c.desc} is rejected by validateSyllabus`);
      assert(r.errors.some(e => e.includes('placeholder text found in verified English statement')), `H-4: Correct error for ${c.desc}`);
    }
  }

  // H-4 #3: [DUMMY:], [todo:] and [परीक्षण:] in statements must be rejected
  {
    const colonCases = [
      { text: 'Statement with [DUMMY:] marker', lang: 'en', desc: '[DUMMY:] with colon' },
      { text: 'Statement with [todo:] marker', lang: 'en', desc: '[todo:] lowercase with colon' },
      { text: 'विवरण [परीक्षण:] चिह्न', lang: 'hi', desc: '[परीक्षण:] with colon' }
    ];

    for (const c of colonCases) {
      const d = createV3Fixture();
      if (c.lang === 'hi') {
        d.units[0].statements[0].text.hi = c.text;
      } else {
        d.units[0].statements[0].text.en = c.text;
      }
      const r = validateSyllabus(d);
      assert(r.valid === false, `H-4: Statement with ${c.desc} is rejected by validateSyllabus`);
    }
  }

  // H-4 #4: LOREMIPSUM, 1LOREM IPSUM, LOREM IPSUM2, [DUMMY text], [abc DUMMY] accepted in statements
  {
    const acceptedCases = [
      { text: 'Research study discussing LOREMIPSUM term', desc: 'LOREMIPSUM glued without space' },
      { text: 'Section 1LOREM IPSUM reference', desc: '1LOREM IPSUM with leading digit' },
      { text: 'Reference to LOREM IPSUM2 dataset', desc: 'LOREM IPSUM2 with trailing digit' },
      { text: 'Use of [DUMMY text] in controlled regression', desc: '[DUMMY text] with non-marker bracket content' },
      { text: 'Statistical analysis of [abc DUMMY] model', desc: '[abc DUMMY] with prefix in brackets' }
    ];

    for (const c of acceptedCases) {
      const d = createV3Fixture();
      d.units[0].statements[0].text.en = c.text;
      const r = validateSyllabus(d);
      assert(r.valid === true, `H-4: Statement with ${c.desc} is accepted by validateSyllabus`);
    }

    // Also assert directly through containsProsePlaceholder
    assert(containsProsePlaceholder('LOREMIPSUM') === false, 'H-4: containsProsePlaceholder("LOREMIPSUM") === false');
    assert(containsProsePlaceholder('1LOREM IPSUM') === false, 'H-4: containsProsePlaceholder("1LOREM IPSUM") === false');
    assert(containsProsePlaceholder('LOREM IPSUM2') === false, 'H-4: containsProsePlaceholder("LOREM IPSUM2") === false');
    assert(containsProsePlaceholder('[DUMMY text]') === false, 'H-4: containsProsePlaceholder("[DUMMY text]") === false');
    assert(containsProsePlaceholder('[abc DUMMY]') === false, 'H-4: containsProsePlaceholder("[abc DUMMY]") === false');
  }
}

// SECTION 8: T-1 English-Only Release Model & Language Gate
console.log('\n--- Section 8: T-1 English-Only Release Model & Language Gate ---');
{
  function createEnglishOnlyV3Fixture() {
    const d = createV3Fixture();
    d.releaseLanguages = ['en'];
    delete d.subjectName.hi;
    delete d.transcription.isManuallyTypedFromVisual;
    for (const u of d.units) {
      delete u.title.hi;
      for (const s of u.statements) {
        delete s.text.hi;
      }
    }
    return d;
  }

  // T-1.1: Valid English-only V3 passes --release check
  {
    const d = createEnglishOnlyV3Fixture();
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === true, 'T-1.1: Valid English-only V3 passes --release check with lang: en');
    assert(!r.warnings.some((w) => w.includes('T-2')), 'T-1.1: T-2 advisory warning is bypassed for English-only release');
    assert(!r.errors.some((e) => e.includes('isManuallyTypedFromVisual')), 'T-1.1: T-5 visual typing certification is bypassed for English-only release');
    assert(r.summary.releaseLanguages.length === 1 && r.summary.releaseLanguages[0] === 'en', 'T-1.1: Summary reflects English-only release');
  }

  // T-1.2: Valid English-only V3 passes via doc.releaseLanguages without explicit option
  {
    const d = createEnglishOnlyV3Fixture();
    const r = validateSyllabus(d, { releaseCheck: true });
    assert(r.valid === true, 'T-1.2: Valid English-only V3 passes --release check via doc.releaseLanguages: ["en"]');
    assert(!r.warnings.some((w) => w.includes('T-2')), 'T-1.2: T-2 advisory warning is bypassed when doc.releaseLanguages is ["en"]');
  }

  // T-1.3: Unverified English-only document strictly fails --release check (R-1)
  {
    const d = createEnglishOnlyV3Fixture();
    d.verification = 'unverified';
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'T-1.3: Unverified English-only document fails --release check');
    assert(r.errors.some((e) => e.includes('R-1')), 'T-1.3: Emits R-1 failure requiring V3 dual_verified');
  }

  // T-1.4: Single-verifier V2 English-only document strictly fails --release check (R-1)
  {
    const d = createEnglishOnlyV3Fixture();
    d.verification = 'verified';
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'T-1.4: Single-verifier V2 English-only document fails --release check');
    assert(r.errors.some((e) => e.includes('R-1')), 'T-1.4: Emits R-1 error for V2 document in release mode');
  }

  // T-1.5: English placeholder in statement is strictly rejected in English-only release
  {
    const d = createEnglishOnlyV3Fixture();
    d.units[0].statements[0].text.en = 'Principles of teaching and [TODO] methods';
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'T-1.5: Placeholder in English statement rejected in English-only release');
    assert(r.errors.some((e) => e.includes('placeholder text found in verified English statement')), 'T-1.5: Emits English statement placeholder error');
  }

  // T-1.6: English unit title placeholder is strictly rejected in English-only release
  {
    const d = createEnglishOnlyV3Fixture();
    d.units[0].title.en = 'Teaching Aptitude [TODO]';
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'T-1.6: Placeholder in English unit title rejected in English-only release');
    assert(r.errors.some((e) => e.includes('placeholder text found in English unit title')), 'T-1.6: Emits English unit title placeholder error');
  }

  // T-1.7: Dual verification identity collision strictly rejected in English-only release
  {
    const d = createEnglishOnlyV3Fixture();
    d.transcription.secondVerifier.name = d.transcription.transcriber.name;
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'T-1.7: Second verifier identical to transcriber rejected in English-only release');
    assert(r.errors.some((e) => e.includes('cannot be identical to transcriber')), 'T-1.7: Emits dual verification distinctness error');
  }

  // T-1.8: Missing transcriber date strictly rejected in English-only release
  {
    const d = createEnglishOnlyV3Fixture();
    delete d.transcription.transcriber.date;
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'T-1.8: Missing transcriber date rejected in English-only release');
  }

  // T-1.9: CLI execution with --release --lang en
  {
    const scriptPath = join(REPO_ROOT, 'scripts', 'check-curriculum.mjs');
    const tempDir = mkdtempSync(join(os.tmpdir(), 'ureducator-t1-test-'));
    try {
      const d = createEnglishOnlyV3Fixture();
      const filePath = join(tempDir, 'paper1.syllabus.en.json');
      writeFileSync(filePath, JSON.stringify(d, null, 2), 'utf8');

      const cliPass = spawnSync(process.execPath, [scriptPath, filePath, '--release', '--lang', 'en'], { encoding: 'utf8' });
      assert(cliPass.status === 0, 'T-1.9: CLI --release --lang en exits with 0 on valid English-only V3');
      assert(cliPass.stdout.includes('RESULT: PASS (Structurally valid)'), 'T-1.9: CLI outputs RESULT: PASS');
      assert(cliPass.stdout.includes('Release Languages:   en'), 'T-1.9: CLI report displays Release Languages: en');
      assert(cliPass.stdout.includes('Hindi Verification:  BYPASS (English-only release model active)'), 'T-1.9: CLI report confirms Hindi bypass');

      const cliInvalidLang = spawnSync(process.execPath, [scriptPath, filePath, '--release', '--lang', 'fr'], { encoding: 'utf8' });
      assert(cliInvalidLang.status === 2, 'T-1.9: CLI with invalid --lang fr exits with code 2');
      assert(cliInvalidLang.stderr.includes("Invalid language: 'fr'"), 'T-1.9: CLI stderr reports invalid language');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  // --- Section 9: T-1 Corrections (C-1, C-2, C-3, CLI edge cases, invalid releaseLanguages) ---
  console.log('\n--- Section 9: T-1 Corrections (C-1, C-2, C-3) ---');

  // C-1: Hindi field rejection in English-only mode - Field 1: subjectName.hi
  {
    const d = createEnglishOnlyV3Fixture();
    d.subjectName.hi = 'शिक्षण एवं शोध अभिवृत्ति';
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'C-1.1: Non-empty subjectName.hi rejected in English-only mode');
    assert(r.errors.some((e) => e.includes('subjectName.hi')), 'C-1.1: Emits subjectName.hi rejection error');
  }

  // C-1: Hindi field rejection in English-only mode - Field 2: unit.title.hi
  {
    const d = createEnglishOnlyV3Fixture();
    d.units[0].title.hi = 'शिक्षण अभिवृत्ति';
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'C-1.2: Non-empty unit.title.hi rejected in English-only mode');
    assert(r.errors.some((e) => e.includes('title.hi')), 'C-1.2: Emits unit.title.hi rejection error');
  }

  // C-1: Hindi field rejection in English-only mode - Field 3: stmt.text.hi
  {
    const d = createEnglishOnlyV3Fixture();
    d.units[0].statements[0].text.hi = 'शिक्षण प्रकृति एवं विशेषताएं';
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'C-1.3: Non-empty stmt.text.hi rejected in English-only mode');
    assert(r.errors.some((e) => e.includes('text.hi')), 'C-1.3: Emits stmt.text.hi rejection error');
  }

  // C-2 Direction 1: Target excludes a language that doc.releaseLanguages declares -> Error
  {
    const d = createV3Fixture();
    d.releaseLanguages = ['en', 'hi'];
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en' });
    assert(r.valid === false, 'C-2.1: Target excluding declared release language is rejected');
    assert(r.errors.some((e) => e.includes("excludes declared release language 'hi'")), 'C-2.1: Emits language target exclusion error');
  }

  // C-2 Direction 2: Stricter target than document declares is allowed (no C-2 exclusion error)
  {
    const d = createEnglishOnlyV3Fixture();
    d.releaseLanguages = ['en'];
    const r = validateSyllabus(d, { releaseCheck: true, lang: 'en,hi' });
    // Stricter target demands Hindi, which English-only fixture lacks, but C-2 target exclusion error is NOT emitted
    assert(!r.errors.some((e) => e.includes('excludes declared release language')), 'C-2.2: Stricter target does not emit C-2 exclusion error');
  }

  // C-3: API option validation
  {
    const d = createEnglishOnlyV3Fixture();
    const rInvalidStr = validateSyllabus(d, { releaseCheck: true, lang: 'es' });
    assert(rInvalidStr.valid === false, 'C-3.1: Invalid API option string rejected');
    assert(rInvalidStr.errors.some((e) => e.includes("Invalid language option: 'es'")), 'C-3.1: Emits invalid language option error for string');

    const rInvalidArr = validateSyllabus(d, { releaseCheck: true, lang: ['en', 'fr'] });
    assert(rInvalidArr.valid === false, 'C-3.2: Invalid API option array rejected');
    assert(rInvalidArr.errors.some((e) => e.includes("Invalid language option: 'en,fr'")), 'C-3.2: Emits invalid language option error for array');

    const rValidArr = validateSyllabus(d, { releaseCheck: true, lang: ['en'] });
    assert(rValidArr.valid === true, 'C-3.3: Valid array API option accepted');
  }

  // Invalid doc.releaseLanguages
  {
    const d1 = createEnglishOnlyV3Fixture();
    d1.releaseLanguages = 'en'; // non-array
    const r1 = validateSyllabus(d1, { releaseCheck: true, lang: 'en' });
    assert(r1.valid === false, 'C-ReleaseLang: Non-array doc.releaseLanguages rejected');
    assert(r1.errors.some((e) => e.includes("Invalid 'releaseLanguages': must be a non-empty array")), 'C-ReleaseLang: Emits non-array error');

    const d2 = createEnglishOnlyV3Fixture();
    d2.releaseLanguages = []; // empty array
    const r2 = validateSyllabus(d2, { releaseCheck: true, lang: 'en' });
    assert(r2.valid === false, 'C-ReleaseLang: Empty array doc.releaseLanguages rejected');
    assert(r2.errors.some((e) => e.includes("Invalid 'releaseLanguages': must be a non-empty array")), 'C-ReleaseLang: Emits empty array error');

    const d3 = createEnglishOnlyV3Fixture();
    d3.releaseLanguages = ['en', 'de']; // invalid code
    const r3 = validateSyllabus(d3, { releaseCheck: true, lang: 'en' });
    assert(r3.valid === false, 'C-ReleaseLang: Invalid language code in doc.releaseLanguages rejected');
    assert(r3.errors.some((e) => e.includes("Invalid language in 'releaseLanguages': 'de'")), 'C-ReleaseLang: Emits invalid code error');
  }

  // CLI execution: --lang hi
  {
    const scriptPath = join(REPO_ROOT, 'scripts', 'check-curriculum.mjs');
    const tempDir = mkdtempSync(join(os.tmpdir(), 'ureducator-t1-test-'));
    try {
      const d = createV3Fixture();
      const filePath = join(tempDir, 'paper1.syllabus.bilingual.json');
      writeFileSync(filePath, JSON.stringify(d, null, 2), 'utf8');

      const cliHi = spawnSync(process.execPath, [scriptPath, filePath, '--release', '--lang', 'hi'], { encoding: 'utf8' });
      assert(cliHi.status === 0, 'CLI --lang hi exits with 0 on valid document');
      assert(cliHi.stdout.includes('Release Languages:   hi'), 'CLI report displays Release Languages: hi');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  // CLI execution: --lang with no value exits 2
  {
    const scriptPath = join(REPO_ROOT, 'scripts', 'check-curriculum.mjs');
    const tempDir = mkdtempSync(join(os.tmpdir(), 'ureducator-t1-test-'));
    try {
      const d = createEnglishOnlyV3Fixture();
      const filePath = join(tempDir, 'paper1.syllabus.en.json');
      writeFileSync(filePath, JSON.stringify(d, null, 2), 'utf8');

      const cliNoVal = spawnSync(process.execPath, [scriptPath, filePath, '--release', '--lang'], { encoding: 'utf8' });
      assert(cliNoVal.status === 2, 'CLI --lang with no value exits with code 2');
      assert(cliNoVal.stderr.includes('--lang requires a language argument'), 'CLI stderr reports missing argument');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

console.log('\n========================================================================');
console.log(`Test Execution Summary: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
if (failed > 0) {
  process.exit(1);
}
