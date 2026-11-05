#!/usr/bin/env node
/**
 * UrEducator 2.0 — Local Curriculum Checker
 * Plain Node.js with built-in modules only (no new dependencies).
 * Validates Paper I syllabus transcription records against schema and governance rules.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

/**
 * Validates a Paper I syllabus document object.
 * Returns { valid: boolean, isStarter: boolean, errors: string[], warnings: string[], summary: object }
 */
export function validateSyllabus(doc) {
  const errors = [];
  const warnings = [];

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { valid: false, isStarter: false, errors: ['Root document must be a JSON object'], warnings, summary: null };
  }

  // 1. Basic Identity Fields
  if (doc.subjectCode !== '00') {
    errors.push(`Invalid subjectCode: expected '00' for Paper I, got '${doc.subjectCode}'`);
  }

  if (!doc.subjectName || typeof doc.subjectName !== 'object') {
    errors.push('Missing subjectName object');
  } else {
    if (!doc.subjectName.en || typeof doc.subjectName.en !== 'string' || !doc.subjectName.en.trim()) {
      errors.push('Missing or empty English subject name (subjectName.en)');
    }
    if (!doc.subjectName.hi || typeof doc.subjectName.hi !== 'string' || !doc.subjectName.hi.trim()) {
      errors.push('Missing or empty Hindi subject name (subjectName.hi)');
    }
  }

  if (typeof doc.syllabusVersion !== 'number' || doc.syllabusVersion < 1) {
    errors.push('syllabusVersion must be a positive integer >= 1');
  }

  const validStatuses = ['draft', 'in_review', 'verified', 'published', 'retired'];
  if (!validStatuses.includes(doc.status)) {
    errors.push(`Invalid status: '${doc.status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  const validVerifications = ['unverified', 'verified', 'dual_verified'];
  if (!validVerifications.includes(doc.verification)) {
    errors.push(`Invalid verification: '${doc.verification}'. Must be one of: ${validVerifications.join(', ')}`);
  }

  // 2. Transcription & Dual-Person Verification
  if (!doc.transcription || typeof doc.transcription !== 'object') {
    errors.push('Missing transcription metadata block');
  } else {
    const transcriber = doc.transcription.transcriber?.name?.trim();
    const verifier = doc.transcription.verifier?.name?.trim();

    if (!transcriber) {
      errors.push('Missing transcriber identity (transcription.transcriber.name)');
    }
    if (!verifier) {
      errors.push('Missing verifier identity (transcription.verifier.name)');
    }

    if (transcriber && verifier && transcriber.toLowerCase() === verifier.toLowerCase()) {
      errors.push(`Independent verification violation: verifier ('${verifier}') cannot be identical to transcriber ('${transcriber}')`);
    }
  }

  // 3. Units and Statements Validation
  if (!Array.isArray(doc.units)) {
    errors.push('Missing units array');
    return { valid: errors.length === 0, isStarter: false, errors, warnings, summary: null };
  }

  const isStarter = doc.units.length === 0;
  let totalStatements = 0;
  let statementsWithPage = 0;
  let statementsWithSourceDoc = 0;
  let statementsWithHindi = 0;
  let statementsWithEnglish = 0;

  if (isStarter) {
    warnings.push('PREPARATION_STARTER: Document contains 0 syllabus units. Valid as an initial starter template, but NOT verified or publishable content.');
  } else {
    const seenUnitNumbers = new Set();

    doc.units.forEach((unit, idx) => {
      const expectedUnitNo = idx + 1;
      const unitPrefix = `Unit[${idx}]`;

      if (typeof unit.unitNo !== 'number') {
        errors.push(`${unitPrefix}: missing numeric unitNo`);
      } else {
        if (seenUnitNumbers.has(unit.unitNo)) {
          errors.push(`${unitPrefix}: duplicate unitNo ${unit.unitNo}`);
        }
        seenUnitNumbers.add(unit.unitNo);

        if (unit.unitNo !== expectedUnitNo) {
          errors.push(`${unitPrefix}: non-contiguous unit numbering: expected ${expectedUnitNo}, got ${unit.unitNo}`);
        }
      }

      // Titles in English and Hindi
      if (!unit.title || typeof unit.title !== 'object') {
        errors.push(`${unitPrefix}: missing title object`);
      } else {
        if (!unit.title.en || typeof unit.title.en !== 'string' || !unit.title.en.trim()) {
          errors.push(`${unitPrefix} (Unit ${unit.unitNo || expectedUnitNo}): missing English title (title.en)`);
        }
        if (!unit.title.hi || typeof unit.title.hi !== 'string' || !unit.title.hi.trim()) {
          errors.push(`${unitPrefix} (Unit ${unit.unitNo || expectedUnitNo}): missing Hindi title (title.hi)`);
        }
      }

      // Statements
      if (!Array.isArray(unit.statements)) {
        errors.push(`${unitPrefix}: missing statements array`);
      } else {
        unit.statements.forEach((stmt, sIdx) => {
          totalStatements++;
          const stmtPrefix = `${unitPrefix}.Statement[${sIdx}]`;

          if (typeof stmt.page !== 'number' || stmt.page < 1) {
            errors.push(`${stmtPrefix}: missing or invalid page reference (expected positive integer, got ${stmt.page})`);
          } else {
            statementsWithPage++;
          }

          if (!stmt.sourceDocId || typeof stmt.sourceDocId !== 'string' || !stmt.sourceDocId.trim()) {
            errors.push(`${stmtPrefix}: missing sourceDocId reference`);
          } else {
            statementsWithSourceDoc++;
          }

          if (!stmt.text || typeof stmt.text !== 'object') {
            errors.push(`${stmtPrefix}: missing text object`);
          } else {
            if (stmt.text.en && typeof stmt.text.en === 'string' && stmt.text.en.trim()) {
              statementsWithEnglish++;
            } else {
              errors.push(`${stmtPrefix}: missing English statement text (text.en)`);
            }

            if (stmt.text.hi && typeof stmt.text.hi === 'string' && stmt.text.hi.trim()) {
              statementsWithHindi++;
            } else {
              errors.push(`${stmtPrefix}: missing Hindi statement text (text.hi)`);
            }
          }
        });
      }
    });
  }

  const summary = {
    subjectCode: doc.subjectCode,
    status: doc.status,
    verification: doc.verification,
    isStarter,
    unitCount: doc.units.length,
    totalStatements,
    coverage: {
      statementsWithPage,
      statementsWithSourceDoc,
      statementsWithEnglish,
      statementsWithHindi,
      pageCoveragePercent: totalStatements > 0 ? Math.round((statementsWithPage / totalStatements) * 100) : 0,
      hindiCoveragePercent: totalStatements > 0 ? Math.round((statementsWithHindi / totalStatements) * 100) : 0,
      englishCoveragePercent: totalStatements > 0 ? Math.round((statementsWithEnglish / totalStatements) * 100) : 0,
    },
    transcriber: doc.transcription?.transcriber?.name || null,
    verifier: doc.transcription?.verifier?.name || null,
  };

  return {
    valid: errors.length === 0,
    isStarter,
    errors,
    warnings,
    summary,
  };
}

export function formatReport(result, filename) {
  const lines = [];
  lines.push('========================================================================');
  lines.push(` UrEducator 2.0 — Paper I Curriculum Validation Report`);
  lines.push(` Target: ${filename}`);
  lines.push('========================================================================');

  if (result.summary) {
    const s = result.summary;
    lines.push(`Subject Code:        ${s.subjectCode}`);
    lines.push(`Lifecycle Status:    ${s.status}`);
    lines.push(`Verification State:  ${s.verification}`);
    lines.push(`Document Nature:     ${s.isStarter ? 'PREPARATION STARTER (Empty units)' : 'POPULATED SYLLABUS'}`);
    lines.push(`Transcriber:         ${s.transcriber || 'N/A'}`);
    lines.push(`Verifier:            ${s.verifier || 'N/A'}`);
    lines.push(`Total Units:         ${s.unitCount}`);
    lines.push(`Total Statements:    ${s.totalStatements}`);
    if (s.totalStatements > 0) {
      lines.push(`Page Citations:      ${s.coverage.statementsWithPage}/${s.totalStatements} (${s.coverage.pageCoveragePercent}%)`);
      lines.push(`English Coverage:    ${s.coverage.statementsWithEnglish}/${s.totalStatements} (${s.coverage.englishCoveragePercent}%)`);
      lines.push(`Hindi Coverage:      ${s.coverage.statementsWithHindi}/${s.totalStatements} (${s.coverage.hindiCoveragePercent}%)`);
    }
  }

  lines.push('------------------------------------------------------------------------');
  if (result.warnings.length > 0) {
    lines.push('WARNINGS / NOTICES:');
    result.warnings.forEach((w) => lines.push(`  [!] ${w}`));
  }

  if (result.errors.length > 0) {
    lines.push('VALIDATION FAILURES:');
    result.errors.forEach((e) => lines.push(`  [X] ${e}`));
    lines.push('------------------------------------------------------------------------');
    lines.push('RESULT: FAIL (Schema and governance errors detected)');
  } else {
    lines.push('RESULT: PASS (Structurally valid)');
    if (result.isStarter) {
      lines.push('NOTE: Structural validity confirmed. Content verification is PENDING human transcription.');
    }
  }
  lines.push('========================================================================');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0] || args[0] === '-h' || args[0] === '--help') {
    console.error('Usage: node scripts/check-curriculum.mjs <path-to-syllabus-json>');
    process.exit(1);
  }

  const targetPath = resolve(args[0]);
  if (!existsSync(targetPath)) {
    console.error(`Error: File not found: ${args[0]}`);
    process.exit(1);
  }

  let content;
  try {
    content = JSON.parse(readFileSync(targetPath, 'utf8'));
  } catch (err) {
    console.error(`Error: Invalid JSON in ${args[0]}: ${err.message}`);
    process.exit(1);
  }

  const result = validateSyllabus(content);
  console.log(formatReport(result, basename(targetPath)));

  if (!result.valid) {
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  main();
}
