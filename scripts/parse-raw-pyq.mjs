#!/usr/bin/env node
/**
 * UrEducator 2.0 — Raw PYQ Text Ingestion & Parser Tool
 *
 * Authorised by: Owner (Bunty)
 *
 * Converts raw copied text from official NTA UGC NET Paper 1 Question Paper
 * and Answer Key PDFs into structured, schema-compliant MockTestDoc JSON.
 *
 * Features:
 *   - Extracts Question Stem, Options (A-D / 1-4), Correct Answer, and Explanation.
 *   - Converts Data Interpretation (DI) tabbed/spaced tables to Markdown tables.
 *   - Auto-detects question types (mcq_single, statement_based, assertion_reason, match_following, comprehension).
 *   - Structurally maps every question into the 10 canonical Paper 1 syllabus units (U1–U10).
 *   - Formats output to content-sources/shifts/<target>.json.
 *
 * Usage:
 *   node scripts/parse-raw-pyq.mjs content-sources/raw/jun14-shift1.txt --target mt-pyq-2023-jun14-s1
 *   node scripts/parse-raw-pyq.mjs content-sources/raw/jun14-shift1.txt --target ugcnet-2023-jun14-s1
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(process.cwd());

// 1. Shift Registry
export const SHIFTS = {
  'mt-pyq-2024-jun18-s1': {
    shiftId: 'ugcnet-2024-jun18-s1',
    mockTestId: 'mt-pyq-2024-jun18-s1',
    paperId: 'paper-pyq-2024-jun18-s1',
    title: 'UGC NET Paper 1 — 18 June 2024 (Shift 1)',
    dateText: '18 June 2024',
    shiftText: 'Shift 1',
  },
  'ugcnet-2024-jun18-s1': {
    shiftId: 'ugcnet-2024-jun18-s1',
    mockTestId: 'mt-pyq-2024-jun18-s1',
    paperId: 'paper-pyq-2024-jun18-s1',
    title: 'UGC NET Paper 1 — 18 June 2024 (Shift 1)',
    dateText: '18 June 2024',
    shiftText: 'Shift 1',
  },
  'mt-pyq-2024-jun18-s2': {
    shiftId: 'ugcnet-2024-jun18-s2',
    mockTestId: 'mt-pyq-2024-jun18-s2',
    paperId: 'paper-pyq-2024-jun18-s2',
    title: 'UGC NET Paper 1 — 18 June 2024 (Shift 2)',
    dateText: '18 June 2024',
    shiftText: 'Shift 2',
  },
  'ugcnet-2024-jun18-s2': {
    shiftId: 'ugcnet-2024-jun18-s2',
    mockTestId: 'mt-pyq-2024-jun18-s2',
    paperId: 'paper-pyq-2024-jun18-s2',
    title: 'UGC NET Paper 1 — 18 June 2024 (Shift 2)',
    dateText: '18 June 2024',
    shiftText: 'Shift 2',
  },
  'mt-pyq-2026-sep09-s1': {
    shiftId: 'ugcnet-2026-sep09-s1',
    mockTestId: 'mt-pyq-2026-sep09-s1',
    paperId: 'paper-pyq-2026-sep09-s1',
    title: 'UGC NET Paper 1 — 09 September 2026 (Shift 1)',
    dateText: '09 September 2026',
    shiftText: 'Shift 1',
  },
  'ugcnet-2026-sep09-s1': {
    shiftId: 'ugcnet-2026-sep09-s1',
    mockTestId: 'mt-pyq-2026-sep09-s1',
    paperId: 'paper-pyq-2026-sep09-s1',
    title: 'UGC NET Paper 1 — 09 September 2026 (Shift 1)',
    dateText: '09 September 2026',
    shiftText: 'Shift 1',
  },
  'mt-pyq-2026-sep09-s2': {
    shiftId: 'ugcnet-2026-sep09-s2',
    mockTestId: 'mt-pyq-2026-sep09-s2',
    paperId: 'paper-pyq-2026-sep09-s2',
    title: 'UGC NET Paper 1 — 09 September 2026 (Shift 2)',
    dateText: '09 September 2026',
    shiftText: 'Shift 2',
  },
  'ugcnet-2026-sep09-s2': {
    shiftId: 'ugcnet-2026-sep09-s2',
    mockTestId: 'mt-pyq-2026-sep09-s2',
    paperId: 'paper-pyq-2026-sep09-s2',
    title: 'UGC NET Paper 1 — 09 September 2026 (Shift 2)',
    dateText: '09 September 2026',
    shiftText: 'Shift 2',
  },
  'mt-pyq-2026-sep10-s1': {
    shiftId: 'ugcnet-2026-sep10-s1',
    mockTestId: 'mt-pyq-2026-sep10-s1',
    paperId: 'paper-pyq-2026-sep10-s1',
    title: 'UGC NET Paper 1 — 10 September 2026 (Shift 1)',
    dateText: '10 September 2026',
    shiftText: 'Shift 1',
  },
  'ugcnet-2026-sep10-s1': {
    shiftId: 'ugcnet-2026-sep10-s1',
    mockTestId: 'mt-pyq-2026-sep10-s1',
    paperId: 'paper-pyq-2026-sep10-s1',
    title: 'UGC NET Paper 1 — 10 September 2026 (Shift 1)',
    dateText: '10 September 2026',
    shiftText: 'Shift 1',
  },
};

// 2. Canonical Syllabus Units Keywords for NLP Mapping
export const CANONICAL_UNITS = [
  { id: 'U1', name: 'Teaching Aptitude', keywords: ['teaching', 'learner', 'pedagogy', 'formative', 'summative', 'swayam', 'mooc', 'classroom', 'cognitive', 'andragogy', 'instructional', 'memory level', 'understanding level', 'reflective level', 'evaluation system', 'cbcs'] },
  { id: 'U2', name: 'Research Aptitude', keywords: ['research', 'hypothesis', 'sampling', 'thesis', 'dissertation', 'plagiarism', 'qualitative', 'quantitative', 'positivism', 'post-positivist', 'variable', 'validity', 'reliability', 'action research', 'experimental', 'ethnography', 'mla', 'apa'] },
  { id: 'U3', name: 'Comprehension', keywords: ['passage', 'author', 'passage implies', 'according to the text', 'reading comprehension', 'the text suggests', 'theme of the passage'] },
  { id: 'U4', name: 'Communication', keywords: ['communication', 'mass media', 'interpersonal', 'encoding', 'decoding', 'shannon', 'noise', 'feedback', 'kinesics', 'proxemics', 'para-language', 'synchronous', 'non-verbal', 'verbal communication', 'classroom communication'] },
  { id: 'U5', name: 'Mathematical Reasoning and Aptitude', keywords: ['ratio', 'proportion', 'percentage', 'profit', 'loss', 'discount', 'interest', 'speed', 'distance', 'series', 'coding', 'decoding', 'fraction', 'average', 'number series', 'letter series'] },
  { id: 'U6', name: 'Logical Reasoning', keywords: ['syllogism', 'pramana', 'pratyaksha', 'anumana', 'upamana', 'shabda', 'arthapatti', 'anupalabdhi', 'hetvabhasa', 'fallacy', 'vyapti', 'square of opposition', 'deductive', 'inductive', 'venn diagram', 'analogies', 'mood and figure', 'paksha', 'sadhya', 'hetu', 'major premise', 'minor premise'] },
  { id: 'U7', name: 'Data Interpretation', keywords: ['data interpretation', 'table shows', 'bar chart', 'pie chart', 'histogram', 'percentage distribution', 'graph below', 'tabular data', 'sales of companies', 'table: ', 'following table'] },
  { id: 'U8', name: 'Information and Communication Technology (ICT)', keywords: ['ict', 'internet', 'intranet', 'email', 'e-mail', 'ram', 'rom', 'cache', 'binary', 'hardware', 'software', 'url', 'http', 'https', 'malware', 'phishing', 'firewall', 'digital initiatives', 'gigabyte', 'megabyte', 'terabyte', 'lan', 'wan', 'wi-fi', 'gui', 'compiler', 'operating system'] },
  { id: 'U9', name: 'People, Development and Environment', keywords: ['millennium development goals', 'mdg', 'sdg', 'sustainable development', 'pollution', 'air quality', 'aqi', 'greenhouse', 'global warming', 'climate change', 'montreal protocol', 'kyoto protocol', 'paris agreement', 'solar alliance', 'biomass', 'renewable energy', 'natural hazards', 'disaster management', 'particulate matter', 'ozone'] },
  { id: 'U10', name: 'Higher Education System', keywords: ['higher education', 'university', 'ugc', 'naac', 'nirf', 'ancient india', 'takshashila', 'nalanda', 'value education', 'nep 2020', 'national education policy', 'governance', 'radhakrishnan commission', 'kothari commission', 'inter-university', 'deemed university', 'central university', 'colleges'] },
];

const NTA_INSTRUCTIONS = `1. Total duration of UGC NET Paper 1 is 60 minutes.
2. The paper consists of 50 Multiple Choice Questions (MCQs) carrying 2 marks each (Total 100 marks).
3. There is NO negative marking for incorrect or unattempted responses.
4. You can navigate freely between questions using the Question Palette.
5. Questions can be saved, marked for review, or cleared at any time before final submission.
6. When the countdown timer reaches 00:00:00, your exam will automatically submit.`;

/**
 * Converts tabular text (tab-separated or columnar spaces) into a GitHub-Flavored Markdown table.
 */
