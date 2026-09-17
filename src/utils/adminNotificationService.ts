import { collection, doc, setDoc, deleteDoc, getDocs, updateDoc, writeBatch, query, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, cleanFirestoreData } from '../firebase';
import { safeApiPost } from './apiConfig';

export interface AdminNotificationDoc {
  id: string;
  type: 'deposit' | 'withdrawal' | 'ticket' | 'bet' | 'general';
  title: string;
  description: string;
  amount?: number;
  userName?: string;
  userId?: string;
  status?: string;
  timestamp: number;
  createdAt: string;
  read: boolean;
  dismissed?: boolean;
  metadata?: Record<string, any>;
}

const LAST_CLEARED_KEY = 'betguru_admin_last_cleared_at';

export function getAdminLastClearedTimestamp(): number {
  try {
    const val = localStorage.getItem(LAST_CLEARED_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch (_) {
    return 0;
  }
}

export function setAdminLastClearedTimestamp(ts: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_CLEARED_KEY, ts.toString());
  } catch (_) {}
}

/**
 * Send a persistent, real-time admin notification to Firestore
 */
export async function sendAdminNotification(notification: {
  type: 'deposit' | 'withdrawal' | 'ticket' | 'bet' | 'general';
  title: string;
  description: string;
  amount?: number;
  userName?: string;
  userId?: string;
  status?: string;
  metadata?: Record<string, any>;
  customId?: string;
}): Promise<string> {
  try {
    const notifId = notification.customId || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const notifDoc: AdminNotificationDoc = {
      id: notifId,
      type: notification.type,
      title: notification.title,
      description: notification.description,
      amount: notification.amount,
      userName: notification.userName || 'Player',
      userId: notification.userId || 'anonymous',
      status: notification.status || 'pending',
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      read: false,
      dismissed: false,
      metadata: notification.metadata || {}
    };

    // 🚀 ZERO-DELAY (0 SEC): Dispatch push notification to Android app immediately without blocking!
    safeApiPost('/api/notify-admin-order', {
      topic: 'admin',
      title: notification.title,
      body: notification.description,
      type: notification.type,
      targetUrl: notification.type === 'deposit' ? '/orders?tab=deposits' : notification.type === 'withdrawal' ? '/orders?tab=withdrawals' : '/admin?tab=support_chat'
    }).catch((err) => {
      console.warn('Silent note: Push notification post returned error:', err);
    });

    // Concurrently persist to Firestore without delaying the push alert
    const docRef = doc(db, 'admin_notifications', notifId);
    setDoc(docRef, cleanFirestoreData(notifDoc)).catch((err) => {
      console.warn('Silent note: Failed to send admin notification to Firestore:', err);
    });

    return notifId;
  } catch (err) {
    console.warn('Silent note: Failed to send admin notification to Firestore:', err);
    return '';
  }
}

/**
 * Delete a single admin notification permanently from Firestore
 */
export async function deleteAdminNotification(notificationId: string): Promise<boolean> {
  try {
    if (!notificationId) return false;
    const docRef = doc(db, 'admin_notifications', notificationId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('Failed to delete admin notification:', err);
    return false;
  }
}

/**
 * Clear ALL admin notifications permanently from Firestore & update local clearance watermark
 */
export async function clearAllAdminNotifications(): Promise<boolean> {
  try {
    setAdminLastClearedTimestamp(Date.now());
    const notifRef = collection(db, 'admin_notifications');
    const snap = await getDocs(query(notifRef, limit(300)));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((docItem) => {
        batch.delete(docItem.ref);
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.warn('Failed to clear all admin notifications from Firestore:', err);
    return false;
  }
}

/**
 * Mark all admin notifications as read in Firestore
 */
export async function markAllAdminNotificationsRead(): Promise<boolean> {
  try {
    const notifRef = collection(db, 'admin_notifications');
    const snap = await getDocs(query(notifRef, limit(300)));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((docItem) => {
        batch.update(docItem.ref, { read: true });
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.warn('Failed to mark admin notifications as read:', err);
    return false;
  }
}
