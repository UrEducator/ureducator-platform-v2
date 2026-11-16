'use client';
import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLoad } from '@/lib/hooks';
import { useNames } from '@/lib/names';
import type { ResultRow } from '@/lib/types';
import {
  type Bucket,
  classifyDiagnosticQuadrant,
  type DiagnosticQuadrant,
  type QuadrantId,
} from '@ureducator/shared';

export type { DiagnosticQuadrant, QuadrantId };
export { classifyDiagnosticQuadrant };

export interface CanonicalUnit {
  id: string;
  unitNo: number;
  name: string;
  shortName: string;
  color: string;
  description: string;
}

export const CANONICAL_PAPER_1_UNITS: CanonicalUnit[] = [
  {
    id: 'p1-teaching',
    unitNo: 1,
    name: 'Teaching Aptitude',
    shortName: 'U1 Teaching',
    color: '#6366f1',
    description: 'Covers teaching concepts, objectives, levels of teaching (Memory, Understanding, Reflective), learner characteristics, instructional methods, support systems, and modern CBCS evaluation.',
  },
  {
    id: 'p1-research',
    unitNo: 2,
    name: 'Research Aptitude',
    shortName: 'U2 Research',
    color: '#06b6d4',
    description: 'Covers meaning, types, and characteristics of research, positivism vs post-positivism, qualitative/quantitative methods, thesis writing steps, and research ethics.',
  },
  {
    id: 'p1-comprehension',
    unitNo: 3,
    name: 'Reading Comprehension',
    shortName: 'U3 Reading',
    color: '#10b981',
    description: 'Dense passage-based analytical comprehension evaluating inference, critical reading speed, semantic extraction, and vocabulary in context.',
  },
  {
    id: 'p1-communication',
    unitNo: 4,
    name: 'Communication',
    shortName: 'U4 Comm',
    color: '#f59e0b',
    description: 'Examines communication models, verbal & non-verbal types, intercultural & group interactions, classroom communication dynamics, and psychological/semantic barriers.',
  },
  {
    id: 'p1-maths',
    unitNo: 5,
    name: 'Mathematical Reasoning',
    shortName: 'U5 Maths',
    color: '#ec4899',
    description: 'Mathematical reasoning, number/letter series, codes, and arithmetic concepts including fractions, time & distance, ratios, percentages, profit & loss, and averages.',
  },
  {
    id: 'p1-logical',
    unitNo: 6,
    name: 'Logical Reasoning',
    shortName: 'U6 Logic',
    color: '#8b5cf6',
    description: 'Structure of arguments, categorical propositions, mood & figure, formal/informal fallacies, square of opposition, Venn diagrams, and Indian Logic (Pramanas & Hetvabhasa).',
  },
  {
    id: 'p1-data',
    unitNo: 7,
    name: 'Data Interpretation',
    shortName: 'U7 DI',
    color: '#14b8a6',
    description: 'Quantitative analysis of datasets through tables, bar charts, line graphs, percentage distributions, and ratio-based numerical reasoning.',
  },
  {
    id: 'p1-ict',
    unitNo: 8,
    name: 'Information & Comm Tech',
    shortName: 'U8 ICT',
    color: '#3b82f6',
    description: 'ICT terminology, general abbreviations, internet/intranet basics, email, audio/video conferencing, and Government digital initiatives in higher education.',
  },
  {
    id: 'p1-environment',
    unitNo: 9,
    name: 'People, Dev & Environment',
    shortName: 'U9 Env',
    color: '#84cc16',
    description: 'Millennium & Sustainable Development Goals (SDGs), human-environment interactions, pollution types, climate change, and international treaties (Montreal, Kyoto, Paris Agreement, ISA).',
  },
  {
    id: 'p1-higher-ed',
    unitNo: 10,
    name: 'Higher Education System',
    shortName: 'U10 Higher Ed',
    color: '#f97316',
    description: 'Ancient Indian universities (Takshashila, Nalanda), post-independence commissions, oriental/conventional programs, NEP 2020, and governance/regulatory structures.',
  },
];

