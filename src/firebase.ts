import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager,
  memoryLocalCache,
  doc, 
  getDoc,
  getDocFromServer 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

export { firebaseConfig };
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Target database ID explicitly from configuration
const targetDatabaseId = firebaseConfig.firestoreDatabaseId || "(default)";

let firestoreInstance;
try {
  // Use memoryLocalCache to eliminate IndexedDB lock contention, iframe storage blocking, and stale cached balances.
  // Use experimentalAutoDetectLongPolling to enable instant WebSocket real-time sync with automatic long-polling fallback.
  firestoreInstance = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  }, targetDatabaseId);
} catch (_initErr) {
  try {
    firestoreInstance = getFirestore(app, targetDatabaseId);
  } catch (_fallbackErr) {
    firestoreInstance = getFirestore(app, targetDatabaseId);
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

export async function testConnection(): Promise<boolean> {
  try {
    const testDocRef = doc(db, '_connection_test_', 'ping');
    await getDocFromServer(testDocRef);
    console.log('✅ Firebase Real-time Firestore is connected successfully!');
    return true;
  } catch (err: any) {
    if (err?.code === 'not-found' || (err?.message && !err.message.includes('offline') && !err.message.includes('unavailable'))) {
      console.log('✅ Firebase Real-time Firestore server reached successfully!');
      return true;
    }
    console.warn('ℹ️ Firebase connection handshake notice:', err?.message || err);
    return false;
  }
}

/**
 * Recursively strips all undefined fields from an object so Firestore setDoc / updateDoc / addDoc never fail with 'Unsupported field value: undefined'
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

