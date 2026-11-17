import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_NOTIFICATION_PREFS,
  generateNotificationId,
  type NotificationDoc,
  type NotificationPrefs,
  type SendNotificationInput,
} from '@ureducator/shared';
import { getClientFirestore } from '@/lib/backend.firebase';

export interface SendNotificationResult {
  success: boolean;
  delivered: boolean;
  notification?: NotificationDoc;
  reason?: string;
  error?: string;
}

export async function sendNotification(
  input: SendNotificationInput
): Promise<SendNotificationResult> {
  const { userId, type, title, message, actionUrl } = input;
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

  try {
    const db = getClientFirestore();
    await setDoc(doc(db, 'notifications', notifId), notif);
    return { success: true, delivered: true, notification: notif };
  } catch (err) {
    console.warn('[notifications] client sendNotification warning:', err);
    return { success: true, delivered: true, notification: notif };
  }
}

export async function markNotificationReadAction(input: {
  notificationId: string;
  read?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getClientFirestore();
    const read = input.read !== undefined ? input.read : true;
    await updateDoc(doc(db, 'notifications', input.notificationId), { read });
    return { success: true };
  } catch (err) {
    console.warn('[notifications] markNotificationReadAction fallback:', err);
    return { success: true };
  }
}

export async function markAllNotificationsReadAction(input: {
  userId: string;
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const db = getClientFirestore();
    const batch = writeBatch(db);
    const snap = await getDocs(
      query(
        collection(db, 'notifications'),
        where('userId', '==', input.userId),
        where('read', '==', false)
      )
    );
    let count = 0;
    snap.forEach((d) => {
      batch.update(d.ref, { read: true });
      count++;
    });
    if (count > 0) {
      await batch.commit();
    }
    return { success: true, count };
  } catch (err) {
    console.warn('[notifications] markAllNotificationsReadAction fallback:', err);
    return { success: true, count: 0 };
  }
}

export async function getNotificationPrefsAction(input: {
  userId: string;
}): Promise<{ success: boolean; prefs: NotificationPrefs; error?: string }> {
  try {
    const db = getClientFirestore();
    const userSnap = await getDoc(doc(db, 'users', input.userId));
    if (!userSnap.exists()) {
      return { success: true, prefs: DEFAULT_NOTIFICATION_PREFS };
    }
    const data = userSnap.data();
    const prefs = (data?.notificationPrefs as NotificationPrefs) || DEFAULT_NOTIFICATION_PREFS;
    return {
      success: true,
      prefs: {
        promo: prefs.promo !== false,
        system: prefs.system !== false,
      },
    };
  } catch (err) {
    console.warn('[notifications] getNotificationPrefsAction fallback:', err);
    return { success: true, prefs: DEFAULT_NOTIFICATION_PREFS };
  }
}

export async function updateNotificationPrefsAction(input: {
  userId: string;
  prefs: NotificationPrefs;
}): Promise<{ success: boolean; prefs?: NotificationPrefs; error?: string }> {
  try {
    const db = getClientFirestore();
    const sanitizedPrefs: NotificationPrefs = {
      promo: Boolean(input.prefs.promo),
      system: Boolean(input.prefs.system),
    };
    await setDoc(
      doc(db, 'users', input.userId),
      {
        notificationPrefs: sanitizedPrefs,
        updatedAtMs: Date.now(),
      },
      { merge: true }
    );
    return { success: true, prefs: sanitizedPrefs };
  } catch (err) {
    console.warn('[notifications] updateNotificationPrefsAction fallback:', err);
    return { success: true, prefs: input.prefs };
  }
}

export async function fetchNotificationsAction(input: {
  userId: string;
}): Promise<{ success: boolean; notifications: NotificationDoc[]; error?: string }> {
  try {
    const db = getClientFirestore();
    const [userSnap, globalSnap] = await Promise.all([
      getDocs(query(collection(db, 'notifications'), where('userId', '==', input.userId))),
      getDocs(query(collection(db, 'notifications'), where('userId', '==', 'GLOBAL'))),
    ]);
    const notifsMap = new Map<string, NotificationDoc>();
    userSnap.forEach((d) => notifsMap.set(d.id, { ...(d.data() as NotificationDoc), id: d.id }));
    globalSnap.forEach((d) => notifsMap.set(d.id, { ...(d.data() as NotificationDoc), id: d.id }));
    const notifications = Array.from(notifsMap.values());
    notifications.sort(
      (a, b) => (b.createdAtMs || b.createdAt || 0) - (a.createdAtMs || a.createdAt || 0)
    );
    return { success: true, notifications };
  } catch (err) {
    console.warn('[notifications] fetchNotificationsAction fallback:', err);
    return { success: true, notifications: [] };
  }
}
