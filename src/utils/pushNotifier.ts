import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { safeApiPost } from './apiConfig';

export interface DispatchNotificationOptions {
  userId: string;
  userEmail?: string;
  title: string;
  message: string;
  type?: 'deposit' | 'withdrawal' | 'win' | 'loss' | 'system' | 'bet' | 'support';
  actionType?: 
    | 'deposit'
    | 'withdrawal'
    | 'lottery'
    | 'supercar'
    | 'crash'
    | 'roulette'
    | 'dragon_tiger'
    | 'andar_bahar'
    | 'lucky_wheel'
    | 'offers'
    | 'tickets'
    | 'results'
    | 'history'
    | 'profile'
    | 'support'
    | 'settings';
  targetUrl?: string;
  fcmToken?: string;
  sendEmail?: boolean;
}

/**
 * Universal Native Push Dispatcher
 * Sends a real-time high-priority native push notification to user's Android phone / background app.
 * Works seamlessly across Cloud Run, Vercel, PWA, and APK sleep mode.
 */
export async function dispatchNativePushToUser(options: DispatchNotificationOptions): Promise<boolean> {
  try {
    let token = options.fcmToken;

    // If token not provided directly, lookup from user doc in Firestore
    if (!token && options.userId && options.userId !== 'anonymous') {
      try {
        const userSnap = await getDoc(doc(db, 'users', options.userId));
        if (userSnap.exists()) {
          token = userSnap.data()?.fcmToken;
        }
      } catch (err) {
        console.warn('Silent note: Could not lookup user FCM token:', err);
      }
    }

    const payload: Record<string, any> = {
      userId: options.userId,
      title: options.title,
      message: options.message,
      body: options.message,
      type: options.type || 'transaction',
      targetUrl: options.targetUrl || '/'
    };

    if (token && typeof token === 'string' && token.trim().length > 10) {
      payload.fcmToken = token.trim();
      payload.token = token.trim();
    }

    const res = await safeApiPost('/api/send-user-push', payload);
    return res.success;
  } catch (err) {
    console.warn('Native push dispatch warning:', err);
    return false;
  }
}

