'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  LogOut,
  LayoutDashboard,
  BookOpen,
  FileQuestion,
  ClipboardList,
  Scroll,
  Users,
  UserPlus,
  LifeBuoy,
  CreditCard,
  Activity,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { can, DEPT_LABELS, type Permission, type Role, type SmartTicket } from '@ureducator/shared';
import { Logo } from '@/components/brand';
import { StagingBanner } from '@/components/SiteChrome';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ToastProvider, toast } from '@/components/ui';
import { getClientFirestore } from '@/lib/backend.firebase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

const NAV: { href: string; label: string; icon: LucideIcon; any: Permission[] }[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, any: [] },
  { href: '/admin/catalogue', label: 'Catalogue', icon: BookOpen, any: ['catalogue.write'] },
  { href: '/admin/questions', label: 'Questions', icon: FileQuestion, any: ['questions.write', 'questions.review'] },
  { href: '/admin/tests', label: 'Mock tests', icon: ClipboardList, any: ['tests.write', 'tests.publish'] },
  { href: '/admin/blueprints', label: 'Blueprints', icon: Scroll, any: ['tests.write'] },
  { href: '/admin/people', label: 'People and roles', icon: Users, any: ['students.read', 'roles.assign'] },
  { href: '/admin/leads', label: 'Leads', icon: UserPlus, any: ['leads.read'] },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy, any: ['support.read'] },
  { href: '/admin/pricing', label: 'Pricing', icon: CreditCard, any: ['pricing.write', 'payments.read'] },
  { href: '/admin/audit', label: 'Audit log', icon: Activity, any: ['audit.read'] },
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

  const [collapsed, setCollapsed] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState<number>(0);
  const initialLoadRef = useRef(false);

  // TASK 3: Zero-Cost Admin Notifications (Real-time onSnapshot listener)
  useEffect(() => {
    if (!user) return;
    try {
      const db = getClientFirestore();
      const q = query(collection(db, 'tickets'), where('status', '==', 'OPEN'));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          setOpenTicketCount(snapshot.size);

          if (!initialLoadRef.current) {
            initialLoadRef.current = true;
            return;
          }

          for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
              const ticket = change.doc.data() as SmartTicket;
              const tone = ticket.severity === 'L1' ? 'error' : ticket.severity === 'L2' ? 'warn' : 'info';
              toast({
                title: `New ${ticket.severity} Ticket: ${ticket.ticketId}`,
                description: `${ticket.title} (${DEPT_LABELS[ticket.dept] || ticket.dept})`,
                tone,
                durationMs: 9000,
                action: {
                  label: 'View in Support Desk',
                  href: '/admin/support',
                },
              });
            }
          }
        },
        (err) => {
          console.warn('[AdminShell] Tickets onSnapshot listener warning:', err);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn('[AdminShell] Failed to initialize tickets onSnapshot:', e);
    }
  }, [user]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ureducator:admin-sidebar-collapsed');
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
        localStorage.setItem('ureducator:admin-sidebar-collapsed', String(next));
      } catch {
        // ignore storage access issues
      }
      return next;
    });
  };

  return (
    <ToastProvider>
      <div className="min-h-screen transition-colors">
      <header className="no-print border-b border-line bg-[#121722] text-white">
        <StagingBanner />
        <div className="w-full flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
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
      <div
        className={cn(
          'w-full grid gap-6 px-4 py-6 sm:px-6 lg:px-8 transition-[grid-template-columns] duration-200',
          collapsed ? 'lg:grid-cols-[4.5rem_1fr]' : 'lg:grid-cols-[14rem_1fr]'
        )}
      >
        <aside className="relative flex flex-col">
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

          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {items.map((n) => {
              const on = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
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
                    on ? 'bg-pen-surface text-pen-surface-ink font-semibold' : 'text-ink hover:bg-surface-hover'
                  )}
                >
                  <Icon className={cn('size-4 shrink-0', on ? 'text-pen-700' : 'text-muted group-hover:text-ink')} aria-hidden="true" />
                  <span className={cn(collapsed ? 'lg:hidden' : 'inline')}>{n.label}</span>
                  {n.href === '/admin/support' && openTicketCount > 0 && (
                    <span
                      className={cn(
                        'rounded-full bg-bad font-mono text-[11px] font-bold text-white px-1.5 py-0.2',
                        collapsed ? 'lg:absolute lg:-top-1 lg:-right-1' : 'ml-auto'
                      )}
                    >
                      {openTicketCount}
                    </span>
                  )}
                  {/* Floating tooltip on hover when collapsed */}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg group-hover:block z-50 whitespace-nowrap">
                      {n.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div id="main" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </div>
      </div>
    </div>
    </ToastProvider>
  );
}
