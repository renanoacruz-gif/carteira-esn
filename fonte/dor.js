/* ===== Rodada 18 §G: busca “dor do cliente → solução” sobre o conteúdo da Base de Soluções =====
   Reusa semIdx() (trechos de funcionalidades, dores, processos e materiais) e wTok(). Sem resultado forçado: exige ≥2 termos significativos em comum com o trecho.
   Correspondência de palavras NÃO prova que o cliente tem a dor. Hipótese salva em c.dorHip[]; vira oportunidade de investigação só se nenhuma outra oportunidade já cobrir a solução
   (senão a hipótese é anexada como evidência à oportunidade existente — nunca duplica). */
const DOR_TIPO = { dor: 'dor resolvida', funcionalidade: 'funcionalidade', processo: 'processo atendido', material: 'material' };
const DOR_MAX = 6;
function dorBuscar(frase) {
  const q = String(frase || '').trim().slice(0, 400), toks = [...new Set(wTok(q))];
  if (toks.length < 2) return { q, toks, grupos: [], fracos: [], motivo: 'curta' };
  const I = semIdx(), by = new Map();
  I.chunks.forEach(ch => { const sh = toks.filter(w => ch.tk.has(w)); if (sh.length < 2) return; const sc = sh.reduce((a, w) => a + Math.log(1 + I.n / (I.df[w] || 1)), 0); if (!by.has(ch.sid)) by.set(ch.sid, []); by.get(ch.sid).push({ ch, sh, sc }); });
  const grupos = [...by.entries()].map(([sid, L]) => { L.sort((a, b) => b.sc - a.sc); const sol = S.solutions.find(x => x.id === sid); return { sid, sol, best: L.slice(0, 2), n: L.length, score: L[0].sc + .25 * L.slice(1, 4).reduce((a, x) => a + x.sc, 0) }; })
    .filter(g => g.sol && !g.sol.arquivado).sort((a, b) => b.score - a.score).slice(0, DOR_MAX);
  /* enquadramento fraco: a frase cita uma necessidade conhecida e a solução está catalogada para ela, mas NENHUM trecho casou — só se houver poucos resultados fortes */
  const fracos = [];
  if (grupos.length < 3) Object.keys(KB.NEEDS).filter(n => n !== 'retencao' && KB.NEEDS[n].test(q)).forEach(n => activeSols().filter(s => (s.necessidades || []).includes(n) && !grupos.some(g => g.sid === s.id) && !fracos.some(f => f.sol.id === s.id)).slice(0, 3).forEach(s => fracos.push({ sol: s, need: n })));
  return { q, toks, grupos, fracos: fracos.slice(0, 3) };
}
function dorReq(r) {
  const l = solLegacy(r), pre = (r.prerequisitos || []).map(p => p.t).slice(0, 4), L = [...pre];
  L.push(l.integraProtheus === true ? 'Integração com Protheus documentada na fonte.' : l.integraProtheus === false ? 'NÃO integra com Protheus segundo a fonte.' : 'Compatibilidade com Protheus não confirmada na Base.');
  if (r.limites) L.push('Limites: ' + String(r.limites).slice(0, 160));
  return { L, semPre: !pre.length };
}
function dorExec() {
  UI.dor ||= {}; UI.dor.q = ($('#dor-q')?.value || '').trim(); UI.dor.k = $('#dor-c')?.value || ''; UI.dor.res = UI.dor.q ? dorBuscar(UI.dor.q) : null; UI.dor.msg = ''; render();
}
function dorCover(c, solId, exceto) { return (c.opps || []).find(o => o.ruleId !== exceto && ((o.sols || []).some(s => s.id === solId) || (o.extraBase || []).includes(solId))); }
function dorSalvar(solId) {
  const D = (UI.dor ||= {}); D.k = $('#dor-c')?.value || D.k || ''; const c = S.clients[D.k], g = D.res?.grupos.find(x => x.sid === solId);
  if (!c) return toast('Escolha o cliente para vincular a hipótese.'); if (!g) return;
  c.dorHip ||= []; if (c.dorHip.some(h => h.solId === solId && norm(h.frase) === norm(D.q))) return toast('Esta hipótese já está salva neste cliente.');
  const b = g.best[0]; c.dorHip.push({ id: 'dh_' + uid(), frase: D.q.slice(0, 400), solId, trecho: b.ch.t.slice(0, 300), tipo: b.ch.k, fonte: b.ch.f ? { t: b.ch.f.t, u: b.ch.f.u || '' } : null, termos: b.sh, em: nowISO() });
  touchC(c.key); runAnalysis(c, ''); const cov = dorCover(c, solId, 'dor_' + solId);
  D.msg = cov ? `Hipótese salva e vinculada à oportunidade já existente “${cov.nome}” (nenhuma oportunidade duplicada).` : 'Hipótese salva: criada oportunidade de investigação (hipótese a validar; nada confirmado).'; render();
}
function dorDel(k, id) { const c = S.clients[k]; if (!c) return; c.dorHip = (c.dorHip || []).filter(h => h.id !== id); touchC(k); runAnalysis(c, ''); render(); }
const DOR_ACT = { dorBuscar: dorExec, dorSalvar: t => dorSalvar(t.dataset.id), dorDel: t => dorDel(t.dataset.k, t.dataset.id) };
/* geração: roda dentro de analyzeClient, DEPOIS das demais regras (recebe a lista-base para não duplicar) */
function dorOpps(c, base) {
  const H = (c.dorHip || []).filter(h => activeSols().some(s => s.id === h.solId)), out = [], bySol = new Map();
  H.forEach(h => (bySol.get(h.solId) || bySol.set(h.solId, []).get(h.solId)).push(h));
  bySol.forEach((hs, solId) => {
    const r = S.solutions.find(s => s.id === solId), l = solLegacy(r), ev = hs.map(h => ({ cls: 'HIPÓTESE', text: `Hipótese do executivo (${dtBR(h.em)}): “${h.frase}”`, src: 'Executivo (busca dor → solução)' }));
    const cov = (base || []).find(o => (o.sols || []).some(s => s.id === solId) || (o.extraBase || []).includes(solId));
    if (cov) { cov.evInd = [...(cov.evInd || []), ...ev]; cov.origemTipo = [...new Set([...(cov.origemTipo || []), 'Hipótese do executivo'])]; cov.dorLink = hs.length; return; }
    const h0 = hs[0], rq = dorReq(r);
    out.push(mkOpp(c, { ruleId: 'dor_' + solId, tipo: 'Hipótese do executivo', tipoBase: 'Cross-sell', nome: `Hipótese do executivo: ${r.nome}`, modo: 'investigacao',
      problema: `INVESTIGAÇÃO RECOMENDADA: você registrou ${hs.length > 1 ? hs.length + ' hipóteses' : 'a hipótese'} (“${h0.frase}”) e a Base de Soluções tem conteúdo de “${r.nome}” que se aproxima dessa descrição. Nada nos documentos do cliente confirma essa dor ou necessidade: é uma hipótese sua a validar.`,
      impacto: 'HIPÓTESE: sem estimativa de receita; serve para orientar a conversa de descoberta.', evInd: [...ev, { cls: 'FATO', text: `Trecho da Base (${DOR_TIPO[h0.tipo] || h0.tipo}): “${h0.trecho}”`, src: h0.fonte?.t || r.nome }],
      sols: [l], natureza: ['HIPÓTESE DO EXECUTIVO — A VALIDAR'], deps: rq.L.slice(0, 4), origemTipo: ['Hipótese do executivo'], origens: ['executivo (dor → solução)'],
      perg: [`A situação “${h0.trecho.slice(0, 160)}” acontece no cliente? Como é feito hoje e com qual sistema ou planilha?`, ...(r.prerequisitos || []).slice(0, 1).map(p => `Requisito a confirmar: ${p.t}`)],
      acao: 'Confirmar a dor com o cliente antes de qualquer proposta; se não se confirmar, descarte a hipótese.' },
      { evidencia: 1, aderencia: l.integraProtheus === true ? 3 : 2, impacto: 1, urgencia: 0, viabilidade: l.integraProtheus === true ? 3 : 2, dados: dataQuality(c) }));
  });
  return out;
}
function dorHtml() {
  const D = UI.dor || {}, res = D.res, cl = clients().slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), c = S.clients[D.k], hs = c?.dorHip || [];
  const card = g => { const r = g.sol, b = g.best[0], rq = dorReq(r), pre0 = (r.prerequisitos || [])[0];
    return `<div class="opp"><div class="row"><h4>${esc(r.nome)}</h4>${pill(r.status, 'off')}<span class="sp"></span><button class="btn sm" data-a="dorSalvar" data-id="${esc(r.id)}">Salvar hipótese no cliente</button></div>
    <dl><dt>Trecho que sustenta</dt><dd>“${esc(b.ch.t.slice(0, 320))}” <span class="muted sm">(${esc(DOR_TIPO[b.ch.k] || b.ch.k)}${b.ch.f ? ' • ' + (b.ch.f.u ? `<a href="${esc(safeUrl(b.ch.f.u))}" target="_blank" rel="noopener noreferrer">${esc(b.ch.f.t)}</a>` : esc(b.ch.f.t)) : ''})</span></dd>
    <dt>Explicação</dt><dd class="sm">Casou em ${b.sh.length} de ${res.toks.length} termos da sua frase (${b.sh.map(esc).join(', ')})${g.n > 1 ? `; ${g.n} trechos desta solução casam` : ''}. É correspondência de palavras: não confirma que o cliente tenha essa dor.</dd>
    <dt>Requisitos</dt><dd><ul class="sm">${rq.L.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${rq.semPre ? '<div class="sm muted">Pré-requisitos não registrados na Base — confirmar na fonte oficial.</div>' : ''}</dd>
    <dt>Pergunta de confirmação</dt><dd class="sm">A situação “${esc(b.ch.t.slice(0, 140))}” acontece no cliente? Como é feito hoje e com qual sistema ou planilha?${pre0 ? ` Requisito a confirmar: ${esc(pre0.t)}` : ''}</dd></dl></div>`; };
  const body = !res ? '' : res.motivo === 'curta' ? '<p class="sm muted">Descreva a dor com mais detalhes (ao menos 2 termos específicos): frases curtas ou genéricas não geram busca confiável.</p>'
    : res.grupos.length ? res.grupos.map(card).join('') : `<div class="alert i sm"><b>Nenhuma solução da Base tem trecho que sustente esta frase.</b> Não há sugestão forçada. Pode ser lacuna de cadastro na Base ou a necessidade não existir no catálogo. Termos usados na busca: ${res.toks.map(esc).join(', ')}.</div>`;
  const fr = res && res.fracos?.length ? `<h4>Indício fraco (sem trecho que sustente)</h4><ul class="sm">${res.fracos.map(f => `<li><b>${esc(f.sol.nome)}</b> — catalogada para “${esc(NEED_LABEL[f.need] || f.need)}”, mas nenhum trecho do conteúdo casa com sua frase.</li>`).join('')}</ul>` : '';
  return `<details class="card" style="margin-bottom:10px" ${UI.dor ? 'open' : ''}><summary><b>Buscar solução pela dor do cliente</b></summary>
  <p class="sm muted">Escreva a dor com as palavras do cliente. A busca varre funcionalidades, dores, processos e materiais da Base e mostra só o que tem trecho que sustente. Salvar a hipótese não a confirma: ela vira oportunidade de investigação (ou é anexada à oportunidade que já cobre a solução).</p>
  <div class="row"><textarea id="dor-q" rows="2" style="flex:1;min-width:260px" placeholder="ex.: aprovação de pedidos de compra é feita por e-mail e planilha">${esc(D.q || '')}</textarea>
  <select id="dor-c"><option value="">— cliente (para salvar hipótese) —</option>${cl.map(x => `<option value="${esc(x.key)}" ${D.k === x.key ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button class="btn pri sm" data-a="dorBuscar">Buscar</button></div>
  ${D.msg ? `<div class="alert i sm">${esc(D.msg)}</div>` : ''}${body}${fr}
  ${hs.length ? `<h4>Hipóteses salvas — ${esc(c.name)}</h4><ul class="sm">${hs.map(h => `<li>“${esc(h.frase)}” → <b>${esc(solNomeRel(h.solId))}</b> • ${esc(dtBR(h.em))} <button class="btn ghost sm" data-a="dorDel" data-k="${esc(c.key)}" data-id="${esc(h.id)}">Remover</button></li>`).join('')}</ul>` : ''}</details>`;
}
