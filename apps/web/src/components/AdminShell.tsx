'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { can, type Permission, type Role } from '@ureducator/shared';
import { Logo } from '@/components/brand';
import { StagingBanner } from '@/components/SiteChrome';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

const NAV: { href: string; label: string; any: Permission[] }[] = [
  { href: '/admin', label: 'Overview', any: [] },
  { href: '/admin/catalogue', label: 'Catalogue', any: ['catalogue.write'] },
  { href: '/admin/questions', label: 'Questions', any: ['questions.write', 'questions.review'] },
  { href: '/admin/tests', label: 'Mock tests', any: ['tests.write', 'tests.publish'] },
  { href: '/admin/blueprints', label: 'Blueprints', any: ['tests.write'] },
  { href: '/admin/people', label: 'People and roles', any: ['students.read', 'roles.assign'] },
  { href: '/admin/leads', label: 'Leads', any: ['leads.read'] },
  { href: '/admin/support', label: 'Support', any: ['support.read'] },
  { href: '/admin/pricing', label: 'Pricing', any: ['pricing.write', 'payments.read'] },
  { href: '/admin/audit', label: 'Audit log', any: ['audit.read'] },
];
export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  super_admin: 'Super administrator',
  admin: 'Administrator',
  content_editor: 'Content editor',
  subject_reviewer: 'Subject reviewer',
  support_agent: 'Support agent',
  analyst: 'Analyst',
};
export const useRole = () => (useAuth().user?.role ?? null) as Role | null;
export const useCan = () => {
  const r = useRole();
  return (p: Permission) => can(r, p);
};

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const role = useRole();
  const items = NAV.filter((n) => n.any.length === 0 || n.any.some((p) => can(role, p)));

  return (
    <div className="min-h-screen transition-colors">
      <header className="no-print border-b border-line bg-[#121722] text-white">
        <StagingBanner />
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo tone="light" />
            <span className="rounded-full border border-white/30 px-2.5 py-0.5 text-xs font-semibold">Content studio</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <span className="hidden sm:inline text-white/80">
              {user?.displayName ?? user?.email} · {role ? ROLE_LABEL[role] : ''}
            </span>
            <ThemeToggle size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" />
            <Link href="/app" className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 font-semibold hover:bg-white/10 text-white">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Student view
            </Link>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 font-semibold hover:bg-white/10 text-white cursor-pointer"
              onClick={() => void signOut().then(() => router.replace('/'))}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {items.map((n) => {
            const on = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-control px-3 py-2 text-[15px] font-medium transition-colors',
                  on ? 'bg-pen-surface text-pen-surface-ink font-semibold' : 'text-ink hover:bg-surface-hover'
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div id="main" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </div>
      </div>
    </div>
  );
}
