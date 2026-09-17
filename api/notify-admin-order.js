import { getAdminMessaging } from './_firebaseAdminHelper.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { title, body, message, targetUrl, type, speak } = req.body || {};
    const effectiveBody = body || message || '';

    if (!title || !effectiveBody) {
      return res.status(400).json({ success: false, error: 'Title and body are required.' });
    }

    const messaging = getAdminMessaging();
    if (!messaging) {
      return res.status(200).json({
        success: false,
        delivered: false,
        error: 'Firebase Cloud Messaging could not be initialized.',
      });
    }

    const fcmMessage = {
      topic: 'admin',
      notification: {
        title: String(title),
        body: String(effectiveBody),
      },
      data: {
        title: String(title),
        body: String(effectiveBody),
        target_url: String(targetUrl || '/orders'),
        type: String(type || 'transaction'),
        speak: speak === false ? 'false' : 'true',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'betguru_transactions',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public',
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          title: String(title),
          body: String(effectiveBody),
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          requireInteraction: true,
          vibrate: [300, 100, 400, 100, 300],
        },
      },
    };

    const result = await messaging.send(fcmMessage);
    console.log('✅ FCM Admin push sent successfully:', result);

    return res.status(200).json({
      success: true,
      delivered: true,
      message: 'Admin push dispatched to topic: admin',
      result,
    });
  } catch (err) {
    console.error('⚠️ Vercel notify-admin-order error:', err);
    return res.status(200).json({
      success: false,
      delivered: false,
      error: err.message,
    });
  }
}
