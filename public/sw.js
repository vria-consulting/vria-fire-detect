// Service worker VigiFire : réception des notifications push d'alerte feu.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "VigiFire", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "🔥 VigiFire", {
      body: data.body || "Nouveau foyer détecté dans votre zone.",
      data: { url: data.url || "/" },
      badge: "/icon.png",
      icon: "/icon.png",
      tag: data.url || "vigifire",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
