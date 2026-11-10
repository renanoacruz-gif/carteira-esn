/* Design refresh — camada de UI opt-in (fase 3). Só ADICIONA elementos fora de #app; não altera estado,
   dados, ids ou handlers existentes. Navegação e abertura de cliente reutilizam os data-a já existentes. */
(() => {
  const $1 = (s, r = document) => r.querySelector(s);
  const typing = t => !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
  const otherModal = () => !!($1('.mdl-bg:not(.rf-layer)') || (typeof UI !== 'undefined' && UI.confirm));
  let layer = null, lastFocus = null;

  /* ---------- camada genérica (paleta, atalhos, glossário) ---------- */
  function close(restore = true) {
    if (!layer) return; layer.remove(); layer = null; document.body.classList.remove('mdl');
    if (restore && lastFocus && document.contains(lastFocus)) lastFocus.focus?.();
    lastFocus = null;
  }
  function open(cls, label, inner) {
    close(false); lastFocus = document.activeElement;
    layer = document.createElement('div'); layer.className = 'mdl-bg rf-layer ' + cls;
    layer.innerHTML = `<div class="mdl-box rf-box" role="dialog" aria-modal="true" aria-label="${label}">${inner}</div>`;
    document.body.appendChild(layer); document.body.classList.add('mdl'); return layer;
  }
  document.addEventListener('mousedown', e => { if (layer && e.target === layer) close(); });
  document.addEventListener('click', e => {
    if (!layer) return;
    if (e.target.closest('[data-rf="x"]')) { close(); return; }
    const go = e.target.closest('[data-rf]');
    if (go && go.dataset.rf === 'keys') { e.preventDefault(); keys(); return; }
    if (go && go.dataset.rf === 'gloss') { e.preventDefault(); gloss(); return; }
    if (e.target.closest('#rf-list [data-a]')) setTimeout(() => close(false), 0);
  });

  /* ---------- paleta Ctrl/⌘+K ---------- */
  const telas = () => [...document.querySelectorAll('#nav .sb-item[data-v]')].map(b => ({ v: b.dataset.v, t: b.dataset.tip || b.textContent.trim() })).filter(x => x.t).filter((x, i, a) => a.findIndex(y => y.v === x.v) === i);
  const fn = n => (typeof n === 'function');
  function palList(q) {
    const nq = fn(norm) ? norm(q).trim() : q.toLowerCase().trim(), out = [];
    const T = telas().filter(x => !nq || (fn(norm) ? norm(x.t) : x.t.toLowerCase()).includes(nq));
    if (T.length) out.push(['Ir para', T.map(x => `<button type="button" class="rf-it" role="option" data-a="nav" data-v="${esc(x.v)}"><span class="rf-ic" aria-hidden="true">→</span>${esc(x.t)}</button>`)]);
    if (nq && fn(clients)) {
      const dq = nq.replace(/\D/g, ''), hit = clients().filter(c => norm(`${c.name} ${c.code || ''}`).includes(nq) || (dq.length >= 4 && (c.cnpj || '').includes(dq))).slice(0, 8);
      if (hit.length) out.push(['Clientes', hit.map(c => `<button type="button" class="rf-it" role="option" data-a="gsOpen" data-k="${esc(c.key)}"><span class="rf-ic" aria-hidden="true">●</span><span class="rf-tx"><b>${esc(c.name)}</b><small>${esc(c.code || '')}${c.cnpj ? ' • ' + esc(c.cnpj) : ''}</small></span></button>`)]);
    }
    const A = [['keys', 'Atalhos do teclado', '?'], ['gloss', 'Glossário (MRR, Score, rótulos…)', 'i']].filter(a => !nq || (fn(norm) ? norm(a[1]) : a[1].toLowerCase()).includes(nq));
    if (A.length) out.push(['Ajuda', A.map(a => `<button type="button" class="rf-it" role="option" data-rf="${a[0]}"><span class="rf-ic" aria-hidden="true">${a[2]}</span>${a[1]}</button>`)]);
    return out;
  }
  function palPaint() {
    const q = $1('#rf-q')?.value || '', box = $1('#rf-list'); if (!box) return;
    const g = palList(q);
    box.innerHTML = g.length ? g.map(([h, its]) => `<div class="rf-gh" role="presentation">${h}</div>${its.join('')}`).join('') : '<div class="rf-empty">Nada encontrado.</div>';
    const f = box.querySelector('.rf-it'); if (f) f.classList.add('on');
  }
  function palMove(d) {
    const its = [...document.querySelectorAll('#rf-list .rf-it')]; if (!its.length) return;
    let i = its.findIndex(x => x.classList.contains('on')); its[i]?.classList.remove('on'); i = (i + d + its.length) % its.length;
    its[i].classList.add('on'); its[i].scrollIntoView({ block: 'nearest' });
    $1('#rf-q')?.setAttribute('aria-activedescendant', its[i].id || '');
  }
  function pal() {
    if (layer?.classList.contains('rf-pal')) { close(); return; }
    open('rf-pal', 'Paleta de comandos', `<input id="rf-q" type="text" autocomplete="off" spellcheck="false" placeholder="Ir para uma tela, buscar cliente…" aria-label="Buscar comando ou cliente"><div id="rf-list" class="rf-list" role="listbox"></div><div class="rf-hint">↑↓ navegar · Enter abrir · Esc fechar</div>`);
    palPaint(); $1('#rf-q').focus();
  }
  document.addEventListener('input', e => { if (e.target.id === 'rf-q') palPaint(); });

  /* ---------- atalhos e glossário ---------- */
  function keys() {
    const K = [['/', 'Buscar cliente (campo do topo)'], ['Ctrl/⌘ + K', 'Paleta de comandos: telas e clientes'], ['?', 'Esta lista de atalhos'], ['Esc', 'Fecha painéis, busca e esta janela'], ['↑ ↓', 'Navega nos resultados de busca'], ['Enter / Espaço', 'Abre o cartão focado'], ['Tab', 'Percorre os controles; o primeiro leva ao conteúdo']];
    open('rf-keys', 'Atalhos do teclado', `<h2>Atalhos do teclado</h2><dl class="rf-dl">${K.map(([k, d]) => `<dt><kbd>${k}</kbd></dt><dd>${d}</dd>`).join('')}</dl><div class="row mdl-act"><button type="button" class="btn ghost" data-rf="gloss">Glossário</button><button type="button" class="btn pri" data-rf="x">Fechar</button></div>`);
    $1('.rf-keys [data-rf="x"]').focus();
  }
  const GL = [
    ['MRR', 'Receita recorrente mensal. Na carteira aparece como “MRR (planilha)”, o valor importado; a ficha de faturamento detalha pela soma dos valores líquidos (VAL_LIQD) da competência.'],
    ['ARR', 'Receita recorrente anualizada, em geral MRR × 12. Use só como leitura de porte; não é previsão.'],
    ['Churn', 'Perda de cliente ou de receita recorrente. Os alertas do app são sinais documentados, não previsão de perda.'],
    ['Cross-sell', 'Oferta de solução adicional a um cliente que já contrata outras.'],
    ['Upsell', 'Ampliação do que o cliente já usa (mais volume, usuários ou plano superior).'],
    ['Expansão / Retenção', 'Tipos de oportunidade: Expansão amplia o uso ou a contratação; Retenção reduz risco de perda.'],
    ['Score (0–100)', 'Média ponderada de critérios transparentes. MRR e porte não entram. Prioridade não é probabilidade de fechamento.'],
    ['Fato · Inferência · Estimativa · Hipótese', 'Rótulos de confiança. Fato vem do arquivo ou fonte; inferência é deduzida por regra; estimativa é cálculo aproximado; hipótese é ponto a investigar e não conta como oportunidade.']];
  function gloss() {
    open('rf-gloss', 'Glossário', `<h2>Glossário</h2><dl class="rf-dl rf-gl">${GL.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl><div class="row mdl-act"><button type="button" class="btn ghost" data-rf="keys">Atalhos</button><button type="button" class="btn pri" data-rf="x">Fechar</button></div>`);
    $1('.rf-gloss [data-rf="x"]').focus();
  }

  /* ---------- teclado (captura, para vencer handlers genéricos só quando a camada é nossa) ---------- */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { if (!layer && otherModal()) return; e.preventDefault(); pal(); return; }
    if (layer) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (layer.classList.contains('rf-pal')) {
        if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); $1('#rf-list .rf-it.on')?.click(); }
      }
      if (e.key === 'Tab') { const f = [...layer.querySelectorAll('button,input')].filter(x => !x.disabled); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      return;
    }
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !typing(e.target) && !otherModal()) { e.preventDefault(); keys(); }
  }, true);

  /* ---------- botão de topo com anel de progresso ---------- */
  const top = document.createElement('button');
  top.type = 'button'; top.id = 'rf-top'; top.hidden = true; top.setAttribute('aria-label', 'Voltar ao topo');
  top.innerHTML = '<svg viewBox="0 0 36 36" width="44" height="44" aria-hidden="true"><circle class="rf-trk" cx="18" cy="18" r="15"/><circle class="rf-prg" cx="18" cy="18" r="15" pathLength="100"/><path class="rf-ar" d="M12 20.5l6-6 6 6"/></svg>';
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  document.body.appendChild(top);

  /* ---------- navegação interna (scroll-spy) nas telas longas ---------- */
  const toc = document.createElement('nav'); toc.id = 'rf-toc'; toc.hidden = true; toc.setAttribute('aria-label', 'Nesta tela'); document.body.appendChild(toc);
  let heads = [], raf = 0;
  const label = h => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 42);
  function tocBuild() {
    const app = $1('#app'); heads = [];
    if (app && innerWidth >= 1200 && document.documentElement.scrollHeight > innerHeight * 2.2) {
      const vis = sel => [...app.querySelectorAll(sel)].filter(h => h.offsetParent && label(h)).slice(0, 14);
      heads = vis('.card > h3, .card > .row > h3'); if (heads.length < 4) heads = vis('.opp h4');
    }
    if (heads.length < 4) { heads = []; toc.hidden = true; toc.innerHTML = ''; return; }
    toc.innerHTML = `<span class="rf-th">Nesta tela</span>` + heads.map((h, i) => `<button type="button" data-i="${i}" aria-label="Ir para ${esc(label(h))}"><i></i><span>${esc(label(h))}</span></button>`).join('');
    toc.hidden = false; tick();
  }
  toc.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]'); if (!b) return;
    const h = heads[+b.dataset.i]; if (h) h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  function tick() {
    raf = 0;
    const y = scrollY, max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    top.hidden = y < 700; top.style.setProperty('--p', Math.min(100, Math.round(y / max * 100)));
    if (!heads.length) return;
    let on = 0; heads.forEach((h, i) => { if (h.getBoundingClientRect().top <= 140) on = i; });
    toc.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('on', i === on); if (i === on) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current'); });
  }
  const sched = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener('scroll', sched, { passive: true });
  let t0 = 0; const rebuild = () => { clearTimeout(t0); t0 = setTimeout(tocBuild, 220); };
  addEventListener('resize', rebuild);
  const app = $1('#app'); if (app) new MutationObserver(rebuild).observe(app, { childList: true });
  rebuild();
})();
