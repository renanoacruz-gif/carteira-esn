/* Service worker só para o lembrete diário (push). Sem cache, sem modo offline. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => e.waitUntil(self.registration.showNotification('Gestão de Carteira ESN', {
  body: 'Bom dia! Já analisou sua carteira hoje? Abra a ferramenta e veja onde vale aprofundar.',
  icon: '/sobre/icons/icon-192.png', badge: '/sobre/icons/favicon-48.png', tag: 'lembrete-diario', renotify: false
})));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) return c.focus();
    return self.clients.openWindow('/?lembrete=1');
  }));
});
