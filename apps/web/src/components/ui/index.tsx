'use client';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ---------------------------------------------------------------- buttons */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'marker';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-pen-surface text-pen-surface-ink hover:bg-pen-surface-hover border-pen-surface shadow-sm hover:shadow active:bg-pen-surface-hover',
  secondary: 'bg-surface text-ink hover:bg-surface-hover border-line-strong hover:border-pen-500 shadow-sm',
  ghost: 'bg-transparent text-pen-700 hover:bg-pen-50 border-transparent',
  danger: 'bg-bad text-white hover:brightness-90 border-bad shadow-sm',
  marker: 'bg-marker text-ink hover:brightness-95 border-[#c9a21f] shadow-sm font-semibold',
};
const SIZE = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-12 px-6 text-base' };
const base =
  'inline-flex items-center justify-center gap-2 rounded-control border font-semibold transition-all duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98] cursor-pointer';

export function Button({
  variant = 'primary',
  size = 'md',
  busy,
  className,
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZE; busy?: boolean }) {
  return (
    <button {...p} disabled={p.disabled || busy} aria-busy={busy || undefined} className={cn(base, VARIANT[variant], SIZE[size], className)}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...p
}: { href: string; variant?: Variant; size?: keyof typeof SIZE; className?: string; children: ReactNode } & Omit<
  React.ComponentProps<typeof Link>,
  'href'
>) {
  return (
    <Link href={href} {...p} className={cn(base, VARIANT[variant], SIZE[size], className)}>
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------- form fields */
const control =
  'w-full rounded-control border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus-visible:border-pen-500 focus-visible:ring-1 focus-visible:ring-pen-500';

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  htmlFor?: string;
}) {
  const gen = useId();
  const id = htmlFor ?? gen;
  const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children(id, desc)}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-sm font-medium text-bad transition-opacity duration-150">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  className,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | undefined }) {
  return (
    <Field label={label} hint={hint} error={error} htmlFor={p.id}>
      {(id, d) => <input {...p} id={id} aria-describedby={d} className={cn(control, 'h-11', className)} />}
    </Field>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className,
  rows = 4,
  ...p
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string | undefined }) {
  return (
    <Field label={label} hint={hint} error={error} htmlFor={p.id}>
      {(id, d) => <textarea {...p} id={id} rows={rows} aria-describedby={d} className={cn(control, 'py-2.5', className)} />}
    </Field>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  children,
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string | undefined }) {
  return (
    <Field label={label} hint={hint} error={error} htmlFor={p.id}>
      {(id, d) => (
        <select {...p} id={id} aria-describedby={d} className={cn(control, 'h-11', className)}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Check({ label, error, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string | undefined }) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
        <input {...p} id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-pen-700" />
        <span>{label}</span>
      </label>
      {error && <p role="alert" className="text-sm font-medium text-bad">{error}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- surfaces */
/** A ruled sheet: border-structured surface. */
export function Sheet({
  className,
  children,
  as: As = 'section',
  ...p
}: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' } & HTMLAttributes<HTMLElement>) {
  return (
    <As {...p} className={cn('rounded-sheet border border-line bg-surface transition-colors', className)}>
      {children}
    </As>
  );
}

export function PageHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {intro && <p className="mt-2 text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warn' | 'error' | 'ok';
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const t = {
    info: 'border-pen-200 bg-info-soft text-ink',
    warn: 'border-[#d9b640] bg-marker-soft text-ink',
    error: 'border-[#e3a79d] bg-bad-soft text-bad',
    ok: 'border-[#8ccaae] bg-ok-soft text-ok',
  }[tone];
  return (
    <div role="status" className={cn('rounded-sheet border p-4 text-[15px]', t, className)}>
      {title && <h2 className="mb-1 font-semibold">{title}</h2>}
      <div>{children}</div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-sheet border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'review' | 'pen';
  children: ReactNode;
  className?: string;
}) {
  const t = {
    neutral: 'bg-paper text-muted border-line-strong',
    ok: 'bg-ok-soft text-ok border-[#8ccaae]',
    warn: 'bg-marker-soft text-ink border-[#d9b640]',
    bad: 'bg-bad-soft text-bad border-[#e3a79d]',
    review: 'bg-review-soft text-review border-[#c9b0e6]',
    pen: 'bg-pen-50 text-pen-700 border-pen-200',
  }[tone];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none', t, className)}>
      {children}
    </span>
  );
}

export function Badge({
  variant = 'default',
  children,
  className,
}: {
  variant?: 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'accent';
  children: ReactNode;
  className?: string;
}) {
  const v = {
    default: 'bg-pen-50 text-pen-700 border-pen-200',
    outline: 'bg-transparent text-ink border-line-strong',
    success: 'bg-ok-soft text-ok border-[#8ccaae]',
    warning: 'bg-marker-soft text-ink border-[#d9b640]',
    danger: 'bg-bad-soft text-bad border-[#e3a79d]',
    accent: 'bg-marker text-ink border-[#c9a21f]',
  }[variant];
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', v, className)}>
      {children}
    </span>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="border-l-2 border-pen-200 pl-4 transition-colors">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 text-3xl font-semibold tabular-nums text-ink">{value}</dd>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- dialog */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  tone,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  tone?: 'danger';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tid = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tid}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-sheet border border-line-strong bg-surface p-0 text-ink shadow-xl backdrop:bg-black/60 backdrop:backdrop-blur-xs transition-transform duration-150"
    >
      <div className="p-6">
        <h2 id={tid} className={cn('text-xl font-semibold', tone === 'danger' && 'text-bad')}>
          {title}
        </h2>
        <div className="mt-3 text-[15px]">{children}</div>
      </div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper px-6 py-3">{footer}</div>}
    </dialog>
  );
}

/* ---------------------------------------------------------------- slide-out drawer / bottom sheet (native dialog focus trap) */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'bottom',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'right' | 'bottom';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tid = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    const handleBackdrop = (e: MouseEvent) => {
      if (e.target === d) onClose();
    };
    d.addEventListener('click', handleBackdrop);
    return () => d.removeEventListener('click', handleBackdrop);
  }, [open, onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tid}
      onClose={onClose}
      onCancel={onClose}
      className={cn(
        'm-0 p-0 bg-transparent text-ink border-0 max-w-none max-h-none backdrop:bg-black/60 backdrop:backdrop-blur-xs',
        side === 'right'
          ? 'fixed inset-y-0 right-0 h-full w-full max-w-md ml-auto'
          : 'fixed inset-x-0 bottom-0 top-auto w-full max-h-[85vh] mt-auto'
      )}
    >
      <div
        className={cn(
          'flex flex-col bg-surface border-line shadow-2xl text-ink transition-transform duration-200 ease-out',
          side === 'right'
            ? 'h-full w-full border-l'
            : 'w-full max-h-[85vh] rounded-t-2xl border-t'
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={tid} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control p-1.5 text-muted hover:bg-surface-hover hover:text-ink focus-visible:outline-pen-500 cursor-pointer"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-5">{children}</div>

        {footer && <div className="border-t border-line bg-paper px-5 py-3">{footer}</div>}
      </div>
    </dialog>
  );
}

/* ---------------------------------------------------------------- table */
export function Table({ head, children, caption }: { head: string[]; children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-sheet border border-line bg-surface shadow-xs">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-paper text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn('px-4 py-3 align-top', className)}>{children}</td>
);

/* ---------------------------------------------------------------- utilities */
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-muted" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
