/* Cockpit da Visão da Carteira (visual v2) — camada aditiva, só leitura.
   Usa clients(), stats(), opAll(), hojeItens(): nenhum cálculo novo de negócio, nenhuma série inventada.
   ckBento() é inserido por refresh3d.js logo depois do palco da orbe (telas > 900px). */
const ckRing = (v, t, lab, tone = 'ok') => {
  const R = 26, C = 2 * Math.PI * R, f = t > 0 ? Math.max(0, Math.min(1, v / t)) : 0;
  return `<svg class="ck-ring ${tone}" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${esc(lab)}: ${v} de ${t}"><circle class="tr" cx="32" cy="32" r="${R}"/>${f > 0 ? `<circle class="fg" cx="32" cy="32" r="${R}" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/>` : ''}<text x="32" y="37" text-anchor="middle">${v}/${t}</text></svg>`;
};
const ckScore = (v, lab) => {
  const R = 24, C = 2 * Math.PI * R, f = Math.max(0, Math.min(1, v / 100));
  return `<svg class="ck-ring ok" width="60" height="60" viewBox="0 0 60 60" role="img" aria-label="${esc(lab)}: ${Math.round(v)} de 100"><circle class="tr" cx="30" cy="30" r="${R}"/><circle class="fg" cx="30" cy="30" r="${R}" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 30 30)"/><text x="30" y="36" text-anchor="middle">${Math.round(v)}</text></svg>`;
};
function ckHoje() {
  const x = (typeof hojeItens === 'function' ? hojeItens() : [])[0]; if (!x) return '';
  const cl = OP_CL[opClasse(x.top)];
  return `<div class="ck-glass ck-hoje"><div class="ck-eb">Onde vale aprofundar hoje</div><div class="ck-hj">${ckScore(x.top.o.score, 'Prioridade')}<div><b>${esc(x.c.name)}</b><span>${esc(x.top.o.nome)}</span>${pill(cl[0], cl[1])}</div></div><p>${esc(x.why[0])}</p><button type="button" class="btn pri" data-a="openTab" data-k="${esc(x.c.key)}" data-v="raiox">Abrir raio-X</button></div>`;
}
function ckBento() {
  const s = stats(), all = opAll().filter(x => x.cl !== 'nao'), nI = all.filter(x => x.cl === 'identificada').length, nH = all.length - nI, cliOp = new Set(all.map(x => x.c.key)).size;
  /* MRR por cliente (planilha) */
  const mr = s.cs.filter(c => Number.isFinite(c.mrr) && c.mrr > 0).sort((a, b) => b.mrr - a.mrr), mx = mr.length ? mr[0].mrr : 0, TOP = 6;
  const mrrCard = `<div class="card ck-c"><h3>MRR por cliente</h3>${mr.length ? `<ul class="ck-bars">${mr.slice(0, TOP).map(c => `<li><div><a href="#" data-a="open" data-k="${esc(c.key)}">${esc(c.name)}</a><span>${fmtBRL(c.mrr)}</span></div><i aria-hidden="true"><b style="width:${(100 * c.mrr / mx).toFixed(1)}%"></b></i></li>`).join('')}</ul>${mr.length > TOP ? `<a class="sm" href="#" data-a="nav" data-v="clientes">Ver os ${mr.length} clientes</a>` : ''}<p class="sm muted ck-ft">${chip('FATO')} informado na planilha</p>` : '<p class="muted sm">Nenhum cliente com MRR informado na planilha.</p>'}</div>`;
  /* Oportunidades */
  const opCardH = `<div class="card ck-c"><h3>Oportunidades mapeadas</h3><div class="ck-big"><b>${all.length}</b><span>em ${cliOp} de ${s.n} cliente(s)</span></div>${all.length ? `<div class="ck-split" role="img" aria-label="${nI} identificada(s) e ${nH} hipótese(s)">${nI ? `<i class="ok" style="flex:${nI}"></i>` : ''}${nH ? `<i class="hy" style="flex:${nH}"></i>` : ''}</div>` : ''}<div class="ck-lg"><span><b class="ok">${nI}</b> identificada(s)</span><span><b class="hy">${nH}</b> hipótese(s) de investigação</span></div><a class="sm ck-ft" href="#" data-a="nav" data-v="oport">Ver oportunidades</a></div>`;
  /* Soluções TOTVS mais sugeridas (por nº de clientes) — é o que a ferramenta existe para responder */
  const sm = new Map(); all.forEach(x => (x.o.sols || []).forEach(sl => { if (!sl.nome) return; if (!sm.has(sl.nome)) sm.set(sl.nome, new Set()); sm.get(sl.nome).add(x.c.key); }));
  const sl = [...sm.entries()].map(([n, st]) => [n, st.size]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), smx = sl.length ? sl[0][1] : 0;
  const solCard = `<div class="card ck-c"><h3>Soluções TOTVS mais sugeridas</h3>${sl.length ? `<ul class="ck-bars">${sl.slice(0, 5).map(([n, k]) => `<li><div><b title="${esc(n)}">${esc(n)}</b><span>${k} cliente(s)</span></div><i aria-hidden="true"><b style="width:${(100 * k / smx).toFixed(1)}%"></b></i></li>`).join('')}</ul><a class="sm ck-ft" href="#" data-a="nav" data-v="oport">Ver todas as ${sl.length} em Oportunidades</a>` : '<p class="muted sm">Nenhuma solução sugerida ainda. Anexe fichas de faturamento para o motor comparar com a Base de Soluções.</p>'}</div>`;
  /* Prontidão dos dados */
  const pend = typeof pendItems === 'function' ? pendItems().length : 0;   /* mesma contagem do menu lateral */
  const prCard = `<div class="card ck-c"><h3>Prontidão dos dados</h3><div class="ck-rings"><div>${ckRing(s.withF, s.n, 'Fichas confirmadas', s.withF ? 'ok' : 'off')}<span><b>Fichas</b>confirmadas</span></div><div>${ckRing(s.mrrN, s.n, 'MRR informado')}<span><b>MRR</b>informado</span></div></div>${pend ? `<div class="ck-pend"><b>${pend}</b><span>pendência(s) documental(is)</span><a href="#" data-a="nav" data-v="pend">Resolver</a></div>` : '<p class="sm muted ck-ft">Sem pendências documentais.</p>'}</div>`;
  /* Mapa cliente × família de solução */
  let mapa = '';
  if (all.length) {
    const fc = new Map(); all.forEach(x => { const f = oppFam(x.o); fc.set(f, (fc.get(f) || 0) + 1); });
    const fams = [...fc.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 9).map(e => e[0]);
    const byC = new Map(); all.forEach(x => { if (!byC.has(x.c.key)) byC.set(x.c.key, { c: x.c, m: new Map() }); const m = byC.get(x.c.key).m, f = oppFam(x.o), cur = m.get(f); if (!cur || (x.cl === 'identificada' && cur.cl !== 'identificada') || (x.cl === cur.cl && x.o.score > cur.o.score)) m.set(f, x); });
    const rows = [...byC.values()].sort((a, b) => (b.c.mrr || 0) - (a.c.mrr || 0) || a.c.name.localeCompare(b.c.name)), LIM = 12;
    const cell = (r, f) => { const x = r.m.get(f); if (!x) return '<td><span class="ck-cell" aria-label="Sem indício"></span></td>'; const id = x.cl === 'identificada', t = `${x.o.nome} — ${id ? 'oportunidade identificada, prioridade ' + Math.round(x.o.score) : 'hipótese de investigação'}`; return `<td><button type="button" class="ck-cell ${id ? 'ok' : 'hy'}" data-a="openTab" data-k="${esc(r.c.key)}" data-v="raiox" title="${esc(t)}" aria-label="${esc(r.c.name + ': ' + t)}">${id ? Math.round(x.o.score) : 'H'}</button></td>`; };
    mapa = `<div class="card ck-map"><div class="row"><h3>Mapa de oportunidades — cliente × família de solução</h3><span class="sp"></span><span class="ck-k"><i class="ok"></i>Identificada (prioridade)</span><span class="ck-k"><i class="hy"></i>Hipótese</span><span class="ck-k"><i></i>Sem indício</span></div><div class="ck-tw"><table><thead><tr><th scope="col">Cliente</th>${fams.map(f => `<th scope="col">${esc(f)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, LIM).map(r => `<tr><th scope="row"><a href="#" data-a="open" data-k="${esc(r.c.key)}">${esc(r.c.name)}</a></th>${fams.map(f => cell(r, f)).join('')}</tr>`).join('')}</tbody></table></div><p class="sm muted">Cada célula abre o raio-X do cliente. Número = prioridade (score transparente); H = hipótese ainda sem confirmação.${rows.length > LIM ? ` Exibindo ${LIM} de ${rows.length} clientes com oportunidade (maior MRR primeiro).` : ''}${fc.size > fams.length ? ` Exibindo as ${fams.length} famílias mais frequentes de ${fc.size}.` : ''}</p></div>`;
  }
  return `<section id="ck" class="ck" aria-label="Indicadores da carteira"><div class="ck-grid">${mrrCard}${solCard}${opCardH}${prCard}</div>${mapa}</section>`;
}

/* ---------- Ficha do Cliente e Oportunidades (telas > 900px): só acrescenta blocos e classes depois do render() ---------- */
(() => {
  'use strict';
  const WIDE = matchMedia('(min-width: 901px)');
  function ficha(app) {
    const row = app.querySelector(':scope > .row [data-a=pesqCli]')?.closest('.row'); if (!row || row.closest('.ck-ch')) return;
    const c = S.clients[UI.sel]; if (!c) return;
    const recs = rxRecs(c).map(r => opClasse(r)), nI = recs.filter(x => x === 'identificada').length, nH = recs.filter(x => x === 'hipotese').length;
    const tot = stats().mrrSum, ls = licStatus(c), rel = relRows(c).filter(r => r.rel);
    const steps = [
      ['Planilha', !!c.src?.file, c.src?.file ? 'Importada' : 'Sem planilha', 'cadastro', 'Ver cadastro'],
      ['Ficha de faturamento', c.fstat?.k === 'disponivel', c.fstat?.k === 'disponivel' ? 'Confirmada' : 'Não carregada', 'fichas', 'Anexar ficha'],
      ['Contrato e licenciamento', ls.k === 'ok', ls.k === 'ok' ? 'Confirmado' : ls.k === 'parcial' ? 'Parcial' : 'Pendente', 'contratacao', 'Conferir'],
      ['Release', rel.length > 0, rel.length ? rel.map(r => r.rel).join(', ') : 'Não confirmada', 'tecnologia', 'Informar release']];
    const done = steps.filter(s => s[1]).length, ini = String(c.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const chips = [c.code, typeof segName === 'function' && segName(c.segInfo?.id), c.city, c.size && 'Porte ' + String(c.size).toLowerCase()].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('');
    const box = document.createElement('section'); box.className = 'ck-ch'; box.setAttribute('aria-label', 'Resumo do cliente');
    row.parentNode.insertBefore(box, row); box.appendChild(row); row.style.marginBottom = '';
    box.insertAdjacentHTML('beforeend', `<div class="ck-ch2"><div class="ck-id"><i aria-hidden="true">${esc(ini)}</i><div class="ck-chips">${chips}</div></div>
      <div class="ck-st"><div><small>MRR informado</small><b>${Number.isFinite(c.mrr) ? fmtBRL(c.mrr) : '—'}</b><span>${Number.isFinite(c.mrr) && tot > 0 ? (100 * c.mrr / tot).toFixed(1).replace('.', ',') + '% da carteira' : 'não informado na planilha'}</span></div><div><small>Oportunidades</small><b>${nI + nH}</b><span>${nI} identificada(s) • ${nH} hipótese(s)</span></div></div></div>
      <div class="ck-rd">${ckRing(done, steps.length, 'Fontes confirmadas', done ? 'ok' : 'off')}<ol>${steps.map(([l, ok, st, tab, act], i) => `<li class="${ok ? 'ok' : ''}"><i aria-hidden="true">${ok ? '✓' : i + 1}</i><b>${l}</b>${ok ? `<span>${esc(st)}</span>` : `<a href="#" data-a="ctab" data-v="${tab}">${act}</a>`}</li>`).join('')}</ol></div>`);
  }
  function funil(app) {
    if (app.querySelector('#ckf')) return; const flt = app.querySelector(':scope > .filters'); if (!flt) return;
    const all = opAll().filter(x => x.cl !== 'nao'), nI = all.filter(x => x.cl === 'identificada').length, nH = all.length - nI, nL = all.filter(x => jdCur(x.c, x.o)).length, f = OPF();
    const m = (l, v, t, cls) => `<div><small>${l}</small><b>${v}</b><i aria-hidden="true"><u class="${cls}" style="width:${t > 0 ? (100 * v / t).toFixed(1) : 0}%"></u></i></div>`;
    const ch = (v, l, n) => `<button type="button" data-ckcl="${v}" aria-pressed="${(f.cl || '') === v}">${l} <b>${n}</b></button>`;
    let top = app.firstElementChild; while (top && top.matches('.alert') && !top.matches('.alert.i')) top = top.nextElementSibling;
    (top || flt).insertAdjacentHTML('beforebegin', `<section id="ckf" class="ckf" aria-label="Resumo das oportunidades"><div class="ckf-g">${m('Mapeadas', all.length, all.length, 'c')}${m('Hipóteses a investigar', nH, all.length, 'hy')}${m('Identificadas', nI, all.length, 'ok')}${m('Com sua leitura', nL, all.length, 'c')}</div></section>`);
    flt.insertAdjacentHTML('beforebegin', `<div class="ckf-ch" role="group" aria-label="Filtro rápido por classificação">${ch('', 'Todas', all.length)}${ch('identificada', 'Identificadas', nI)}${ch('hipotese', 'Hipóteses', nH)}</div>`);
  }
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-ckcl]'); if (!t) return; const f = OPF(); f.cl = t.dataset.ckcl; f.lim = 30; render(); });
  function run() {
    const app = document.getElementById('app'); if (!app || typeof UI === 'undefined' || !WIDE.matches) return;
    try { if (UI.view === 'cliente') ficha(app); else if (UI.view === 'oport') funil(app); } catch (err) { console.warn('cockpit', err); }
  }
  let q = 0; const sched = () => { if (!q) q = requestAnimationFrame(() => { q = 0; run(); }); };
  const host = document.getElementById('app'); if (host) new MutationObserver(sched).observe(host, { childList: true });
  WIDE.addEventListener && WIDE.addEventListener('change', sched); sched();
})();
