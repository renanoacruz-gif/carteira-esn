/* Limpeza visual — camada aditiva: recolhe textos explicativos (abre ao clicar), dobra cartões só de leitura da Visão,
   oportunidades em acordeão também no computador e tabelas largas com rolagem própria. Nenhum texto é removido do DOM;
   exportações e impressão não mudam (impressão abre tudo). */
(() => {
  'use strict';
  const WIDE = matchMedia('(min-width: 901px)'), CTL = 'input,select,textarea,button';
  const mk = (el, cls) => { el.classList.add('cl-x', cls); requestAnimationFrame(() => { if (el.scrollHeight <= el.clientHeight + 3 && el.scrollWidth <= el.clientWidth + 3) { el.classList.remove('cl-x', cls); return; } el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-expanded', 'false'); el.title = 'Clique para ler tudo'; }); };
  function textos(app) {
    app.querySelectorAll('.alert:not([data-cl])').forEach(a => { a.dataset.cl = '1'; if (a.matches('.busy,.m-al') || a.closest('.a4,.rf3d,.mdl-box') || a.querySelector(CTL + ',[data-a]') || a.textContent.trim().length < 170) return; mk(a, 'cl-al'); });
    app.querySelectorAll('p:not([data-cl])').forEach(p => { p.dataset.cl = '1'; if (!p.matches('.muted,.sm,.lead') || p.closest('.a4,.rf3d,.alert,.ck,.mdl-box,details.sol-more,.empty') || p.querySelector(CTL) || p.textContent.trim().length < 130) return; mk(p, 'cl-p'); });
    app.querySelectorAll('td:not([data-cl])').forEach(td => { td.dataset.cl = '1'; if (td.closest('.a4,.rf3d,.ck,.mdl-box,table.chain,.bfkv,.bft2') || td.querySelector(CTL + ',[data-a],table,ul,ol') || td.textContent.trim().length < 150) return; const d = document.createElement('div'); while (td.firstChild) d.appendChild(td.firstChild); td.appendChild(d); mk(d, 'cl-p'); d.classList.add('l2'); });
    app.querySelectorAll('ul:not([data-cl]),ol:not([data-cl])').forEach(u => { u.dataset.cl = '1'; if (u.matches('.hjw,.ck-bars') || u.closest('.a4,.rf3d,.alert,.ck,.ck-ch,.mdl-box,details,.onb,#onb') || u.querySelector(CTL + ',[data-a]') || u.children.length < 3 || u.textContent.trim().length < 280) return;
      u.classList.add('cl-ul'); const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost sm cl-ulb'; b.setAttribute('aria-expanded', 'false'); b.textContent = `Ver detalhes (${u.children.length})`; u.parentNode.insertBefore(b, u); });
  }
  function visao(app) {
    if (UI.view !== 'geral') return;
    app.querySelectorAll(':scope > .card:not([data-cf]), :scope > .grid > .card:not([data-cf])').forEach(c => {
      c.dataset.cf = '1'; const hd = c.firstElementChild; if (!hd || c.id === 'hoje' || c.closest('.ck') || c.querySelector(CTL) || !(hd.matches('h3') || (hd.matches('.row') && hd.querySelector('h3'))) || c.children.length < 2) return;
      c.classList.add('cl-fold', 'cl-closed'); hd.classList.add('cl-hd'); hd.setAttribute('role', 'button'); hd.tabIndex = 0; hd.setAttribute('aria-expanded', 'false');
    });
  }
  function opps(app) {
    if (!WIDE.matches) return;   /* no celular quem faz é mobile.js (mesmas classes) */
    app.querySelectorAll('.card.opc .opp:not([data-mc])').forEach(o => {
      o.dataset.mc = '1'; o.classList.add('mo-c');
      const jd = o.querySelector(':scope > .jd'), b = '<button type="button" class="btn ghost sm mo-tg" aria-expanded="false">Ver evidências e detalhes</button>';
      if (jd) jd.insertAdjacentHTML('afterend', b); else o.querySelector(':scope > .row')?.insertAdjacentHTML('afterend', b);
    });
  }
  function tabelas(app) {
    if (!WIDE.matches) return;
    app.querySelectorAll('.card table').forEach(t => {
      if (t.closest('.tw, .tbl-wrap, .m-ts, .ck-tw, table.chain, .a4') || t.parentElement.closest('table')) return;
      const p = t.parentElement; if (t.offsetWidth <= p.clientWidth + 1 && t.scrollWidth <= p.clientWidth + 1) return;
      const w = document.createElement('div'); w.className = 'm-ts'; p.insertBefore(w, t); w.appendChild(t);
    });
    const on = app.querySelector('.ctabs button.on'); if (on && app.dataset.ctab !== UI.sel + '|' + UI.ctab) { app.dataset.ctab = UI.sel + '|' + UI.ctab; const b = on.parentElement; if (on.offsetLeft + on.offsetWidth > b.scrollLeft + b.clientWidth || on.offsetLeft < b.scrollLeft) b.scrollLeft = Math.max(0, on.offsetLeft - 24); }
  }
  const tog = e => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target; if (!t.closest) return;
    const ub = t.closest('.cl-ulb'); if (ub) { const u = ub.nextElementSibling, on = u.classList.toggle('open'); ub.setAttribute('aria-expanded', String(on)); ub.textContent = on ? 'Recolher detalhes' : `Ver detalhes (${u.children.length})`; return; }
    const hd = t.closest('.cl-hd'); if (hd && !t.closest('a,button,input,select')) { if (e.type === 'keydown') e.preventDefault(); const on = !hd.parentElement.classList.toggle('cl-closed'); hd.setAttribute('aria-expanded', String(on)); return; }
    const x = t.closest('.cl-x[role=button]'); if (x && !x.classList.contains('m-al') && !t.closest('a,button,input,select,textarea')) { if (e.type === 'keydown') e.preventDefault(); if (e.type === 'click' && String(getSelection()).length) return; x.setAttribute('aria-expanded', String(x.classList.toggle('open'))); }
  };
  document.addEventListener('click', tog); document.addEventListener('keydown', tog);
  let q = 0;
  const run = () => { q = 0; const app = document.getElementById('app'); if (!app || typeof UI === 'undefined') return; try { textos(app); visao(app); opps(app); tabelas(app); } catch (err) { console.warn('clean', err); } };
  const sched = () => { if (!q) q = requestAnimationFrame(run); };
  const host = document.getElementById('app'); if (host) new MutationObserver(sched).observe(host, { childList: true, subtree: true });
  sched();
})();
