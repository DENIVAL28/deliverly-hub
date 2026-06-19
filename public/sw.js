// Ativa imediatamente sem esperar fechar abas
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Novo pedido!";
  const options = {
    body: data.body || "Voce recebeu um novo pedido",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.tag || "pedido-novo",
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/empresa/pedidos" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        const url = event.notification.data?.url || "/empresa/pedidos";
        for (const client of clientList) {
          if (client.url.includes("/empresa/pedidos") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
