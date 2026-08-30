const NOTIFICATION_INTENT_PREFIX = '#pq-notification=';
const SPOT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DELIVERY_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function normalizeSpotId(value) {
  if (
    typeof value !== 'string' ||
    !SPOT_ID_PATTERN.test(value) ||
    value.startsWith('mycar_')
  ) {
    return null;
  }

  return value;
}

function normalizeNotificationIntent(data = {}) {
  if (data.version === 1) {
    if (data.type === 'ping') {
      const spotId = normalizeSpotId(data.spotId);
      return spotId
        ? { version: 1, type: 'ping', spotId }
        : { version: 1, type: 'notifications' };
    }

    if (data.type === 'my_car') {
      return { version: 1, type: 'my_car' };
    }

    if (data.type === 'notifications') {
      return { version: 1, type: 'notifications' };
    }
  }

  if (data.navigationVersion === '1') {
    if (data.navigationType === 'ping') {
      const spotId = normalizeSpotId(data.spotId);
      return spotId
        ? { version: 1, type: 'ping', spotId }
        : { version: 1, type: 'notifications' };
    }

    if (data.navigationType === 'my_car') {
      return { version: 1, type: 'my_car' };
    }

    if (data.navigationType === 'notifications') {
      return { version: 1, type: 'notifications' };
    }

    return { version: 1, type: 'notifications' };
  }

  const legacySpotId = normalizeSpotId(data.spotId);
  return legacySpotId
    ? { version: 1, type: 'ping', spotId: legacySpotId }
    : { version: 1, type: 'notifications' };
}

function intentFragment(intent) {
  const value = intent.type === 'ping'
    ? `v1:ping:${intent.spotId}`
    : `v1:${intent.type}`;

  return `${NOTIFICATION_INTENT_PREFIX}${encodeURIComponent(value)}`;
}

function notificationData(notification) {
  return notification?.data?.FCM_MSG?.data || notification?.data || {};
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const intent = normalizeNotificationIntent(notificationData(event.notification));

  event.waitUntil((async () => {
    const appOrigin = self.location.origin;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appWindow = windows.find((client) => {
      try {
        return new URL(client.url).origin === appOrigin;
      } catch {
        return false;
      }
    });

    if (appWindow) {
      appWindow.postMessage({
        kind: 'PARQUEEN_NOTIFICATION_OPEN',
        version: 1,
        intent,
      });
      await appWindow.focus();
      return;
    }

    await self.clients.openWindow(
      new URL(`/${intentFragment(intent)}`, appOrigin).href,
    );
  })());
});

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyCKSqWVd6JqpcrNUG6hei8Ug1njaIkAI7Y',
  authDomain: 'parkqueen-46475363-ccf36.firebaseapp.com',
  projectId: 'parkqueen-46475363-ccf36',
  storageBucket: 'parkqueen-46475363-ccf36.firebasestorage.app',
  messagingSenderId: '768131391875',
  appId: '1:768131391875:web:613c5d2a948862333196b6',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Notification-bearing FCM messages are displayed automatically. Displaying
  // them again here would create duplicate notifications.
  if (payload.notification) {
    return;
  }

  const title = payload.data?.title?.trim();
  const body = payload.data?.body?.trim();
  if (!title || !body || title.length > 120 || body.length > 500) {
    return;
  }

  const intent = normalizeNotificationIntent(payload.data);
  const deliveryId = DELIVERY_ID_PATTERN.test(payload.data?.deliveryId || '')
    ? payload.data.deliveryId
    : undefined;

  return self.registration.showNotification(title, {
    body,
    icon: '/icons/parqueen-192.png',
    badge: '/icons/parqueen-192.png',
    ...(deliveryId ? { tag: deliveryId } : {}),
    data: intent,
  });
});
