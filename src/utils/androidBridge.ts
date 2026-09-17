/**
 * Android WebView & FCM Native Bridge Integration Utility for BETGURU
 * Package: com.aistudio.betguru.pxvmbq
 * Handles two-way communication between Android Native App and Web Application.
 */

import { doc, setDoc } from 'firebase/firestore';
import { db, cleanFirestoreData } from '../firebase';
import { User } from '../types';
import { getNativeAppVersion, clearNativeAppCache, triggerAppUpdate } from './appUpdateService';

export const ANDROID_PACKAGE_NAME = 'com.aistudio.betguru.pxvmbq';
export const FCM_TOKEN_STORAGE_KEY = 'betguru_fcm_token';
export const IS_NATIVE_STORAGE_KEY = 'betguru_is_native_app';

export interface NativePushNotificationPayload {
  token?: string;
  notification?: {
    title?: string;
    body?: string;
    image?: string;
    icon?: string;
  };
  data?: {
    type?: string;
    target_url?: string;
    targetUrl?: string;
    action?: string;
    amount?: string | number;
    id?: string;
    [key: string]: any;
  };
  title?: string;
  body?: string;
  type?: string;
  target_url?: string;
}

/**
 * Check if the web app is running inside the Android Native WebView
 */
export function isAndroidNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean(window.AndroidBridge) ||
    navigator.userAgent.includes('BetGuruAndroid') ||
    sessionStorage.getItem(IS_NATIVE_STORAGE_KEY) === 'true' ||
    localStorage.getItem(IS_NATIVE_STORAGE_KEY) === 'true'
  );
}

/**
 * Retrieve cached or live FCM token from AndroidBridge or LocalStorage
 */
export function getStoredFcmToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (window.AndroidBridge && typeof window.AndroidBridge.getFcmToken === 'function') {
    try {
      const token = window.AndroidBridge.getFcmToken();
      if (token && typeof token === 'string' && token.trim().length > 0) {
        return token.trim();
      }
    } catch (_) {}
  }
  return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
}

/**
 * Save FCM token to the user database and local cache
 */
export async function saveTokenToUserDatabase(fcmToken: string, activeUser?: User | null): Promise<void> {
  if (!fcmToken || typeof fcmToken !== 'string') return;
  const cleanToken = fcmToken.trim();
  if (!cleanToken) return;

  // 1. Cache token and flag native mode in storage
  try {
    localStorage.setItem(FCM_TOKEN_STORAGE_KEY, cleanToken);
    localStorage.setItem(IS_NATIVE_STORAGE_KEY, 'true');
    sessionStorage.setItem(IS_NATIVE_STORAGE_KEY, 'true');
  } catch (_) {}

  // 2. Dispatch custom event for real-time UI indicators
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('betguru_fcm_token_updated', {
        detail: { fcmToken: cleanToken, platform: 'android' }
      })
    );
  }

  // 3. Persist to Firestore user document if user is authenticated
  const targetUid = activeUser?.id || (activeUser as any)?.canonicalUid;
  if (targetUid && targetUid !== 'anonymous') {
    try {
      const userRef = doc(db, 'users', targetUid);
      const updateData = {
        fcmToken: cleanToken,
        isNativeApp: true,
        fcmUpdatedAt: new Date().toISOString(),
        platform: 'android',
        appPackage: ANDROID_PACKAGE_NAME
      };
      await setDoc(userRef, cleanFirestoreData(updateData), { merge: true });
      console.log('✅ FCM token successfully synchronized to user profile in Firestore:', targetUid);
    } catch (err) {
      console.warn('⚠️ Could not save FCM token to Firestore user profile:', err);
    }
  }

  // 4. Notify Android bridge if it provides confirmation callback
  if (typeof window !== 'undefined' && window.AndroidBridge) {
    try {
      if (typeof window.AndroidBridge.onTokenSaved === 'function') {
        window.AndroidBridge.onTokenSaved(cleanToken);
      }
    } catch (_) {}
  }
}

/**
 * Resolve target destination route from deep link URL or notification type
 */
