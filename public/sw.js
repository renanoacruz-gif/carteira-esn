/* Service worker só para o lembrete diário (push). Sem cache, sem modo offline. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
/* Texto: tenta o resumo (inteiro calculado no navegador do usuário na última visita); sem resposta em 4 s, vencido (>5 dias) ou zero, usa o texto geral. */
async function resumoTexto() {
  const c = new AbortController(), to = setTimeout(() => c.abort(), 4000);
  try {
    const r = await fetch('/api/push/resumo', { credentials: 'same-origin', redirect: 'manual', cache: 'no-store', signal: c.signal });
    if (!r.ok) return null;
    const j = await r.json(); if (!j || !j.ok || !Number.isInteger(j.n) || j.n < 1 || !j.em) return null;
    const em = new Date(j.em); if (!(Date.now() - em.getTime() < 5 * 86400000)) return null;
    const hoje = em.toDateString() === new Date().toDateString(), q = j.n === 1 ? '1 cliente' : j.n + ' clientes';
    return hoje ? q + ' com motivo para aprofundar hoje. Abra a ferramenta e veja quais.' : q + ' com motivo para aprofundar na sua última visita (' + String(em.getDate()).padStart(2, '0') + '/' + String(em.getMonth() + 1).padStart(2, '0') + '). Abra e confira.';
  } catch (e) { return null; } finally { clearTimeout(to); }
}
self.addEventListener('push', e => {
  const manha = new Date().getHours() < 12; /* o push não leva conteúdo: o texto depende do horário no aparelho */
  const geral = manha ? 'Bom dia! Já analisou sua carteira hoje? Abra a ferramenta e veja onde vale aprofundar.' : 'Boa tarde! Já deu uma olhada na sua carteira hoje? Abra a ferramenta e veja o que mudou.';
  e.waitUntil(resumoTexto().then(t => self.registration.showNotification('Gestão de Carteira ESN', {
    body: t || geral, icon: '/sobre/icons/icon-192.png', badge: '/sobre/icons/favicon-48.png', tag: 'lembrete-diario', renotify: true
  })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) return c.focus();
    return self.clients.openWindow('/?lembrete=1');
  }));
});