export function convertTabularToMarkdown(text) {
  if (!text || typeof text !== 'string') return text;
  // If it already contains a valid markdown table, skip
  if (/^\s*\|.*\|\s*$/m.test(text) && /^\s*\|[\s\-:]+\|\s*$/m.test(text)) {
    return text;
  }

  const lines = text.split(/\r?\n/);
  const result = [];
  let tableBuffer = [];

  function flushTable() {
    if (tableBuffer.length === 0) return;
    if (tableBuffer.length === 1) {
      result.push(tableBuffer[0].raw);
      tableBuffer = [];
      return;
    }

    const maxCols = Math.max(...tableBuffer.map((r) => r.cells.length));
    if (maxCols < 2) {
      result.push(...tableBuffer.map((r) => r.raw));
      tableBuffer = [];
      return;
    }

    const normalizedRows = tableBuffer.map((r) => {
      const c = [...r.cells];
      while (c.length < maxCols) c.push('');
      return c;
    });

    const header = normalizedRows[0];
    const dataRows = normalizedRows.slice(1);
    result.push('| ' + header.join(' | ') + ' |');
    result.push('| ' + header.map(() => '---').join(' | ') + ' |');
    for (const row of dataRows) {
      result.push('| ' + row.join(' | ') + ' |');
    }
    tableBuffer = [];
  }

  for (const line of lines) {
    let cells = null;
    if (line.includes('\t')) {
      cells = line.split('\t').map((c) => c.trim()).filter((c) => c.length > 0);
    } else if (/\S\s{2,}\S/.test(line)) {
      cells = line.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
    }

    if (cells && cells.length >= 2) {
      tableBuffer.push({ raw: line, cells });
    } else {
      flushTable();
      result.push(line);
    }
  }
  flushTable();
  return result.join('\n');
}

