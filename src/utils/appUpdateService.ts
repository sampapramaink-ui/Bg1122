/**
 * BETGURU In-App APK Update & Native Version Control Service
 * Handles live update triggers, remote Firestore configs, FCM updates, and cache clearing.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, cleanFirestoreData } from '../firebase';
import { AppUpdateConfig } from '../types';
import { soundFx } from './audio';

export const DEFAULT_APP_VERSION = '1.0';
export const APP_VERSION_STORAGE_KEY = 'betguru_app_version';
export const DISMISSED_UPDATE_VERSION_KEY = 'betguru_dismissed_update_version';

export const DEFAULT_APP_UPDATE_CONFIG: AppUpdateConfig = {
  versionCode: 2,
  versionName: '2.0',
  apkUrl: 'https://your-domain.com/downloads/betguru.apk',
  changelog: '• নতুন লাইভ ক্যাসিনো ও সুপার কার গেমস\n• সুপারফাস্ট ডিপোজিট ও ইনস্ট্যান্ট উইথড্রয়াল গেটওয়ে\n• পারফরমেন্স উন্নতি ও ফিক্সড রিয়েল-টাইম অডিও',
  forceUpdate: false,
  minSupportedVersion: '1.0',
  releaseDate: new Date().toISOString().split('T')[0],
  enabled: true
};

/**
 * Retrieve the current running native/web application version
 */
export function getNativeAppVersion(): string {
  if (typeof window === 'undefined') return DEFAULT_APP_VERSION;
  
  // 1. Check if Android Bridge has explicit version
  if (window.AndroidBridge && typeof window.AndroidBridge.getAppVersion === 'function') {
    try {
      const bridgeVer = window.AndroidBridge.getAppVersion();
      if (bridgeVer && typeof bridgeVer === 'string' && bridgeVer.trim().length > 0) {
        return bridgeVer.trim();
      }
    } catch (_) {}
  }

  // 2. Check LocalStorage fallback
  try {
    const stored = localStorage.getItem(APP_VERSION_STORAGE_KEY);
    if (stored && stored.trim().length > 0) {
      return stored.trim();
    }
  } catch (_) {}

  return DEFAULT_APP_VERSION;
}

/**
 * Set the simulated or native client version
 */
export function setLocalAppVersion(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, version.trim());
  } catch (_) {}
}

/**
 * Clear application cache (CacheStorage, sessionStorage, and temp keys) and hard reload
 */
export async function clearNativeAppCache(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    soundFx.playClick();
    // 1. Clear CacheStorage (Service Worker / PWA Caches)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('🧹 All browser CacheStorage cleared successfully');
    }

    // 2. Clear SessionStorage
    sessionStorage.clear();

    // 3. Clear temporary volatile localStorage items (keep critical user session intact)
    const preserveKeys = ['betguru_session_token', 'betguru_user_id', 'betguru_fcm_token'];
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !preserveKeys.includes(k) && !k.startsWith('firebase:')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    console.log('🧹 Native app cache and temporary stores reset.');
  } catch (err) {
    console.warn('⚠️ Error during cache clear:', err);
  } finally {
    // 4. Force hard reload from server
    setTimeout(() => {
      window.location.reload();
    }, 200);
  }
}

/**
 * Trigger in-app update dialog directly on player screen
 */
export function triggerAppUpdate(
  apkUrl: string,
  versionName: string,
  changelog: string = '',
  forceUpdate: boolean = false
): void {
  if (typeof window === 'undefined') return;

  const detail: AppUpdateConfig = {
    versionCode: parseFloat(versionName) * 10 || 2,
    versionName: versionName || '2.0',
    apkUrl: apkUrl || DEFAULT_APP_UPDATE_CONFIG.apkUrl,
    changelog: changelog || DEFAULT_APP_UPDATE_CONFIG.changelog,
    forceUpdate: Boolean(forceUpdate),
    enabled: true
  };

  window.dispatchEvent(
    new CustomEvent('betguru_trigger_app_update', {
      detail
    })
  );

  console.log('🚀 Triggered In-App Update Dialog with payload:', detail);
}

/**
 * Compare two semver/version strings. Returns true if remoteVersion > currentVersion
 */
export function isVersionNewer(remoteVersion: string, currentVersion: string): boolean {
  if (!remoteVersion || !currentVersion) return false;

  const parseParts = (v: string) =>
    v
      .replace(/[^0-9.]/g, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const remoteParts = parseParts(remoteVersion);
  const currentParts = parseParts(currentVersion);

  const maxLen = Math.max(remoteParts.length, currentParts.length);
  for (let i = 0; i < maxLen; i++) {
    const r = remoteParts[i] || 0;
    const c = currentParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }

  return false;
}

/**
 * Fetch remote app update configuration from Firestore system_settings/app_update
 */
export async function fetchRemoteAppUpdateConfig(): Promise<AppUpdateConfig> {
  try {
    const snap = await getDoc(doc(db, 'system_settings', 'app_update'));
    if (snap.exists()) {
      return { ...DEFAULT_APP_UPDATE_CONFIG, ...snap.data() } as AppUpdateConfig;
    }
  } catch (err) {
    console.warn('Could not fetch remote app update config:', err);
  }
  return DEFAULT_APP_UPDATE_CONFIG;
}

/**
 * Save / Update the remote App Update configuration in Firestore
 */
export async function saveAppUpdateConfigToFirestore(config: AppUpdateConfig): Promise<void> {
  const updateData = {
    ...config,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'system_settings', 'app_update'), cleanFirestoreData(updateData), {
    merge: true
  });
}
