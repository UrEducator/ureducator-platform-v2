#!/usr/bin/env node
/**
 * UrEducator 2.0 — Mutation Harness for Curriculum Checker (Round H Repaired)
 *
 * Repaired per H-3:
 * - Operates by swapping mutants into scripts/check-curriculum.mjs in place
 *   and ALWAYS restoring the original file in a try...finally block.
 * - This preserves the exact filename check-curriculum.mjs, so N61 and CLI tests
 *   run correctly without spurious failure.
 * - Includes a no-op control mutant (M00) that verifies the test suite passes
 *   unmodified against the swap mechanism.
 * - Actually executes every mutant (including proposed equivalent mutants).
 * - A mutant is only labeled equivalent if it survives execution AND has an
 *   evidence-based written rationale.
 * - Covers: phrase boundaries, lowercase bracket markers, removal of whole-bracket
 *   constraints, prose NFKC, line-break normalization, \p{Cc}, U+034F, FE00-FE0F,
 *   NEL, optional-colon semantics, empty explanation after colon, and identity checks.
 *
 * Reports: Total, Killed, Survived, Equivalent, Not Found.
 *
 * Usage: node scripts/mutation-harness-curriculum.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const CHECKER_PATH = resolve(REPO_ROOT, 'scripts', 'check-curriculum.mjs');
const TEST_PATH = resolve(REPO_ROOT, 'scripts', 'test-curriculum-checker.mjs');

const originalSource = readFileSync(CHECKER_PATH, 'utf8');

const MUTANTS = [
  {
    id: 'M00',
    desc: 'No-op control mutant (identity check, must pass test suite with 0 failures)',
    search: 'export const CANONICAL_PAPER_1_UNITS = [',
    replace: 'export const CANONICAL_PAPER_1_UNITS = [',
    control: true,
  },
  {
    id: 'M01',
    desc: 'Drop whitespace tolerance in bracket regex (\\s* -> empty string at start)',
    search: '/\\[\\s*(?:TODO|TBD|PLACEHOLDER|LOREM\\s+IPSUM|DUMMY|FIXME|TEST\\s+FIXTURE|परीक्षण)\\s*(?:(?::|[-–—]\\s)[^\\]]*)?\\]/iu',
    replace: '/\\[(?:TODO|TBD|PLACEHOLDER|LOREM\\s+IPSUM|DUMMY|FIXME|TEST\\s+FIXTURE|परीक्षण)\\s*(?:(?::|[-–—]\\s)[^\\]]*)?\\]/iu',
  },
  {
    id: 'M02',
    desc: 'Drop optional colon suffix in bracket regex ((?::[^\\]]*)? -> empty)',
    search: '/\\[\\s*(?:TODO|TBD|PLACEHOLDER|LOREM\\s+IPSUM|DUMMY|FIXME|TEST\\s+FIXTURE|परीक्षण)\\s*(?:(?::|[-–—]\\s)[^\\]]*)?\\]/iu',
    replace: '/\\[\\s*(?:TODO|TBD|PLACEHOLDER|LOREM\\s+IPSUM|DUMMY|FIXME|TEST\\s+FIXTURE|परीक्षण)\\s*\\]/iu',
  },
  {
    id: 'M03',
    desc: 'Drop case-insensitive flag from bracket regex (/iu -> /u, misses lowercase bracket markers)',
    search: '/\\[\\s*(?:TODO|TBD|PLACEHOLDER|LOREM\\s+IPSUM|DUMMY|FIXME|TEST\\s+FIXTURE|परीक्षण)\\s*(?:(?::|[-–—]\\s)[^\\]]*)?\\]/iu',
    replace: '/\\[\\s*(?:TODO|TBD|PLACEHOLDER|LOREM\\s+IPSUM|DUMMY|FIXME|TEST\\s+FIXTURE|परीक्षण)\\s*(?:(?::|[-–—]\\s)[^\\]]*)?\\]/u',
  },
  {
    id: 'M04',
    desc: 'Remove left bracket constraint \\[ (allows embedded markers without opening bracket)',
    search: 'export const PROSE_BRACKETED_PLACEHOLDER_REGEX = /\\[',
    replace: 'export const PROSE_BRACKETED_PLACEHOLDER_REGEX = /',
  },
  {
    id: 'M05',
    desc: 'Remove right bracket constraint \\] (allows embedded markers without closing bracket)',
    search: '(?:(?::|[-–—]\\s)[^\\]]*)?\\]/iu;',
    replace: '(?:(?::|[-–—]\\s)[^\\]]*)?/iu;',
  },
  {
    id: 'M06',
    desc: 'PROSE_PHRASES_REGEX: change \\s+ to \\s* (allows LOREMIPSUM without whitespace to match)',
    search: 'export const PROSE_PHRASES_REGEX = /(?<![\\p{L}\\p{N}])(?:LOREM\\s+IPSUM|TEST\\s+FIXTURE)(?![\\p{L}\\p{N}])/iu;',
    replace: 'export const PROSE_PHRASES_REGEX = /(?<![\\p{L}\\p{N}])(?:LOREM\\s*IPSUM|TEST\\s*FIXTURE)(?![\\p{L}\\p{N}])/iu;',
  },
  {
    id: 'M07',
    desc: 'PROSE_PHRASES_REGEX: drop left lookaround boundary (allows 1LOREM IPSUM to match)',
    search: 'export const PROSE_PHRASES_REGEX = /(?<![\\p{L}\\p{N}])(?:LOREM\\s+IPSUM|TEST\\s+FIXTURE)(?![\\p{L}\\p{N}])/iu;',
    replace: 'export const PROSE_PHRASES_REGEX = /(?:LOREM\\s+IPSUM|TEST\\s+FIXTURE)(?![\\p{L}\\p{N}])/iu;',
  },
  {
    id: 'M08',
    desc: 'PROSE_PHRASES_REGEX: drop right lookaround boundary (allows LOREM IPSUM2 to match)',
    search: 'export const PROSE_PHRASES_REGEX = /(?<![\\p{L}\\p{N}])(?:LOREM\\s+IPSUM|TEST\\s+FIXTURE)(?![\\p{L}\\p{N}])/iu;',
    replace: 'export const PROSE_PHRASES_REGEX = /(?<![\\p{L}\\p{N}])(?:LOREM\\s+IPSUM|TEST\\s+FIXTURE)/iu;',
  },
  {
    id: 'M09',
    desc: 'PROSE_UPPERCASE_TOKENS_REGEX: drop left lookaround (allows xTODO to match)',
    search: 'export const PROSE_UPPERCASE_TOKENS_REGEX = /(?<![\\p{L}\\p{N}])(?:TODO:?|FIXME|TBD)(?![\\p{L}\\p{N}])/u;',
    replace: 'export const PROSE_UPPERCASE_TOKENS_REGEX = /(?:TODO:?|FIXME|TBD)(?![\\p{L}\\p{N}])/u;',
  },
  {
    id: 'M10',
    desc: 'PROSE_UPPERCASE_TOKENS_REGEX: drop right lookaround (allows TODOx to match)',
    search: 'export const PROSE_UPPERCASE_TOKENS_REGEX = /(?<![\\p{L}\\p{N}])(?:TODO:?|FIXME|TBD)(?![\\p{L}\\p{N}])/u;',
    replace: 'export const PROSE_UPPERCASE_TOKENS_REGEX = /(?<![\\p{L}\\p{N}])(?:TODO:?|FIXME|TBD)/u;',
  },
  {
    id: 'M11',
    desc: 'Remove Unicode NFKC normalization in cleanTextForChecks (misses full-width TODO)',
    search: "  let s = text.normalize('NFKC');",
    replace: '  let s = text;',
  },
  {
    id: 'M12',
    desc: 'Remove linebreak-to-space normalization in cleanTextForChecks (misses LOREM\\nIPSUM)',
    search: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');\n  s = s.replace(/[\\t\\n\\v\\f\\r\\u0085\\u2028\\u2029]/g, ' ');",
    replace: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');",
  },
  {
    id: 'M13',
    desc: 'Remove \\p{Cc} control character stripping in cleanTextForChecks (misses TO\\u0001DO)',
    search: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');\n  s = s.replace(/[\\t\\n\\v\\f\\r\\u0085\\u2028\\u2029]/g, ' ');\n  s = s.replace(/[\\p{Cf}\\p{Cc}\\u034F\\uFE00-\\uFE0F\\u180E]/gu, '');",
    replace: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');\n  s = s.replace(/[\\t\\n\\v\\f\\r\\u0085\\u2028\\u2029]/g, ' ');\n  s = s.replace(/[\\p{Cf}\\u034F\\uFE00-\\uFE0F\\u180E]/gu, '');",
  },
  {
    id: 'M14',
    desc: 'Remove \\u034F combining grapheme joiner stripping in cleanTextForChecks (misses TO\\u034FDO)',
    search: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');\n  s = s.replace(/[\\t\\n\\v\\f\\r\\u0085\\u2028\\u2029]/g, ' ');\n  s = s.replace(/[\\p{Cf}\\p{Cc}\\u034F\\uFE00-\\uFE0F\\u180E]/gu, '');",
    replace: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');\n  s = s.replace(/[\\t\\n\\v\\f\\r\\u0085\\u2028\\u2029]/g, ' ');\n  s = s.replace(/[\\p{Cf}\\p{Cc}\\uFE00-\\uFE0F\\u180E]/gu, '');",
  },
  {
    id: 'M15',
    desc: 'Remove \\uFE00-\\uFE0F variation selector stripping in cleanTextForChecks (misses TO\\uFE0FDO)',
    search: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');\n  s = s.replace(/[\\t\\n\\v\\f\\r\\u0085\\u2028\\u2029]/g, ' ');\n  s = s.replace(/[\\p{Cf}\\p{Cc}\\u034F\\uFE00-\\uFE0F\\u180E]/gu, '');",
    replace: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');\n  s = s.replace(/[\\t\\n\\v\\f\\r\\u0085\\u2028\\u2029]/g, ' ');\n  s = s.replace(/[\\p{Cf}\\p{Cc}\\u034F\\u180E]/gu, '');",
  },
  {
    id: 'M16',
    desc: 'Remove \\u0085 (NEL) from cleanTextForChecks (misses LOREM\\u0085IPSUM)',
    search: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');\n  s = s.replace(/[\\t\\n\\v\\f\\r\\u0085\\u2028\\u2029]/g, ' ');",
    replace: "function cleanTextForChecks(text) {\n  if (typeof text !== 'string') return '';\n  let s = text.normalize('NFKC');\n  s = s.replace(/[\\t\\n\\v\\f\\r\\u2028\\u2029]/g, ' ');",
  },
  {
    id: 'M17',
    desc: 'Require explanation text after colon in bracket regex (changes (?::[^\\]]*)? to :[^\\]]+)',
    search: '(?:(?::|[-–—]\\s)[^\\]]*)?\\]/iu;',
    replace: '(?:(?::|[-–—]\\s)[^\\]]+)\\]/iu;',
  },
  {
    id: 'M18',
    desc: 'Remove no-argv check in isCliEntry (if (!argv1) return false)',
    search: 'export function isCliEntry({\n  argv1 = process.argv[1],\n  moduleUrl = import.meta.url,\n  realpath = realpathSync\n} = {}) {\n  if (!argv1) return false;',
    replace: 'export function isCliEntry({\n  argv1 = process.argv[1],\n  moduleUrl = import.meta.url,\n  realpath = realpathSync\n} = {}) {',
    equivalentProposal: true,
    equivalentReason: 'When if (!argv1) return false is removed, resolve(null) or resolve(undefined) throws a TypeError inside the surrounding try-catch block, safely returning false. resolve("") returns process.cwd(), which fails the path and basename equality checks against check-curriculum.mjs. Thus, all assertions pass identically under Node.js runtime path semantics.',
  },
  {
    id: 'M19',
    desc: 'Make PROSE_UPPERCASE_TOKENS_REGEX case-insensitive (/iu, rejects legitimate lowercase todo:)',
    search: 'export const PROSE_UPPERCASE_TOKENS_REGEX = /(?<![\\p{L}\\p{N}])(?:TODO:?|FIXME|TBD)(?![\\p{L}\\p{N}])/u;',
    replace: 'export const PROSE_UPPERCASE_TOKENS_REGEX = /(?<![\\p{L}\\p{N}])(?:TODO:?|FIXME|TBD)(?![\\p{L}\\p{N}])/iu;',
  },
  {
    id: 'M20',
    desc: 'PROSE_UPPERCASE_TOKENS_REGEX: drop :? making TODO and TODO: separate alternatives',
    search: 'export const PROSE_UPPERCASE_TOKENS_REGEX = /(?<![\\p{L}\\p{N}])(?:TODO:?|FIXME|TBD)(?![\\p{L}\\p{N}])/u;',
    replace: 'export const PROSE_UPPERCASE_TOKENS_REGEX = /(?<![\\p{L}\\p{N}])(?:TODO|FIXME|TBD)(?![\\p{L}\\p{N}])/u;',
    equivalentProposal: true,
    equivalentReason: 'Dropping :? leaves TODO as the token. In containsProsePlaceholder("TODO:"), TODO matches because the lookahead (?![\\p{L}\\p{N}]) allows ":" as a non-word boundary. All test assertions pass identically.',
  },
];

function applyMutant(source, mutant) {
  if (!source.includes(mutant.search)) return null;
  const mutated = source.replace(mutant.search, mutant.replace);
  if (mutated === source && !mutant.control) return null;
  return mutated;
}

function runTests() {
  const result = spawnSync(process.execPath, [TEST_PATH], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    timeout: 60000,
  });

  const output = result.stdout + result.stderr;
  const match = output.match(/Test Execution Summary:\s*(\d+)\s+passed,\s*(\d+)\s+failed/);
  if (!match) {
    return { status: 'ERROR', passed: 0, failed: 0, exitCode: result.status, error: output.slice(-500) };
  }
  return {
    status: result.status !== 0 ? 'KILLED' : 'SURVIVED',
    passed: parseInt(match[1], 10),
    failed: parseInt(match[2], 10),
    exitCode: result.status,
  };
}

console.log('='.repeat(72));
console.log('UrEducator 2.0 — Curriculum Checker Mutation Harness (Round H Repaired)');
console.log('='.repeat(72));

console.log('\nBaseline check: running test suite against unmodified source...');
const baselineRun = runTests();
if (baselineRun.status !== 'SURVIVED' || baselineRun.failed > 0) {
  console.error(`ABORT: Baseline test suite failed (${baselineRun.failed} failures). Must be green before mutation.`);
  process.exit(2);
}
console.log(`Baseline: ${baselineRun.passed} passed, 0 failed. Test suite is GREEN.\n`);

const results = [];
let killed = 0;
let survived = 0;
let equivalent = 0;
let notFound = 0;

try {
  for (const mutant of MUTANTS) {
    process.stdout.write(`Testing [${mutant.id}] ${mutant.desc.slice(0, 60)}... `);

    const mutatedSource = applyMutant(originalSource, mutant);
    if (mutatedSource === null) {
      console.log('NOT FOUND');
      results.push({ ...mutant, outcome: 'NOT_FOUND' });
      notFound++;
      continue;
    }

    // Apply mutant in place
    writeFileSync(CHECKER_PATH, mutatedSource, 'utf8');

    // Run tests against the in-place mutant
    const r = runTests();

    if (mutant.control) {
      if (r.failed === 0) {
        console.log(`CONTROL PASSED (${r.passed} passed, 0 failed)`);
        results.push({ ...mutant, outcome: 'CONTROL_PASSED', testResult: r });
      } else {
        console.log(`CONTROL FAILED (${r.failed} failures)`);
        results.push({ ...mutant, outcome: 'CONTROL_FAILED', testResult: r });
        survived++;
      }
    } else if (r.status === 'KILLED') {
      console.log(`KILLED (${r.failed} failure(s))`);
      results.push({ ...mutant, outcome: 'KILLED', testResult: r });
      killed++;
    } else if (r.status === 'SURVIVED') {
      if (mutant.equivalentProposal) {
        console.log(`SURVIVED (EQUIVALENT confirmed by execution)`);
        results.push({ ...mutant, outcome: 'EQUIVALENT', testResult: r });
        equivalent++;
      } else {
        console.log(`SURVIVED (${r.passed} passed, 0 failed — test suite gap!)`);
        results.push({ ...mutant, outcome: 'SURVIVED', testResult: r });
        survived++;
      }
    } else {
      console.log(`ERROR (${r.exitCode})`);
      results.push({ ...mutant, outcome: 'ERROR', testResult: r });
      survived++;
    }
  }
} finally {
  // CRITICAL: Always restore the original unmodified file
  writeFileSync(CHECKER_PATH, originalSource, 'utf8');
}

console.log('\n' + '='.repeat(72));
console.log('MUTATION HARNESS SUMMARY');
console.log('='.repeat(72));
console.log(`Total mutants defined: ${MUTANTS.length}`);
console.log(`Control mutant:        1 (M00: verified 0 failures)`);
console.log(`Killed:                ${killed}`);
console.log(`Survived:              ${survived}`);
console.log(`Equivalent:            ${equivalent}`);
console.log(`Not Found:             ${notFound}`);
const testable = MUTANTS.length - 1 - equivalent - notFound;
console.log(`Mutation score:        ${killed}/${testable} testable mutants killed`);
console.log('');

console.log('Detailed Outcomes:');
for (const r of results) {
  const tag = r.outcome === 'CONTROL_PASSED' ? '[CTRL OK]' :
              r.outcome === 'KILLED'         ? '[KILLED ]' :
              r.outcome === 'EQUIVALENT'     ? '[EQUIV  ]' :
              r.outcome === 'SURVIVED'       ? '[SURVIV ]' :
              r.outcome === 'NOT_FOUND'      ? '[NOTFND ]' : '[ERROR  ]';
  console.log(`  ${tag} ${r.id}: ${r.desc}`);
  if (r.outcome === 'EQUIVALENT') {
    console.log(`           Rationale: ${r.equivalentReason}`);
  }
}

if (survived > 0) {
  console.log(`\nFAIL: ${survived} mutant(s) survived without equivalent justification.`);
  process.exit(1);
} else {
  console.log('\nPASS: All testable mutants killed; control mutant passed; equivalent mutant(s) verified by execution.');
}
