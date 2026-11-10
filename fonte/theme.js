/* Tema claro / noturno / automático — camada aditiva. Só troca data-theme em <html> (tokens em style.css);
   não toca em dados, exportações ou lógica. Preferência por navegador em localStorage 'rf.theme'. */
(() => {
  'use strict';
  const KEY = 'rf.theme', MQ = matchMedia('(prefers-color-scheme: dark)');
  const get = () => { try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'auto' ? v : 'light'; } catch { return 'light'; } };
  const eff = () => { const p = get(); return p === 'auto' ? (MQ.matches ? 'dark' : 'light') : p; };
  const SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>';
  const MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>';
  function apply() {
    const e = eff(), r = document.documentElement;
    if (e === 'dark') r.dataset.theme = 'dark'; else delete r.dataset.theme;
    const b = document.getElementById('th-btn'); if (b) { const d = e === 'dark'; b.innerHTML = d ? SUN : MOON; b.setAttribute('aria-pressed', String(d)); const t = d ? 'Mudar para o tema claro' : 'Mudar para o modo noturno'; b.setAttribute('aria-label', t); b.title = t; }
    document.querySelectorAll('[data-th]').forEach(x => x.classList.toggle('on', x.dataset.th === get()));
  }
  const set = v => { try { localStorage.setItem(KEY, v); } catch { } apply(); };
  window.themeGet = get; window.themeSet = set;
  function button() {
    const a = document.querySelector('#top .top-a'); if (!a || document.getElementById('th-btn')) return;
    a.insertAdjacentHTML('afterbegin', '<button type="button" class="btn ghost sm th-btn" id="th-btn"></button>'); apply();
  }
  function card() {
    const app = document.getElementById('app'); if (!app || typeof UI === 'undefined' || UI.view !== 'conta' || document.getElementById('th-card')) return;
    const o = (v, t) => `<button type="button" data-th="${v}">${t}</button>`;
    app.insertAdjacentHTML('afterbegin', `<div class="card" id="th-card"><h3>Aparência</h3><p class="sm muted">Vale só para este navegador. "Automático" segue o tema do sistema.</p><div class="seg2" role="group" aria-label="Tema">${o('light', 'Claro')}${o('dark', 'Noturno')}${o('auto', 'Automático')}</div></div>`); apply();
  }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('#th-btn, [data-th]'); if (!t) return;
    set(t.id === 'th-btn' ? (eff() === 'dark' ? 'light' : 'dark') : t.dataset.th);
  });
  MQ.addEventListener && MQ.addEventListener('change', apply);
  let q = 0; const sched = () => { if (!q) q = requestAnimationFrame(() => { q = 0; button(); card(); }); };
  ['top', 'app'].forEach(id => { const el = document.getElementById(id); if (el) new MutationObserver(sched).observe(el, { childList: true }); });
  apply(); sched();
})();
