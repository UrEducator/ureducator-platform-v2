'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  BookMarked,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/brand';
import { StagingBanner } from '@/components/SiteChrome';
import { ThemeToggle } from '@/components/ThemeToggle';
import { STAFF_ROLES, useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { StudentSupportModal, SupportFab } from '@/components/StudentSupportModal';
import { NotificationHub } from '@/components/NotificationHub';

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/tests', label: 'Mock tests', icon: ClipboardList },
  { href: '/app/history', label: 'History', icon: History },
  { href: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/app/notebook', label: 'Error notebook', icon: BookMarked },
  { href: '/app/planner', label: 'Planner', icon: Calendar },
  { href: '/app/mentor', label: 'Study mentor', icon: Sparkles },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const isStaff = !!user?.role && STAFF_ROLES.includes(user.role);

  const [collapsed, setCollapsed] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ureducator:student-sidebar-collapsed');
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch {
      // ignore storage access issues
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ureducator:student-sidebar-collapsed', String(next));
      } catch {
        // ignore storage access issues
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen transition-colors">
      <header className="no-print border-b border-line bg-surface transition-colors print:hidden">
        <StagingBanner />
        <div className="w-full flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-1.5">
            {isStaff && (
              <Link
                href="/admin"
                className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-pen-700 hover:bg-surface-hover"
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                Admin
              </Link>
            )}
            <ThemeToggle size="sm" />
            <NotificationHub />
            <Link
              href="/app/settings"
              className="grid size-9 place-items-center rounded-control hover:bg-surface-hover text-ink"
              aria-label="Account settings"
            >
              <Settings className="size-5" />
            </Link>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-surface-hover text-ink cursor-pointer"
              onClick={() => void signOut().then(() => router.replace('/'))}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'w-full grid gap-6 px-4 py-6 sm:px-6 lg:px-8 transition-[grid-template-columns] duration-200 print:block print:p-0 print:m-0',
          collapsed ? 'lg:grid-cols-[4.5rem_1fr]' : 'lg:grid-cols-[14rem_1fr]'
        )}
      >
        <aside className="no-print relative flex flex-col print:hidden">
          {/* Collapse/Expand Toggle Header on desktop */}
          <div className={cn('hidden lg:flex items-center mb-3', collapsed ? 'justify-center' : 'justify-between px-1')}>
            {!collapsed && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Navigation</span>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="inline-flex size-7 items-center justify-center rounded-control border border-line text-muted hover:text-ink hover:bg-surface-hover cursor-pointer transition-colors shadow-2xs"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav
            aria-label="Student"
            className="flex gap-1 overflow-x-auto pb-2 border-b border-line lg:border-b-0 lg:pb-0 lg:flex-col lg:overflow-visible scrollbar-none"
          >
            {NAV.map((n) => {
              const on = n.href === '/app' ? path === '/app' : path.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  title={n.label}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-control text-[15px] font-medium transition-colors whitespace-nowrap',
                    collapsed ? 'lg:justify-center lg:px-2 lg:py-2.5 px-3 py-2' : 'px-3 py-2',
                    on
                      ? 'bg-pen-surface text-pen-surface-ink font-semibold'
                      : 'text-ink hover:bg-surface-hover'
                  )}
                >
                  <Icon
                    className={cn('size-4 shrink-0', on ? 'text-pen-700' : 'text-muted group-hover:text-ink')}
                    aria-hidden="true"
                  />
                  <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{n.label}</span>
                  {/* Floating tooltip on hover when collapsed */}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg group-hover:block z-50 whitespace-nowrap">
                      {n.label}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Help / Support Link */}
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              title="Help & Support"
              className={cn(
                'group relative flex items-center gap-2.5 rounded-control text-[15px] font-medium transition-colors text-ink hover:bg-surface-hover w-full text-left cursor-pointer mt-1 pt-2 border-t border-line/60',
                collapsed ? 'lg:justify-center lg:px-2 lg:py-2.5 px-3 py-2' : 'px-3 py-2'
              )}
            >
              <LifeBuoy
                className="size-4 shrink-0 text-pen-700"
                aria-hidden="true"
              />
              <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>Help & Support</span>
              {collapsed && (
                <span className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg group-hover:block z-50 whitespace-nowrap">
                  Help & Support
                </span>
              )}
            </button>
          </nav>
        </aside>

        <div id="main" tabIndex={-1} className="min-w-0 outline-none print:p-0 print:m-0">
          {children}
        </div>
      </div>

      {/* Floating Action Button (FAB) for Help / Support */}
      <SupportFab onOpen={() => setSupportOpen(true)} />

      {/* Guided Smart Support Ticket Modal */}
      <StudentSupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}
