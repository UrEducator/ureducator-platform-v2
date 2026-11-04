'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ---------------------------------------------------------------- buttons */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'marker';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-pen-700 text-white hover:bg-pen-900 border-pen-700',
  secondary: 'bg-surface text-ink hover:bg-pen-50 border-line-strong',
  ghost: 'bg-transparent text-pen-700 hover:bg-pen-50 border-transparent',
  danger: 'bg-bad text-white hover:bg-[#82220f] border-bad',
  marker: 'bg-marker text-ink hover:brightness-95 border-[#c9a21f]',
};
const SIZE = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-12 px-6 text-base' };
const base = 'inline-flex items-center justify-center gap-2 rounded-control border font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none select-none';

export function Button({ variant = 'primary', size = 'md', busy, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZE; busy?: boolean }) {
  return (
    <button {...p} disabled={p.disabled || busy} aria-busy={busy || undefined} className={cn(base, VARIANT[variant], SIZE[size], className)}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}{children}
    </button>
  );
}
export function LinkButton({ href, variant = 'primary', size = 'md', className, children, ...p }: { href: string; variant?: Variant; size?: keyof typeof SIZE; className?: string; children: ReactNode } & Omit<React.ComponentProps<typeof Link>, 'href'>) {
  return <Link href={href} {...p} className={cn(base, VARIANT[variant], SIZE[size], className)}>{children}</Link>;
}

/* ---------------------------------------------------------------- form fields */
const control = 'w-full rounded-control border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted/70 focus-visible:border-pen-500';
export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string | undefined; children: (id: string, describedBy: string | undefined) => ReactNode; htmlFor?: string }) {
  const gen = useId(); const id = htmlFor ?? gen; const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      {children(id, desc)}
      {error ? <p id={`${id}-err`} role="alert" className="text-sm text-bad">{error}</p> : hint ? <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
export function Input({ label, hint, error, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | undefined }) {
  return <Field label={label} hint={hint} error={error} htmlFor={p.id}>{(id, d) => <input {...p} id={id} aria-describedby={d} aria-invalid={!!error || undefined} className={cn(control, 'h-11', error && 'border-bad', className)} />}</Field>;
}
export function Textarea({ label, hint, error, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string | undefined }) {
  return <Field label={label} hint={hint} error={error} htmlFor={p.id}>{(id, d) => <textarea {...p} id={id} aria-describedby={d} aria-invalid={!!error || undefined} className={cn(control, 'min-h-28 py-2.5', error && 'border-bad', className)} />}</Field>;
}
export function Select({ label, hint, error, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string | undefined }) {
  return <Field label={label} hint={hint} error={error} htmlFor={p.id}>{(id, d) => <select {...p} id={id} aria-describedby={d} className={cn(control, 'h-11', className)}>{children}</select>}</Field>;
}
export function Check({ label, error, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string | undefined }) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="flex items-start gap-3 text-sm leading-snug"><input {...p} id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-pen-700" /><span>{label}</span></label>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- surfaces */
/** A ruled sheet: the border carries structure, so there are no drop shadows. */
export function Sheet({ className, children, as: As = 'section', ...p }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' } & React.HTMLAttributes<HTMLElement>) {
  return <As {...p} className={cn('rounded-sheet border border-line bg-surface', className)}>{children}</As>;
}
export function PageHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl"><h1 className="text-3xl sm:text-4xl">{title}</h1>{intro && <p className="mt-2 text-muted">{intro}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
export function Alert({ tone = 'info', title, children, className }: { tone?: 'info' | 'warn' | 'error' | 'ok'; title?: string; children?: ReactNode; className?: string }) {
  const t = { info: 'bg-info-soft border-[#9cc3ec]', warn: 'bg-marker-soft border-[#d9b640]', error: 'bg-bad-soft border-[#e3a79d]', ok: 'bg-ok-soft border-[#8ccaae]' }[tone];
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-sheet border px-4 py-3 text-sm', t, className)}>{title && <p className="font-semibold">{title}</p>}{children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}</div>;
}
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div role="status" className="flex items-center gap-2 py-10 text-muted"><Loader2 className="size-5 animate-spin" aria-hidden /><span>{label}…</span></div>;
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="rounded-sheet border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center"><p className="text-lg font-semibold">{title}</p>{children && <p className="mx-auto mt-1 max-w-md text-muted">{children}</p>}{action && <div className="mt-4 flex justify-center">{action}</div>}</div>;
}
export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'review' | 'pen'; children: ReactNode }) {
  const t = { neutral: 'bg-paper text-muted border-line-strong', ok: 'bg-ok-soft text-ok border-[#8ccaae]', warn: 'bg-marker-soft text-[#6d5200] border-[#d9b640]', bad: 'bg-bad-soft text-bad border-[#e3a79d]', review: 'bg-review-soft text-review border-[#c9b0e6]', pen: 'bg-pen-50 text-pen-700 border-pen-200' }[tone];
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', t)}>{children}</span>;
}
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return <div className="border-l-2 border-pen-200 pl-4"><dt className="text-sm text-muted">{label}</dt><dd className="mt-0.5 text-3xl font-semibold tabular-nums">{value}</dd>{note && <p className="mt-0.5 text-xs text-muted">{note}</p>}</div>;
}

/* ---------------------------------------------------------------- dialog (native <dialog>: focus trap and Esc come for free) */
export function Dialog({ open, onClose, title, children, footer, tone }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; tone?: 'danger' }) {
  const ref = useRef<HTMLDialogElement>(null); const tid = useId();
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={tid} onClose={onClose} onCancel={onClose} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-sheet border border-line-strong bg-surface p-0 text-ink backdrop:bg-ink/50">
      <div className="p-6"><h2 id={tid} className={cn('text-xl', tone === 'danger' && 'text-bad')}>{title}</h2><div className="mt-3 text-[15px]">{children}</div></div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper px-6 py-3">{footer}</div>}
    </dialog>
  );
}

/* ---------------------------------------------------------------- table */
export function Table({ head, children, caption }: { head: string[]; children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-sheet border border-line bg-surface">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-paper text-muted"><tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn('px-4 py-3 align-top', className)}>{children}</td>;
