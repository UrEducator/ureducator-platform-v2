#!/usr/bin/env node
/**
 * UrEducator 2.0 — Local Curriculum Checker (C-03 remediation (F-round))
 * Plain Node.js with built-in modules only (no new dependencies).
 * Validates Paper I syllabus transcription records against schema and academic governance rules.
 *
 * Implements:
 * - Claude Finding C-03 & Corrections R-1 through R-6
 * - Strict V3 (--release) gate requiring dual human verifiers
 * - Normalization of human identities (NFKC, zero-width stripping, whitespace collapse)
 * - Strict YYYY-MM effective dates and SHA-256 format/value validation
 *   (Note: does not compute hashes from PDF bytes and does not compare them to MANIFEST.json)
 * - Canonical Paper I 10-unit structure & presence of at least one Devanagari character check
 * - Anti-auto-promotion protection for official dataset imports
 * - Placeholder policy distinction (F-4, G-1): unverified draft statements may contain placeholders
 *   while being authored, but subject names and unit titles are checked even in drafts.
 *   Placeholder policy summary:
 *     • Names (Policy A): strict — rejects PENDING, UNKNOWN, DUMMY, PLACEHOLDER, TODO, etc.
 *     • Prose (Policy B): structured — rejects only whole-bracket markers ([TODO], [DUMMY], [परीक्षण:…]),
 *       explicit uppercase tokens (TODO, TBD, FIXME), and phrases (LOREM IPSUM, TEST FIXTURE).
 *       Legitimate academic expressions ([Dummy variables], [abc DUMMY], [DUMMY text], [PENDING], [UNKNOWN]) are accepted.
 *       Note: [abc TODO] is rejected by the uppercase-token rule.
 *     • Drafts: placeholder markers allowed in statement text; forbidden in subject/unit names.
 * - Symlink-aware CLI entry guard with explicit resolution semantics (F-6, G-5)
 */

import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANONICAL_PAPER_1_UNITS = [
  { unitNo: 1, titleEn: 'Teaching Aptitude', titleHi: 'शिक्षण अभिवृत्ति', key: 'teaching' },
  { unitNo: 2, titleEn: 'Research Aptitude', titleHi: 'शोध अभिवृत्ति', key: 'research' },
  { unitNo: 3, titleEn: 'Comprehension', titleHi: 'बोध (पठन अवबोधन)', key: 'comprehension' },
  { unitNo: 4, titleEn: 'Communication', titleHi: 'संचार / संप्रेषण', key: 'communication' },
  { unitNo: 5, titleEn: 'Mathematical Reasoning and Aptitude', titleHi: 'गणितीय तर्क और अभिवृत्ति', key: 'mathematical' },
  { unitNo: 6, titleEn: 'Logical Reasoning', titleHi: 'युक्तियुक्त तर्क', key: 'logical' },
  { unitNo: 7, titleEn: 'Data Interpretation', titleHi: 'आंकड़ों की व्याख्या', key: 'data' },
  { unitNo: 8, titleEn: 'Information and Communication Technology (ICT)', titleHi: 'सूचना एवं संचार प्रौद्योगिकी (ICT)', key: 'ict' },
  { unitNo: 9, titleEn: 'People, Development and Environment', titleHi: 'लोग, विकास और पर्यावरण', key: 'environment' },
  { unitNo: 10, titleEn: 'Higher Education System', titleHi: 'उच्च शिक्षा प्रणाली', key: 'higher' },
];

/**
 * Normalizes a human identity name (C-1):
 * 1. Apply Unicode NFKC normalization.
 * 2. Convert tabs, newline, carriage return, vertical tab, form feed, U+0085, U+2028, U+2029 into ordinary spaces.
 * 3. Remove Unicode format characters and remaining control characters:
 *    \p{Cf}, \p{Cc}, U+034F, U+FE00–U+FE0F, U+180E
 * 4. Do NOT remove combining marks \p{M}, preserving Devanagari vowel signs and matras.
 * 5. Collapse multiple consecutive spaces to a single space.
 * 6. Trim leading and trailing spaces.
 */
export function normalizeIdentity(name) {
  if (typeof name !== 'string') return '';
  // 1. Unicode NFKC normalization
  let s = name.normalize('NFKC');
  // 2. Convert tabs, newline, carriage return, vertical tab, form feed, U+0085, U+2028, U+2029 into ordinary spaces
  s = s.replace(/[\t\n\v\f\r\u0085\u2028\u2029]/g, ' ');
  // 3. Remove Unicode format characters and remaining control characters (\p{Cf}, \p{Cc}, U+034F, U+FE00–U+FE0F, U+180E)
  s = s.replace(/[\p{Cf}\p{Cc}\u034F\uFE00-\uFE0F\u180E]/gu, '');
  // 4. Combining marks (\p{M}) are intentionally preserved intact
  // 5. Collapse multiple consecutive spaces to a single space
  s = s.replace(/\s+/g, ' ');
  // 6. Trim leading and trailing spaces
  return s.trim();
}

