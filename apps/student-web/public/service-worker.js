self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const options = {
    body: payload.body || '',
    icon: new URL('/icon.png', self.location.origin).href,
    badge: new URL('/icon.png', self.location.origin).href,
    data: { url: payload.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(payload.title || 'Şakanın Sınırında', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((candidate) => new URL(candidate.url).origin === self.location.origin);
      if (client) return client.navigate(target.href).then(() => client.focus());
      return self.clients.openWindow(target.href);
    }),
  );
});
