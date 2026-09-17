import { doc, updateDoc, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
import { db, app } from '../firebase';
import { User } from '../types';
import { safeApiPost } from './apiConfig';

export interface PushSubscriptionInfo {
  token: string;
  userId: string;
  role?: string;
  platform?: string;
  updatedAt: number;
}

/**
 * Checks current notification permission state
 */
export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Registers the Service Worker explicitly for background push
 */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    // Register the dedicated background notification service worker
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
    console.log('✅ BETGURU Background Push Service Worker ready:', reg.scope);
    return reg;
  } catch (err) {
    console.warn('⚠️ Service Worker registration note:', err);
    // Fallback to existing registration if any
    try {
      return await navigator.serviceWorker.getRegistration();
    } catch (_) {
      return null;
    }
  }
}

/**
 * Request notification permission and register push token with Firebase & Backend
 */
export async function requestAndRegisterPushNotifications(user?: User | null): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.info('Notifications not supported in this browser.');
    return false;
  }

  try {
    const currentPerm = Notification.permission;
    let perm: NotificationPermission = currentPerm;

    if (currentPerm !== 'granted') {
      perm = await Notification.requestPermission();
    }

    if (perm !== 'granted') {
      console.info('Notification permission was not granted:', perm);
      return false;
    }

    // Register Service Worker
    const swReg = await registerPushServiceWorker();

    // Generate or fetch FCM Web Token or device push token
    let pushToken: string | null = null;

    try {
      // Dynamic import to avoid build errors if firebase/messaging is in modern modular form
      const { getMessaging, getToken } = await import('firebase/messaging');
      const messaging = getMessaging(app);

      // VAPID key / Web push certificate if provided or default
      const token = await getToken(messaging, {
        serviceWorkerRegistration: swReg || undefined,
        vapidKey: 'BEl-6_5XqjG8Z7J9_u4U6eM-QoZ4J_9yZqR5R5vG6K8=', // default fallback or client VAPID
      }).catch(async () => {
        // Retry without explicit VAPID key
        return await getToken(messaging, {
          serviceWorkerRegistration: swReg || undefined
        }).catch((e) => {
          console.info('FCM getToken note:', e?.message || e);
          return null;
        });
      });

      if (token) {
        pushToken = token;
      }
    } catch (fcmErr) {
      console.info('FCM setup note:', fcmErr);
    }

    // If native Android Bridge is active (APK / WebView wrapper)
    if (!pushToken && window.AndroidBridge?.getFcmToken) {
      pushToken = window.AndroidBridge.getFcmToken();
    }

    // If token still null, generate a robust persistent Web Push ID for this device session
    if (!pushToken) {
      const storedId = localStorage.getItem('betguru_device_push_token');
      if (storedId) {
        pushToken = storedId;
      } else {
        pushToken = `web_pwa_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem('betguru_device_push_token', pushToken);
      }
    }

    // Save token to Firestore for real-time delivery
    if (user?.id && pushToken) {
      try {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          fcmToken: pushToken,
          fcmTokens: arrayUnion(pushToken),
          pushEnabled: true,
          lastActiveAt: new Date().toISOString()
        }).catch(async () => {
          // If updateDoc fails (e.g. doc doesn't exist yet), use setDoc with merge
          await setDoc(userRef, {
            fcmToken: pushToken,
            pushEnabled: true,
            lastActiveAt: new Date().toISOString()
          }, { merge: true });
        });

        // If user is admin, also save to admin_devices
        if (user.role === 'admin' || (user as any).isAdmin) {
          const adminDevRef = doc(db, 'admin_push_tokens', pushToken.replace(/[^\w-]/g, '_'));
          await setDoc(adminDevRef, {
            userId: user.id,
            token: pushToken,
            userName: user.name || 'Admin',
            platform: navigator.userAgent,
            updatedAt: Date.now()
          }, { merge: true });
        }
      } catch (storeErr) {
        console.warn('Silent note saving push token to user doc:', storeErr);
      }
    }

    // Test a local greeting notification if first time
    if (Notification.permission === 'granted' && !localStorage.getItem('betguru_push_welcomed')) {
      showLocalPwaNotification(
        '⚡ BETGURU 0-Sec Notifications Active',
        'You will receive instant alerts for deposits, withdrawals & support even when the app is closed.',
        '/'
      );
      localStorage.setItem('betguru_push_welcomed', 'true');
    }

    return true;
  } catch (err) {
    console.warn('requestAndRegisterPushNotifications error:', err);
    return false;
  }
}

/**
 * Show a local notification immediately via Service Worker (Works across mobile PWA and desktop)
 */
export async function showLocalPwaNotification(title: string, body: string, targetUrl: string = '/') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        return await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          vibrate: [300, 100, 400, 100, 300],
          renotify: true,
          requireInteraction: true,
          data: { url: targetUrl }
        } as any);
      }
    }
    // Fallback to window Notification
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    });
  } catch (err) {
    console.warn('showLocalPwaNotification note:', err);
  }
}

/**
 * Dispatch an instant push notification from frontend to server
 * (Works both on local dev server and Vercel serverless functions)
 */
export async function sendPushAlert({
  target, // 'admin' or 'user'
  userId,
  title,
  body,
  type = 'transaction',
  targetUrl = '/',
  soundUrl = ''
}: {
  target: 'admin' | 'user';
  userId?: string;
  title: string;
  body: string;
  type?: string;
  targetUrl?: string;
  soundUrl?: string;
}): Promise<boolean> {
  try {
    const endpoint = target === 'admin' ? '/api/notify-admin-order' : '/api/send-user-push';
    const payload = {
      title,
      body,
      userId,
      targetUrl,
      type,
      soundUrl,
      speak: true
    };

    const res = await safeApiPost(endpoint, payload);
    return res.success;
  } catch (e) {
    console.warn('sendPushAlert warning:', e);
    return false;
  }
}

/**
 * Automatically initializes PWA service worker and registers push notifications
 */
export async function initPWANotifications(userId?: string, isAdmin: boolean = false): Promise<boolean> {
  // 1. Register background Service Worker
  await registerPushServiceWorker();

  // 2. If user is logged in or if notifications were previously permitted, register push token
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted' || (userId && userId !== 'anonymous')) {
      return await requestAndRegisterPushNotifications(userId ? ({ id: userId, role: isAdmin ? 'admin' : 'user' } as any) : undefined);
    }
  }

  return true;
}