export function resolveNativeRoute(type?: string, targetUrl?: string): string {
  const rawType = (type || '').toLowerCase().trim();
  const rawUrl = (targetUrl || '').toLowerCase().trim();

  if (rawUrl.includes('/deposit') || rawType === 'deposit') return 'deposit';
  if (rawUrl.includes('/withdraw') || rawType === 'withdrawal' || rawType === 'withdraw') return 'withdrawal';
  if (rawUrl.includes('/supercar') || rawType === 'supercar') return 'supercar';
  if (rawUrl.includes('/roulette') || rawType === 'roulette') return 'roulette';
  if (rawUrl.includes('/andarbahar') || rawUrl.includes('/andar_bahar') || rawType === 'andar_bahar' || rawType === 'andarbahar') return 'andar_bahar';
  if (rawUrl.includes('/aviator') || rawUrl.includes('/crash') || rawType === 'crash' || rawType === 'aviator') return 'crash';
  if (rawUrl.includes('/dragontiger') || rawUrl.includes('/dragon_tiger') || rawType === 'dragon_tiger' || rawType === 'dragontiger') return 'dragon_tiger';
  if (rawUrl.includes('/wheel') || rawUrl.includes('/lucky_wheel') || rawType === 'lucky_wheel' || rawType === 'wheel') return 'lucky_wheel';
  if (rawUrl.includes('/tickets') || rawUrl.includes('/mytickets') || rawType === 'tickets' || rawType === 'mytickets') return 'tickets';
  if (rawUrl.includes('/results') || rawType === 'results') return 'results';
  if (rawUrl.includes('/offers') || rawType === 'offers' || rawType === 'promotion') return 'offers';
  if (rawUrl.includes('/support') || rawUrl.includes('/chat') || rawType === 'support' || rawType === 'chat') return 'support';
  if (rawUrl.includes('/profile') || rawType === 'profile') return 'profile';
  if (rawUrl.includes('/settings') || rawType === 'settings') return 'settings';
  if (rawUrl.includes('/history') || rawType === 'history') return 'history';
  if (rawUrl.includes('/lottery') || rawType === 'lottery') return 'lottery';

  return 'home';
}

export interface AndroidBridgeSetupOptions {
  onTokenReceived?: (token: string) => void;
  onRouteRequested?: (actionType: string, targetUrl?: string) => void;
  onNotificationReceived?: (notification: {
    title: string;
    body: string;
    type?: string;
    targetUrl?: string;
    rawPayload?: any;
  }) => void;
  getCurrentUser?: () => User | null;
}

/**
 * Initialize Android Bridge listeners and window handlers
 */
