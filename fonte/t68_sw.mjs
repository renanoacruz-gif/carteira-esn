// Texto do aviso no service worker (public/sw.js) em sandbox: sem rede real, sem navegador.
import fs from 'node:fs'; import vm from 'node:vm';
const src = fs.readFileSync(process.argv[2] || '../public/sw.js', 'utf8'); let F = [];
const ck = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x); if (!c) F.push(n); };
async function roda(resp, relogio) {
  const L = {}, shown = []; let url = null, opts = null;
  const Dt = relogio ? class extends Date { constructor(...a) { a.length ? super(...a) : super(relogio); } static now() { return relogio; } } : Date;
  const self = { addEventListener: (t, f) => { L[t] = f; }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => [] }, registration: { showNotification: async (t, o) => { shown.push([t, o]); } } };
  const fetch = (u, o) => { url = u; opts = o; return resp(o); };
  vm.runInNewContext(src, { self, fetch, Date: Dt, AbortController, setTimeout, clearTimeout, console, Number, JSON, String });
  let p; L.push({ waitUntil: x => { p = x; } }); await p; return { shown, url, opts };
}
const ok = j => () => Promise.resolve({ ok: true, json: async () => j });
const agora = Date.now(), iso = ms => new Date(ms).toISOString(), geral = b => /^(Bom dia|Boa tarde)/.test(b);
let r = await roda(ok({ ok: true, n: 3, em: iso(agora - 60000) })); let b = r.shown[0][1].body;
ck('n=3 hoje: texto com número e "hoje"', /^3 clientes com motivo para aprofundar hoje/.test(b), b);
ck('chamada só ao próprio endpoint, mesma origem, sem seguir redirect', r.url === '/api/push/resumo' && r.opts.credentials === 'same-origin' && r.opts.redirect === 'manual', JSON.stringify(r.opts));
r = await roda(ok({ ok: true, n: 1, em: iso(agora - 60000) })); ck('n=1: singular', /^1 cliente com motivo/.test(r.shown[0][1].body), r.shown[0][1].body);
r = await roda(ok({ ok: true, n: 4, em: iso(agora - 2 * 86400000) })); b = r.shown[0][1].body; ck('resumo de dias atrás: "na sua última visita (dd/mm)"', /^4 clientes .*última visita \(\d\d\/\d\d\)/.test(b), b);
for (const [nome, j] of [['n=0', { ok: true, n: 0, em: iso(agora) }], ['sem resumo (null)', { ok: true, n: null, em: null }], ['vencido (6 dias)', { ok: true, n: 5, em: iso(agora - 6 * 86400000) }], ['n não inteiro', { ok: true, n: 2.5, em: iso(agora) }], ['n texto', { ok: true, n: '3', em: iso(agora) }], ['ok=false', { ok: false }], ['data futura inválida', { ok: true, n: 3, em: 'x' }]]) {
  r = await roda(ok(j)); ck('texto geral: ' + nome, geral(r.shown[0][1].body), r.shown[0][1].body);
}
r = await roda(() => Promise.reject(new Error('rede'))); ck('falha de rede: texto geral e notificação mostrada', r.shown.length === 1 && geral(r.shown[0][1].body));
r = await roda(() => Promise.resolve({ ok: false, status: 302, json: async () => { throw new Error('x'); } })); ck('redirect/sessão expirada: texto geral', geral(r.shown[0][1].body));
r = await roda(() => Promise.resolve({ ok: true, json: async () => { throw new Error('json'); } })); ck('JSON inválido: texto geral', geral(r.shown[0][1].body));
const t0 = Date.now(); r = await roda(o => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('abort'))))); const dt = Date.now() - t0;
ck('sem resposta: cancela em ~4 s e mostra o texto geral', dt >= 3500 && dt < 6000 && geral(r.shown[0][1].body), dt);
ck('opções da notificação preservadas (tag/renotify/ícone)', r.shown[0][1].tag === 'lembrete-diario' && r.shown[0][1].renotify === true && /icon-192/.test(r.shown[0][1].icon));
r = await roda(ok({ ok: true, n: 3, em: iso(agora), alerta: true })); b = r.shown[0][1].body;
ck('alerta ao administrador: texto fixo, sem detalhes', /^Atenção: o lembrete diário teve um problema hoje\. Abra o painel Administrador/.test(b), b);
{
  const L = {}; const msgs = []; let focado = 0, aberto = null;
  const self = { addEventListener: (t, f) => { L[t] = f; }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => [{ focus: () => { focado++; return Promise.resolve(); }, postMessage: m => msgs.push(m) }], openWindow: u => { aberto = u; return Promise.resolve(); } }, registration: {} };
  vm.runInNewContext(src, { self, fetch: () => Promise.reject(new Error('x')), Date, AbortController, setTimeout, clearTimeout, console, Number, JSON, String });
  let p; L.notificationclick({ notification: { close() {} }, waitUntil: x => { p = x; } }); await p;
  ck('clique com app aberto: foca a janela e avisa para ir ao card de hoje', focado === 1 && msgs.length === 1 && msgs[0].lembrete === 1 && aberto === null, JSON.stringify([focado, msgs, aberto]));
  const self2 = { addEventListener: (t, f) => { L[t] = f; }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => [], openWindow: u => { aberto = u; return Promise.resolve(); } }, registration: {} };
  vm.runInNewContext(src, { self: self2, fetch: () => Promise.reject(new Error('x')), Date, AbortController, setTimeout, clearTimeout, console, Number, JSON, String });
  L.notificationclick({ notification: { close() {} }, waitUntil: x => { p = x; } }); await p;
  ck('clique com app fechado: abre /?lembrete=1', aberto === '/?lembrete=1', aberto);
}
console.log(F.length ? 'FALHAS: ' + JSON.stringify(F) : 'TUDO OK'); process.exit(F.length ? 1 : 0);