/**
 * Extracts options (A-D or 1-4) from question block text.
 */
function extractOptions(text) {
  const numToLetter = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f' };

  // Multiline options: must start on their own line with (1)/(2) or A./B. or (A)/(B) or 1./2.
  const letterRegex = /(?:^|\n)\s*(?:\(([A-Fa-f])\)|([A-Fa-f])[.)])\s+([\s\S]*?)(?=(?:\n\s*(?:\(([A-Fa-f])\)|([A-Fa-f])[.)])\s+)|$)/g;
  const numRegex = /(?:^|\n)\s*(?:\(([1-6])\)|([1-6])[.)])\s+([\s\S]*?)(?=(?:\n\s*(?:\(([1-6])\)|([1-6])[.)])\s+)|$)/g;

  let matches = [];
  const numTest = [...text.matchAll(numRegex)];
  if (numTest.length >= 2) {
    matches = numTest.map((m) => {
      const idRaw = (m[1] || m[2]).toLowerCase();
      const id = numToLetter[idRaw] || idRaw;
      return { id, text: m[3].trim(), fullMatch: m[0], index: m.index };
    });
  } else {
    const letterTest = [...text.matchAll(letterRegex)];
    if (letterTest.length >= 2) {
      matches = letterTest.map((m) => {
        const id = (m[1] || m[2]).toLowerCase();
        return { id, text: m[3].trim(), fullMatch: m[0], index: m.index };
      });
    }
  }

  // Handle inline options if multiline yielded < 2
  if (matches.length < 2) {
    const inlineNumRegex = /(?:\(([1-4])\)|(?<=\s|^)([1-4])[.)])\s+([\s\S]*?)(?=(?:\(([1-4])\)|(?<=\s)([1-4])[.)])|$)/g;
    const inlineLetterRegex = /(?:\(([A-Da-d])\)|(?<=\s|^)([A-Da-d])[.)])\s+([\s\S]*?)(?=(?:\(([A-Da-d])\)|(?<=\s)([A-Da-d])[.)])|$)/g;

    const inlineNums = [...text.matchAll(inlineNumRegex)];
    if (inlineNums.length >= 2) {
      matches = inlineNums.map((m) => {
        const idRaw = (m[1] || m[2]).toLowerCase();
        const id = numToLetter[idRaw] || idRaw;
        return { id, text: m[3].trim(), fullMatch: m[0], index: m.index };
      });
    } else {
      const inlineLetters = [...text.matchAll(inlineLetterRegex)];
      if (inlineLetters.length >= 2) {
        matches = inlineLetters.map((m) => {
          const id = (m[1] || m[2]).toLowerCase();
          return { id, text: m[3].trim(), fullMatch: m[0], index: m.index };
        });
      }
    }
  }

  return matches;
}

