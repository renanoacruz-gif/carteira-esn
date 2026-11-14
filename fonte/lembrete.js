/* Lembretes 9h e 14h (seg-sex) por notificação do navegador (Web Push). Estado em memória; "agora não" fica em localStorage. */
const LEM = { foco: false, st: null, local: false, busy: false, msg: '', sup: false, ios: false, app: false };
try {
  LEM.sup = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  LEM.ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  LEM.app = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (/[?&]lembrete=1/.test(location.search)) { history.replaceState(null, '', location.pathname + location.hash); LEM.foco = true; setTimeout(() => toast('Hora de olhar a carteira de hoje.'), 800); }
} catch { /* sem DOM */ }
const lemB64 = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
async function lemApi(path, corpo) {
  const c = new AbortController(), to = setTimeout(() => c.abort(), 10000);
  try {
    const r = await fetch(path, { method: corpo === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo), credentials: 'same-origin', redirect: 'manual', signal: c.signal });
    let j = null; try { j = await r.json(); } catch { /* sem corpo */ }
    return { ok: r.ok && !!j && j.ok === true, status: r.status, j };
  } catch { return { ok: false, status: 0, j: null }; } finally { clearTimeout(to); }
}
async function lemSubLocal() { try { const reg = await navigator.serviceWorker.getRegistration('/'); return reg ? await reg.pushManager.getSubscription() : null; } catch { return null; } }
const lemSt = j => ({ cfg: true, aparelhos: j.aparelhos, pausa: j.pausa_ate || null, manha: j.manha !== false, tarde: j.tarde !== false });
async function lemCarregar() {
  if (!LEM.sup && !LEM.ios) { LEM.st = { cfg: false }; return; }
  LEM.st = { cfg: false, carregando: true };
  const r = await lemApi('/api/push/status');
  LEM.st = r.ok ? lemSt(r.j) : { cfg: false, erro: r.status !== 503 };
  if (LEM.sup) LEM.local = !!(await lemSubLocal()) && Notification.permission === 'granted';
  render();
}
function lemGarantir() { if (LEM.st === null) { LEM.st = { cfg: false, carregando: true }; setTimeout(lemCarregar, 0); } }
function lemBanner() {
  lemGarantir();
  if (!LEM.sup || !LEM.st || !LEM.st.cfg || LEM.local || lsGet('lem.nao') === '1' || Notification.permission === 'denied') return '';
  return `<div class="card" id="lem-b"><div class="row"><b>Lembretes às 9h e às 14h</b><span class="sp"></span><button class="btn ghost sm" data-a="lemFechar">Agora não</button></div><p class="sm">Receba dois avisos neste aparelho nos dias úteis. O da manhã só vem se você ainda não abriu a ferramenta no dia, e o da tarde só se não abriu desde o meio-dia.</p><button class="btn pri" data-a="lemOn" ${LEM.busy ? 'disabled' : ''}>Ativar lembrete</button></div>`;
}
function lemCard() {
  lemGarantir();
  let h = '<div class="card" id="lem"><h3>Lembrete diário</h3>';
  if (!LEM.st || LEM.st.carregando) return h + '<p class="sm muted">Verificando…</p></div>';
  if (!LEM.st.cfg) return h + `<p class="sm muted">${LEM.st.erro ? 'Não foi possível consultar o lembrete agora. Tente novamente mais tarde.' : 'Ainda não ativado pelo administrador da ferramenta.'}</p></div>`;
  h += '<p class="sm">Notificações às 9h e às 14h (Brasília), de segunda a sexta. A das 9h só vem se você ainda não abriu a ferramenta no dia, e a das 14h só se não abriu desde o meio-dia. Guardamos apenas seu e-mail e o endereço de notificação deste aparelho, nunca dados da carteira.</p>';
  if (!LEM.sup) h += `<p class="sm muted">${LEM.ios ? 'No iPhone/iPad (iOS 16.4 ou superior): toque em Compartilhar → Adicionar à Tela de Início, abra pelo ícone e ative aqui.' : 'Este navegador não oferece notificações.'}</p>`;
  else if (Notification.permission === 'denied') h += '<p class="sm muted">Notificações bloqueadas neste navegador. Libere nas configurações do site e volte aqui.</p>';
  else h += `<div class="row">${LEM.local ? `<span class="pill p-info">Ativo neste aparelho</span><span class="sp"></span><button class="btn ghost sm" data-a="lemTeste" ${LEM.busy ? 'disabled' : ''}>Enviar teste</button><button class="btn ghost sm" data-a="lemOff" ${LEM.busy ? 'disabled' : ''}>Desativar</button>` : `<button class="btn pri" data-a="lemOn" ${LEM.busy ? 'disabled' : ''}>Ativar neste aparelho</button>`}</div>`;
  if (LEM.st.aparelhos) {
    h += `<p class="sm muted">Aparelhos com lembrete na sua conta: ${LEM.st.aparelhos}.</p>`;
    const on = k => LEM.st[k] !== false, tg = (k, l) => `<button class="btn ${on(k) ? 'pri' : 'ghost'} sm" data-a="lemTurno" data-k="${k}" aria-pressed="${on(k)}" ${LEM.busy ? 'disabled' : ''}>${l}: ${on(k) ? 'ligado' : 'desligado'}</button>`;
    h += `<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><span class="sm">Turnos:</span>${tg('manha', '9h')}${tg('tarde', '14h')}</div>`;
    h += LEM.st.pausa ? `<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><span class="pill p-warn">Em pausa até ${esc(LEM.st.pausa.split('-').reverse().join('/'))}</span><button class="btn ghost sm" data-a="lemRetomar" ${LEM.busy ? 'disabled' : ''}>Retomar agora</button></div>`
      : `<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><span class="sm">Pausar (férias, folga):</span>${[7, 15, 30].map(d => `<button class="btn ghost sm" data-a="lemPausa" data-d="${d}" ${LEM.busy ? 'disabled' : ''}>${d} dias</button>`).join('')}</div>`;
    h += '<p class="sm muted">O lembrete não é enviado em feriados nacionais, Carnaval e Corpus Christi. Feriados estaduais e municipais não são tratados: use a pausa.</p>';
  }
  if (LEM.msg) h += `<p class="sm" role="status">${esc(LEM.msg)}</p>`;
  return h + '</div>';
}
const LEM_ACT = {
  lemFechar: () => { lsSet('lem.nao', '1'); render(); },
  lemOn: async () => {
    if (LEM.busy || !LEM.sup) return; LEM.busy = true; LEM.msg = ''; render();
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Permissão de notificação não concedida.');
      const k = await lemApi('/api/push/chave'); if (!k.ok) throw new Error('Lembrete indisponível no momento.');
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }); await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: lemB64(k.j.chave) });
      const r = await lemApi('/api/push/inscrever', { endpoint: sub.endpoint });
      if (!r.ok) { try { await sub.unsubscribe(); } catch { /* ok */ } throw new Error('Não foi possível registrar este aparelho.'); }
      LEM.local = true; LEM.st = { ...LEM.st, cfg: true, aparelhos: r.j.aparelhos }; LEM.msg = 'Lembrete ativado. Use "Enviar teste" para conferir.';
    } catch (e) { LEM.msg = (e && e.message && !/^(Failed|Registration|Subscription|NotAllowed|Abort|Security|Type)/.test(e.name || '')) ? e.message : 'Não foi possível ativar neste aparelho.'; }
    LEM.busy = false; render();
  },
  lemOff: async () => {
    if (LEM.busy) return; LEM.busy = true; LEM.msg = ''; render();
    try {
      const sub = await lemSubLocal(), ep = sub && sub.endpoint;
      const r = ep ? await lemApi('/api/push/cancelar', { endpoint: ep }) : { ok: true, j: { aparelhos: LEM.st && LEM.st.aparelhos } };
      if (sub) { try { await sub.unsubscribe(); } catch { /* ok */ } }
      LEM.local = false; if (r.ok) LEM.st = { ...LEM.st, cfg: true, aparelhos: r.j.aparelhos }; LEM.msg = 'Lembrete desativado neste aparelho.';
    } catch { LEM.msg = 'Não foi possível desativar agora.'; }
    LEM.busy = false; render();
  },
  lemTurno: async t => {
    if (LEM.busy || !LEM.st) return; const k = t.dataset.k; if (k !== 'manha' && k !== 'tarde') return; LEM.busy = true; LEM.msg = ''; render();
    const novo = { manha: LEM.st.manha !== false, tarde: LEM.st.tarde !== false }; novo[k] = !novo[k];
    const r = await lemApi('/api/push/pref', novo); if (r.ok) { LEM.st = { ...LEM.st, manha: r.j.manha, tarde: r.j.tarde }; LEM.msg = 'Preferência salva.'; } else LEM.msg = 'Não foi possível salvar agora.';
    LEM.busy = false; render();
  },
  lemPausa: async t => {
    if (LEM.busy) return; const d = Math.min(90, Math.max(1, +t.dataset.d || 7)); LEM.busy = true; LEM.msg = ''; render();
    const ate = new Date(Date.now() - 3 * 3600000 + d * 86400000).toISOString().slice(0, 10), r = await lemApi('/api/push/pausar', { ate });
    if (r.ok) { LEM.st = { ...LEM.st, pausa: r.j.pausa_ate }; LEM.msg = 'Lembrete em pausa.'; } else LEM.msg = 'Não foi possível pausar agora.';
    LEM.busy = false; render();
  },
  lemRetomar: async () => {
    if (LEM.busy) return; LEM.busy = true; LEM.msg = ''; render(); const r = await lemApi('/api/push/pausar', { ate: null });
    if (r.ok) { LEM.st = { ...LEM.st, pausa: null }; LEM.msg = 'Lembrete retomado.'; } else LEM.msg = 'Não foi possível retomar agora.';
    LEM.busy = false; render();
  },
  lemTeste: async () => {
    if (LEM.busy) return; LEM.busy = true; LEM.msg = ''; render();
    const r = await lemApi('/api/push/teste', {});
    LEM.msg = r.ok ? (r.j.enviados ? 'Teste enviado. A notificação deve aparecer em instantes.' : 'O serviço de notificação não aceitou o envio. Desative e ative novamente.') : (r.status === 429 ? 'Aguarde um minuto para enviar outro teste.' : 'Não foi possível enviar o teste.');
    LEM.busy = false; render();
  }
};
{
  const h = typeof hojeCard === 'function' ? hojeCard : null, c = typeof vConta === 'function' ? vConta : null;
  if (h) globalThis.hojeCard = function () { if (LEM.foco) lemIrParaHoje(6); return lemBanner() + h(); };
  if (c) globalThis.vConta = function () { return c() + lemCard(); };
}

