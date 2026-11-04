import type { Lang } from './constants';
export type LocalizedText = { en: string; hi?: string };
export function pickText(t: LocalizedText, lang: Lang): string {
  if (lang === 'hi' && t.hi && t.hi.trim().length > 0) return t.hi;
  return t.en;
}