/**
 * Extracts the correct answer(s) from answer string.
 */
function extractAnswer(rawAns) {
  if (!rawAns) return ['a']; // fallback if missing

  const cleaned = rawAns.trim().toLowerCase();

  // Cancelled / Marks to all
  if (cleaned.includes('all') || cleaned.includes('marks to all') || cleaned.includes('cancelled') || cleaned.includes('drop')) {
    return ['a', 'b', 'c', 'd'];
  }

  const numMap = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
  const found = new Set();

  for (const m of cleaned.matchAll(/\b([1-4]|[a-d])\b|\(([1-4]|[a-d])\)/g)) {
    const v = (m[1] || m[2]).toLowerCase();
    found.add(numMap[v] || v);
  }

  if (found.size > 0) {
    return Array.from(found).sort();
  }

  // Fallback single character search
  const singleChar = cleaned.match(/[1-4a-d]/);
  if (singleChar) {
    const v = singleChar[0];
    return [numMap[v] || v];
  }

  return ['a'];
}

/**
 * Classifies a question into one of the 10 canonical Paper 1 syllabus units.
 */
function classifyUnit(stemText, explicitUnit, qIndex) {
  // 1. Explicit Unit Tagging
  if (explicitUnit) {
    const uMatch = explicitUnit.match(/U([1-9]|10)\b/i) || explicitUnit.match(/\b([1-9]|10)\b/);
    if (uMatch) return `U${uMatch[1]}`;

    const lower = explicitUnit.toLowerCase();
    for (const u of CANONICAL_UNITS) {
      if (lower.includes(u.name.toLowerCase())) return u.id;
    }
  }

  // 2. Keyword-based NLP heuristic
  const lowerStem = stemText.toLowerCase();
  let bestUnit = null;
  let bestScore = 0;

  for (const u of CANONICAL_UNITS) {
    let score = 0;
    for (const kw of u.keywords) {
      if (lowerStem.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestUnit = u.id;
    }
  }

  if (bestUnit && bestScore >= 1) {
    return bestUnit;
  }

  // 3. Sequential 5-item block fallback (Q1-5: U1, Q6-10: U2, ..., Q46-50: U10)
  const blockUnit = Math.min(10, Math.floor(qIndex / 5) + 1);
  return `U${blockUnit}`;
}

/**
 * Detects the question type based on stem structure.
 */
function detectQuestionType(stem, hasPassage, answers) {
  if (answers && answers.length > 1) return 'mcq_multi';
  if (hasPassage) return 'comprehension';
  if (/Statement\s*(?:I|1)\s*:[\s\S]*Statement\s*(?:II|2)\s*:/i.test(stem)) return 'statement_based';
  if (/Assertion\s*\(?A\)?\s*:[\s\S]*Reason\s*\(?R\)?\s*:/i.test(stem)) return 'assertion_reason';
  if (/Match\s*List\s*(?:I|1)[\s\S]*List\s*(?:II|2)/i.test(stem)) return 'match_following';
  return 'mcq_single';
}

/**
 * Main parser function.
 */
export function parseRawPYQ(content, targetId, sourceFile = '') {
  const shiftMeta = SHIFTS[targetId] || {
    shiftId: targetId,
    mockTestId: targetId,
    paperId: `paper-${targetId}`,
    title: `UGC NET Paper 1 — ${targetId}`,
    dateText: '2023',
    shiftText: 'Shift 1',
  };

  // 0. Normalize CRLF to LF for Windows compatibility
  content = content.replace(/\r\n/g, '\n');

  // 1. Check for shared global passages or directions
  let activePassage = null;
  const passageRegex = /\[PASSAGE START\]([\s\S]*?)\[PASSAGE END\]/i;
  const passageMatch = content.match(passageRegex);
  if (passageMatch) {
    activePassage = convertTabularToMarkdown(passageMatch[1].trim());
    content = content.replace(passageRegex, '');
  }

  // 2. Clean outer delimiters and split into question blocks
  let blocks = [];
  if (content.includes('---')) {
    blocks = content
      .split(/\n---+\n/)
      .map((b) => b.replace(/^[\s\-=]+/g, '').replace(/[\s\-=]+$/g, '').trim())
      .filter((b) => b.length > 15);
  } else {
    const splitRegex = /(?:^|\n)(?=(?:Q(?:uestion)?\.?\s*\d+[.:)]|\b\d{1,2}\.[\s\S]*?(?:A[.)]|\(1\)|1[.)])))/gi;
    blocks = content
      .split(splitRegex)
      .map((b) => b.replace(/^[\s\-=]+/g, '').replace(/[\s\-=]+$/g, '').trim())
      .filter((b) => b.length > 15);
  }

  if (blocks.length === 0) {
    blocks = [content.replace(/^[\s\-=]+/g, '').replace(/[\s\-=]+$/g, '').trim()];
  }

  const questions = [];
  const answerKey = {};
  const unitCounts = {};
  for (let i = 1; i <= 10; i++) unitCounts[`U${i}`] = 0;

  for (let idx = 0; idx < blocks.length; idx++) {
    let block = blocks[idx];
    const qid = `q-${String(idx + 1).padStart(2, '0')}`;

    // Extract Explanation
    let explanationText = null;
    const explMatch = block.match(/(?:^|\n)\s*(?:Explanation|Solution|Rationale|Why)\s*[:=-]\s*([\s\S]*?)$/i);
    if (explMatch) {
      explanationText = explMatch[1].trim();
      block = block.slice(0, explMatch.index).trim();
    }

    // Extract Answer
    let rawAns = null;
    const ansMatch = block.match(/(?:^|\n)\s*(?:Answer|Ans|Correct(?:\s*Answer|\s*Option)?|Key)\s*[:=-]\s*([^\n\r]+)/i);
    if (ansMatch) {
      rawAns = ansMatch[1].trim();
      block = (block.slice(0, ansMatch.index) + '\n' + block.slice(ansMatch.index + ansMatch[0].length)).trim();
    }
    const answers = extractAnswer(rawAns);

    // Extract Unit tag
    let explicitUnit = null;
    const unitMatch = block.match(/(?:^|\n)\s*(?:Unit|Syllabus\s*Unit|Topic)\s*[:=-]\s*([^\n\r]+)/i);
    if (unitMatch) {
      explicitUnit = unitMatch[1].trim();
      block = (block.slice(0, unitMatch.index) + '\n' + block.slice(unitMatch.index + unitMatch[0].length)).trim();
    }

    // Extract Options
    const optionsParsed = extractOptions(block);

    // Determine Stem
    let stemRaw = block;
    if (optionsParsed.length > 0 && optionsParsed[0].index !== undefined) {
      stemRaw = block.slice(0, optionsParsed[0].index);
    }

    // Clean up leading question labels (e.g. Q.1, Question 1:, 1.)
    let stem = stemRaw
      .replace(/^(?:Q(?:uestion)?\.?\s*\d+[.:)]?|\d+[.)])\s*/i, '')
      .replace(/(?:Unit|Syllabus\s*Unit|Topic)\s*[:=-]\s*[^\n\r]+\n?/gi, '')
      .trim();

    // Check for inline passage in question
    let questionPassage = activePassage;
    const inlinePassageMatch = block.match(/(?:Passage|Directions?\s*(?:for\s*Questions?\s*[\dto\s-]+)?)\s*[:=-]\s*([\s\S]*?)(?=(?:Q(?:uestion)?\.?\s*\d+|Which|What|Who|When|Where|According|In|Select|$))/i);
    if (inlinePassageMatch && inlinePassageMatch[1].trim().length > 40) {
      questionPassage = convertTabularToMarkdown(inlinePassageMatch[1].trim());
      stem = stem.replace(inlinePassageMatch[0], '').trim();
    }

    // Convert tabular text in stem to Markdown table
    stem = convertTabularToMarkdown(stem);

    // Options formatting
    let finalOptions = [];
    if (optionsParsed.length >= 2) {
      finalOptions = optionsParsed.map((o) => ({
        id: o.id,
        text: { en: o.text },
      }));
    } else {
      finalOptions = [
        { id: 'a', text: { en: 'Option A' } },
        { id: 'b', text: { en: 'Option B' } },
        { id: 'c', text: { en: 'Option C' } },
        { id: 'd', text: { en: 'Option D' } },
      ];
    }

    // Map Unit & Topic
    const unitId = classifyUnit(stem, explicitUnit, idx);
    unitCounts[unitId] = (unitCounts[unitId] || 0) + 1;
    const topicId = `${unitId}.1`;

    // Detect question type
    const qType = detectQuestionType(stem, Boolean(questionPassage), answers);

    const questionDoc = {
      qid,
      version: 1,
      sectionId: 'paper1',
      unitId,
      topicId,
      difficulty: 'medium',
      content: {
        type: qType,
        stem: { en: stem },
        ...(questionPassage ? { passage: { en: questionPassage } } : {}),
        options: finalOptions,
      },
      provenance: {
        kind: 'official_pyq',
        officialPyqVerified: false,
      },
    };

    questions.push(questionDoc);

    answerKey[qid] = {
      correct: answers,
      sectionId: 'paper1',
      unitId,
      topicId,
      difficulty: 'medium',
      ...(explanationText ? { explanation: { en: explanationText } } : {}),
    };
  }

  // Construct MockTestDoc root structure
  const resultDoc = {
    target: targetId,
    shiftId: shiftMeta.shiftId,
    mockTestId: shiftMeta.mockTestId,
    paperId: shiftMeta.paperId,
    title: shiftMeta.title,
    kind: 'pyq',
    blueprintId: 'ugcnet-paper1-pilot-v1',
    paperVersion: 1,
    access: 'paid',
    collectionId: 'plan-pyq-2023-premium-pack',
    status: 'draft',
    timed: true,
    shuffle: false,
    revealPolicy: 'immediate',
    contentLabel: 'under_development',
    description: `UGC NET Paper 1, ${shiftMeta.dateText}, ${shiftMeta.shiftText}. 50 questions, 100 marks, 60 minutes.`,
    instructions: NTA_INSTRUCTIONS,
    version: 1,
    transcriber: 'Bunty',
    verifier: 'Pending Human Verification',
    mockTest: {
      title: shiftMeta.title,
      kind: 'pyq',
      blueprintId: 'ugcnet-paper1-pilot-v1',
      paperId: shiftMeta.paperId,
      paperVersion: 1,
      access: 'paid',
      collectionId: 'plan-pyq-2023-premium-pack',
      status: 'draft',
      timed: true,
      shuffle: false,
      revealPolicy: 'immediate',
      contentLabel: 'under_development',
      description: `UGC NET Paper 1, ${shiftMeta.dateText}, ${shiftMeta.shiftText}. 50 questions, 100 marks, 60 minutes.`,
      instructions: NTA_INSTRUCTIONS,
      version: 1,
      transcriber: 'Bunty',
      verifier: 'Pending Human Verification',
    },
    paper: {
      paperId: shiftMeta.paperId,
      mockTestId: shiftMeta.mockTestId,
      version: 1,
      questions,
      contentLabel: 'under_development',
    },
    questions,
    answerKey,
    metadata: {
      parsedAt: new Date().toISOString(),
      sourceFile: sourceFile ? basename(sourceFile) : 'inline',
      questionCount: questions.length,
      unitDistribution: unitCounts,
    },
  };

  return resultDoc;
}

