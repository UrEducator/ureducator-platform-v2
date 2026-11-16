'use server';

import { getApps, initializeApp, getApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  DEFAULT_NOTIFICATION_PREFS,
  generateNotificationId,
  shouldDeliverNotification,
  type NotificationDoc,
  type NotificationPrefs,
  type SendNotificationInput,
} from '@ureducator/shared';

function getAdminApp(): App | null {
  try {
    if (getApps().length > 0) {
      return getApp();
    }
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      'ugc-mock-test-staging';

    return initializeApp({ projectId });
  } catch (err) {
    console.error('[actions/notifications] Failed to initialize Firebase Admin app:', err);
    return null;
  }
}

export interface SendNotificationResult {
  success: boolean;
  delivered: boolean;
  notification?: NotificationDoc;
  reason?: string;
  error?: string;
}

/**
 * Server utility to deliver a notification to a specific user (or 'GLOBAL').
 * Honors user mute preferences for PROMO and SYSTEM types.
 * Critical SUPPORT notifications can NEVER be muted.
 */
export async function sendNotification(
  input: SendNotificationInput
): Promise<SendNotificationResult> {
  const app = getAdminApp();
  if (!app) {
    return { success: false, delivered: false, error: 'Firebase Admin not available' };
  }

  const db = getFirestore(app);
  const { userId, type, title, message, actionUrl } = input;

  try {
    // Check preferences if target is a specific student and type is mutable (non-SUPPORT)
    if (userId !== 'GLOBAL' && type !== 'SUPPORT') {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const prefs = (userData?.notificationPrefs as NotificationPrefs) || DEFAULT_NOTIFICATION_PREFS;
        if (!shouldDeliverNotification(prefs, type)) {
          return {
            success: true,
            delivered: false,
            reason: `Notification type '${type}' muted by user preferences.`,
          };
        }
      }
    }

    const notifId = generateNotificationId();
    const now = Date.now();

    const notif: NotificationDoc = {
      id: notifId,
      userId,
      type,
      title: title.trim(),
      message: message.trim(),
      read: false,
      createdAt: now,
      createdAtMs: now,
      ...(actionUrl ? { actionUrl: actionUrl.trim() } : {}),
    };

    await db.collection('notifications').doc(notifId).set(notif);

    return {
      success: true,
      delivered: true,
      notification: notif,
    };
  } catch (err) {
    console.error('[actions/notifications] sendNotification error:', err);
    return { success: false, delivered: false, error: String(err) };
  }
}

/**
 * Marks a notification as read or unread.
 */
export async function markNotificationReadAction(input: {
  notificationId: string;
  read?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const app = getAdminApp();
  if (!app) {
    return { success: false, error: 'Firebase Admin not available' };
  }

  try {
    const db = getFirestore(app);
    const read = input.read !== undefined ? input.read : true;
    await db.collection('notifications').doc(input.notificationId).update({ read });
    return { success: true };
  } catch (err) {
    console.error('[actions/notifications] markNotificationReadAction error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Marks all unread notifications for a specific user as read.
 */
export async function markAllNotificationsReadAction(input: {
  userId: string;
}): Promise<{ success: boolean; count: number; error?: string }> {
  const app = getAdminApp();
  if (!app) {
    return { success: false, count: 0, error: 'Firebase Admin not available' };
  }

  try {
    const db = getFirestore(app);
    const batch = db.batch();

    // Query unread notifications for the specific user
    const userQuery = await db
      .collection('notifications')
      .where('userId', '==', input.userId)
      .where('read', '==', false)
      .get();

    let count = 0;
    userQuery.forEach((doc) => {
      batch.update(doc.ref, { read: true });
      count++;
    });

    if (count > 0) {
      await batch.commit();
    }

    return { success: true, count };
  } catch (err) {
    console.error('[actions/notifications] markAllNotificationsReadAction error:', err);
    return { success: false, count: 0, error: String(err) };
  }
}

/**
 * Retrieves student notification preferences.
 */
export async function getNotificationPrefsAction(input: {
  userId: string;
}): Promise<{ success: boolean; prefs: NotificationPrefs; error?: string }> {
  const app = getAdminApp();
  if (!app) {
    return { success: false, prefs: DEFAULT_NOTIFICATION_PREFS, error: 'Firebase Admin not available' };
  }

  try {
    const db = getFirestore(app);
    const userDoc = await db.collection('users').doc(input.userId).get();
    if (!userDoc.exists) {
      return { success: true, prefs: DEFAULT_NOTIFICATION_PREFS };
    }

    const data = userDoc.data();
    const prefs = (data?.notificationPrefs as NotificationPrefs) || DEFAULT_NOTIFICATION_PREFS;
    return {
      success: true,
      prefs: {
        promo: prefs.promo !== false,
        system: prefs.system !== false,
      },
    };
  } catch (err) {
    console.error('[actions/notifications] getNotificationPrefsAction error:', err);
    return { success: false, prefs: DEFAULT_NOTIFICATION_PREFS, error: String(err) };
  }
}

/**
 * Updates student notification preferences in users/{uid}.
 */
export async function updateNotificationPrefsAction(input: {
  userId: string;
  prefs: NotificationPrefs;
}): Promise<{ success: boolean; prefs?: NotificationPrefs; error?: string }> {
  const app = getAdminApp();
  if (!app) {
    return { success: false, error: 'Firebase Admin not available' };
  }

  try {
    const db = getFirestore(app);
    const sanitizedPrefs: NotificationPrefs = {
      promo: Boolean(input.prefs.promo),
      system: Boolean(input.prefs.system),
    };

    await db.collection('users').doc(input.userId).set(
      {
        notificationPrefs: sanitizedPrefs,
        updatedAtMs: Date.now(),
      },
      { merge: true }
    );

    return { success: true, prefs: sanitizedPrefs };
  } catch (err) {
    console.error('[actions/notifications] updateNotificationPrefsAction error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Fetches notifications for a user (including GLOBAL), ordered newest first.
 */
export async function fetchNotificationsAction(input: {
  userId: string;
}): Promise<{ success: boolean; notifications: NotificationDoc[]; error?: string }> {
  const app = getAdminApp();
  if (!app) {
    return { success: false, notifications: [], error: 'Firebase Admin not available' };
  }

  try {
    const db = getFirestore(app);

    // 1. Fetch user notifications
    const userDocsPromise = db
      .collection('notifications')
      .where('userId', '==', input.userId)
      .get();

    // 2. Fetch global notifications
    const globalDocsPromise = db
      .collection('notifications')
      .where('userId', '==', 'GLOBAL')
      .get();

    const [userSnap, globalSnap] = await Promise.all([userDocsPromise, globalDocsPromise]);

    const notifsMap = new Map<string, NotificationDoc>();

    userSnap.forEach((doc) => {
      notifsMap.set(doc.id, doc.data() as NotificationDoc);
    });
    globalSnap.forEach((doc) => {
      notifsMap.set(doc.id, doc.data() as NotificationDoc);
    });

    const notifications = Array.from(notifsMap.values());
    notifications.sort((a, b) => (b.createdAtMs || b.createdAt || 0) - (a.createdAtMs || a.createdAt || 0));

    return { success: true, notifications };
  } catch (err) {
    console.error('[actions/notifications] fetchNotificationsAction error:', err);
    return { success: false, notifications: [], error: String(err) };
  }
}
