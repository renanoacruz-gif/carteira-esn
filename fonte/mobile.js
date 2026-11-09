/* Mobile (≤900px): camada visual — hero da carteira, oportunidades em acordeão, planilha do Google recolhida, marca no cabeçalho.
   Aditivo e idempotente: só cria elementos/classes novos; reutiliza as ações existentes (nav). Desktop não muda. */
(function () {
  const mq = window.matchMedia('(max-width: 900px)'), $1 = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const mrrFmt = v => (typeof fmtBRL === 'function' ? fmtBRL(v) : 'R$ ' + Math.round(v).toLocaleString('pt-BR'));
  function logo() { const i = $1('.sb-sym'); if (i && i.src) document.documentElement.style.setProperty('--logo-s', 'url("' + i.src + '")'); }
  function hero(app) {
    const on = UI.view === 'geral' && typeof clients === 'function' && clients().length > 0; app.classList.toggle('m-geral', on);
    if (!on || app.querySelector('.mhero')) return;
    const cs = clients(); let mrr = 0, com = 0, pr = 0, iv = 0;
    cs.forEach(c => { if (c.mrr > 0) { mrr += c.mrr; com++; } (c.opps || []).forEach(o => { try { const k = rxClass(c, o).cl; if (k === 'prioridade') pr++; else if (k === 'investigar') iv++; } catch { /* regra sem classe */ } }); });
    const chip = (n, l, cls) => `<button type="button" class="mh-chip ${cls}" data-a="nav" data-v="oport"><b>${n}</b><span>${l}</span></button>`;
    app.insertAdjacentHTML('afterbegin', `<section class="mhero" aria-label="Resumo da carteira"><div class="mh-eb">Sua carteira</div><div class="mh-v">${mrrFmt(mrr)}</div><div class="mh-s">MRR informado na planilha · ${com} de ${cs.length} cliente(s)</div><div class="mh-chips">${chip(pr, pr === 1 ? 'prioridade' : 'prioridades', 'pri')}${chip(iv, 'a investigar', 'inv')}</div></section>`);
  }
  function opps(app) {
    app.querySelectorAll('.card.opc .opp:not([data-mc])').forEach(o => {
      o.dataset.mc = '1'; o.classList.add('mo-c');
      const jd = o.querySelector(':scope > .jd'), b = '<button type="button" class="btn ghost sm mo-tg" aria-expanded="false">Ver evidências e detalhes</button>';
      if (jd) jd.insertAdjacentHTML('afterend', b); else o.querySelector(':scope > .row')?.insertAdjacentHTML('afterend', b);
    });
  }
  function sheet(app) {
    const s = app.querySelector('#shcard'); if (!s || s.querySelector('.shc-tg')) return;
    s.classList.add('shc-c'); s.querySelector('h3')?.insertAdjacentHTML('afterend', '<button type="button" class="btn ghost sm shc-tg" aria-expanded="false">Configurar</button>');
  }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('.mo-tg, .shc-tg'); if (!t) return;
    const box = t.classList.contains('mo-tg') ? t.closest('.opp') : t.closest('#shcard'), on = box.classList.toggle('open'); t.setAttribute('aria-expanded', String(on));
    t.textContent = t.classList.contains('mo-tg') ? (on ? 'Recolher detalhes' : 'Ver evidências e detalhes') : (on ? 'Recolher' : 'Configurar');
  });
  let q = 0;
  const run = () => { q = 0; try { logo(); const app = $1('#app'); if (!app) return; if (!mq.matches) { app.classList.remove('m-geral'); return; } hero(app); opps(app); sheet(app); } catch { /* shell ainda não montado */ } };
  const sched = () => { if (!q) q = requestAnimationFrame(run); };
  const app = $1('#app'); if (app) new MutationObserver(sched).observe(app, { childList: true, subtree: true });
  mq.addEventListener?.('change', sched); sched();
})();
