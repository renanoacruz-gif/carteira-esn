/* ===== SHELL: sidebar flutuante, cabeçalho compacto, tooltips, modal e toasts =====
   Só estrutura e navegação: as telas (vGeral, vClientes…) continuam as mesmas. Tokens ficam em style.css (:root). */
const IC = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.9c1.8.7 3 2.4 3.3 5.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  pie: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  plan: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 9l2 2 3.5-3.5M8 15h8"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  merge: '<path d="M5 4v6a4 4 0 0 0 4 4h6M19 4v6a4 4 0 0 1-4 4"/><path d="M12 14v6M9 17l3 3 3-3"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  trend: '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 20h14"/>', plus: '<path d="M12 5v14M5 12h14"/>', ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>'
};
const ico = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
/* 8 destinos de primeiro nível; telas internas ficam como subitens do destino ativo */
const NAV = [
  ['geral', 'Visão da Carteira', 'dash', []],
  ['clientes', 'Clientes', 'users', [['clientes', 'Clientes', 'users'], ['cliente', 'Cliente', 'user'], ['segmentos', 'Segmentos', 'pie'], ['consol', 'Consolidação', 'merge']]],
  ['oport', 'Oportunidades TOTVS', 'plan', [['oport', 'Oportunidades', 'plan'], ['plano', 'Acompanhamento (opcional)', 'merge']]],
  ['mercado', 'Inteligência de Mercado', 'trend', []],
  ['solucoes', 'Base de Soluções', 'box', [['solucoes', 'Soluções', 'box'], ['refs', 'Releases e regulatório', 'doc']]],
  ['importar', 'Importar e fichas', 'upload', [], true],
  ['pend', 'Pendências documentais', 'warn', []],
  ['cnpj', 'Consulta de CNPJ', 'search', []],
  ['integra', 'Integrações', 'link', []],
  ['conta', 'Configurações', 'cog', [['conta', 'Conta e catálogo', 'shield'], ['ia', 'IA e provedores', 'cog'], ['dados', 'Gerenciamento de dados', 'shield'], ['criterios', 'Critérios', 'sliders'], ['base', 'Base TOTVS e limites', 'info']]]
];
const navTop = v => NAV.find(([k, , , sub]) => k === (v === 'diag' ? 'cliente' : v) || sub.some(s => s[0] === (v === 'diag' ? 'cliente' : v))) || NAV[0]; const navTopOld = v => NAV.find(([k, , , sub]) => k === v || sub.some(s => s[0] === v)) || NAV[0];
const VIEW_TITLE = { oport: 'Oportunidades TOTVS', mercado: 'Inteligência de Mercado', pend: 'Central de Pendências', cnpj: 'Consulta de CNPJ', importar: 'Importar e fichas', geral: 'Visão da carteira', clientes: 'Clientes', cliente: 'Cliente', diag: 'Diagnóstico da oportunidade', segmentos: 'Segmentos', plano: 'Acompanhamento (opcional)', criterios: 'Critérios de análise', solucoes: 'Base de Soluções', refs: 'Releases e regulatório', consol: 'Consolidação de clientes', conta: 'Conta e catálogo compartilhado', integra: 'Integrações', dados: 'Gerenciamento de dados', ia: 'Configurações de IA', base: 'Base TOTVS e limites' };
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: só nesta sessão */ } };
UI.sbCol = lsGet('sb.col') === '1'; UI.sbOpen = false;
const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
function viewSub(v) {
  const n = clients().length;
  if (v === 'cliente') return S.clients[UI.sel]?.name || 'Selecione um cliente em Clientes';
  if (v === 'geral') return n ? `${n} cliente(s) • última análise ${fmtDate(S.meta.lastAnalysis)}` : 'Sem dados importados';
  if (v === 'clientes') return n ? `${n} cliente(s) na carteira` : 'Sem dados importados';
  if (v === 'solucoes') return `${activeSols().length} registro(s) ativo(s)`;
  if (v === 'plano') return n ? 'Responsável e prazo são opcionais: apoio à análise, não um CRM' : 'Sem dados importados';
  if (v === 'oport') return n ? 'Onde há oportunidades, por que fazem sentido e o que validar' : 'Sem dados importados';
  return '';
}
function viewActions(v) {
  const b = (a, l, i, cls = 'ghost', extra = '') => `<button class="btn ${cls} sm" data-a="${a}" ${extra}>${ico(i, 16)}<span>${l}</span></button>`, has = clients().length > 0;
  if (v === 'geral' || v === 'clientes') return b('nav', 'Importar', 'upload', 'ghost', 'data-v="importar"') + (v === 'geral' && has ? b('expCSV', 'Plano (CSV)', 'down') : '');
  if (v === 'plano' && has) return b('expCSV', 'CSV', 'down') + b('expXLSX', 'XLSX', 'down', 'pri');
  if (v === 'solucoes') return b('solNew', 'Novo registro', 'plus', 'pri');
  if (v === 'cliente') return b('nav', 'Clientes', 'left', 'ghost', 'data-v="clientes"');
  return '';
}
function paintShell() {
  const sh = $('#shell'); if (!sh) return;
  const act = document.activeElement, keep = act && act.closest?.('#nav') ? act.dataset.v : null;
  sh.classList.toggle('col', UI.sbCol && !isMobile()); sh.classList.toggle('open', UI.sbOpen);
  const bd = k => k === 'importar' ? S.inbox.length : k === 'refs' ? refPending().length : k === 'pend' ? pendItems().length : 0;
  const btn = ([k, l, i], on, sub, n) => `<button type="button" class="sb-item ${sub ? 'sub' : ''} ${on ? 'on' : ''}" data-a="nav" data-v="${k}" data-tip="${esc(l)}" data-tipc="1" ${on ? 'aria-current="page"' : ''}>${sub ? '' : ico(i)}<span class="sb-lb">${l}</span>${n ? `<span class="badge" aria-label="${n} pendente(s)">${n}</span>` : ''}</button>`;
  const top = navTop(UI.view)[0];
  $('#nav').innerHTML = `<div class="sb-grp">${NAV.map(([k, l, i, sub, sep]) => {
    const act = k === top, n = k === 'importar' ? S.inbox.length : k === 'pend' ? bd('pend') : 0;
    return (sep ? '<div class="sb-sep sb-lb">Suporte operacional</div>' : '') + btn([k, l, i], act && (!sub.length || UI.view === k && !sub.some(s => s[0] === k)), false, n) + (act && sub.length ? `<div class="sb-sub">${sub.map(s => btn(s, (UI.view === 'diag' ? 'cliente' : UI.view) === s[0], true, bd(s[0]))).join('')}</div>` : '');
  }).join('')}</div>`;
  $('#sbfoot').innerHTML = `<button type="button" class="sb-user" data-a="nav" data-v="conta" data-tip="${esc(ME.nome || 'Minha conta')} — carteira privada desta conta" data-tipc="1"><span class="av">${ico('user', 18)}</span><span class="sb-lb"><b>${esc(ME.nome || 'Minha conta')}</b><span class="sm" id="pstat">${esc(UI.persist)}</span></span></button>`;
  if (keep) $(`#nav [data-v="${keep}"]`)?.focus();
  const tg = $('#sbtg'); tg.innerHTML = ico(UI.sbCol && !isMobile() ? 'right' : 'left', 18); tg.setAttribute('aria-expanded', String(!(UI.sbCol && !isMobile()))); tg.setAttribute('aria-label', UI.sbCol ? 'Expandir menu lateral' : 'Recolher menu lateral');
  const sb = $('#sb'); if (isMobile()) { sb.inert = !UI.sbOpen; sb.setAttribute('aria-hidden', String(!UI.sbOpen)); } else { sb.inert = false; sb.removeAttribute('aria-hidden'); }
  const v = UI.view, title = VIEW_TITLE[v] || v, q = $('#gq')?.value || '';
  $('#top').innerHTML = `<button type="button" class="btn ghost sm top-mn" data-a="sbOpen" aria-label="Abrir menu" aria-expanded="${UI.sbOpen}">${ico('menu', 18)}</button>
  <div class="top-t"><h1 id="ptitle">${esc(title)}</h1><div class="sm muted top-s">${esc(viewSub(v))}</div></div>
  <div class="top-q" role="search"><label class="sr" for="gq">Buscar cliente</label>${ico('search', 16)}<input id="gq" type="search" data-i="gq" placeholder="Buscar cliente por nome, código ou CNPJ  ( / )" autocomplete="off" value="${esc(q)}" aria-controls="gres" aria-expanded="false"><div id="gres" class="gres" hidden></div></div>
  <div class="top-a">${viewActions(v)}</div>`;
  document.title = title + ' — Gestão de Carteira TOTVS ESN';
  if (q) gSearch(q, true);
}
/* ---------- busca global (clientes) ---------- */
function gSearch(q, keepOpen) {
  const box = $('#gres'), inp = $('#gq'); if (!box) return; q = norm(q).trim();
  if (!q) { box.hidden = true; box.innerHTML = ''; inp?.setAttribute('aria-expanded', 'false'); return; }
  const dq = q.replace(/\D/g, ''), hit = clients().filter(c => norm(`${c.name} ${c.code || ''}`).includes(q) || (dq.length >= 4 && (c.cnpj || '').includes(dq)));
  box.innerHTML = hit.length ? hit.slice(0, 8).map(c => `<button type="button" class="gr" data-a="gsOpen" data-k="${esc(c.key)}"><b>${esc(c.name)}</b><span class="muted sm">${esc(c.code || '')} ${c.cnpj ? '• ' + esc(c.cnpj) : ''} ${esc(segName(c.segInfo?.id) || '')}</span></button>`).join('') + (hit.length > 8 ? `<div class="muted sm gr-more">+${hit.length - 8} — refine a busca ou use Clientes</div>` : '') : `<div class="muted sm gr-more">${clients().length ? 'Nenhum cliente encontrado.' : 'Importe a carteira para buscar clientes.'}</div>`;
  box.hidden = false; inp?.setAttribute('aria-expanded', 'true');
}
const SHELL_ACT = {
  sbToggle: () => { if (isMobile()) { UI.sbOpen = false; } else { UI.sbCol = !UI.sbCol; lsSet('sb.col', UI.sbCol ? '1' : '0'); } paintShell(); },
  sbOpen: () => { UI.sbOpen = true; paintShell(); $('#nav .sb-item.on, #nav .sb-item')?.focus(); },
  sbClose: () => { const was = UI.sbOpen; UI.sbOpen = false; paintShell(); if (was) $('.top-mn')?.focus(); },
  gsOpen: (t, e) => { const inp = $('#gq'); if (inp) inp.value = ''; ACT.open(t, e || { preventDefault() { } }); },
  toastX: () => { clearTimeout(toastT); $('#toast').hidden = true; },
  mdClose: (t, e) => { if (e && t && e.target !== t) return; const m = MODALS[UI.confirm]; if (m) ACT[m.cancel](); }
};
/* ---------- modal de confirmação (mesmas ações dos botões antigos) ---------- */
const MODALS = {
  csauto: { t: 'Executar as unificações seguras?', b: 'O backup (JSON) será baixado primeiro e as unificações ficam registradas no histórico, com reversão disponível enquanto o snapshot existir.', ok: ['csAuto2', 'Baixar backup e unificar', 'pri'], cancel: 'csAuto0' }
};
let modalFrom = null;
function paintModal() {
  const m = MODALS[UI.confirm], host = $('#modal'); if (!host) return;
  if (!m) { if (host.firstChild) { host.innerHTML = ''; document.body.classList.remove('mdl'); modalFrom?.isConnected && modalFrom.focus(); modalFrom = null; } return; }
  if (host.firstChild) return;
  modalFrom = document.activeElement; document.body.classList.add('mdl');
  host.innerHTML = `<div class="mdl-bg" data-a="mdClose"><div class="mdl-box" role="dialog" aria-modal="true" aria-labelledby="mdt" aria-describedby="mdb" data-a-stop="1"><h2 id="mdt">${m.t}</h2><div id="mdb">${m.b}</div><div class="row mdl-act"><button type="button" class="btn ghost" data-a="${m.cancel}" id="mdcancel">Cancelar</button>${m.alt ? `<button type="button" class="btn ${m.alt[2]}" data-a="${m.alt[0]}">${m.alt[1]}</button>` : ''}<button type="button" class="btn ${m.ok[2]}" data-a="${m.ok[0]}">${m.ok[1]}</button></div></div></div>`;
  $('#mdcancel').focus();
}
/* ---------- tooltips (um único elemento, posicionado por JS: nunca cortado por rolagem) ---------- */
let tipEl = null;
function tipShow(el) {
  if (el.dataset.tipc && !($('#shell').classList.contains('col'))) return;
  const t = el.dataset.tip; if (!t) return; const tp = $('#tip'); tp.textContent = t; tp.hidden = false; tipEl = el;
  const r = el.getBoundingClientRect(), w = tp.offsetWidth, h = tp.offsetHeight; let x, y;
  if (el.dataset.tipc) { x = r.right + 10; y = r.top + r.height / 2 - h / 2; } else { x = r.left + r.width / 2 - w / 2; y = r.top - h - 8; if (y < 6) y = r.bottom + 8; }
  tp.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + 'px'; tp.style.top = Math.max(6, Math.min(y, innerHeight - h - 6)) + 'px';
}
const tipHide = () => { const tp = $('#tip'); if (tp) tp.hidden = true; tipEl = null; };
document.addEventListener('mouseover', e => { const el = e.target.closest?.('[data-tip]'); if (el) tipShow(el); else if (tipEl) tipHide(); });
document.addEventListener('focusin', e => { const el = e.target.closest?.('[data-tip]'); if (el && el.matches(':focus-visible')) tipShow(el); });
document.addEventListener('focusout', tipHide); document.addEventListener('scroll', tipHide, true); document.addEventListener('click', tipHide, true);
/* ---------- teclado e responsividade ---------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (UI.confirm && MODALS[UI.confirm]) { e.preventDefault(); SHELL_ACT.mdClose(); return; }
    if (UI.sbOpen) { e.preventDefault(); SHELL_ACT.sbClose(); return; }
    const g = $('#gres'); if (g && !g.hidden) { g.hidden = true; $('#gq')?.setAttribute('aria-expanded', 'false'); }
  }
  if (e.key === 'Tab' && UI.confirm && MODALS[UI.confirm]) { const f = [...$('#modal').querySelectorAll('button')]; if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
  if (e.key === 'Tab' && UI.sbOpen && isMobile()) { const f = [...$('#sb').querySelectorAll('button')]; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); $('#gq')?.focus(); }
  if (e.key === 'Enter' && e.target.id === 'gq') { const f = $('#gres .gr'); if (f) { e.preventDefault(); f.click(); } }
  if (e.key === 'ArrowDown' && e.target.id === 'gq') { $('#gres .gr')?.focus(); }
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.classList?.contains('gr')) { e.preventDefault(); (e.key === 'ArrowDown' ? e.target.nextElementSibling : e.target.previousElementSibling)?.focus?.(); }
});
document.addEventListener('input', e => { if (e.target.id === 'gq') gSearch(e.target.value); });
document.addEventListener('click', e => { if (!e.target.closest('.top-q')) { const g = $('#gres'); if (g && !g.hidden) g.hidden = true; } });
window.matchMedia('(max-width: 900px)').addEventListener?.('change', () => { UI.sbOpen = false; paintShell(); });
