import { z } from 'zod';

export const NOTIFICATION_TYPES = ['SUPPORT', 'SYSTEM', 'PROMO'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  SUPPORT: 'Support',
  SYSTEM: 'System',
  PROMO: 'Special Offer',
};

export const NotificationDocSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1), // student uid or 'GLOBAL'
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  read: z.boolean(),
  createdAt: z.number().int(),
  createdAtMs: z.number().int(),
  actionUrl: z.string().optional(),
});
export type NotificationDoc = z.infer<typeof NotificationDocSchema>;

export const NotificationPrefsSchema = z.object({
  promo: z.boolean(),
  system: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  promo: true,
  system: true,
};

export const SendNotificationInputSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  actionUrl: z.string().optional(),
});
export type SendNotificationInput = z.infer<typeof SendNotificationInputSchema>;

/**
 * Determines whether a notification should be delivered/displayed based on user preferences.
 * NOTE: 'SUPPORT' notifications are critical and CANNOT be muted under any circumstances.
 */
export function shouldDeliverNotification(
  prefs: NotificationPrefs | undefined | null,
  type: NotificationType
): boolean {
  if (type === 'SUPPORT') {
    return true; // Strictly un-mutable
  }
  if (!prefs) {
    return true; // Default is unmuted
  }
  if (type === 'PROMO') {
    return prefs.promo !== false;
  }
  if (type === 'SYSTEM') {
    return prefs.system !== false;
  }
  return true;
}

/**
 * Formats the unread notification count for badge display.
 * - Zero-State Hiding: Returns null if count <= 0.
 * - Maximum Cap: Returns '99+' if count > 99.
 * - Exact Count: Returns string representation of count (e.g. '1', '42').
 */
export function formatUnreadBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return '99+';
  return String(count);
}

/**
 * Generates a unique notification document ID.
 */
export function generateNotificationId(prefix = 'notif'): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}