/* Resumo para o texto do aviso: o navegador conta os clientes com motivo para aprofundar (mesma regra do card "Onde vale aprofundar hoje")
   e envia só esse inteiro. O servidor nunca lê a carteira. Só envia neste aparelho com lembrete ativo e com a carteira carregada. */
/* Retornos que vencem hoje ou já venceram (prazos que o próprio usuário definiu); só o número sai do navegador. */
function lemRetornos() {
  try { const h = today(); return pendItems().filter(x => x.tipo === 'acao' || (x.tipo === 'prox' && x.prazo === h)).length; } catch { return null; }
}
const LEMR = { n: null, r: null, env: null, t: 0, busy: false, tm: 0 };
function lemReportar() {
  clearTimeout(LEMR.tm);
  LEMR.tm = setTimeout(async () => {
    try {
      const n = LEMR.n; if (!LEM.local || LEMR.busy || !Number.isInteger(n) || n < 0 || n > 999) return;
      const r = Number.isInteger(LEMR.r) && LEMR.r >= 0 && LEMR.r <= 999 ? LEMR.r : undefined, chave = n + '|' + r;
      if (chave === LEMR.env && Date.now() - LEMR.t < 3 * 3600 * 1000) return;
      LEMR.busy = true; const rs = await lemApi('/api/push/resumo', r === undefined ? { n } : { n, r }); if (rs.ok) { LEMR.env = chave; LEMR.t = Date.now(); }
    } catch { /* sem efeito: o aviso volta ao texto geral */ } finally { LEMR.busy = false; }
  }, 2500);
}
{
  const hi = typeof hojeItens === 'function' ? hojeItens : null;
  if (hi) globalThis.hojeItens = function () {
    const out = hi.apply(this, arguments);
    try { if (Array.isArray(out) && typeof clients === 'function' && clients().length) { LEMR.n = out.length; LEMR.r = lemRetornos(); lemReportar(); } } catch { /* sem efeito */ }
    return out;
  };
}

/* Aviso tocado: leva direto ao card "Onde vale aprofundar hoje" (com a app aberta ou não). */
function lemIrParaHoje(tent) {
  setTimeout(() => { const e = document.getElementById('hoje'); if (e) { LEM.foco = false; e.scrollIntoView({ block: 'start', behavior: 'smooth' }); } else if (tent > 1) lemIrParaHoje(tent - 1); else LEM.foco = false; }, 350);
}
try { if (LEM.sup) navigator.serviceWorker.addEventListener('message', ev => { if (ev.data && ev.data.lembrete) { LEM.foco = true; try { if (new Date().getDay() === 1 && Object.values(S.clients).some(c => c.emp)) { empUI().tab = 'semana'; UI.view = 'mrr'; } else UI.view = 'geral'; render(); } catch { /* sem efeito */ } } }); } catch { /* sem service worker */ }
