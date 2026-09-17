import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountConfig } from './_serviceAccount.js';

let cachedApp = null;
let cachedMessaging = null;
let cachedFirestore = null;

import fs from 'fs';
import path from 'path';

let activeDbId = 'ai-studio-remixremixbetgur-9e39f044-97cb-4539-82bd-f43d541659d2';
let activeProjectId = 'gen-lang-client-0470266878';
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (raw.firestoreDatabaseId) activeDbId = raw.firestoreDatabaseId;
    if (raw.projectId) activeProjectId = raw.projectId;
  }
} catch (_) {}

const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || activeDbId;

export function getAdminApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedApp = existingApps[0];
    return cachedApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccountConfig.projectId || activeProjectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || serviceAccountConfig.clientEmail;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || serviceAccountConfig.privateKey;

  if (!privateKey || privateKey.trim().length < 20) {
    console.warn('⚠️ Firebase private key not available.');
    return null;
  }

  const sanitizedKey = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;

  try {
    cachedApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail: clientEmail.trim(),
        privateKey: sanitizedKey.trim(),
      }),
    });
    return cachedApp;
  } catch (err) {
    console.warn('⚠️ Failed to initialize Firebase Admin in Vercel function:', err.message);
    const fallbackApps = getApps();
    if (fallbackApps.length > 0) {
      cachedApp = fallbackApps[0];
      return cachedApp;
    }
    return null;
  }
}

export function getAdminMessaging() {
  if (cachedMessaging) {
    return cachedMessaging;
  }
  const app = getAdminApp();
  if (app) {
    try {
      cachedMessaging = getMessaging(app);
      return cachedMessaging;
    } catch (_) {}
  }
  return null;
}

export function getAdminFirestore() {
  if (cachedFirestore) {
    return cachedFirestore;
  }
  const app = getAdminApp();
  if (app) {
    try {
      cachedFirestore = getFirestore(app, FIRESTORE_DATABASE_ID);
      return cachedFirestore;
    } catch (err) {
      try {
        cachedFirestore = getFirestore(app);
        return cachedFirestore;
      } catch (fallbackErr) {
        console.warn('⚠️ Could not initialize Admin Firestore:', fallbackErr);
      }
    }
  }
  return null;
}
