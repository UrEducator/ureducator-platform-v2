export const ROLES = [
  'owner', 'super_admin', 'admin', 'content_editor', 'subject_reviewer', 'support_agent', 'analyst',
] as const;
export type Role = (typeof ROLES)[number];

export const PUBLICATION_STATUSES = ['draft', 'review', 'approved', 'published'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/** Public labels required by the product brief. Nothing is "fully_verified" until a human verifies it against official documents. */
export const CONTENT_LABELS = ['fully_verified', 'under_development', 'sample', 'coming_soon'] as const;
export type ContentLabel = (typeof CONTENT_LABELS)[number];

export const QUESTION_TYPES = [
  'mcq_single', 'mcq_multi', 'assertion_reason', 'match_following', 'statement_based', 'comprehension', 'image_based',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const LANGS = ['en', 'hi'] as const;
export type Lang = (typeof LANGS)[number];

export const PALETTE_STATUSES = ['not_visited', 'not_answered', 'answered', 'marked', 'answered_marked'] as const;
export type PaletteStatus = (typeof PALETTE_STATUSES)[number];

export const PROVENANCE = ['original', 'synthetic_demo', 'licensed', 'official_pyq'] as const;
export type Provenance = (typeof PROVENANCE)[number];

export const SESSION_STATUSES = ['in_progress', 'submitted', 'auto_submitted', 'expired_finalised'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const LIMITS = {
  maxQuestionsPerPaper: 200,
  maxOptions: 6,
  maxTextLength: 4000,
  maxResponsesPerSave: 200,
  maxPaperDocBytes: 800_000,
  autosaveGraceMs: 30_000,
  maxSessionsPerHourPerUser: 6,
} as const;

export const DISCLAIMERS = {
  report: 'Practice Examination Performance Report — Not an Official NTA Scorecard.',
  notNta: 'UrEducator is an independent preparation platform. It is not affiliated with or endorsed by the National Testing Agency (NTA) or the UGC.',
  syntheticQuestions: 'Demonstration question written for UrEducator. Not a previous-year question.',
} as const;
