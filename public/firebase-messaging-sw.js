importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  projectId: "evaraos-web",
  messagingSenderId: "125377381598",
  appId: "1:125377381598:web:d63df45da3a09f0199ae4f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  return self.registration.showNotification(notification.title || "New message", {
    body: notification.body || "You received a new message.",
    icon: "/assets/img/icon-192.png",
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