// Stricter policy for human identity names (E-2A)
export const NAME_PLACEHOLDER_REGEX = /(?<![\p{L}\p{N}])(?:TODO|TBD|PLACEHOLDER|LOREM\s+IPSUM|DUMMY|FIXME|TEST\s+FIXTURE|परीक्षण|PENDING|UNKNOWN)(?![\p{L}\p{N}])/iu;

// Narrower structured policy for academic prose (E-2B, F-4, G-1)
// BRACKET MARKER RULE: the entire bracket content must be the marker,
// optionally followed by a colon and free text: [TODO], [TODO: reason],
// [TEST FIXTURE: description], [परीक्षण: शेष], [LOREM IPSUM].
// Does NOT search arbitrary bracket contents for placeholder substrings, avoiding false rejection of
// legitimate bracketed academic expressions like [Mastodon], [Dummy variables], [कंप्यूटर आधारित परीक्षण].
// [abc DUMMY] and [DUMMY text] are accepted by this rule because
// "abc DUMMY" and "DUMMY text" are not the marker alone.
// [PENDING] and [UNKNOWN] are accepted by this rule (not in list); name rule (Policy A) still rejects them.
// Note: [abc TODO] is rejected by the uppercase-token rule (PROSE_UPPERCASE_TOKENS_REGEX).
// Note: [TODO fix this] is also rejected by PROSE_UPPERCASE_TOKENS_REGEX.
export const PROSE_BRACKETED_PLACEHOLDER_REGEX = /\[\s*(?:TODO|TBD|PLACEHOLDER|LOREM\s+IPSUM|DUMMY|FIXME|TEST\s+FIXTURE|परीक्षण)\s*(?:(?::|[-–—]\s)[^\]]*)?\]/iu;
export const PROSE_UPPERCASE_TOKENS_REGEX = /(?<![\p{L}\p{N}])(?:TODO:?|FIXME|TBD)(?![\p{L}\p{N}])/u;
export const PROSE_PHRASES_REGEX = /(?<![\p{L}\p{N}])(?:LOREM\s+IPSUM|TEST\s+FIXTURE)(?![\p{L}\p{N}])/iu;

/**
 * Normalizes text for placeholder checks by stripping invisible/format/control characters
 * and converting linebreaks to spaces.
 */
function cleanTextForChecks(text) {
  if (typeof text !== 'string') return '';
  let s = text.normalize('NFKC');
  s = s.replace(/[\t\n\v\f\r\u0085\u2028\u2029]/g, ' ');
  s = s.replace(/[\p{Cf}\p{Cc}\u034F\uFE00-\uFE0F\u180E]/gu, '');
  return s;
}

/**
 * Checks whether human identity names contain placeholder indicators (Policy A).
 * Rejects PENDING, UNKNOWN, DUMMY, PLACEHOLDER, TODO, etc.
 * Does NOT reject legitimate names such as Mockler or Dr. Robert Mockler.
 */
export function isPlaceholderName(name) {
  if (typeof name !== 'string') return false;
  const s = normalizeIdentity(name);
  if (!s) return true;
  return NAME_PLACEHOLDER_REGEX.test(s);
}

/**
 * Checks whether academic prose (subject names, unit titles, statements)
 * contains structured placeholder markers (Policy B).
 *
 * Accepts genuine academic vocabulary such as:
 * - "Computer-Based Testing"
 * - "Dummy variables in regression"
 * - "Pending cases"
 * - "Unknown parameters"
 * - "Placeholder values in templates"
 * - "कंप्यूटर आधारित परीक्षण"
 * - "परिकल्पना परीक्षण"
 * - "सार्थकता परीक्षणों"
 *
 * Rejects only structured placeholders:
 * - Bracketed markers: [TODO], [परीक्षण], [TEST FIXTURE], [DUMMY], etc.
 * - Explicit uppercase tokens: TODO, TODO:, FIXME, TBD
 * - Phrases: LOREM IPSUM, TEST FIXTURE
 */
export function containsProsePlaceholder(text) {
  if (typeof text !== 'string') return false;
  const s = cleanTextForChecks(text);
  return PROSE_BRACKETED_PLACEHOLDER_REGEX.test(s) ||
         PROSE_UPPERCASE_TOKENS_REGEX.test(s) ||
         PROSE_PHRASES_REGEX.test(s);
}

// Retain containsPlaceholder as alias for backward compatibility
export const containsPlaceholder = containsProsePlaceholder;

/**
 * Validates a Paper I syllabus document object.
 * Returns { valid: boolean, isStarter: boolean, errors: string[], warnings: string[], summary: object }
 */
