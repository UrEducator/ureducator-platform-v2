import { cn } from '@/lib/cn';

/** Horizontal bar with a text value beside it, so meaning never depends on colour alone. */
export function Meter({ value, tone = 'auto', label }: { value: number; tone?: 'auto' | 'pen'; label: string }) {
  const v = Math.max(0, Math.min(1, value)); const colour = tone === 'pen' ? 'bg-pen-600' : v >= 0.75 ? 'bg-ok' : v >= 0.5 ? 'bg-pen-600' : 'bg-bad';
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`${label}: ${Math.round(v * 100)} percent`}>
      <div className="h-2.5 w-full min-w-16 overflow-hidden rounded-full bg-pen-100"><div className={cn('h-full rounded-full', colour)} style={{ width: `${v * 100}%` }} /></div>
      <span className="w-10 shrink-0 text-right text-sm tabular-nums">{Math.round(v * 100)}%</span>
    </div>
  );
}

/** Score history. Values are 0..1. Labelled axes and a visible list of points keep it readable without colour or a pointer. */
export function ScoreLine({ points }: { points: { label: string; value: number }[] }) {
  if (points.length === 0) return null;
  const W = 560, H = 180, L = 36, R = 12, T = 12, B = 28; const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw); const y = (v: number) => T + (1 - Math.max(0, Math.min(1, v))) * ih;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Score trend over ${points.length} tests, latest ${Math.round((points.at(-1)?.value ?? 0) * 100)} percent`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--color-line)" strokeWidth="1" /><text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">{Math.round(g * 100)}%</text></g>)}
        <path d={d} fill="none" stroke="var(--color-pen-600)" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => <g key={i}><circle cx={x(i)} cy={y(p.value)} r="5" fill="var(--color-surface)" stroke="var(--color-pen-700)" strokeWidth="2.5" /><text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">{points.length > 8 && i % 2 ? '' : p.label}</text></g>)}
      </svg>
    </figure>
  );
}
