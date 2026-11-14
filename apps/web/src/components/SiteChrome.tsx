'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { DISCLAIMERS } from '@ureducator/shared';
import { Logo } from '@/components/brand';
import { LinkButton } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';
import { ENV } from '@/lib/env';

export function StagingBanner() {
  if (!ENV.isStaging) return null;
  return (
    <div className="bg-marker px-4 py-1.5 text-center text-sm font-medium text-ink" role="note">
      {ENV.appEnv === 'local-test' ? 'Local test build.' : 'Staging preview.'} Practice content only. Search engines are told not to index this site. Payments are switched off.
    </div>
  );
}

const NAV = [
  { href: '/syllabus', label: 'Syllabus' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="no-print border-b border-line bg-surface transition-colors">
      <StagingBanner />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-control px-3 py-2 text-[15px] font-medium text-ink hover:bg-surface-hover transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2.5 md:flex">
          <ThemeToggle />
          {status === 'in' ? (
            <LinkButton href="/app" size="sm">
              Open dashboard
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/signup" size="sm">
                Start practising
              </LinkButton>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle size="sm" />
          <button
            type="button"
            className="grid size-10 place-items-center rounded-control border border-line-strong hover:bg-surface-hover text-ink"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="grid gap-1 border-t border-line px-4 py-3 bg-surface md:hidden transition-all duration-150">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="rounded-control px-3 py-3 font-medium text-ink hover:bg-surface-hover"
            >
              {n.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2 pt-2 border-t border-line">
            {status === 'in' ? (
              <LinkButton href="/app" className="flex-1">
                Open dashboard
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="secondary" className="flex-1">
                  Sign in
                </LinkButton>
                <LinkButton href="/signup" className="flex-1">
                  Start practising
                </LinkButton>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-line bg-surface transition-colors">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-muted">{DISCLAIMERS.notNta}</p>
        </div>
        <nav aria-label="Product" className="grid content-start gap-2 text-sm">
          <p className="font-semibold text-ink">Product</p>
          <Link href="/syllabus" className="text-muted hover:text-ink transition-colors">
            Syllabus and content status
          </Link>
          <Link href="/pricing" className="text-muted hover:text-ink transition-colors">
            Pricing
          </Link>
          <Link href="/verify-report" className="text-muted hover:text-ink transition-colors">
            Verify a report
          </Link>
          <Link href="/contact" className="text-muted hover:text-ink transition-colors">
            Contact
          </Link>
        </nav>
        <nav aria-label="Legal" className="grid content-start gap-2 text-sm">
          <p className="font-semibold text-ink">Legal</p>
          <Link href="/privacy" className="text-muted hover:text-ink transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="text-muted hover:text-ink transition-colors">
            Terms
          </Link>
          <Link href="/disclaimer" className="text-muted hover:text-ink transition-colors">
            Disclaimer
          </Link>
        </nav>
      </div>
    </footer>
  );
}
