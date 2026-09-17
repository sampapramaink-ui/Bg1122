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
    const { title, body, message, targetUrl, type, speak, token, fcmToken, topic } = req.body || {};
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

    const effectiveTargetUrl = targetUrl || '/orders';
    const effectiveType = type || 'transaction';

    const fcmMessage = {
      notification: {
        title: String(title),
        body: String(effectiveBody),
      },
      data: {
        title: String(title),
        body: String(effectiveBody),
        message: String(effectiveBody),
        target_url: String(effectiveTargetUrl),
        targetUrl: String(effectiveTargetUrl),
        type: String(effectiveType),
        channel_id: 'betguru_transactions',
        channelId: 'betguru_transactions',
        sound: 'default',
        speak: speak === false ? 'false' : 'true',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        priority: 'high',
        timestamp: String(Date.now()),
      },
      android: {
        priority: 'high',
        ttl: 2419200,
        notification: {
          channelId: 'betguru_transactions',
          priority: 'max',
          sound: 'default',
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          notificationPriority: 'PRIORITY_MAX',
          ticker: String(title),
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

    const directToken = token || fcmToken;
    let result;
    if (directToken && typeof directToken === 'string' && directToken.trim().length > 10) {
      fcmMessage.token = directToken.trim();
      result = await messaging.send(fcmMessage);
    } else {
      const targetTopic = (topic && typeof topic === 'string' && topic.trim()) ? topic.trim() : 'admin';
      fcmMessage.topic = targetTopic;
      result = await messaging.send(fcmMessage);
    }

    console.log('✅ FCM Admin push sent successfully:', result);

    return res.status(200).json({
      success: true,
      delivered: true,
      message: 'Admin push dispatched successfully in 0s',
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
