importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAg12tiBifLswke_km3nY6YQpf8ROyqup4",
  authDomain: "evaraos-web.firebaseapp.com",
  projectId: "evaraos-web",
  storageBucket: "evaraos-web.firebasestorage.app",
  messagingSenderId: "125377381598",
  appId: "1:125377381598:web:d63df45da3a09f0199ae4f",
  measurementId: "G-296N94CKPR"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  return self.registration.showNotification(notification.title || "New message", {
    body: notification.body || "You received a new message.",
    icon: "/assets/brand/evaraos-app-icon.png?v=brand-canonical-20260726-1",
    badge: "/assets/img/favicon-32.png",
    tag: `evara-message-${data.channelId || "chat"}`,
    renotify: true,
    data: {
      route: data.route || "/messages.html",
      channelId: data.channelId || "",
      messageId: data.messageId || ""
    }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification?.data?.route || "/messages.html";
  const destination = new URL(route, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    return clients.openWindow(destination);
  })());
});