// CLI Execution Guard
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  const args = process.argv.slice(2);
  const value = (n) => {
    const i = args.indexOf(n);
    return i >= 0 && i < args.length - 1 ? args[i + 1] : undefined;
  };

  const inputFile = args.find((a) => !a.startsWith('--') && existsSync(resolve(a))) || args[0];
  const target = value('--target') || (args[1] && !args[1].startsWith('--') ? args[1] : undefined);

  if (!inputFile || !target) {
    console.log('='.repeat(70));
    console.log('UrEducator 2.0 — Raw PYQ Text Ingestion & Parser Tool');
    console.log('='.repeat(70));
    console.log('\nUsage:');
    console.log('  node scripts/parse-raw-pyq.mjs <inputFile> --target <targetMockTestId>\n');
    console.log('Examples:');
    console.log('  node scripts/parse-raw-pyq.mjs content-sources/raw/jun14-shift1.txt --target mt-pyq-2023-jun14-s1');
    console.log('  node scripts/parse-raw-pyq.mjs content-sources/raw/dec07-shift1.txt --target mt-pyq-2023-dec07-s1\n');
    console.log('Supported Targets:');
    for (const [k, v] of Object.entries(SHIFTS)) {
      if (k.startsWith('mt-')) console.log(`  - ${k} (${v.title})`);
    }
    process.exit(1);
  }

  const inputAbsPath = resolve(inputFile);
  if (!existsSync(inputAbsPath)) {
    console.error(`[ERROR] Input file not found: ${inputAbsPath}`);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('UrEducator 2.0 — Raw PYQ Text Ingestion & Parsing');
  console.log(`Source File : ${inputAbsPath}`);
  console.log(`Target ID   : ${target}`);
  console.log('='.repeat(70));

  const rawContent = readFileSync(inputAbsPath, 'utf8');
  const parsed = parseRawPYQ(rawContent, target, inputAbsPath);

  // Ensure output directories exist
  const shiftsDir = join(REPO_ROOT, 'content-sources', 'shifts');
  if (!existsSync(shiftsDir)) mkdirSync(shiftsDir, { recursive: true });

  // Output file paths
  const targetOutputFile = join(shiftsDir, `${target}.json`);
  writeFileSync(targetOutputFile, JSON.stringify(parsed, null, 2), 'utf8');
  console.log(`\n[OK] Wrote structured MockTestDoc JSON to:`);
  console.log(`     ${targetOutputFile}`);

  // Print Summary Report
  console.log('\n' + '-'.repeat(70));
  console.log('INGESTION SUMMARY & BLUEPRINT VALIDATION:');
  console.log('-'.repeat(70));
  console.log(`Total Questions Parsed : ${parsed.questions.length} / 50`);
  console.log(`Mock Test Title        : ${parsed.title}`);
  console.log(`Paper ID               : ${parsed.paperId}`);
  console.log(`Blueprint ID           : ${parsed.blueprintId}`);
  console.log(`Content Label          : ${parsed.contentLabel}`);
  console.log('\nUnit Distribution (Canonical Syllabus Blueprint):');
  for (let i = 1; i <= 10; i++) {
    const uId = `U${i}`;
    const uName = CANONICAL_UNITS[i - 1].name;
    const count = parsed.metadata.unitDistribution[uId] || 0;
    console.log(`  [${uId}] ${uName.padEnd(42)}: ${count} questions`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('NEXT STEPS:');
  console.log(`1. Review the output JSON at: content-sources/shifts/${target}.json`);
  console.log(`2. Verify question count is exactly 50 with no missing options.`);
  console.log(`3. When verified, seed into staging using:`);
  console.log(`   node scripts/ingest-premium-pyqs.mjs --project ugc-mock-test-staging --seed-test-shells --confirm-write`);
  console.log('='.repeat(70));
}
