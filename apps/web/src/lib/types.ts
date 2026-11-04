import type { EndpointName, ENDPOINTS } from '@fn/endpoints';
import type { MockTestDoc, ResultDoc, SessionDoc, SnapshotDoc } from '@fn/domain/types';
import type { z } from 'zod';
import type { Blueprint, PlanTask } from '@ureducator/shared';

export type In<N extends EndpointName> = z.input<(typeof ENDPOINTS)[N]['input']>;
export type Out<N extends EndpointName> = Awaited<ReturnType<(typeof ENDPOINTS)[N]['run']>>;
export type { EndpointName };

export type AuthUser = { uid: string; email: string | null; displayName: string | null; emailVerified: boolean; role: string | null };
export type TestRow = MockTestDoc & { id: string };
export type SessionRow = Pick<SessionDoc, 'mockTestId' | 'testTitle' | 'status' | 'startedAtMs' | 'deadlineMs'> & { id: string; submittedAtMs?: number };
export type ResultRow = ResultDoc & { id: string };
export type ProfileDoc = { displayName: string; email: string | null; onboardingComplete: boolean; studyMinutesPerDay: number; preferredPaper2Subject: string | null; studyGoal: string | null; examTarget: string | null; createdAtMs: number };
export type PlanDoc = { id: string; name: string; pricePaise: number; durationDays: number; entitlements: string[]; published: boolean };
export type StudyPlanDoc = { tasks: PlanTask[]; generatedAtMs: number; basedOnTests: number };
export type SubscriptionDoc = { status: string; expiresAtMs: number; entitlements: string[]; planId?: string };
export type CatalogueData = {
  subjects: { id: string; paper: 'paper1' | 'paper2'; name: { en: string; hi?: string }; label: string; sourceRef?: string }[];
  units: { id: string; subjectId: string; name: { en: string; hi?: string }; order?: number }[];
  topics: { id: string; unitId: string; subjectId: string; name: { en: string; hi?: string }; order?: number }[];
};

export interface Reads {
  catalogue(): Promise<CatalogueData>;
  publishedTests(): Promise<TestRow[]>;
  publishedPlans(): Promise<PlanDoc[]>;
  blueprints(): Promise<Record<string, Blueprint>>;
  profile(uid: string): Promise<ProfileDoc | null>;
  attempts(uid: string): Promise<SessionRow[]>;
  results(uid: string): Promise<ResultRow[]>;
  snapshot(uid: string): Promise<SnapshotDoc | null>;
  studyPlan(uid: string): Promise<StudyPlanDoc | null>;
  subscription(uid: string): Promise<SubscriptionDoc | null>;
}
export interface AuthService {
  onChange(cb: (u: AuthUser | null) => void): () => void;
  signUp(email: string, password: string, name: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendReset(email: string): Promise<void>;
  resendVerification(): Promise<void>;
  /** Re-reads the account and forces a fresh ID token so email_verified and role claims are current. */
  refresh(): Promise<AuthUser | null>;
}
export interface Backend {
  kind: 'firebase' | 'mock';
  call<N extends EndpointName>(name: N, data: In<N>): Promise<Out<N>>;
  reads: Reads;
  auth: AuthService;
}

/** A failure from the server. `reason` is a stable machine code, `message` is safe to show to students. */
export class ApiError extends Error {
  constructor(public code: string, public reason: string, message: string, public correlationId?: string) { super(message); this.name = 'ApiError'; }
}
export const asApiError = (e: unknown): ApiError => e instanceof ApiError ? e : new ApiError('unknown', 'UNKNOWN', e instanceof Error && e.name === 'TypeError' ? 'Network problem. Check your connection and try again.' : 'Something went wrong. Please try again.');
export const isOffline = (e: unknown) => { const x = asApiError(e); return x.code === 'unavailable' || x.code === 'deadline-exceeded' || x.reason === 'NETWORK' || x.reason === 'UNKNOWN'; };
