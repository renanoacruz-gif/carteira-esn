/* ===== Rodada 18 §E: utilidade do motor — métricas derivadas dos registros EXISTENTES (c.act = decisão, c.aval = avaliação, c.valid.naoIdent) =====
   Nada novo é coletado. Taxas só sobre recomendações efetivamente avaliadas (denominador sempre exibido); período = data da última decisão/avaliação.
   Aceitação (“pertinente”) ≠ venda. Propostas de ajuste são só sugestões para revisão humana (S.meta.motorSug); nenhuma altera pesos, regras ou resultados. */
const UT_PER = { 0: 'Todo o período', 30: 'Últimos 30 dias', 90: 'Últimos 90 dias', 365: 'Últimos 12 meses' };
const UT_MIN_N = 4, UT_MIN_CLI = 2, UT_LIM = 0.5; /* proposta só com ≥4 avaliadas, ≥2 clientes e ≥50% de sinais negativos */
const utRegra = id => { const m = String(id).match(/^(fs_[a-z]+|cmp|rel)(?:_|$)/); return m ? m[1] : id; };
function utColetar(dias) {
  const lim = dias ? Date.now() - dias * 864e5 : 0, out = [];
  Object.values(S.clients).forEach(c => (c.opps || []).forEach(o => {
    const d = decGet(c, o.ruleId), a = avGet(c, o.ruleId) || {}, av = d.valid !== 'sugerida' || !!a.classe;
    const at = Math.max(Date.parse(d.at) || 0, Date.parse(a.at) || 0);
    const r = { c, o, regra: utRegra(o.ruleId), seg: opSeg(c), sols: (o.sols || []).map(s => s.id), ger: true, av: av && (!lim || at >= lim) };
    r.pert = r.av && (d.valid === 'validada' || d.valid === 'investigacao' || a.classe === 'faz_sentido');
    r.desc = r.av && d.valid === 'descartada'; r.atend = r.av && a.classe === 'atendida';
    r.gen = r.av && a.classe === 'generica'; r.inc = r.av && a.classe === 'incorreta'; r.aju = r.av && a.classe === 'ajuste';
    out.push(r);
  }));
  return out;
}
function utAgr(rows, keys) {
  const m = new Map();
  rows.forEach(r => keys(r).forEach(k => { const e = m.get(k) || { k, ger: 0, n: 0, pert: 0, desc: 0, atend: 0, gen: 0, inc: 0, aju: 0, cli: new Set(), nome: '' };
    e.ger++; if (!e.nome) e.nome = r.o.nome; if (r.av) { e.n++; e.cli.add(r.c.key); ['pert', 'desc', 'atend', 'gen', 'inc', 'aju'].forEach(f => { if (r[f]) e[f]++; }); } m.set(k, e); }));
  return [...m.values()].sort((a, b) => b.n - a.n || b.ger - a.ger);
}
const utNeg = e => e.desc + e.gen + e.inc + e.aju;
function utProps(rows) {
  return utAgr(rows, r => [r.regra]).filter(e => e.n >= UT_MIN_N && e.cli.size >= UT_MIN_CLI && utNeg(e) / e.n >= UT_LIM);
}
function utNaoIdent(dias) {
  const lim = dias ? Date.now() - dias * 864e5 : 0, seg = new Map(); let tot = 0, cli = 0;
  Object.values(S.clients).forEach(c => { const l = (c.valid?.naoIdent || []).filter(x => !lim || (Date.parse(x.at) || 0) >= lim); if (!l.length) return; cli++; tot += l.length; const s = opSeg(c); seg.set(s, (seg.get(s) || 0) + l.length); });
  return { tot, cli, seg: [...seg.entries()].sort((a, b) => b[1] - a[1]) };
}
function utRev(id, st) { S.meta.motorSug ||= {}; S.meta.motorSug[id] = { st, nota: ($('#mu_' + id)?.value || '').trim().slice(0, 400), at: nowISO() }; touchMeta(); render(); }
const UT_ACT = { utilP: t => { UI.utilP = +t.dataset.id || 0; UI.utilOpen = true; render(); }, utRev: t => utRev(t.dataset.id, t.dataset.st) };
const utCel = (k, n) => n ? `${k} <span class="muted">(${Math.round(100 * k / n)}%)</span>` : '—';
function utTabela(tit, rows, nomeFn) {
  if (!rows.length) return '';
  return `<h4>${esc(tit)}</h4><div class="tw"><table class="sm"><thead><tr><th>${esc(tit.replace(/^Por /, ''))}</th><th>Geradas</th><th>Avaliadas (n)</th><th>Pertinentes</th><th>Descartadas</th><th>Já atendidas</th><th>Genéricas / incorretas</th><th>Precisam de ajuste</th><th>Clientes</th></tr></thead><tbody>${rows.map(e =>
    `<tr><td>${esc(nomeFn(e))}</td><td>${e.ger}</td><td><b>${e.n}</b>${e.n && e.n < UT_MIN_N ? ' ' + pill('amostra pequena', 'warn') : ''}${!e.n ? ' <span class="muted">sem avaliação</span>' : ''}</td><td>${utCel(e.pert, e.n)}</td><td>${utCel(e.desc, e.n)}</td><td>${utCel(e.atend, e.n)}</td><td>${utCel(e.gen + e.inc, e.n)}</td><td>${utCel(e.aju, e.n)}</td><td>${e.cli.size}</td></tr>`).join('')}</tbody></table></div>`;
}
function utilHtml() {
  const dias = UI.utilP || 0, rows = utColetar(dias), tot = rows.length; if (!tot) return '';
  const ava = rows.filter(r => r.av), cli = new Set(ava.map(r => r.c.key)).size, ni = utNaoIdent(dias), props = utProps(rows);
  const solRows = utAgr(rows, r => r.sols.length ? r.sols : ['(sem solução)']).slice(0, 12), segRows = utAgr(rows, r => [r.seg]).slice(0, 12), regRows = utAgr(rows, r => [r.regra]).slice(0, 15);
  const solNome = e => e.k === '(sem solução)' ? e.k : (S.solutions.find(s => s.id === e.k)?.nome || e.k);
  return `<details class="card" style="margin-bottom:10px" ${UI.utilOpen ? 'open' : ''}><summary><b>Utilidade do motor</b> <span class="muted sm">— ${ava.length} de ${tot} recomendação(ões) avaliada(s) • ${cli} cliente(s) • ${esc(UT_PER[dias])}</span></summary>
  <p class="sm muted">Calculado dos registros já existentes (sua leitura, validação e avaliação). Percentuais usam como denominador só as recomendações <b>avaliadas</b> (coluna n) no período; “Geradas” é o total ativo no motor. Categorias podem se sobrepor (ex.: descartada e já atendida). <b>Pertinente não é venda</b>: mede aceitação da hipótese, não contratação. Amostras pequenas não permitem concluir nada sobre a regra.</p>
  <div class="row sm" style="gap:4px">${Object.entries(UT_PER).map(([d, l]) => `<button class="btn ${dias === +d ? 'pri' : 'ghost'} sm" data-a="utilP" data-id="${d}" aria-pressed="${dias === +d}">${esc(l)}</button>`).join('')}</div>
  ${ava.length ? '' : '<p class="sm muted">Nenhuma recomendação avaliada neste período — sem taxas a mostrar.</p>'}
  ${utTabela('Por regra', regRows, e => e.nome || e.k)}${utTabela('Por solução', solRows, solNome)}${utTabela('Por segmento', segRows, e => opSegL(e.k))}
  <h4>Necessidades relevantes não identificadas pelo motor</h4><p class="sm">${ni.tot ? `${ni.tot} registrada(s) em ${ni.cli} cliente(s) (${esc(UT_PER[dias].toLowerCase())})${ni.seg.length ? ' — por segmento: ' + ni.seg.map(([s, n]) => `${esc(opSegL(s))}: ${n}`).join('; ') : ''}. Contagem apenas: não há denominador confiável (não se sabe quantas existiam).` : 'Nenhuma registrada neste período.'}</p>
  <h4>Propostas de ajuste (para sua revisão)</h4>${props.length ? props.map(e => { const d = (S.meta.motorSug || {})[e.k];
    return `<div class="opp"><div class="row"><h4>${esc(e.nome || e.k)}</h4><span class="sp"></span>${d ? pill(d.st === 'analisada' ? 'Revisada' : 'Descartada', d.st === 'analisada' ? 'ok' : 'off') : pill('Pendente de revisão', 'warn')}</div>
    <p class="sm">${utNeg(e)} de ${e.n} avaliadas (${Math.round(100 * utNeg(e) / e.n)}%) foram descartadas ou apontadas como genéricas, incorretas ou a ajustar, em ${e.cli.size} cliente(s). <b>Proposta:</b> revisar a regra/gatilho. Nada foi alterado automaticamente.</p>
    <div class="row"><input id="mu_${esc(e.k)}" placeholder="Nota da revisão" value="${esc(d?.nota || '')}" style="flex:1;min-width:200px"><button class="btn ghost sm" data-a="utRev" data-id="${esc(e.k)}" data-st="analisada">Marcar como revisada</button><button class="btn ghost sm" data-a="utRev" data-id="${esc(e.k)}" data-st="descartada">Descartar proposta</button></div></div>`; }).join('')
    : `<p class="sm muted">Nenhuma regra atinge o mínimo para proposta (≥${UT_MIN_N} avaliadas em ≥${UT_MIN_CLI} clientes e ≥${UT_LIM * 100}% de sinais negativos). Pesos e regras globais só mudam por decisão sua.</p>`}
  </details>`;
}
