import Link from 'next/link';
import { LABEL_TEXT, type ContentLabel } from '@ureducator/shared';
import { Pill } from '@/components/ui';
import { cn } from '@/lib/cn';

/** The mark is one answer bubble, half shaded: a question answered with a pencil. */
export function Logo({ className, tone = 'ink' }: { className?: string; tone?: 'ink' | 'light' }) {
  return (
    <Link href="/" className={cn('inline-flex items-center gap-2.5 font-semibold tracking-tight', tone === 'light' ? 'text-white' : 'text-pen-900', className)} aria-label="UrEducator home">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="11.5" fill="none" stroke="currentColor" strokeWidth="2.5" /><path d="M14 2.5a11.5 11.5 0 0 1 0 23z" fill="#ffd23f" stroke="currentColor" strokeWidth="2.5" /></svg>
      <span className="text-[1.3rem]">UrEducator</span>
    </Link>
  );
}

export function ContentLabelPill({ label }: { label: string }) {
  const tone = label === 'fully_verified' ? 'ok' : label === 'under_development' ? 'warn' : label === 'sample' ? 'review' : 'neutral';
  return <Pill tone={tone}>{LABEL_TEXT[label as ContentLabel] ?? label}</Pill>;
}

export type PaletteState = 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'answered_marked';
export const PALETTE_TEXT: Record<PaletteState, string> = { not_visited: 'Not visited', not_answered: 'Not answered', answered: 'Answered', marked: 'Marked for review', answered_marked: 'Answered and marked for review' };
export function Bubble({ n, state, current, onClick, size = 'md', label }: { n: number; state: PaletteState; current?: boolean; onClick?: () => void; size?: 'sm' | 'md'; label?: string }) {
  const glyph = state === 'answered' ? '✓' : state === 'marked' ? '⚑' : state === 'answered_marked' ? '⚑' : null;
  const cls = cn('bubble', size === 'sm' && '!size-7 !text-xs');
  const inner = <>{n}{glyph && <span className="glyph" aria-hidden="true">{glyph}</span>}</>;
  const aria = label ?? `Question ${n}: ${PALETTE_TEXT[state]}${current ? ' (current)' : ''}`;
  return onClick
    ? <button type="button" className={cls} data-state={state} aria-current={current || undefined} aria-label={aria} onClick={onClick}>{inner}</button>
    : <span className={cls} data-state={state} aria-label={aria} role="img">{inner}</span>;
}
export function PaletteLegend({ counts }: { counts?: Partial<Record<PaletteState, number>> }) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
      {(Object.keys(PALETTE_TEXT) as PaletteState[]).map((k) => (
        <li key={k} className="flex items-center gap-2"><Bubble n={counts?.[k] ?? 0} state={k} size="sm" label={`${PALETTE_TEXT[k]}${counts ? `: ${counts[k] ?? 0}` : ''}`} /><span>{PALETTE_TEXT[k]}</span></li>
      ))}
    </ul>
  );
}
