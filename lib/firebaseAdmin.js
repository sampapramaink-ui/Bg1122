// lib/firebaseAdmin.js
import { getAdminMessaging, getAdminApp } from '../api/_firebaseAdminHelper.js';

/**
 * 📌 ডিপোজিট বা নতুন অর্ডারের সময় এই ফাংশনটি কল করুন:
 * Sends instant high-priority push notification to all BetGuru Admin devices
 */
export async function notifyAdminNewOrder(title, body, targetUrl = "/orders") {
  const messaging = getAdminMessaging();
  if (!messaging) {
    console.warn("notifyAdminNewOrder warning: Firebase messaging not initialized");
    return { error: "Firebase messaging not initialized" };
  }

  const message = {
    topic: 'admin', // ✅ সমস্ত BetGuru Admin ডিভাইসে যাবে
    notification: {
      title: String(title),
      body: String(body),
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
    const result = await messaging.send(message);
    return { success: true, result };
  } catch (error) {
    console.warn("notifyAdminNewOrder warning:", error.message);
    return { error: error.message };
  }
}

export const admin = {
  get app() { return getAdminApp(); },
  messaging: () => getAdminMessaging()
};

export default { notifyAdminNewOrder, admin };
