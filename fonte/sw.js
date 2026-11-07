/* Service worker só para o lembrete diário (push). Sem cache, sem modo offline. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  const manha = new Date().getHours() < 12; /* o push não leva conteúdo: o texto depende do horário no aparelho */
  e.waitUntil(self.registration.showNotification('Gestão de Carteira ESN', {
    body: manha ? 'Bom dia! Já analisou sua carteira hoje? Abra a ferramenta e veja onde vale aprofundar.' : 'Boa tarde! Já deu uma olhada na sua carteira hoje? Abra a ferramenta e veja o que mudou.',
    icon: '/sobre/icons/icon-192.png', badge: '/sobre/icons/favicon-48.png', tag: 'lembrete-diario', renotify: true
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) return c.focus();
    return self.clients.openWindow('/?lembrete=1');
  }));
});
