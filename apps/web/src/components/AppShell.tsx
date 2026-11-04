'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { LogOut, Settings, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand';
import { StagingBanner } from '@/components/SiteChrome';
import { STAFF_ROLES, useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/app', label: 'Dashboard' }, { href: '/app/tests', label: 'Mock tests' }, { href: '/app/history', label: 'History' },
  { href: '/app/analytics', label: 'Analytics' }, { href: '/app/notebook', label: 'Error notebook' }, { href: '/app/planner', label: 'Planner' }, { href: '/app/mentor', label: 'Study mentor' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth(); const path = usePathname(); const router = useRouter();
  const isStaff = !!user?.role && STAFF_ROLES.includes(user.role);
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-line bg-surface">
        <StagingBanner />
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1">
            {isStaff && <Link href="/admin" className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-pen-700 hover:bg-pen-50"><ShieldCheck className="size-4" aria-hidden />Admin</Link>}
            <Link href="/app/settings" className="grid size-9 place-items-center rounded-control hover:bg-pen-50" aria-label="Account settings"><Settings className="size-5" /></Link>
            <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-pen-50" onClick={() => void signOut().then(() => router.replace('/'))}><LogOut className="size-4" aria-hidden />Sign out</button>
          </div>
        </div>
        <nav aria-label="Student" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {NAV.map((n) => { const on = n.href === '/app' ? path === '/app' : path.startsWith(n.href); return <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined} className={cn('whitespace-nowrap border-b-2 px-3 py-2.5 text-[15px] font-medium', on ? 'border-pen-700 text-pen-900' : 'border-transparent text-muted hover:text-ink')}>{n.label}</Link>; })}
        </nav>
      </header>
      <div id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none sm:px-6">{children}</div>
    </div>
  );
}
