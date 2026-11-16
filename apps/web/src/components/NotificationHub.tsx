'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  ExternalLink,
  LifeBuoy,
  Lock,
  Settings,
  Sparkles,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  DEFAULT_NOTIFICATION_PREFS,
  formatUnreadBadge,
  shouldDeliverNotification,
  type NotificationDoc,
  type NotificationPrefs,
} from '@ureducator/shared';
import {
  fetchNotificationsAction,
  getNotificationPrefsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  updateNotificationPrefsAction,
} from '@/app/actions/notifications';
import { Button, Dialog, Drawer, toast } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getClientFirestore } from '@/lib/backend.firebase';
import { cn } from '@/lib/cn';

type FilterTab = 'ALL' | 'SUPPORT' | 'SYSTEM' | 'OFFERS';

function formatRelativeTime(timestampMs: number): string {
  if (!timestampMs) return '';
  const diff = Date.now() - timestampMs;
  if (diff < 60_000) return 'Just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestampMs).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function NotificationHub() {
  const { user } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const [rawNotifications, setRawNotifications] = useState<NotificationDoc[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const initialLoadRef = useRef(false);

  // Load user preferences
  useEffect(() => {
    if (!user?.uid) return;
    void getNotificationPrefsAction({ userId: user.uid }).then((res) => {
      if (res.success && res.prefs) {
        setPrefs(res.prefs);
      }
    });
  }, [user?.uid]);

  // Real-time Firestore sync with server fallback
  useEffect(() => {
    if (!user?.uid) {
      setRawNotifications([]);
      return;
    }

    let unsubUser: (() => void) | null = null;
    let unsubGlobal: (() => void) | null = null;
    const notifsMap = new Map<string, NotificationDoc>();

    const updateFromMap = () => {
      const list = Array.from(notifsMap.values());
      list.sort((a, b) => (b.createdAtMs || b.createdAt || 0) - (a.createdAtMs || a.createdAt || 0));
      setRawNotifications(list);
    };

    try {
      const db = getClientFirestore();

      // Listen to student-specific notifications
      const qUser = query(collection(db, 'notifications'), where('userId', '==', user.uid));
      unsubUser = onSnapshot(
        qUser,
        (snap) => {
          for (const change of snap.docChanges()) {
            const data = change.doc.data() as NotificationDoc;
            if (change.type === 'removed') {
              notifsMap.delete(change.doc.id);
            } else {
              notifsMap.set(change.doc.id, { ...data, id: change.doc.id });
              // Toast for newly arriving notification during session
              if (initialLoadRef.current && change.type === 'added' && !data.read) {
                toast({
                  title: data.title,
                  description: data.message,
                  tone: data.type === 'SUPPORT' ? 'ok' : 'info',
                  durationMs: 7000,
                  action: data.actionUrl
                    ? {
                        label: 'View',
                        onClick: () => {
                          setOpen(true);
                        },
                      }
                    : undefined,
                });
              }
            }
          }
          updateFromMap();
          initialLoadRef.current = true;
        },
        (err) => {
          console.warn('[NotificationHub] onSnapshot user notifications warning, falling back to server action:', err);
          void fetchNotificationsAction({ userId: user.uid }).then((res) => {
            if (res.success && res.notifications) {
              setRawNotifications(res.notifications);
            }
          });
        }
      );

      // Listen to GLOBAL notifications
      const qGlobal = query(collection(db, 'notifications'), where('userId', '==', 'GLOBAL'));
      unsubGlobal = onSnapshot(
        qGlobal,
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type === 'removed') {
              notifsMap.delete(change.doc.id);
            } else {
              const data = change.doc.data() as NotificationDoc;
              notifsMap.set(change.doc.id, { ...data, id: change.doc.id });
            }
          }
          updateFromMap();
        },
        (err) => {
          console.warn('[NotificationHub] onSnapshot global notifications warning:', err);
        }
      );
    } catch (e) {
      console.warn('[NotificationHub] Firestore init warning, fetching via Server Action:', e);
      void fetchNotificationsAction({ userId: user.uid }).then((res) => {
        if (res.success && res.notifications) {
          setRawNotifications(res.notifications);
        }
      });
    }

    return () => {
      if (unsubUser) unsubUser();
      if (unsubGlobal) unsubGlobal();
    };
  }, [user?.uid]);

  // Filter raw notifications based on user preferences and active tab
  const visibleNotifications = useMemo(() => {
    return rawNotifications.filter((n) => {
      // Respect mute preferences
      if (!shouldDeliverNotification(prefs, n.type)) {
        return false;
      }
      // Tab filtering
      if (activeTab === 'SUPPORT') return n.type === 'SUPPORT';
      if (activeTab === 'SYSTEM') return n.type === 'SYSTEM';
      if (activeTab === 'OFFERS') return n.type === 'PROMO';
      return true; // ALL
    });
  }, [rawNotifications, prefs, activeTab]);

  // Calculate unread count (filtering active Firestore payload for read === false)
  const unreadCount = useMemo(() => {
    return rawNotifications.filter(
      (n) => n.read === false && shouldDeliverNotification(prefs, n.type)
    ).length;
  }, [rawNotifications, prefs]);

  // Mark single notification read
  const handleNotificationClick = useCallback(
    async (item: NotificationDoc) => {
      if (!item.read) {
        // Optimistic update
        setRawNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
        void markNotificationReadAction({ notificationId: item.id, read: true });
      }

      if (item.actionUrl) {
        setOpen(false);
        router.push(item.actionUrl);
      }
    },
    [router]
  );

  // Mark all visible as read
  const handleMarkAllRead = useCallback(async () => {
    if (!user?.uid || unreadCount === 0) return;
    setMarkingAll(true);
    // Optimistic update
    setRawNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      const res = await markAllNotificationsReadAction({ userId: user.uid });
      if (res.success) {
        toast({
          title: 'All notifications marked as read',
          tone: 'ok',
          durationMs: 3000,
        });
      }
    } catch (e) {
      console.error('[NotificationHub] markAllRead error:', e);
    } finally {
      setMarkingAll(false);
    }
  }, [user?.uid, unreadCount]);

  // Update preferences toggle
  const handleTogglePref = useCallback(
    async (key: 'promo' | 'system') => {
      if (!user?.uid || savingPrefs) return;
      const nextPrefs: NotificationPrefs = {
        ...prefs,
        [key]: !prefs[key],
      };
      setPrefs(nextPrefs);
      setSavingPrefs(true);

      try {
        const res = await updateNotificationPrefsAction({
          userId: user.uid,
          prefs: nextPrefs,
        });
        if (res.success) {
          toast({
            title: 'Preferences Updated',
            description: key === 'promo'
              ? nextPrefs.promo ? 'Promotional offers enabled.' : 'Promotional offers muted.'
              : nextPrefs.system ? 'System alerts enabled.' : 'System alerts muted.',
            tone: 'info',
            durationMs: 3500,
          });
        }
      } catch (err) {
        console.error('[NotificationHub] updatePrefs error:', err);
      } finally {
        setSavingPrefs(false);
      }
    },
    [user?.uid, prefs, savingPrefs]
  );

  return (
    <>
      {/* Header Bell Icon Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-control hover:bg-surface-hover text-ink cursor-pointer transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        title="Notifications"
      >
        <div className="relative inline-flex items-center justify-center">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-xs',
                unreadCount > 99 ? 'h-4 min-w-5 px-1 -right-2' : 'h-4 w-4'
              )}
            >
              {formatUnreadBadge(unreadCount)}
            </span>
          )}
        </div>
      </button>

      {/* Slide-Out Notification Drawer */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        side="right"
      >
        <div className="flex flex-col gap-4">
          {/* Top Control Bar: Preferences & Mark All Read */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-line">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              {unreadCount > 0 ? (
                <span className="font-semibold text-pen-700 dark:text-pen-400">
                  {unreadCount} unread
                </span>
              ) : (
                <span>All caught up</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleMarkAllRead()}
                disabled={unreadCount === 0 || markingAll}
                className="h-8 text-xs px-2 gap-1"
                title="Mark all notifications as read"
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </Button>

              <button
                type="button"
                onClick={() => setPrefsOpen(true)}
                className="grid size-8 place-items-center rounded-control border border-line hover:bg-surface-hover text-muted hover:text-ink cursor-pointer transition-colors"
                title="Notification Preferences"
                aria-label="Notification Preferences"
              >
                <Settings className="size-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs: All | Support | System | Offers */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-control bg-paper border border-line text-xs font-semibold">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'SUPPORT', label: 'Support' },
                { id: 'SYSTEM', label: 'System' },
                { id: 'OFFERS', label: 'Offers' },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'py-1.5 px-2 rounded-control text-center transition-all cursor-pointer truncate',
                    active
                      ? 'bg-surface text-ink shadow-2xs font-bold'
                      : 'text-muted hover:text-ink hover:bg-surface/50'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Notification List Feed */}
          {visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-paper text-muted mb-3">
                <BellOff className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-ink">No notifications</h3>
              <p className="mt-1 text-xs text-muted max-w-xs">
                {activeTab === 'ALL'
                  ? "You don't have any notifications at the moment."
                  : `No ${activeTab.toLowerCase()} notifications found.`}
              </p>
              {(!prefs.promo || !prefs.system) && (
                <button
                  type="button"
                  onClick={() => setPrefsOpen(true)}
                  className="mt-4 text-xs font-semibold text-pen-700 hover:underline cursor-pointer"
                >
                  Check muted notification preferences
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {visibleNotifications.map((item) => {
                const isSupport = item.type === 'SUPPORT';
                const isPromo = item.type === 'PROMO';
                const isSystem = item.type === 'SYSTEM';

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => void handleNotificationClick(item)}
                    className={cn(
                      'group relative flex flex-col gap-1.5 p-3.5 transition-colors cursor-pointer rounded-sheet my-0.5 text-left w-full border-0 focus-visible:outline-pen-500',
                      item.read
                        ? 'hover:bg-surface-hover/70 opacity-80'
                        : 'bg-pen-50/50 dark:bg-pen-950/20 hover:bg-pen-50/80 dark:hover:bg-pen-950/30'
                    )}
                  >
                    {/* Header: Type Badge, Time, and Unread Dot */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isSupport && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <LifeBuoy className="size-3" />
                            Support
                          </span>
                        )}
                        {isSystem && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="size-3" />
                            System
                          </span>
                        )}
                        {isPromo && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Sparkles className="size-3" />
                            Offer
                          </span>
                        )}

                        <span className="text-[11px] text-muted">
                          {formatRelativeTime(item.createdAtMs || item.createdAt)}
                        </span>
                      </div>

                      {!item.read && (
                        <span
                          className="size-2 rounded-full bg-pen-600 ring-2 ring-surface shrink-0"
                          title="Unread"
                        />
                      )}
                    </div>

                    {/* Notification Title */}
                    <h4
                      className={cn(
                        'text-sm leading-snug',
                        item.read ? 'font-medium text-ink' : 'font-bold text-ink'
                      )}
                    >
                      {item.title}
                    </h4>

                    {/* Notification Message Snippet */}
                    <p className="text-xs text-muted leading-relaxed line-clamp-3">
                      {item.message}
                    </p>

                    {/* Action link if available */}
                    {item.actionUrl && (
                      <div className="pt-1 flex items-center gap-1 text-xs font-semibold text-pen-700 dark:text-pen-400 group-hover:underline">
                        <span>View details</span>
                        <ExternalLink className="size-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Drawer>

      {/* Preference Center Modal */}
      <Dialog
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="Notification Preferences"
        footer={
          <Button variant="primary" onClick={() => setPrefsOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted leading-relaxed">
            Choose which types of alerts and updates you wish to receive. Critical grievance and support tickets cannot be muted to ensure uninterrupted account assistance.
          </p>

          <div className="flex flex-col divide-y divide-line rounded-sheet border border-line bg-paper/50">
            {/* Promo Offers Toggle */}
            <div className="flex items-center justify-between p-3.5 gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-ink">
                  Promotional Offers & Discounts
                </span>
                <span className="text-xs text-muted">
                  Receive special exam prep discounts, coupon codes, and mock test announcements.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.promo}
                disabled={savingPrefs}
                onClick={() => void handleTogglePref('promo')}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-pen-500',
                  prefs.promo ? 'bg-pen-600' : 'bg-neutral-300 dark:bg-neutral-700'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    prefs.promo ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* System Reminders Toggle */}
            <div className="flex items-center justify-between p-3.5 gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-ink">
                  System & Study Reminders
                </span>
                <span className="text-xs text-muted">
                  Scheduled study routine reminders, platform maintenance notices, and syllabus updates.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.system}
                disabled={savingPrefs}
                onClick={() => void handleTogglePref('system')}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-pen-500',
                  prefs.system ? 'bg-pen-600' : 'bg-neutral-300 dark:bg-neutral-700'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    prefs.system ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* Support Updates - Mandatory / Unmutable */}
            <div className="flex items-center justify-between p-3.5 gap-3 bg-pen-50/30 dark:bg-pen-950/10">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-ink">
                    Support & Grievance Desk
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.2 text-[10px] font-bold text-muted">
                    <Lock className="size-2.5" />
                    Always On
                  </span>
                </div>
                <span className="text-xs text-muted">
                  Real-time updates when an administrator replies to or resolves your support ticket.
                </span>
              </div>
              <div
                className="relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-pen-600 opacity-60"
                title="Critical support notifications cannot be disabled"
              >
                <span className="pointer-events-none inline-block size-5 translate-x-5 transform rounded-full bg-white shadow ring-0" />
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
