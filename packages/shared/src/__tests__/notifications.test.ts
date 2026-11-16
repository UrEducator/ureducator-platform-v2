import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  generateNotificationId,
  NotificationDocSchema,
  NotificationPrefsSchema,
  NOTIFICATION_TYPES,
  SendNotificationInputSchema,
  shouldDeliverNotification,
} from '../notifications';

describe('Phase S: Universal Notification Hub & Preferences', () => {
  it('defines valid notification types and defaults', () => {
    expect(NOTIFICATION_TYPES).toContain('SUPPORT');
    expect(NOTIFICATION_TYPES).toContain('SYSTEM');
    expect(NOTIFICATION_TYPES).toContain('PROMO');
    expect(DEFAULT_NOTIFICATION_PREFS).toEqual({ promo: true, system: true });
  });

  it('generates a valid unique notification ID with timestamp prefix', () => {
    const id1 = generateNotificationId();
    expect(id1).toMatch(/^notif_[0-9]+_[a-z0-9]+$/);
    const id2 = generateNotificationId('custom');
    expect(id2).toMatch(/^custom_[0-9]+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it('validates a complete NotificationDoc against NotificationDocSchema', () => {
    const now = Date.now();
    const doc = {
      id: 'notif_1731778900000_abc123',
      userId: 'student_123',
      type: 'SUPPORT' as const,
      title: 'Ticket PAY-L1-FAIL-9021 Updated: RESOLVED',
      message: 'Your payment dispute has been resolved and your plan is activated.',
      read: false,
      createdAt: now,
      createdAtMs: now,
      actionUrl: '/app',
    };

    const parsed = NotificationDocSchema.safeParse(doc);
    expect(parsed.success).toBe(true);
  });

  it('validates GLOBAL notifications', () => {
    const now = Date.now();
    const globalDoc = {
      id: 'notif_1731778900000_glob99',
      userId: 'GLOBAL',
      type: 'PROMO' as const,
      title: '50% Off UGC NET Full Mock Test Series',
      message: 'Use coupon CODE50 before Sunday midnight!',
      read: false,
      createdAt: now,
      createdAtMs: now,
      actionUrl: '/pricing',
    };

    const parsed = NotificationDocSchema.safeParse(globalDoc);
    expect(parsed.success).toBe(true);
  });

  it('enforces that SUPPORT notifications CANNOT be muted under any preferences', () => {
    // Both muted
    const allMuted = { promo: false, system: false };
    expect(shouldDeliverNotification(allMuted, 'SUPPORT')).toBe(true);

    // Undefined/null prefs
    expect(shouldDeliverNotification(undefined, 'SUPPORT')).toBe(true);
    expect(shouldDeliverNotification(null, 'SUPPORT')).toBe(true);
  });

  it('respects mute preferences for PROMO and SYSTEM notifications', () => {
    const promoMuted = { promo: false, system: true };
    expect(shouldDeliverNotification(promoMuted, 'PROMO')).toBe(false);
    expect(shouldDeliverNotification(promoMuted, 'SYSTEM')).toBe(true);

    const systemMuted = { promo: true, system: false };
    expect(shouldDeliverNotification(systemMuted, 'PROMO')).toBe(true);
    expect(shouldDeliverNotification(systemMuted, 'SYSTEM')).toBe(false);

    const bothMuted = { promo: false, system: false };
    expect(shouldDeliverNotification(bothMuted, 'PROMO')).toBe(false);
    expect(shouldDeliverNotification(bothMuted, 'SYSTEM')).toBe(false);

    // Default or empty allows both
    expect(shouldDeliverNotification(DEFAULT_NOTIFICATION_PREFS, 'PROMO')).toBe(true);
    expect(shouldDeliverNotification(DEFAULT_NOTIFICATION_PREFS, 'SYSTEM')).toBe(true);
    expect(shouldDeliverNotification(null, 'PROMO')).toBe(true);
    expect(shouldDeliverNotification(null, 'SYSTEM')).toBe(true);
  });

  it('validates NotificationPrefs schema and SendNotificationInput schema', () => {
    expect(NotificationPrefsSchema.safeParse({ promo: false, system: true }).success).toBe(true);
    expect(NotificationPrefsSchema.safeParse({ promo: 'no' }).success).toBe(false);

    const validSend = {
      userId: 'student_456',
      type: 'SYSTEM' as const,
      title: 'Scheduled Maintenance Tomorrow at 2 AM IST',
      message: 'The UGC NET mock test platform will be undergoing scheduled upgrades.',
      actionUrl: '/app',
    };
    expect(SendNotificationInputSchema.safeParse(validSend).success).toBe(true);
  });
});