export function validateSyllabus(doc, options = {}) {
  const errors = [];
  const warnings = [];
  const isReleaseCheck = Boolean(options.releaseCheck);

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { valid: false, isStarter: false, errors: ['Root document must be a JSON object'], warnings, summary: null };
  }

  // Target languages resolution (T-1)
  // Options validation (C-3): only 'en', 'hi', 'en,hi', 'hi,en' (or equivalent arrays)
  const optLang = options.releaseLanguages ?? options.lang;
  let targetLanguages;

  if (optLang !== undefined && optLang !== null) {
    let normalized = null;
    if (typeof optLang === 'string') {
      const trimmed = optLang.trim();
      if (['en', 'hi', 'en,hi', 'hi,en'].includes(trimmed)) {
        normalized = trimmed.split(',').map((s) => s.trim());
      }
    } else if (Array.isArray(optLang)) {
      if (optLang.length === 1 && (optLang[0] === 'en' || optLang[0] === 'hi')) {
        normalized = [...optLang];
      } else if (optLang.length === 2) {
        if ((optLang[0] === 'en' && optLang[1] === 'hi') || (optLang[0] === 'hi' && optLang[1] === 'en')) {
          normalized = [...optLang];
        }
      }
    }

    if (!normalized) {
      errors.push(`Invalid language option: '${optLang}'. Must be 'en', 'hi', 'en,hi', or 'hi,en'`);
      targetLanguages = ['en', 'hi'];
    } else {
      targetLanguages = normalized;
    }
  } else if (doc.releaseLanguages) {
    targetLanguages = Array.isArray(doc.releaseLanguages) ? doc.releaseLanguages : [];
  } else {
    targetLanguages = ['en', 'hi'];
  }

  // Validate releaseLanguages if declared in doc
  if (doc.releaseLanguages !== undefined) {
    if (!Array.isArray(doc.releaseLanguages) || doc.releaseLanguages.length === 0) {
      errors.push("Invalid 'releaseLanguages': must be a non-empty array (e.g. ['en'] or ['en', 'hi'])");
    } else {
      const validCodes = ['en', 'hi'];
      for (const code of doc.releaseLanguages) {
        if (!validCodes.includes(code)) {
          errors.push(`Invalid language in 'releaseLanguages': '${code}'. Must be 'en' or 'hi'`);
        }
      }
    }
  }

  // C-2: If target excludes a language that doc.releaseLanguages declares, return an error
  if ((optLang !== undefined && optLang !== null) && Array.isArray(doc.releaseLanguages)) {
    for (const declaredLang of doc.releaseLanguages) {
      if (!targetLanguages.includes(declaredLang)) {
        errors.push(`Language target '${targetLanguages.join(',')}' excludes declared release language '${declaredLang}' from doc.releaseLanguages`);
      }
    }
  }

  const isHindiRequired = targetLanguages.includes('hi');

  // 1. Basic Identity Fields
  if (doc.subjectCode !== '00') {
    errors.push(`Invalid subjectCode: expected '00' for Paper I, got '${doc.subjectCode}'`);
  }

  if (!doc.subjectName || typeof doc.subjectName !== 'object' || Array.isArray(doc.subjectName)) {
    errors.push('Missing or invalid subjectName object');
  } else {
    if (typeof doc.subjectName.en !== 'string' || !doc.subjectName.en.trim()) {
      errors.push('Missing or empty English subject name (subjectName.en)');
    } else if (containsPlaceholder(doc.subjectName.en)) {
      errors.push(`Placeholder text found in English subject name ('${doc.subjectName.en}')`);
    }
    if (isHindiRequired) {
      if (typeof doc.subjectName.hi !== 'string' || !doc.subjectName.hi.trim()) {
        errors.push('Missing or empty Hindi subject name (subjectName.hi)');
      } else if (containsPlaceholder(doc.subjectName.hi)) {
        errors.push(`Placeholder text found in Hindi subject name ('${doc.subjectName.hi}')`);
      }
    } else {
      // C-1: In English-only mode, reject if Hindi field is non-empty
      if (typeof doc.subjectName.hi === 'string' && doc.subjectName.hi.trim()) {
        errors.push(`English-only mode violation: Hindi subject name (subjectName.hi) must be empty or omitted (got '${doc.subjectName.hi}')`);
      }
    }
  }

  if (typeof doc.syllabusVersion !== 'number' || !Number.isInteger(doc.syllabusVersion) || doc.syllabusVersion < 1) {
    errors.push(`syllabusVersion must be a positive integer >= 1 (got ${doc.syllabusVersion})`);
  }

  const validStatuses = ['draft', 'in_review', 'verified', 'published', 'retired'];
  if (!validStatuses.includes(doc.status)) {
    errors.push(`Invalid status: '${doc.status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  const validVerifications = ['unverified', 'verified', 'dual_verified'];
  if (!validVerifications.includes(doc.verification)) {
    errors.push(`Invalid verification: '${doc.verification}'. Must be one of: ${validVerifications.join(', ')}`);
  }

  const isVerified = doc.verification === 'verified';
  const isDualVerified = doc.verification === 'dual_verified';
  const isVerifiedOrAbove = isVerified || isDualVerified;
  const isPublished = doc.status === 'published';

  // Units array check (early so isStarter can be established)
  if (!doc.units || !Array.isArray(doc.units)) {
    errors.push('Missing or invalid units array (must be an array)');
    return { valid: false, isStarter: false, errors, warnings, summary: null };
  }

  if (doc.units.some((u) => u === null || typeof u !== 'object')) {
    errors.push('units array cannot contain null or non-object entries');
    return { valid: false, isStarter: false, errors, warnings, summary: null };
  }

  const isStarter = doc.units.length === 0;

  // 2. Lifecycle Consistency (R-1, R-2)
  // R-1: --release strictly requires V3 (dual_verified)
  if (isReleaseCheck && !isDualVerified) {
    errors.push(`Release validation failure (R-1): --release strictly requires V3 verification ('dual_verified'). Current verification: '${doc.verification}'`);
  }

  // R-2: 'published' status strictly requires V3 (dual_verified)
  if (isPublished && !isDualVerified) {
    errors.push(`Lifecycle violation (R-2): 'published' status requires V3 verification ('dual_verified'). Current verification: '${doc.verification}'`);
  }

  // Reject 'status: verified' (lifecycle vocabulary error)
  if (doc.status === 'verified') {
    errors.push("Lifecycle violation (R-2): 'status' cannot be 'verified' ('verified' is a verification state, not a lifecycle status). Valid statuses: draft, in_review, published, retired");
  }

  // Empty document lifecycle constraints
  if (isStarter) {
    if (isPublished) {
      errors.push("Empty syllabus cannot claim 'published' status.");
    }
    if (isVerifiedOrAbove) {
      errors.push(`Empty syllabus cannot claim '${doc.verification}' status.`);
    }
    if (isReleaseCheck) {
      errors.push('RELEASE_VALIDATION_FAILURE: Empty syllabus document cannot be released.');
    }
    if (!isPublished && !isVerifiedOrAbove && !isReleaseCheck) {
      warnings.push('PREPARATION_STARTER: Document contains 0 syllabus units. Valid as an initial starter template, but NOT verified or publishable content.');
    }
  }

  // V3 in draft status: permitted but emits warning
  if (isDualVerified && doc.status === 'draft') {
    warnings.push("Document is dual_verified (V3) but lifecycle status is 'draft'.");
  }

  // 3. Human Identity Verification (R-3)
  if (!doc.transcription || typeof doc.transcription !== 'object' || Array.isArray(doc.transcription)) {
    errors.push('Missing or invalid transcription metadata block');
  } else {
    const transcriber = doc.transcription.transcriber;
    const verifier = doc.transcription.verifier;
    const secondVerifier = doc.transcription.secondVerifier;

    if (!transcriber || typeof transcriber !== 'object' || typeof transcriber.name !== 'string' || !transcriber.name.trim()) {
      errors.push('Missing or invalid transcriber identity (transcription.transcriber.name must be non-empty string)');
    }
    if (!verifier || typeof verifier !== 'object' || typeof verifier.name !== 'string' || !verifier.name.trim()) {
      errors.push('Missing or invalid verifier identity (transcription.verifier.name must be non-empty string)');
    }

    const normTranscriber = normalizeIdentity(transcriber?.name);
    const normVerifier = normalizeIdentity(verifier?.name);
    const normSecond = secondVerifier && typeof secondVerifier.name === 'string' ? normalizeIdentity(secondVerifier.name) : '';

    // Distinctness checks across all 3 pair combinations:
    // Pair 1: transcriber vs primary verifier (T == V1)
    if (normTranscriber && normVerifier && normTranscriber.toLowerCase() === normVerifier.toLowerCase()) {
      errors.push(`Independent verification violation: verifier ('${verifier?.name}') cannot be identical to transcriber ('${transcriber?.name}')`);
    }
    // Pair 2: transcriber vs secondVerifier (T == V2)
    if (normTranscriber && normSecond && normTranscriber.toLowerCase() === normSecond.toLowerCase()) {
      errors.push(`Dual verification violation (V3): secondVerifier ('${secondVerifier?.name}') cannot be identical to transcriber ('${transcriber?.name}')`);
    }
    // Pair 3: primary verifier vs secondVerifier (V1 == V2)
    if (normVerifier && normSecond && normVerifier.toLowerCase() === normSecond.toLowerCase()) {
      errors.push(`Dual verification violation (V3): secondVerifier ('${secondVerifier?.name}') cannot be identical to primary verifier ('${verifier?.name}')`);
    }

    // Verified / Release identity checks
    if (isVerifiedOrAbove || isPublished || isReleaseCheck) {
      if (isPlaceholderName(transcriber?.name)) {
        errors.push(`Placeholder transcriber '${transcriber?.name}' rejected for verified content`);
      }
      if (isPlaceholderName(verifier?.name)) {
        errors.push(`Placeholder verifier '${verifier?.name}' rejected for verified content`);
      }

      // Attestation dates format check (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!transcriber?.date || !dateRegex.test(transcriber.date)) {
        errors.push(`transcription.transcriber.date must be a valid 'YYYY-MM-DD' date (got '${transcriber?.date}')`);
      }
      if (!verifier?.date || !dateRegex.test(verifier.date)) {
        errors.push(`transcription.verifier.date must be a valid 'YYYY-MM-DD' date (got '${verifier?.date}')`);
      }
    }

    // V3 (dual_verified) checks
    if (isDualVerified || (isReleaseCheck && isVerifiedOrAbove)) {
      if (!secondVerifier || typeof secondVerifier !== 'object' || typeof secondVerifier.name !== 'string' || !secondVerifier.name.trim()) {
        errors.push('Dual verification violation (V3): A second independent human verifier is required (transcription.secondVerifier.name)');
      } else {
        if (isPlaceholderName(secondVerifier.name)) {
          errors.push(`Placeholder secondVerifier '${secondVerifier.name}' rejected for verified content`);
        }
        if (!secondVerifier.date || !/^\d{4}-\d{2}-\d{2}$/.test(secondVerifier.date)) {
          errors.push(`transcription.secondVerifier.date must be a valid 'YYYY-MM-DD' date (got '${secondVerifier.date}')`);
        }
      }

      // C-4: Hindi-capable verifier proficiency advisory notice (T-2)
      // The current schema does not machine-verify verifier language proficiency.
      // When dual_verified content has Hindi present, emit an advisory notice without failing.
      // Bypassed for English-only release.
      if (isHindiRequired) {
        warnings.push('Hindi-capable verifier proficiency is not machine-verified — T-2 remains open.');
      }
    }

    // Bilingual visual transcription certification check
    // Enforced only when Hindi is part of the target release languages.
    if (isHindiRequired && (isVerifiedOrAbove || isReleaseCheck)) {
      if (typeof doc.transcription.isManuallyTypedFromVisual !== 'boolean' || doc.transcription.isManuallyTypedFromVisual !== true) {
        errors.push('Bilingual verification violation: Hindi content must be explicitly certified as manually typed from visual rendering (transcription.isManuallyTypedFromVisual: true) to prevent font-layer corruption.');
      }
    }
  }

  // 4. Strict Effective Dates (R-4)
  if (isVerifiedOrAbove || isPublished || isReleaseCheck) {
    if (typeof doc.effectiveFrom !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(doc.effectiveFrom)) {
      errors.push(`Verified content must specify a valid 'YYYY-MM' effectiveFrom date (got '${doc.effectiveFrom}')`);
    }
  } else if (doc.effectiveFrom && doc.effectiveFrom !== 'unknown' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(doc.effectiveFrom)) {
    errors.push(`effectiveFrom must be 'unknown' or a valid 'YYYY-MM' date (got '${doc.effectiveFrom}')`);
  }

  // 5. Source Documents & SHA-256 Hashes
  const registeredSourceDocs = new Map();
  if (doc.sourceDocuments) {
    if (!Array.isArray(doc.sourceDocuments)) {
      errors.push('sourceDocuments must be an array');
    } else {
      const seenDocIds = new Set();
      doc.sourceDocuments.forEach((src, idx) => {
        const srcPrefix = `SourceDoc[${idx}]`;
        if (src === null || typeof src !== 'object') {
          errors.push(`${srcPrefix}: null or non-object entry in sourceDocuments`);
          return;
        }

        if (typeof src.docId !== 'string' || !src.docId.trim()) {
          errors.push(`${srcPrefix}: missing or invalid docId`);
        } else {
          if (seenDocIds.has(src.docId)) {
            errors.push(`duplicate docId in sourceDocuments: '${src.docId}'`);
          }
          seenDocIds.add(src.docId);
          registeredSourceDocs.set(src.docId, src);
        }

        if (typeof src.title !== 'string' || !src.title.trim()) {
          errors.push(`${srcPrefix} (${src.docId || idx}): missing or empty title`);
        }

        const validLangs = ['en', 'hi', 'both'];
        if (!validLangs.includes(src.language)) {
          errors.push(`${srcPrefix} (${src.docId || idx}): invalid language '${src.language}' (must be 'en', 'hi', or 'both')`);
        }

        // SHA-256 Hash checks
        if (typeof src.sha256 !== 'string') {
          errors.push(`${srcPrefix} (${src.docId || idx}): missing sha256 hash`);
        } else if (!/^[a-f0-9]{64}$/.test(src.sha256)) {
          errors.push(`${srcPrefix} (${src.docId}): invalid SHA-256 hash format (must be 64-character lowercase hex string)`);
        } else {
          // Reject all-zero and empty-file hashes when claiming verification
          if (isVerifiedOrAbove || isReleaseCheck) {
            if (/^0{64}$/.test(src.sha256)) {
              errors.push(`${srcPrefix} (${src.docId}): placeholder zero SHA-256 hash rejected for verified content`);
            }
            if (src.sha256 === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') {
              errors.push(`${srcPrefix} (${src.docId}): SHA-256 hash corresponds to an EMPTY file (e3b0c442...); genuine source PDF required`);
            }
          }
        }
      });
    }
  }

  if ((isVerifiedOrAbove || isReleaseCheck) && registeredSourceDocs.size === 0) {
    errors.push('Verified content must register at least one official source document with a valid SHA-256 hash');
  }

  // 6. Units and Statements Validation
  let totalStatements = 0;
  let statementsWithPage = 0;
  let statementsWithSourceDoc = 0;
  let statementsWithHindi = 0;
  let statementsWithEnglish = 0;

  if (!isStarter) {
    // Canonical 10-Unit Structure Requirement
    if (doc.units.length !== 10) {
      errors.push(`Canonical structure violation: UGC NET Paper I must contain exactly 10 units, got ${doc.units.length}`);
    }

    const seenUnitNumbers = new Set();
    const devanagariRegex = /[\u0900-\u097F]/;

    doc.units.forEach((unit, idx) => {
      const expectedUnitNo = idx + 1;
      const unitPrefix = `Unit[${idx}]`;

      if (typeof unit.unitNo !== 'number' || !Number.isInteger(unit.unitNo)) {
        errors.push(`${unitPrefix}: missing or non-integer unitNo`);
      } else {
        if (seenUnitNumbers.has(unit.unitNo)) {
          errors.push(`${unitPrefix}: duplicate unitNo ${unit.unitNo}`);
        }
        seenUnitNumbers.add(unit.unitNo);

        if (unit.unitNo !== expectedUnitNo) {
          errors.push(`${unitPrefix}: non-contiguous unit numbering: expected ${expectedUnitNo}, got ${unit.unitNo}`);
        }
      }

      // Unit Titles
      if (!unit.title || typeof unit.title !== 'object') {
        errors.push(`${unitPrefix}: missing title object`);
      } else {
        if (typeof unit.title.en !== 'string' || !unit.title.en.trim()) {
          errors.push(`${unitPrefix} (Unit ${unit.unitNo || expectedUnitNo}): missing English title (title.en)`);
        } else if (containsPlaceholder(unit.title.en)) {
          errors.push(`${unitPrefix} (Unit ${unit.unitNo || expectedUnitNo}): placeholder text found in English unit title ('${unit.title.en}')`);
        }
        if (isHindiRequired) {
          if (typeof unit.title.hi !== 'string' || !unit.title.hi.trim()) {
            errors.push(`${unitPrefix} (Unit ${unit.unitNo || expectedUnitNo}): missing Hindi title (title.hi)`);
          } else if (!devanagariRegex.test(unit.title.hi)) {
            errors.push(`${unitPrefix} (Unit ${unit.unitNo || expectedUnitNo}): Hindi unit title must contain Devanagari script (got '${unit.title.hi}')`);
          } else if (containsPlaceholder(unit.title.hi)) {
            errors.push(`${unitPrefix} (Unit ${unit.unitNo || expectedUnitNo}): placeholder text found in Hindi unit title ('${unit.title.hi}')`);
          }
        } else {
          // C-1: In English-only mode, reject if Hindi field is non-empty
          if (typeof unit.title.hi === 'string' && unit.title.hi.trim()) {
            errors.push(`${unitPrefix} (Unit ${unit.unitNo || expectedUnitNo}): English-only mode violation: Hindi unit title (title.hi) must be empty or omitted (got '${unit.title.hi}')`);
          }
        }

        // Canonical Paper I topic matching check
        if (unit.unitNo >= 1 && unit.unitNo <= 10) {
          const canonical = CANONICAL_PAPER_1_UNITS[unit.unitNo - 1];
          const normTitle = (unit.title.en || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const normCanonical = canonical.key;
          if (!normTitle.includes(normCanonical)) {
            errors.push(`${unitPrefix} (Unit ${unit.unitNo}): title '${unit.title.en}' does not match canonical Paper I unit '${canonical.titleEn}'`);
          }
        }
      }

      // Statements
      if (!Array.isArray(unit.statements)) {
        errors.push(`${unitPrefix}: missing statements array`);
      } else if (unit.statements.length === 0) {
        errors.push(`${unitPrefix} (Unit ${unit.unitNo || expectedUnitNo}): unit has 0 statements; at least 1 statement is required`);
      } else {
        const seenStatementTexts = new Set();

        unit.statements.forEach((stmt, sIdx) => {
          totalStatements++;
          const stmtPrefix = `${unitPrefix}.Statement[${sIdx}]`;

          if (typeof stmt.statementNo !== 'number' || !Number.isInteger(stmt.statementNo) || stmt.statementNo < 1) {
            errors.push(`${stmtPrefix}: missing or invalid statementNo (expected positive integer)`);
          }

          if (typeof stmt.page !== 'number' || !Number.isInteger(stmt.page) || stmt.page < 1) {
            errors.push(`${stmtPrefix}: missing or invalid page reference (expected positive integer, got ${stmt.page})`);
          } else if (stmt.page > 500) {
            errors.push(`${stmtPrefix}: page reference ${stmt.page} exceeds reasonable document boundaries`);
          } else {
            statementsWithPage++;
          }

          if (typeof stmt.sourceDocId !== 'string' || !stmt.sourceDocId.trim()) {
            errors.push(`${stmtPrefix}: missing sourceDocId reference`);
          } else {
            statementsWithSourceDoc++;
            const sDoc = registeredSourceDocs.get(stmt.sourceDocId);
            if (!sDoc) {
              errors.push(`${stmtPrefix}: sourceDocId '${stmt.sourceDocId}' does not resolve to any registered source document`);
            }
          }

          if (!stmt.text || typeof stmt.text !== 'object') {
            errors.push(`${stmtPrefix}: missing text object`);
          } else {
            // English text checks
            if (typeof stmt.text.en === 'string' && stmt.text.en.trim()) {
              statementsWithEnglish++;
              if (stmt.text.en.trim().length === 1 && !/[a-zA-Z0-9]/.test(stmt.text.en)) {
                errors.push(`${stmtPrefix}: English statement cannot be single punctuation mark`);
              }
              if (isVerifiedOrAbove && containsPlaceholder(stmt.text.en)) {
                errors.push(`${stmtPrefix}: placeholder text found in verified English statement ('${stmt.text.en}')`);
              }
            } else {
              errors.push(`${stmtPrefix}: missing English statement text (text.en)`);
            }

            // Hindi text checks
            if (isHindiRequired) {
              if (typeof stmt.text.hi === 'string' && stmt.text.hi.trim()) {
                statementsWithHindi++;
                if (!devanagariRegex.test(stmt.text.hi)) {
                  errors.push(`${stmtPrefix}: Hindi statement text must contain Devanagari script (got '${stmt.text.hi}')`);
                }
                if (stmt.text.hi.trim().length === 1 && !devanagariRegex.test(stmt.text.hi)) {
                  errors.push(`${stmtPrefix}: Hindi statement cannot be single non-Devanagari character`);
                }
                if (isVerifiedOrAbove && containsPlaceholder(stmt.text.hi)) {
                  errors.push(`${stmtPrefix}: placeholder text found in verified Hindi statement ('${stmt.text.hi}')`);
                }
              } else {
                errors.push(`${stmtPrefix}: missing Hindi statement text (text.hi)`);
              }
            } else {
              // C-1: In English-only mode, reject if Hindi field is non-empty
              if (typeof stmt.text.hi === 'string' && stmt.text.hi.trim()) {
                errors.push(`${stmtPrefix}: English-only mode violation: Hindi statement text (text.hi) must be empty or omitted (got '${stmt.text.hi}')`);
              }
            }

            // Duplicate statement detection within unit
            const normEn = (stmt.text.en || '').trim().toLowerCase();
            if (normEn) {
              if (seenStatementTexts.has(normEn)) {
                errors.push(`${stmtPrefix}: duplicate statement text in unit: '${stmt.text.en}'`);
              }
              seenStatementTexts.add(normEn);
            }
          }
        });
      }
    });
  }

  // 7. Claude C-03 Anti-Auto-Promotion Guard
  // Strictly rejects importEligible / importAsOfficialContent / importPolicy / releaseStatus unless V3 (dual_verified) with zero errors
  if (doc.importEligible !== undefined && typeof doc.importEligible !== 'boolean') {
    errors.push(`importEligible must be a boolean (got ${typeof doc.importEligible})`);
  }

  const isImportEligibleClaimed = Boolean(doc.importEligible);
  const isImportAsOfficialClaimed = Boolean(doc.importAsOfficialContent);
  const isNestedImportClaimed = Boolean(doc.importPolicy?.importAsOfficialContent);
  const isPromotionClaimed = isImportEligibleClaimed || isImportAsOfficialClaimed || isNestedImportClaimed;

  if (doc.releaseStatus === 'RELEASED' && !isDualVerified) {
    errors.push("Auto-promotion violation (Claude C-03): releaseStatus='RELEASED' is prohibited on unverified content.");
  }

  if (isPromotionClaimed) {
    if (!isDualVerified) {
      errors.push(`Auto-promotion violation (Claude C-03): Official content import/promotion cannot be true unless verification is 'dual_verified' (V3). Current state: '${doc.verification}'`);
    }
    if (isStarter) {
      errors.push('Auto-promotion violation (Claude C-03): Empty starter syllabus cannot be marked importEligible / importAsOfficialContent.');
    }
  }

  const summary = {
    subjectCode: doc.subjectCode,
    status: doc.status,
    verification: doc.verification,
    releaseLanguages: targetLanguages,
    isStarter,
    unitCount: doc.units.length,
    totalStatements,
    importEligible: isImportEligibleClaimed || isImportAsOfficialClaimed,
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
    secondVerifier: doc.transcription?.secondVerifier?.name || null,
    isManuallyTypedFromVisual: Boolean(doc.transcription?.isManuallyTypedFromVisual),
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
    lines.push(`Release Languages:   ${s.releaseLanguages.join(', ')}`);
    lines.push(`Document Nature:     ${s.isStarter ? 'PREPARATION STARTER (Empty units)' : 'POPULATED SYLLABUS'}`);
    lines.push(`Official Import:     ${s.importEligible ? 'ELIGIBLE (V3 Verified)' : 'BLOCKED / UNVERIFIED'}`);
    lines.push(`Transcriber:         ${s.transcriber || 'N/A'}`);
    lines.push(`Verifier 1:          ${s.verifier || 'N/A'}`);
    lines.push(`Verifier 2 (V3):     ${s.secondVerifier || 'N/A'}`);
    if (s.releaseLanguages.includes('hi')) {
      lines.push(`Hindi Manual Typed:  ${s.isManuallyTypedFromVisual ? 'YES (Visual Certified)' : 'NO'}`);
    } else {
      lines.push('Hindi Verification:  BYPASS (English-only release model active)');
    }
    lines.push(`Total Units:         ${s.unitCount}`);
    lines.push(`Total Statements:    ${s.totalStatements}`);
    if (s.totalStatements > 0) {
      lines.push(`Page Citations:      ${s.coverage.statementsWithPage}/${s.totalStatements} (${s.coverage.pageCoveragePercent}%)`);
      lines.push(`English Coverage:    ${s.coverage.statementsWithEnglish}/${s.totalStatements} (${s.coverage.englishCoveragePercent}%)`);
      if (s.releaseLanguages.includes('hi')) {
        lines.push(`Hindi Coverage:      ${s.coverage.statementsWithHindi}/${s.totalStatements} (${s.coverage.hindiCoveragePercent}%)`);
      } else {
        lines.push('Hindi Coverage:      BYPASS (English-only release)');
      }
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

export async function main() {
  const args = process.argv.slice(2);
  const files = [];
  let isRelease = false;
  let targetLang = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--release') {
      isRelease = true;
    } else if (arg === '--lang') {
      i++;
      if (i >= args.length || args[i].startsWith('--')) {
        console.error('Error: --lang requires a language argument (e.g. --lang en)');
        process.exit(2);
      }
      targetLang = args[i];
    } else if (arg.startsWith('--lang=')) {
      targetLang = arg.slice('--lang='.length);
    } else if (arg.startsWith('--')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    } else {
      files.push(arg);
    }
  }

  if (targetLang !== null) {
    const validLangs = ['en', 'hi', 'en,hi', 'hi,en'];
    if (!validLangs.includes(targetLang)) {
      console.error(`Invalid language: '${targetLang}'. Must be 'en', 'hi', or 'en,hi'`);
      process.exit(2);
    }
  }

  if (files.length !== 1 || files[0] === '-h' || files[0] === '--help') {
    console.error('Usage: node scripts/check-curriculum.mjs <path-to-syllabus-json> [--release] [--lang <en|hi|en,hi>]');
    process.exit(1);
  }

  const targetPath = resolve(files[0]);
  if (!existsSync(targetPath)) {
    console.error(`Error: File not found: ${files[0]}`);
    process.exit(1);
  }

  let content;
  try {
    content = JSON.parse(readFileSync(targetPath, 'utf8'));
  } catch (err) {
    console.error(`Error: Invalid JSON in ${files[0]}: ${err.message}`);
    process.exit(1);
  }

  const options = { releaseCheck: isRelease };
  if (targetLang) {
    options.lang = targetLang;
  }
  const result = validateSyllabus(content, options);
  console.log(formatReport(result, basename(targetPath)));

  if (!result.valid) {
    process.exit(1);
  }
}

/**
 * Determines whether this module was invoked directly as the CLI entrypoint (F-6).
 * Accepts optional injection parameters for unit testing.
 *
 * Guarantees:
 * - Direct invocation via node (exact path match): true
 * - Invocation via same-name or different-name symlink (when realpathSync succeeds): true
 * - Imported module when invoked from another script (when realpathSync succeeds): false
 * - No argv[1] present (e.g. interactive or programmatic import): false
 *
/**
 * Returns true when this module is the entry point that Node.js was launched with.
 *
 * Uses import.meta.main (Node >=24.2.0) as the authoritative check when available.
 * Falls back to comparing resolved filesystem paths between process.argv[1] and this module.
 *
 * Injectable parameters allow deterministic unit testing without spawning subprocesses.
 *
 * Disclosed Limitation (F-6, G-5, H-5):
 * The legacy path-heuristic fallback applies when typeof import.meta.main !== 'boolean'.
 * - If realpathSync throws for a differently-named symlink (e.g. filesystem permission error),
 *   the basename comparison returns false — the CLI will silently not execute main().
 * - Conversely, on Node 24.0–24.1 when realpathSync throws or fails, a same-named importing script
 *   (e.g., an importer whose file is also named check-curriculum.mjs) would match basenames and
 *   execute main().
 * These legacy fallback edge cases are acknowledged and accepted. Node >=24.2.0 is unaffected
 * because import.meta.main is authoritative and does not rely on path or realpath resolution.
 */
export function isCliEntry({
  argv1 = process.argv[1],
  moduleUrl = import.meta.url,
  realpath = realpathSync
} = {}) {
  if (!argv1) return false;
  let invokedRaw;
  let targetRaw;
  try {
    invokedRaw = resolve(argv1);
    targetRaw = resolve(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
  if (invokedRaw === targetRaw) return true;
  try {
    return realpath(invokedRaw) === realpath(targetRaw);
  } catch {
    // Disclosed limitation: differently-named symlink + realpath failure silently skips main().
    return basename(invokedRaw) === basename(targetRaw);
  }
}

// Use import.meta.main (Node >=24.2.0) as authoritative; fall back to path heuristic.
// Known limitation of fallback: a differently-named symlink with realpath failure may
// silently not execute main() instead of running the CLI.
const _cliEntry =
  typeof import.meta.main === 'boolean'
    ? import.meta.main
    : isCliEntry();

if (_cliEntry) {
  main();
}
