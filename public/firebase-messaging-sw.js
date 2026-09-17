// public/firebase-messaging-sw.js
// BETGURU High-Priority Background Push Service Worker (0 Sec Latency Wakeup)

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCX79e7g5009Gk0T_67c2V_3b9T498WvKk",
  authDomain: "gen-lang-client-0707039218.firebaseapp.com",
  projectId: "gen-lang-client-0707039218",
  storageBucket: "gen-lang-client-0707039218.firebasestorage.app",
  messagingSenderId: "473324684992",
  appId: "1:473324684992:web:dd88f9180f6828555938bf"
};

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} catch (e) {
  console.warn('Firebase sw init notice:', e);
}

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.warn('Firebase messaging sw notice:', e);
}

// 1. Firebase Background Message Event (Runs when PWA is closed or device is sleeping)
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[BETGURU SW] Received background FCM message:', payload);
    const title = payload.notification?.title || payload.data?.title || '⚡ BETGURU Notification';
    const body = payload.notification?.body || payload.data?.body || 'New instant update from BETGURU';
    const type = payload.data?.type || 'general';
    const targetUrl = payload.data?.target_url || payload.data?.targetUrl || '/';

    const options = {
      body: body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      image: payload.notification?.image || undefined,
      tag: `betguru-${type}-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 150, 400, 150, 400, 200, 600],
      actions: [
        { action: 'open', title: '🚀 Open BETGURU' },
        { action: 'dismiss', title: 'Close' }
      ],
      data: {
        url: targetUrl,
        type: type,
        timestamp: Date.now()
      }
    };

    // Broadcast wallet sync event to all active clients
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'BETGURU_SYNC_WALLET',
          source: 'sw_background_message',
          payload
        });
      });
    }).catch(() => {});

    return self.registration.showNotification(title, options);
  });
}

// 2. Direct Web Push Event (Fallback / High-Speed Direct Push)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: '⚡ BETGURU Alert', body: event.data.text() };
  }

  // Broadcast wallet sync event to any open or waking client windows
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    windowClients.forEach((client) => {
      client.postMessage({
        type: 'BETGURU_SYNC_WALLET',
        source: 'sw_push',
        payload
      });
    });
  }).catch(() => {});

  const title = payload.notification?.title || payload.title || payload.data?.title || '⚡ BETGURU Alert';
  const body = payload.notification?.body || payload.body || payload.data?.body || 'New deposit, withdrawal, or support message';
  const type = payload.data?.type || payload.type || 'transaction';
  const targetUrl = payload.data?.target_url || payload.data?.targetUrl || payload.targetUrl || '/';

  const options = {
    body: body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `betguru-${type}-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [400, 150, 400, 150, 400, 200, 600],
    actions: [
      { action: 'open', title: '🚀 View App' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: {
      url: targetUrl,
      type: type,
      timestamp: Date.now()
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 3. Notification Click Handler (Focus existing tab or launch PWA standalone window)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it, send wallet sync trigger, and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'BETGURU_SYNC_WALLET',
            source: 'sw_notification_click',
            data: event.notification.data
          });
          if (client.url && 'navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      // If no window open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 4. Force immediate Service Worker activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
