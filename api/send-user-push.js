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
    const { token, fcmToken, userId, title, body, message, soundUrl, targetUrl, type, amount } = req.body || {};
    const effectiveBody = body || message || '';
    const effectiveToken = token || fcmToken || '';

    if (!title || !effectiveBody) {
      return res.status(400).json({ success: false, error: 'title and body/message are required' });
    }

    const messaging = getAdminMessaging();
    if (!messaging) {
      return res.status(200).json({
        success: false,
        delivered: false,
        error: 'Firebase Cloud Messaging could not be initialized.',
      });
    }

    const payload = {
      notification: {
        title: String(title),
        body: String(effectiveBody),
      },
      data: {
        title: String(title),
        body: String(effectiveBody),
        type: String(type || 'general'),
        targetUrl: String(targetUrl || '/'),
        amount: String(amount || ''),
        soundUrl: String(soundUrl || ''),
        speak: 'true',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'betguru_alerts',
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

    if (effectiveToken && typeof effectiveToken === 'string' && effectiveToken.trim().length > 10) {
      payload.token = effectiveToken.trim();
    } else if (userId) {
      payload.topic = `user_${userId}`;
    } else {
      payload.topic = 'all_users';
    }

    const result = await messaging.send(payload);
    console.log('✅ FCM User push sent successfully:', result);

    return res.status(200).json({
      success: true,
      delivered: true,
      result,
    });
  } catch (err) {
    console.error('⚠️ Vercel send-user-push error:', err);
    return res.status(200).json({
      success: false,
      delivered: false,
      error: err.message,
    });
  }
}
