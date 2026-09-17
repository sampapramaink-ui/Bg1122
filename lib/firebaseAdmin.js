// lib/firebaseAdmin.js
const admin = require('firebase-admin');

let projectId = "gen-lang-client-0470266878";
try {
  const cfg = require('../firebase-applet-config.json');
  if (cfg.projectId) projectId = cfg.projectId;
} catch (_) {}
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || `firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com`;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n');

if (!admin.apps.length) {
  try {
    if (privateKey && privateKey.trim().length > 20) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("🔥 Firebase Admin SDK initialized for project:", projectId);
    } else {
      admin.initializeApp({
        projectId,
      });
    }
  } catch (err) {
    console.info("ℹ️ Firebase Admin initialization notice:", err.message);
  }
}

/**
 * 📌 ডিপোজিট বা নতুন অর্ডারের সময় এই ফাংশনটি কল করুন:
 * Sends instant high-priority push notification to all BetGuru Admin devices
 */
async function notifyAdminNewOrder(title, body, targetUrl = "/orders") {
  const message = {
    topic: 'admin', // ✅ সমস্ত BetGuru Admin ডিভাইসে যাবে
    notification: {
      title: title,
      body: body,
    },
    data: {
      title: String(title),
      body: String(body),
      target_url: String(targetUrl),
      type: 'transaction',
      speak: 'true', // বাংলা ভয়েস অ্যালার্ট চালু রাখবে
    },
    android: {
      priority: 'high', // ⚡ স্ক্রিন অফ থাকলেও সঙ্গে সঙ্গে ওয়েক করবে
      notification: {
        channelId: 'betguru_transactions',
        priority: 'max',
        defaultSound: true,
        defaultVibrateTimings: true,
        visibility: 'public',
      },
    },
  };

  try {
    return await admin.messaging().send(message);
  } catch (error) {
    console.warn("notifyAdminNewOrder warning:", error.message);
    return { error: error.message };
  }
}

module.exports = { admin, notifyAdminNewOrder };