export function setupAndroidBridge(options: AndroidBridgeSetupOptions = {}): () => void {
  if (typeof window === 'undefined') return () => {};

  // Check Android Bridge existence and mark native session
  if (window.AndroidBridge) {
    try {
      sessionStorage.setItem(IS_NATIVE_STORAGE_KEY, 'true');
      localStorage.setItem(IS_NATIVE_STORAGE_KEY, 'true');
    } catch (_) {}
  }

  // 1. Initial direct check on window.AndroidBridge
  if (window.AndroidBridge && typeof window.AndroidBridge.getFcmToken === 'function') {
    try {
      const fcmToken = window.AndroidBridge.getFcmToken();
      if (fcmToken) {
        console.log('📱 FCM Token from AndroidBridge:', fcmToken);
        const currentUser = options.getCurrentUser ? options.getCurrentUser() : null;
        saveTokenToUserDatabase(fcmToken, currentUser);
        options.onTokenReceived?.(fcmToken);
      }
    } catch (e) {
      console.warn('Error reading token from AndroidBridge:', e);
    }
  }

  // 2. Native Ready Custom Event Listener
  const handleNativeReady = (e: any) => {
    const token = e.detail?.fcmToken || e.detail?.token || (typeof e.detail === 'string' ? e.detail : null);
    if (token) {
      console.log('📱 FCM Token from betGuruNativeReady event:', token);
      const currentUser = options.getCurrentUser ? options.getCurrentUser() : null;
      saveTokenToUserDatabase(token, currentUser);
      options.onTokenReceived?.(token);
    }
  };

  // 3. Native Push Notification Event Listener & Payload Processor
  const handleNativePush = (payload: any) => {
    if (!payload) return;
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const title = parsed?.notification?.title || parsed?.title || 'BETGURU Notification';
      const body = parsed?.notification?.body || parsed?.body || parsed?.message || '';
      const type = parsed?.data?.type || parsed?.type || '';
      const targetUrl = parsed?.data?.target_url || parsed?.data?.targetUrl || parsed?.target_url || parsed?.targetUrl || '';

      console.log('📬 Native Push Notification Received:', { title, body, type, targetUrl });

      // Check if this push is an in-app update trigger
      if (type === 'app_update' || parsed?.data?.type === 'app_update') {
        const apkUrl = parsed?.data?.apk_url || parsed?.data?.apkUrl || parsed?.apk_url || parsed?.apkUrl || '';
        const versionName = parsed?.data?.version_name || parsed?.data?.versionName || parsed?.version_name || parsed?.versionName || '2.0';
        const changelog = parsed?.data?.changelog || parsed?.changelog || '';
        const forceUpdate = parsed?.data?.force_update === true || parsed?.data?.force_update === 'true' || parsed?.data?.forceUpdate === true || false;
        
        triggerAppUpdate(apkUrl, versionName, changelog, forceUpdate);
      }

      // Trigger notification UI callback
      options.onNotificationReceived?.({
        title,
        body,
        type,
        targetUrl,
        rawPayload: parsed
      });

      // Instantly dispatch wallet sync request across the application
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('betguru_sync_wallet_request', {
          detail: { title, body, type, targetUrl, rawPayload: parsed }
        }));
      }

      // Trigger route navigation if present
      if (type || targetUrl) {
        const actionType = resolveNativeRoute(type, targetUrl);
        options.onRouteRequested?.(actionType, targetUrl);
      }
    } catch (err) {
      console.warn('Error parsing native push payload:', err);
    }
  };

  const handlePushEvent = (e: any) => {
    handleNativePush(e.detail || e);
  };

  const handleAppResume = () => {
    console.log('📱 Android app resume detected, triggering full wallet & transactions sync');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('betguru_app_resumed', { detail: { timestamp: Date.now() } }));
      window.dispatchEvent(new CustomEvent('betguru_sync_wallet_request', { detail: { reason: 'app_resume' } }));
    }
  };

  // 4. Attach Global window methods for direct native bridge calls
  window.saveTokenToUserDatabase = (token: string) => {
    const currentUser = options.getCurrentUser ? options.getCurrentUser() : null;
    saveTokenToUserDatabase(token, currentUser);
    options.onTokenReceived?.(token);
  };

  window.onAppResume = handleAppResume;
  window.betGuruResume = handleAppResume;

  // Alias for backward compatibility with user native app script
  window.saveUserFcmTokenToServer = (token: string) => {
    const currentUser = options.getCurrentUser ? options.getCurrentUser() : null;
    saveTokenToUserDatabase(token, currentUser);
    options.onTokenReceived?.(token);
  };

  window.saveUserTokenToBackend = (token: string) => {
    const currentUser = options.getCurrentUser ? options.getCurrentUser() : null;
    saveTokenToUserDatabase(token, currentUser);
    options.onTokenReceived?.(token);
  };

  window.handleNativePushNotification = (payload: any) => {
    handleNativePush(payload);
  };

  window.getNativeFcmToken = () => {
    return getStoredFcmToken();
  };

  // App Update Native Bridge Handlers
  window.triggerAppUpdate = (apkUrl: string, versionName: string, changelog?: string, forceUpdate?: boolean) => {
    triggerAppUpdate(apkUrl, versionName, changelog, forceUpdate);
  };

  window.getNativeAppVersion = () => {
    return getNativeAppVersion();
  };

  window.clearNativeAppCache = () => {
    clearNativeAppCache();
  };

  // 5. Custom App Update Event Listener
  const handleAppUpdateEvent = (e: any) => {
    const detail = e.detail || {};
    if (detail.apkUrl || detail.versionName) {
      triggerAppUpdate(detail.apkUrl, detail.versionName, detail.changelog, detail.forceUpdate);
    }
  };

  // Register DOM event listeners
  window.addEventListener('betGuruNativeReady', handleNativeReady);
  window.addEventListener('betGuruPushNotification', handlePushEvent);
  window.addEventListener('betguruTriggerAppUpdate', handleAppUpdateEvent);
  window.addEventListener('message', (event) => {
    // Also support iframe or postMessage notifications from Android WebViews
    try {
      if (event.data && typeof event.data === 'object') {
        if (event.data.type === 'betGuruNativeReady' || event.data.fcmToken) {
          handleNativeReady({ detail: event.data });
        } else if (event.data.type === 'betGuruPushNotification' || event.data.notification) {
          handleNativePush(event.data);
        } else if (event.data.type === 'betGuruResume' || event.data.type === 'onResume' || event.data.type === 'BETGURU_SYNC_WALLET') {
          handleAppResume();
        } else if (event.data.type === 'betguru_app_update' || event.data.type === 'betguruTriggerAppUpdate') {
          handleAppUpdateEvent({ detail: event.data });
        }
      }
    } catch (_) {}
  });

  // Return cleanup function
  return () => {
    window.removeEventListener('betGuruNativeReady', handleNativeReady);
    window.removeEventListener('betGuruPushNotification', handlePushEvent);
    window.removeEventListener('betguruTriggerAppUpdate', handleAppUpdateEvent);
  };
}
