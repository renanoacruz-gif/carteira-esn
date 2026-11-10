/* Rodada 34 — sistema de movimento (camada aditiva, sem alterar dados nem lógica).
   1) entrada suave do conteúdo quando a TELA muda (não a cada render: render() reconstrói o DOM e piscaria);
   2) contagem progressiva dos indicadores numéricos na entrada da tela; o texto final é exatamente o original.
   Desligado com prefers-reduced-motion e sob automação de testes (valores precisam ser lidos de imediato); window.__MOTION_FORCE__ força para teste. */
(() => {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)'), on = () => window.__MOTION_FORCE__ || (!RM.matches && navigator.webdriver !== true);
  const NUM = /^(R\$\s?)?(\d{1,3}(?:\.\d{3})*|\d+)(,\d+)?(\s?%)?$/;
  let last = null, pend = false;
  function count(el) {
    const txt = el.textContent.trim(), m = txt.match(NUM); if (!m || el.children.length) return;
    const dec = m[3] ? m[3].length - 1 : 0, end = parseFloat(m[2].replace(/\./g, '') + (m[3] ? '.' + m[3].slice(1) : '')); if (!(end > 0)) return;
    const fmt = v => (m[1] || '') + v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (m[4] || ''), t0 = performance.now(), D = 520;
    el.style.fontVariantNumeric = 'tabular-nums';
    const step = t => { if (!el.isConnected) return; const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3); if (p < 1) { el.textContent = fmt(end * e); requestAnimationFrame(step); } else el.textContent = txt; };
    requestAnimationFrame(step);
  }
  function run() {
    pend = false; const app = document.getElementById('app'); if (!app || typeof UI === 'undefined') return;
    const key = UI.view + '|' + (UI.view === 'cliente' ? UI.sel + '|' + UI.ctab : ''); if (key === last) return; last = key;
    if (!on()) return;
    app.classList.remove('mo-in'); void app.offsetWidth; app.classList.add('mo-in');
    app.querySelectorAll('.kpi .v, .ck-big b').forEach(count);
  }
  const host = document.getElementById('app'); if (host) new MutationObserver(() => { if (!pend) { pend = true; requestAnimationFrame(run); } }).observe(host, { childList: true });
})();
