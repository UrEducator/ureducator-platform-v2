/**
 * UrEducator 2.0 — Phase G: Semantic Auto-Mapping for Question Bank
 *
 * Maps all 250 questions in ugc-mock-test-staging to the 10 standard UGC NET Paper 1 Units
 * using heuristic keyword matching across stems, options, and passages, resolving to the
 * canonical unit IDs (p1-teaching, p1-research, etc.) and valid topic IDs.
 *
 * Usage:
 *   Dry-run:
 *     node scripts/semantic-mapper.mjs --project ugc-mock-test-staging
 *   Live update:
 *     node scripts/semantic-mapper.mjs --project ugc-mock-test-staging --confirm-write
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

// 1. Prior mapping from U codes (used in syllabus transcription) to canonical DB unit IDs
const U_CODE_TO_UNIT = {
  U1: 'p1-teaching',
  U2: 'p1-research',
  U3: 'p1-comprehension',
  U4: 'p1-communication',
  U5: 'p1-maths',
  U6: 'p1-logical',
  U7: 'p1-data',
  U8: 'p1-ict',
  U9: 'p1-environment',
  U10: 'p1-higher-ed',
};

// 2. Comprehensive Semantic Dictionaries for UGC NET Paper 1 Units
const UNIT_KEYWORDS = {
  'p1-teaching': [
    'teaching', 'learner', 'learners', 'pedagogy', 'pedagogical', 'evaluation', 'formative', 'summative',
    'criterion-referenced', 'norm-referenced', 'andragogy', 'swayam', 'swayamprabha', 'mooc', 'moocs',
    'classroom', 'cognitive', 'instructional', 'memory level', 'understanding level', 'reflective level',
    'cbcs', 'choice based credit system', 'microteaching', 'teaching aid', 'teaching aids', 'learning outcome',
    'effectiveness of teaching', 'teaching aptitude', 'teacher-centric', 'learner-centric', 'peer group',
    'instruction', 'pedagogic', 'remedial teaching', 'diagnostic evaluation', 'continuous and comprehensive evaluation',
    'cce', 'herbart', 'morrison', 'hunt', 'flipped classroom', 'blended learning'
  ],
  'p1-research': [
    'research', 'hypothesis', 'hypotheses', 'thesis', 'dissertation', 'sampling', 'sample size', 'plagiarism',
    'qualitative', 'quantitative', 'positivism', 'post-positivist', 'postpositivism', 'variable', 'variables',
    'validity', 'reliability', 'action research', 'experimental research', 'ethnography', 'grounded theory',
    'case study', 'mla', 'apa', 'chicago', 'referencing', 'citation', 'bibliography', 'null hypothesis',
    'type i error', 'type ii error', 'stratified sampling', 'snowball sampling', 'quota sampling', 'purposive sampling',
    'research ethics', 'epistemology', 'ontology', 'methodology', 'triangulation', 'research design', 'inquiry'
  ],
  'p1-comprehension': [
    'passage', 'reading comprehension', 'according to the passage', 'author suggests', 'author states',
    'central idea of the passage', 'tone of the passage', 'theme of the passage', 'in the given passage',
    'from the passage', 'the passage implies', 'the author of the passage', 'based on the passage',
    'the author argues', 'the author discusses', 'the passage deals with'
  ],
  'p1-communication': [
    'communication', 'communicator', 'sender', 'receiver', 'encoding', 'decoding', 'channel', 'feedback',
    'noise', 'mass media', 'interpersonal', 'intrapersonal', 'kinesics', 'proxemics', 'paralanguage',
    'para-language', 'non-verbal', 'nonverbal', 'verbal communication', 'classroom communication',
    'barriers to communication', 'shannon', 'weaver', 'berlo', 'linear model', 'interactive model',
    'dyadic', 'grapevine', 'horizontal communication', 'vertical communication', 'body language', 'facial expression',
    'media accountability', 'synchronous', 'asynchronous', 'haptics', 'chronemics'
  ],
  'p1-maths': [
    'ratio', 'proportion', 'percentage', 'profit and loss', 'simple interest', 'compound interest',
    'discount', 'speed', 'distance', 'train', 'trains', 'number series', 'letter series', 'coding-decoding',
    'coding and decoding', 'fraction', 'fractions', 'average', 'averages', 'cost price', 'selling price',
    'time and work', 'work and time', 'time and distance', 'blood relation', 'direction sense',
    'km/h', 'metres per second', 'arithmetic', 'series:', 'find the next term', 'missing term'
  ],
  'p1-logical': [
    'syllogism', 'pramana', 'pramanas', 'pratyaksha', 'anumana', 'upamana', 'shabda', 'arthapatti',
    'anupalabdhi', 'hetvabhasa', 'fallacy', 'fallacies', 'vyapti', 'square of opposition', 'contradictory',
    'contrary', 'subcontrary', 'subalternation', 'deductive', 'inductive', 'venn diagram', 'analogies',
    'mood and figure', 'paksha', 'sadhya', 'hetu', 'major premise', 'minor premise', 'middle term',
    'major term', 'minor term', 'categorical proposition', 'valid argument', 'invalid argument', 'indian logic',
    'aristotelian', 'fallacy of'
  ],
  'p1-data': [
    'data interpretation', 'following table', 'table shows', 'table gives', 'percentage distribution of',
    'bar chart', 'pie chart', 'histogram', 'tabular data', 'table below', 'table:', 'readers of an it magazine'
  ],
  'p1-ict': [
    'ict', 'internet', 'intranet', 'extranet', 'email', 'e-mail', 'ram', 'rom', 'cache', 'binary',
    'hexadecimal', 'octal', 'hardware', 'software', 'url', 'http', 'https', 'malware', 'phishing',
    'spyware', 'ransomware', 'virus', 'firewall', 'digital initiatives', 'gigabyte', 'megabyte', 'terabyte',
    'lan', 'wan', 'wi-fi', 'cpu', 'operating system', 'cloud computing', 'artificial intelligence', 'search engine',
    'ip address', 'base-10', 'base-4', 'base-2', 'computer memory', 'solid state drive', 'ssd', 'dpi',
    'computer components', 'compiler', 'interpreter'
  ],
  'p1-environment': [
    'millennium development goals', 'mdg', 'mdgs', 'sdg', 'sdgs', 'sustainable development', 'pollution', 'pollutant',
    'air quality', 'aqi', 'greenhouse', 'global warming', 'climate change', 'montreal protocol', 'kyoto protocol',
    'paris agreement', 'solar alliance', 'biomass', 'renewable energy', 'solar energy', 'natural hazards',
    'disaster management', 'particulate matter', 'pm2.5', 'pm10', 'ozone', 'cfcs', 'toxicants', 'nephrotoxic',
    'hepatotoxic', 'hematotoxic', 'pulmonotoxic', 'acid rain', 'smog', 'solid waste', 'e-waste', 'water pollution',
    'ambient air', 'environment', 'breeder reactors', 'waste water treatment', 'interspecific'
  ],
  'p1-higher-ed': [
    'higher education', 'university', 'universities', 'ugc', 'naac', 'nirf', 'ancient india', 'takshashila',
    'nalanda', 'vikramashila', 'value education', 'nep 2020', 'national education policy', 'governance',
    'radhakrishnan commission', 'kothari commission', 'mudaliar commission', 'hunter commission',
    'macaulay', 'woods despatch', 'central university', 'state university', 'deemed university',
    'aicte', 'ncte', 'chancellor', 'vice-chancellor', 'academic council', 'rusa', 'vedic', 'oriental learning',
    'inter-university', 'gross enrolment ratio', 'ger', 'ignou', 'national credit framework', 'ncrf',
    'autonomous degree-granting'
  ]
};

// Build compiled word-boundary regular expressions to avoid substring false positives (e.g. 'rom' in 'from')
const COMPILED_REGEXES = {};
for (const [unitId, kws] of Object.entries(UNIT_KEYWORDS)) {
  COMPILED_REGEXES[unitId] = kws.map((kw) => ({
    regex: new RegExp('(?:^|[^a-zA-Z0-9])' + kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:$|[^a-zA-Z0-9])', 'i'),
    weight: kw.includes(' ') ? 3 : 1,
    kw,
  }));
}

// 3. Topic Resolver for each Unit
function resolveTopicId(unitId, text) {
  const lower = text.toLowerCase();
  switch (unitId) {
    case 'p1-teaching':
      if (/(?:evaluation|formative|summative|criterion-referenced|norm-referenced|grading|cce|test|methods|method|lecture|discussion|project|heuristic|microteaching)/i.test(lower)) {
        return 'p1-teaching-methods';
      }
      return 'p1-teaching-nature';

    case 'p1-research':
      if (/(?:ethics|plagiarism|thesis|dissertation|referencing|citation|mla|apa|chicago|bibliography|footnote|endnote|style manual)/i.test(lower)) {
        return 'p1-research-ethics';
      }
      return 'p1-research-types';

    case 'p1-comprehension':
      return 'p1-comprehension-passage';

    case 'p1-communication':
      return 'p1-communication-basics';

    case 'p1-maths':
      return 'p1-maths-series';

    case 'p1-logical':
      return 'p1-logical-arguments';

    case 'p1-data':
      return 'p1-data-tables';

    case 'p1-ict':
      return 'p1-ict-basics';

    case 'p1-environment':
      return 'p1-environment-issues';

    case 'p1-higher-ed':
      return 'p1-higher-ed-structure';

    default:
      return `${unitId}-basics`;
  }
}

// 4. Semantic Classifier
function classifyQuestion(fullText, currentUnitId, hasPassage, isTablePassage) {
  // Strong structural signals
  const isData = isTablePassage || /table\s+shows|percentage\s*\(%\)\s*distribution|the\s+following\s+table/i.test(fullText);
  const isComprehension = (hasPassage && !isData) || /read\s+the\s+following\s+passage|according\s+to\s+the\s+passage/i.test(fullText);

  const scores = {};
  for (const [unitId, regexList] of Object.entries(COMPILED_REGEXES)) {
    let score = 0;
    for (const { regex, weight } of regexList) {
      if (regex.test(fullText)) {
        score += weight;
      }
    }
    scores[unitId] = score;
  }

  if (isData) scores['p1-data'] = (scores['p1-data'] || 0) + 15;
  if (isComprehension) scores['p1-comprehension'] = (scores['p1-comprehension'] || 0) + 15;

  // Add prior weight from transcription U code if present
  const priorUnit = U_CODE_TO_UNIT[currentUnitId] || currentUnitId;
  if (priorUnit && scores[priorUnit] !== undefined) {
    scores[priorUnit] += 0.5; // slight tie-breaking prior
  }

  let bestUnit = priorUnit || 'p1-teaching';
  let bestScore = -1;

  for (const [unitId, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestUnit = unitId;
    }
  }

  return { unitId: bestUnit, score: bestScore, scores };
}

async function run() {
  console.log('================================================================');
  console.log('UrEducator 2.0 — Phase G: Semantic Auto-Mapping for Question Bank');
  console.log(`Environment: ${STAGING_PROJECT}`);
  console.log(`Mode:        ${confirmWrite ? 'LIVE WRITE CONFIRMED' : 'DRY-RUN (pass --confirm-write to execute)'}`);
  console.log('================================================================\n');

  const app = initializeApp({ projectId: STAGING_PROJECT });
  const db = getFirestore(app);
  const nowMs = Date.now();

  // 1. Fetch valid units and topics from Firestore to verify schema mapping
  console.log('[STEP 1] Validating Firestore Units and Topics for Paper 1...');
  const unitsSnap = await db.collection('units').where('subjectId', '==', 'paper1').get();
  const validUnits = new Map();
  unitsSnap.docs.forEach((d) => {
    validUnits.set(d.id, d.data());
  });

  console.log(`Found ${validUnits.size} Paper 1 units in database:`);
  for (const [uid, udata] of validUnits.entries()) {
    console.log(`  - ${uid.padEnd(20)}: ${udata.name?.en}`);
  }

  const topicsSnap = await db.collection('topics').where('subjectId', '==', 'paper1').get();
  console.log(`Found ${topicsSnap.size} Paper 1 topics in database.\n`);

  // 2. Fetch all questions from Firestore
  console.log('[STEP 2] Fetching questions from Firestore...');
  const qsSnap = await db.collection('questions').get();
  console.log(`Retrieved ${qsSnap.size} questions from questions collection.\n`);

  const unitDistribution = {};
  for (const uid of validUnits.keys()) {
    unitDistribution[uid] = 0;
  }

  const updates = [];
  let alreadyMapped = 0;
  let remappedCount = 0;

  console.log('[STEP 3] Running semantic classification...');
  for (const doc of qsSnap.docs) {
    const qid = doc.id;
    const qData = doc.data();
    const curUnit = qData.unitId;

    // Fetch version 1 content
    const vSnap = await doc.ref.collection('versions').doc(String(qData.currentVersion || 1)).get();
    const vData = vSnap.data() || {};
    const stem = vData.content?.stem?.en || qData.preview || '';
    const passage = vData.content?.passage?.en || '';
    const optionsText = (vData.content?.options || []).map((o) => o.text?.en || '').join(' ');
    const fullText = `${stem} ${passage} ${optionsText}`;

    const hasPassage = passage.length > 50;
    const isTablePassage = hasPassage && (/table/i.test(passage) || /percentage/i.test(passage));

    // Classify
    const { unitId } = classifyQuestion(fullText, curUnit, hasPassage, isTablePassage);
    const topicId = resolveTopicId(unitId, fullText);

    unitDistribution[unitId] = (unitDistribution[unitId] || 0) + 1;

    const isGenericPlaceholder = !curUnit || curUnit.startsWith('U') || !validUnits.has(curUnit);
    if (!isGenericPlaceholder && curUnit === unitId && qData.topicId === topicId) {
      alreadyMapped++;
    } else {
      remappedCount++;
    }

    updates.push({
      qid,
      oldUnit: curUnit,
      newUnit: unitId,
      oldTopic: qData.topicId,
      newTopic: topicId,
      shiftId: qData.shiftId || qData.mockTestId,
      preview: stem.slice(0, 70).replace(/\n/g, ' '),
    });
  }

  console.log(`Classification complete.`);
  console.log(`- Questions needing mapping/update: ${remappedCount}`);
  console.log(`- Questions already compliant:      ${alreadyMapped}\n`);

  console.log('----------------------------------------------------------------');
  console.log('Unit Distribution Breakdown (across all 250 questions):');
  console.log('----------------------------------------------------------------');
  for (const [uid, count] of Object.entries(unitDistribution)) {
    const uName = validUnits.get(uid)?.name?.en || uid;
    console.log(`  ${uid.padEnd(20)} (${uName.padEnd(45)}): ${count} questions`);
  }
  console.log('----------------------------------------------------------------\n');

  // 3. Execute database updates if confirmed
  if (confirmWrite) {
    console.log('[STEP 4] Executing database updates to ugc-mock-test-staging...');
    let batch = db.batch();
    let batchCount = 0;
    let totalUpdated = 0;

    for (const u of updates) {
      const qRef = db.collection('questions').doc(u.qid);
      batch.update(qRef, {
        unitId: u.newUnit,
        topicId: u.newTopic,
        updatedAtMs: nowMs,
      });

      // Also update version doc if present
      const vRef = qRef.collection('versions').doc('1');
      batch.set(vRef, { unitId: u.newUnit, topicId: u.newTopic, updatedAtMs: nowMs }, { merge: true });

      batchCount += 2;
      totalUpdated++;

      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
    console.log(`[FIRESTORE] Successfully updated ${totalUpdated} question documents in questions/.`);

    // Also update papers and answerKeys in staging for full system consistency
    console.log('[STEP 5] Updating papers and answerKeys collections for test consistency...');
    const papersSnap = await db.collection('papers').get();
    for (const pDoc of papersSnap.docs) {
      const pData = pDoc.data();
      const pQs = pData.questions || [];
      let paperChanged = false;

      const updatedPQs = pQs.map((pq) => {
        const match = updates.find((u) => u.qid === pq.qid);
        if (match && (pq.unitId !== match.newUnit || pq.topicId !== match.newTopic)) {
          paperChanged = true;
          return { ...pq, unitId: match.newUnit, topicId: match.newTopic };
        }
        return pq;
      });

      if (paperChanged) {
        await pDoc.ref.update({ questions: updatedPQs, updatedAtMs: nowMs });
        console.log(`  - Updated paper ${pDoc.id}`);
      }
    }

    const answerKeysSnap = await db.collection('answerKeys').get();
    for (const aDoc of answerKeysSnap.docs) {
      const aData = aDoc.data() || {};
      const paperId = aDoc.id;
      const shiftPrefix = paperId.startsWith('paper-') ? paperId.replace('paper-', 'mt-') : paperId;
      const items = aData.items || {};
      let keyChanged = false;

      for (const [keyQid, kEntry] of Object.entries(items)) {
        if (kEntry && typeof kEntry === 'object') {
          const numStr = keyQid.replace('q-', '');
          const fullQid = `${shiftPrefix}-q${numStr}`;
          const match = updates.find((u) => u.qid === fullQid);
          if (match && (kEntry.unitId !== match.newUnit || kEntry.topicId !== match.newTopic)) {
            keyChanged = true;
            kEntry.unitId = match.newUnit;
            kEntry.topicId = match.newTopic;
          }
        }
      }

      if (keyChanged) {
        await aDoc.ref.update({ items, updatedAtMs: nowMs });
        console.log(`  - Updated answerKey ${aDoc.id}`);
      }
    }

    // Also update local shift JSONs in content-sources/shifts/
    console.log('[STEP 6] Syncing local content-sources/shifts/ JSON files...');
    const shiftsDir = resolve(REPO_ROOT, 'content-sources', 'shifts');
    if (existsSync(shiftsDir)) {
      const shiftFiles = [
        'mt-pyq-2024-jun18-s1.json',
        'mt-pyq-2024-jun18-s2.json',
        'mt-pyq-2026-sep09-s1.json',
        'mt-pyq-2026-sep09-s2.json',
        'mt-pyq-2026-sep10-s1.json',
      ];

      for (const f of shiftFiles) {
        const fPath = join(shiftsDir, f);
        if (existsSync(fPath)) {
          const shiftId = f.replace('.json', '');
          const shiftData = JSON.parse(readFileSync(fPath, 'utf8'));
          let modified = false;
          if (Array.isArray(shiftData.questions)) {
            shiftData.questions = shiftData.questions.map((q) => {
              const numStr = q.qid.replace('q-', '');
              const fullQid = `${shiftId}-q${numStr}`;
              const match = updates.find((u) => u.qid === fullQid);
              if (match) {
                modified = true;
                return { ...q, unitId: match.newUnit, topicId: match.newTopic };
              }
              return q;
            });
          }
          if (modified) {
            writeFileSync(fPath, JSON.stringify(shiftData, null, 2) + '\n', 'utf8');
            console.log(`  - Synced ${f}`);
          }
        }
      }
    }

    console.log('\n[SUCCESS] Phase G Semantic Mapping Complete!');
  } else {
    console.log('\n[DRY RUN COMPLETE] No records were modified. Run with --confirm-write to execute live updates.');
  }
}

run().catch((err) => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
