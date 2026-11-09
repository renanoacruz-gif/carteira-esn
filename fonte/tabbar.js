/* Mobile (≤900px): barra inferior de navegação, "Primeiros passos" compacto e KPIs em faixa deslizante.
   Aditivo: só cria elementos novos e classes; reutiliza as ações existentes (nav, sbOpen). Desktop não muda. */
(function () {
  const TABS = [['geral', 'Visão', 'dash'], ['clientes', 'Clientes', 'users'], ['oport', 'Oportunidades', 'plan'], ['mercado', 'Mercado', 'trend']];
  const mq = window.matchMedia('(max-width: 900px)'), $1 = s => document.querySelector(s);
  let bar = null;
  function ensure() {
    if (bar) return bar; bar = document.createElement('nav'); bar.id = 'tabbar'; bar.setAttribute('aria-label', 'Navegação inferior');
    const sh = $1('#shell'); (sh && sh.parentNode ? sh.parentNode : document.body).insertBefore(bar, sh ? sh.nextSibling : null); return bar;
  }
  function paintBar() {
    if (!mq.matches) { if (bar) bar.hidden = true; return; }
    const b = ensure(); b.hidden = false;
    const top = navTop(UI.view)[0], inTabs = TABS.some(t => t[0] === top);
    b.innerHTML = TABS.map(([k, l, i]) => `<button type="button" class="tb-i${k === top ? ' on' : ''}" data-a="nav" data-v="${k}"${k === top ? ' aria-current="page"' : ''}>${ico(i, 22)}<span>${l}</span></button>`).join('')
      + `<button type="button" class="tb-i${inTabs ? '' : ' on'}" data-a="sbOpen" aria-haspopup="true">${ico('menu', 22)}<span>Menu</span></button>`;
  }
  function compact() {
    if (!mq.matches) return;
    const o = $1('#app #onb'); if (o && !o.querySelector('.onb-tg')) {
      const p = o.querySelectorAll('ol > li'), next = [...p].find(li => li.querySelector('[data-a=nav]')), nm = next && next.querySelector('b');
      o.classList.add('onb-c');
      const row = o.querySelector('.row'); if (row) row.insertAdjacentHTML('beforeend', '<button type="button" class="btn ghost sm onb-tg" aria-expanded="false">Ver passos</button>');
      if (nm) row && row.insertAdjacentHTML('afterend', `<p class="sm muted onb-nx">Próximo: <b>${nm.textContent}</b></p>`);
    }
    if (UI.view === 'geral') { const g = $1('#app > .grid.g4'); if (g && g.querySelector('.kpi')) g.classList.add('kpi-strip'); }
  }
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.onb-tg'); if (!t) return; const o = t.closest('#onb'), on = o.classList.toggle('open'); t.setAttribute('aria-expanded', String(on)); t.textContent = on ? 'Recolher' : 'Ver passos'; });
  const run = () => { try { paintBar(); compact(); } catch { /* shell ainda não montado */ } };
  const app = $1('#app'); if (app) new MutationObserver(run).observe(app, { childList: true });
  mq.addEventListener?.('change', run); run();
})();
