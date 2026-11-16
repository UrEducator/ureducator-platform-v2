import { z } from 'zod';
import type { Blueprint, ExamResponse, Lang, SessionStatus, TopicAggregate } from '@ureducator/shared';

export type Clock = () => number;
export type Actor = { uid: string; emailVerified: boolean; role?: string | undefined; email?: string | undefined };

export const PilotCohortDocSchema = z.object({
  enabled: z.boolean().optional(),
  allowedEmails: z.array(z.string().email().max(254)).optional(),
  allowedUids: z.array(z.string().min(1).max(128).regex(/^[^/\\]+$/)).optional(),
  appliesTo: z.object({
    kinds: z.array(z.string()).optional(),
    mockTestIds: z.array(z.string().regex(/^[^/\\]+$/)).optional(),
  }).optional(),
}).passthrough();

export type PilotCohortDoc = z.infer<typeof PilotCohortDocSchema>;

export type PilotCohortMember = {
  active?: boolean;
  email?: string;
  uid?: string;
  addedAtMs?: number;
};

export type MockTestDoc = {
  title: string; kind: 'full' | 'paper1' | 'paper2' | 'unit' | 'topic' | 'pyq' | 'custom';
  setCode?: string;
  blueprintId: string; paperId: string; paperVersion: number;
  access: 'free' | 'paid'; collectionId?: string;
  status: 'draft' | 'review' | 'approved' | 'published';
  timed: boolean; shuffle: boolean;
  opensAtMs?: number; closesAtMs?: number;
  revealPolicy: 'immediate' | 'after_close';
  contentLabel: 'fully_verified' | 'under_development' | 'sample' | 'coming_soon';
  description?: string; version: number;
  transcriber?: string; verifier?: string;
};

export type SessionDoc = {
  uid: string; mockTestId: string; paperId: string; paperVersion: number; testTitle: string;
  blueprint: Blueprint; language: Lang;
  questionOrder: string[];
  /** compact per-question option ids ("abcd") and multi flag, so autosave never reads the full paper */
  qmeta: Record<string, { opts: string; multi: boolean }>;
  startedAtMs: number; deadlineMs: number; status: SessionStatus;
  lastSeq: number; lastSavedAtMs?: number; clientRequestId: string;
  submittedAtMs?: number; revealAvailableAtMs?: number;
  contentLabel?: string;
};

export type ResponsesDoc = { byQid: Record<string, ExamResponse> };

export type ResultDoc = {
  sessionId: string; uid: string; mockTestId: string; testTitle: string; submittedAtMs: number;
  reason: 'manual' | 'deadline' | 'expired';
  marks: number; maxMarks: number; correct: number; incorrect: number; unattempted: number; attempted: number;
  accuracy: number; attemptRate: number; percentage: number; durationMs: number; timeSpentMs: number;
  bySection: Record<string, unknown>; byUnit: Record<string, unknown>; byTopic: Record<string, unknown>; byDifficulty: Record<string, unknown>;
  revealAvailableAtMs: number; contentLabel: string;
};

export type SnapshotDoc = { topics: Record<string, TopicAggregate>; recentScores: { sessionId: string; percentage: number; atMs: number }[]; activeDays: string[]; testsTaken: number; updatedAtMs: number };