export const U_CODE_MAP: Record<string, string> = {
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

export interface TopicAnalyticsItem {
  topicId: string;
  topicName: string;
  unitId: string;
  unitName: string;
  totalAttempted: number;
  totalCorrect: number;
  totalQuestions: number;
  accuracy: number;
  avgTimePerQuestion: number;
  totalTimeSpentSec: number;
  quadrant: DiagnosticQuadrant;
}

export interface UnitAnalyticsItem {
  unitId: string;
  unitNo: number;
  unitName: string;
  shortName: string;
  color: string;
  description: string;
  totalAttempted: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnattempted: number;
  totalQuestions: number;
  accuracy: number;
  avgTimePerQuestion: number;
  totalTimeSpentSec: number;
  timeSharePercent: number;
  topics: TopicAnalyticsItem[];
}

export interface BenchmarkDemoData {
  units: UnitAnalyticsItem[];
  topics: TopicAnalyticsItem[];
  summary: {
    testsTaken: number;
    overallAccuracy: number;
    avgTimePerQuestion: number;
    totalAttempted: number;
    totalCorrect: number;
    totalTimeSpentSec: number;
  };
}

const DEMO_UNITS_DATA = [
  { unitId: 'p1-teaching', unitNo: 1, unitName: 'Teaching Aptitude', shortName: 'U1 Teaching', color: '#6366f1', description: 'Covers teaching concepts, objectives, levels of teaching (Memory, Understanding, Reflective), learner characteristics, instructional methods, support systems, and modern CBCS evaluation.', totalAttempted: 40, totalCorrect: 32, totalIncorrect: 8, totalUnattempted: 5, totalQuestions: 45, accuracy: 80, avgTimePerQuestion: 50, totalTimeSpentSec: 2000 },
  { unitId: 'p1-research', unitNo: 2, unitName: 'Research Aptitude', shortName: 'U2 Research', color: '#06b6d4', description: 'Covers meaning, types, and characteristics of research, positivism vs post-positivism, qualitative/quantitative methods, thesis writing steps, and research ethics.', totalAttempted: 38, totalCorrect: 26, totalIncorrect: 12, totalUnattempted: 7, totalQuestions: 45, accuracy: 68, avgTimePerQuestion: 58, totalTimeSpentSec: 2204 },
  { unitId: 'p1-comprehension', unitNo: 3, unitName: 'Reading Comprehension', shortName: 'U3 Reading', color: '#10b981', description: 'Dense passage-based analytical comprehension evaluating inference, critical reading speed, semantic extraction, and vocabulary in context.', totalAttempted: 25, totalCorrect: 21, totalIncorrect: 4, totalUnattempted: 0, totalQuestions: 25, accuracy: 84, avgTimePerQuestion: 74, totalTimeSpentSec: 1850 },
  { unitId: 'p1-communication', unitNo: 4, unitName: 'Communication', shortName: 'U4 Comm', color: '#f59e0b', description: 'Examines communication models, verbal & non-verbal types, intercultural & group interactions, classroom communication dynamics, and psychological/semantic barriers.', totalAttempted: 35, totalCorrect: 27, totalIncorrect: 8, totalUnattempted: 5, totalQuestions: 40, accuracy: 77, avgTimePerQuestion: 44, totalTimeSpentSec: 1540 },
  { unitId: 'p1-maths', unitNo: 5, unitName: 'Mathematical Reasoning', shortName: 'U5 Maths', color: '#ec4899', description: 'Mathematical reasoning, number/letter series, codes, and arithmetic concepts including fractions, time & distance, ratios, percentages, profit & loss, and averages.', totalAttempted: 32, totalCorrect: 17, totalIncorrect: 15, totalUnattempted: 8, totalQuestions: 40, accuracy: 53, avgTimePerQuestion: 88, totalTimeSpentSec: 2816 },
  { unitId: 'p1-logical', unitNo: 6, unitName: 'Logical Reasoning', shortName: 'U6 Logic', color: '#8b5cf6', description: 'Structure of arguments, categorical propositions, mood & figure, formal/informal fallacies, square of opposition, Venn diagrams, and Indian Logic (Pramanas & Hetvabhasa).', totalAttempted: 36, totalCorrect: 25, totalIncorrect: 11, totalUnattempted: 9, totalQuestions: 45, accuracy: 69, avgTimePerQuestion: 64, totalTimeSpentSec: 2304 },
  { unitId: 'p1-data', unitNo: 7, unitName: 'Data Interpretation', shortName: 'U7 DI', color: '#14b8a6', description: 'Quantitative analysis of datasets through tables, bar charts, line graphs, percentage distributions, and ratio-based numerical reasoning.', totalAttempted: 25, totalCorrect: 18, totalIncorrect: 7, totalUnattempted: 0, totalQuestions: 25, accuracy: 72, avgTimePerQuestion: 82, totalTimeSpentSec: 2050 },
  { unitId: 'p1-ict', unitNo: 8, unitName: 'Information & Comm Tech', shortName: 'U8 ICT', color: '#3b82f6', description: 'ICT terminology, general abbreviations, internet/intranet basics, email, audio/video conferencing, and Government digital initiatives in higher education.', totalAttempted: 35, totalCorrect: 30, totalIncorrect: 5, totalUnattempted: 5, totalQuestions: 40, accuracy: 86, avgTimePerQuestion: 38, totalTimeSpentSec: 1330 },
  { unitId: 'p1-environment', unitNo: 9, unitName: 'People, Dev & Environment', shortName: 'U9 Env', color: '#84cc16', description: 'Millennium & Sustainable Development Goals (SDGs), human-environment interactions, pollution types, climate change, and international treaties (Montreal, Kyoto, Paris Agreement, ISA).', totalAttempted: 36, totalCorrect: 21, totalIncorrect: 15, totalUnattempted: 9, totalQuestions: 45, accuracy: 58, avgTimePerQuestion: 66, totalTimeSpentSec: 2376 },
  { unitId: 'p1-higher-ed', unitNo: 10, unitName: 'Higher Education System', shortName: 'U10 Higher Ed', color: '#f97316', description: 'Ancient Indian universities (Takshashila, Nalanda), post-independence commissions, oriental/conventional programs, NEP 2020, and governance/regulatory structures.', totalAttempted: 34, totalCorrect: 25, totalIncorrect: 9, totalUnattempted: 6, totalQuestions: 40, accuracy: 74, avgTimePerQuestion: 46, totalTimeSpentSec: 1564 },
];

const DEMO_TOPICS_RAW = [
  { topicId: 'p1-ict-basics', topicName: 'ICT Fundamentals & Hardware', unitId: 'p1-ict', unitName: 'Information & Comm Tech', totalAttempted: 18, totalCorrect: 16, totalQuestions: 20, accuracy: 89, avgTimePerQuestion: 34, totalTimeSpentSec: 612 },
  { topicId: 'p1-teaching-methods', topicName: 'Teaching Methods & Learner-Centered Tech', unitId: 'p1-teaching', unitName: 'Teaching Aptitude', totalAttempted: 22, totalCorrect: 18, totalQuestions: 25, accuracy: 82, avgTimePerQuestion: 46, totalTimeSpentSec: 1012 },
  { topicId: 'p1-communication-basics', topicName: 'Communication Process & Classroom Dynamics', unitId: 'p1-communication', unitName: 'Communication', totalAttempted: 20, totalCorrect: 16, totalQuestions: 22, accuracy: 80, avgTimePerQuestion: 41, totalTimeSpentSec: 820 },
  { topicId: 'p1-higher-ed-structure', topicName: 'Post-Independence Higher Ed Bodies', unitId: 'p1-higher-ed', unitName: 'Higher Education System', totalAttempted: 19, totalCorrect: 15, totalQuestions: 22, accuracy: 79, avgTimePerQuestion: 44, totalTimeSpentSec: 836 },
  { topicId: 'p1-comprehension-passage', topicName: 'Reading Passage & Inference Analysis', unitId: 'p1-comprehension', unitName: 'Reading Comprehension', totalAttempted: 25, totalCorrect: 21, totalQuestions: 25, accuracy: 84, avgTimePerQuestion: 74, totalTimeSpentSec: 1850 },
  { topicId: 'p1-logical-arguments', topicName: 'Categorical Syllogisms & Venn Logic', unitId: 'p1-logical', unitName: 'Logical Reasoning', totalAttempted: 19, totalCorrect: 14, totalQuestions: 22, accuracy: 74, avgTimePerQuestion: 68, totalTimeSpentSec: 1292 },
  { topicId: 'p1-data-tables', topicName: 'Tabular & Percentage Data Interpretation', unitId: 'p1-data', unitName: 'Data Interpretation', totalAttempted: 25, totalCorrect: 18, totalQuestions: 25, accuracy: 72, avgTimePerQuestion: 82, totalTimeSpentSec: 2050 },
  { topicId: 'p1-research-ethics', topicName: 'Research Ethics & Thesis Citation Styles', unitId: 'p1-research', unitName: 'Research Aptitude', totalAttempted: 18, totalCorrect: 13, totalQuestions: 22, accuracy: 72, avgTimePerQuestion: 64, totalTimeSpentSec: 1152 },
  { topicId: 'p1-comm-barriers', topicName: 'Psychological & Semantic Barriers', unitId: 'p1-communication', unitName: 'Communication', totalAttempted: 15, totalCorrect: 9, totalQuestions: 18, accuracy: 60, avgTimePerQuestion: 48, totalTimeSpentSec: 720 },
  { topicId: 'p1-teaching-nature', topicName: 'Levels of Teaching (MLT, ULT, RLT)', unitId: 'p1-teaching', unitName: 'Teaching Aptitude', totalAttempted: 18, totalCorrect: 10, totalQuestions: 20, accuracy: 56, avgTimePerQuestion: 54, totalTimeSpentSec: 972 },
  { topicId: 'p1-maths-series', topicName: 'Letter & Number Series Patterns', unitId: 'p1-maths', unitName: 'Mathematical Reasoning', totalAttempted: 16, totalCorrect: 8, totalQuestions: 20, accuracy: 50, avgTimePerQuestion: 86, totalTimeSpentSec: 1376 },
  { topicId: 'p1-maths-ratios', topicName: 'Profit, Loss, Ratio & Speed-Time', unitId: 'p1-maths', unitName: 'Mathematical Reasoning', totalAttempted: 16, totalCorrect: 7, totalQuestions: 20, accuracy: 44, avgTimePerQuestion: 90, totalTimeSpentSec: 1440 },
  { topicId: 'p1-environment-issues', topicName: 'Air Quality, Ozone & COP Protocols', unitId: 'p1-environment', unitName: 'People, Dev & Environment', totalAttempted: 20, totalCorrect: 11, totalQuestions: 25, accuracy: 55, avgTimePerQuestion: 68, totalTimeSpentSec: 1360 },
  { topicId: 'p1-research-types', topicName: 'Qualitative vs Quantitative Methodologies', unitId: 'p1-research', unitName: 'Research Aptitude', totalAttempted: 20, totalCorrect: 10, totalQuestions: 23, accuracy: 50, avgTimePerQuestion: 72, totalTimeSpentSec: 1440 },
  { topicId: 'p1-logical-pramana', topicName: 'Indian Logic: Pramanas & Hetvabhasa', unitId: 'p1-logical', unitName: 'Logical Reasoning', totalAttempted: 17, totalCorrect: 9, totalQuestions: 23, accuracy: 53, avgTimePerQuestion: 78, totalTimeSpentSec: 1326 },
  { topicId: 'p1-higher-ed-ancient', topicName: 'Ancient Indian Universities (Takshashila/Nalanda)', unitId: 'p1-higher-ed', unitName: 'Higher Education System', totalAttempted: 15, totalCorrect: 8, totalQuestions: 18, accuracy: 53, avgTimePerQuestion: 62, totalTimeSpentSec: 930 },
];

function buildDemoData(): BenchmarkDemoData {
  const totalTime = DEMO_UNITS_DATA.reduce((acc, u) => acc + u.totalTimeSpentSec, 0);

  const topics: TopicAnalyticsItem[] = DEMO_TOPICS_RAW.map((t) => ({
    ...t,
    quadrant: classifyDiagnosticQuadrant(t.accuracy, t.avgTimePerQuestion),
  }));

  const units: UnitAnalyticsItem[] = DEMO_UNITS_DATA.map((u) => ({
    ...u,
    timeSharePercent: totalTime > 0 ? Math.round((u.totalTimeSpentSec / totalTime) * 100) : 0,
    topics: topics.filter((t) => t.unitId === u.unitId),
  }));

  const totalAttempted = units.reduce((acc, u) => acc + u.totalAttempted, 0);
  const totalCorrect = units.reduce((acc, u) => acc + u.totalCorrect, 0);

  return {
    units,
    topics,
    summary: {
      testsTaken: 7,
      overallAccuracy: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0,
      avgTimePerQuestion: totalAttempted > 0 ? Math.round(totalTime / totalAttempted) : 0,
      totalAttempted,
      totalCorrect,
      totalTimeSpentSec: totalTime,
    },
  };
}

export function useAnalyticsData() {
  const auth = useAuth();
  const uid = auth.user?.uid ?? '';
  const { name } = useNames();
  const [demoOverride, setDemoOverride] = useState<boolean | null>(null);

  const snapLoad = useLoad((b) => b.reads.snapshot(uid), [uid]);
  const resultsLoad = useLoad((b) => b.reads.results(uid), [uid]);

  const loading = snapLoad.loading || resultsLoad.loading;

  const data = useMemo(() => {
    const rawResults: ResultRow[] = resultsLoad.data ?? [];
    const snapshot = snapLoad.data;
    const hasLiveTests = rawResults.length > 0 || (snapshot?.testsTaken ?? 0) > 0;

    const useDemo = demoOverride ?? !hasLiveTests;

    if (useDemo) {
      const demo = buildDemoData();
      return {
        isSample: true,
        units: demo.units,
        topics: demo.topics,
        summary: demo.summary,
        testsCount: demo.summary.testsTaken,
      };
    }

    // Process live examSessions and results
    type UnitAccumulator = {
      correct: number;
      incorrect: number;
      total: number;
      timeMs: number;
    };

    const unitMap = new Map<string, UnitAccumulator>();
    const topicMap = new Map<string, { correct: number; incorrect: number; total: number; timeMs: number }>();

    for (const r of rawResults) {
      if (r.byUnit) {
        for (const [rawUId, bucketRaw] of Object.entries(r.byUnit)) {
          const b = bucketRaw as Bucket;
          const canonicalId = U_CODE_MAP[rawUId] ?? (rawUId.startsWith('p1-') ? rawUId : null);
          if (!canonicalId) continue;
          const existing = unitMap.get(canonicalId) ?? { correct: 0, incorrect: 0, total: 0, timeMs: 0 };
          existing.correct += b.correct ?? 0;
          existing.incorrect += b.incorrect ?? 0;
          existing.total += b.total ?? 0;
          existing.timeMs += b.timeMs ?? 0;
          unitMap.set(canonicalId, existing);
        }
      }

      if (r.byTopic) {
        for (const [tId, bucketRaw] of Object.entries(r.byTopic)) {
          const b = bucketRaw as Bucket;
          const existing = topicMap.get(tId) ?? { correct: 0, incorrect: 0, total: 0, timeMs: 0 };
          existing.correct += b.correct ?? 0;
          existing.incorrect += b.incorrect ?? 0;
          existing.total += b.total ?? 0;
          existing.timeMs += b.timeMs ?? 0;
          topicMap.set(tId, existing);
        }
      }
    }

    // Incorporate snapshot topics if some topics only exist there
    if (snapshot?.topics) {
      for (const [tId, snapTopic] of Object.entries(snapshot.topics)) {
        if (!topicMap.has(tId) && snapTopic.attempted > 0) {
          topicMap.set(tId, {
            correct: snapTopic.correct,
            incorrect: Math.max(0, snapTopic.attempted - snapTopic.correct),
            total: snapTopic.total || snapTopic.attempted,
            timeMs: snapTopic.timeMs,
          });
        }
      }
    }

    // Compute total time spent across all units
    let totalAllUnitsTimeSec = 0;
    for (const u of CANONICAL_PAPER_1_UNITS) {
      const acc = unitMap.get(u.id);
      if (acc) {
        totalAllUnitsTimeSec += Math.round(acc.timeMs / 1000);
      }
    }

    // Helper to find unitId from topicId
    const inferUnitIdFromTopic = (topicId: string): string => {
      for (const u of CANONICAL_PAPER_1_UNITS) {
        const prefix = u.id.replace('p1-', '');
        if (topicId.includes(prefix)) return u.id;
      }
      return 'p1-teaching';
    };

    // Format all topics
    const topics: TopicAnalyticsItem[] = Array.from(topicMap.entries())
      .map(([tId, acc]) => {
        const attempted = acc.correct + acc.incorrect;
        const accuracy = attempted > 0 ? Math.round((acc.correct / attempted) * 100) : 0;
        const timeSec = Math.round(acc.timeMs / 1000);
        const avgTimePerQuestion = attempted > 0 ? Math.round(timeSec / attempted) : 0;
        const assignedUnitId = inferUnitIdFromTopic(tId);
        const matchedUnit = CANONICAL_PAPER_1_UNITS.find((u) => u.id === assignedUnitId);

        return {
          topicId: tId,
          topicName: name(tId),
          unitId: assignedUnitId,
          unitName: matchedUnit?.name ?? 'General Paper 1',
          totalAttempted: attempted,
          totalCorrect: acc.correct,
          totalQuestions: acc.total,
          accuracy,
          avgTimePerQuestion,
          totalTimeSpentSec: timeSec,
          quadrant: classifyDiagnosticQuadrant(accuracy, avgTimePerQuestion),
        };
      })
      .filter((t) => t.totalAttempted > 0);

    // Format all 10 canonical Paper 1 units
    const units: UnitAnalyticsItem[] = CANONICAL_PAPER_1_UNITS.map((u) => {
      const acc = unitMap.get(u.id) ?? { correct: 0, incorrect: 0, total: 0, timeMs: 0 };
      const attempted = acc.correct + acc.incorrect;
      const accuracy = attempted > 0 ? Math.round((acc.correct / attempted) * 100) : 0;
      const timeSec = Math.round(acc.timeMs / 1000);
      const avgTimePerQuestion = attempted > 0 ? Math.round(timeSec / attempted) : 0;
      const timeSharePercent = totalAllUnitsTimeSec > 0 ? Math.round((timeSec / totalAllUnitsTimeSec) * 100) : 0;
      const unitTopics = topics.filter((t) => t.unitId === u.id);

      return {
        unitId: u.id,
        unitNo: u.unitNo,
        unitName: u.name,
        shortName: u.shortName,
        color: u.color,
        description: u.description,
        totalAttempted: attempted,
        totalCorrect: acc.correct,
        totalIncorrect: acc.incorrect,
        totalUnattempted: Math.max(0, acc.total - attempted),
        totalQuestions: acc.total,
        accuracy,
        avgTimePerQuestion,
        totalTimeSpentSec: timeSec,
        timeSharePercent,
        topics: unitTopics,
      };
    });

    const totalAttempted = units.reduce((acc, u) => acc + u.totalAttempted, 0);
    const totalCorrect = units.reduce((acc, u) => acc + u.totalCorrect, 0);

    return {
      isSample: false,
      units,
      topics,
      summary: {
        testsTaken: snapshot?.testsTaken ?? rawResults.length,
        overallAccuracy: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0,
        avgTimePerQuestion: totalAttempted > 0 ? Math.round(totalAllUnitsTimeSec / totalAttempted) : 0,
        totalAttempted,
        totalCorrect,
        totalTimeSpentSec: totalAllUnitsTimeSec,
      },
      testsCount: snapshot?.testsTaken ?? rawResults.length,
    };
  }, [resultsLoad.data, snapLoad.data, demoOverride, name]);

  const toggleSampleMode = () => {
    setDemoOverride((prev) => (prev === null ? !data.isSample : !prev));
  };

  return {
    loading,
    isSample: data.isSample,
    toggleSampleMode,
    units: data.units,
    topics: data.topics,
    summary: data.summary,
    testsCount: data.testsCount,
  };
}
