import { z } from 'zod';
import { LANGS } from './constants';

export const MarkingSchema = z.object({
  correct: z.number().min(0).max(100),
  incorrect: z.number().min(-100).max(0),
  unattempted: z.number().min(-100).max(0).default(0),
  multiCorrectPolicy: z.enum(['all_or_nothing', 'partial_no_wrong']).default('all_or_nothing'),
});
export type Marking = z.infer<typeof MarkingSchema>;

export const SectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{2,40}$/),
  title: z.object({ en: z.string().min(1).max(120), hi: z.string().max(120).optional() }),
  paper: z.enum(['paper1', 'paper2']),
  questionCount: z.number().int().min(1).max(200),
});

export const BlueprintSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{2,60}$/),
  name: z.string().min(1).max(120),
  version: z.number().int().min(1),
  durationMinutes: z.number().int().min(1).max(600),
  sections: z.array(SectionSchema).min(1).max(8),
  marking: MarkingSchema,
  languages: z.array(z.enum(LANGS)).min(1),
  officialPatternVerified: z.boolean().default(false),
}).superRefine((bp, ctx) => {
  const ids = new Set<string>();
  for (const s of bp.sections) {
    if (ids.has(s.id)) ctx.addIssue({ code: 'custom', message: `duplicate section id ${s.id}` });
    ids.add(s.id);
  }
});
export type Blueprint = z.infer<typeof BlueprintSchema>;

export function totalQuestions(bp: Blueprint): number {
  return bp.sections.reduce((n, s) => n + s.questionCount, 0);
}
export function maxMarks(bp: Blueprint): number {
  return totalQuestions(bp) * bp.marking.correct;
}

/**
 * Initial configurable practice blueprint from the product requirements.
 * It is NOT labelled as the exact current NTA pattern until verified against official documents.
 */
export const DEFAULT_BLUEPRINT: Blueprint = BlueprintSchema.parse({
  id: 'ugcnet-practice-full-v1',
  name: 'UGC-NET style full-length practice (configurable)',
  version: 1,
  durationMinutes: 180,
  sections: [
    { id: 'paper1', title: { en: 'Paper I — Teaching & Research Aptitude' }, paper: 'paper1', questionCount: 50 },
    { id: 'paper2', title: { en: 'Paper II — Subject' }, paper: 'paper2', questionCount: 100 },
  ],
  marking: { correct: 2, incorrect: 0, unattempted: 0, multiCorrectPolicy: 'all_or_nothing' },
  languages: ['en', 'hi'],
  officialPatternVerified: false,
});
