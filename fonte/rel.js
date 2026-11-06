/* ===== Rodada 18 §2: relações entre soluções (núcleo → complemento) =====
   Campo estruturado r.complementos[] em cada registro da Base de Soluções:
   { id, para (id da solução complementar), processo, condicoes, dependencias, fonte {t,u,d}|null, just, status: 'validada'|'pendente'|'rejeitada', origem: 'executivo'|'ia'|'radar', por, em }
   Regras: nada é presumido (Financeiro ⇒ Techfin NÃO é regra); relação comercial/funcional não prova integração técnica;
   só relações VALIDADAS pelo executivo geram indicação; sugestões (IA/radar) ficam PENDENTES até revisão; o catálogo nasce sem relações. */
const REL_ST = { validada: ['Validada pelo executivo', 'ok'], pendente: ['Pendente de revisão', 'warn'], rejeitada: ['Rejeitada', 'off'] };
const relsOf = r => (r.complementos || []);
function relErros(r, d) {
  const e = [], alvo = S.solutions.find(s => s.id === d.para && !s.arquivado);
  if (!alvo) e.push('Escolha a solução complementar.'); else if (alvo.id === r.id) e.push('Uma solução não pode ser complemento de si mesma.');
  if (!String(d.processo || '').trim()) e.push('Informe o processo atendido pelo complemento.');
  if (!String(d.just || '').trim() && !/^https?:\/\//i.test(String(d.fonteU || '').trim())) e.push('Informe a fonte (URL http/https) ou a justificativa: nenhuma relação entra sem base.');
  if (d.fonteU && !/^https?:\/\//i.test(String(d.fonteU).trim())) e.push('URL da fonte inválida (use http/https).');
  if (alvo && relsOf(r).some(x => x.para === d.para && norm(x.processo) === norm(d.processo) && x.status !== 'rejeitada')) e.push('Relação já cadastrada para este processo.');
  return e;
}
function relMk(d, status, origem) {
  const u = String(d.fonteU || '').trim();
  return { id: 'rl_' + uid(), para: d.para, processo: String(d.processo).trim().slice(0, 240), condicoes: String(d.condicoes || '').trim().slice(0, 400), dependencias: String(d.dependencias || '').trim().slice(0, 400),
    fonte: u || d.fonteT ? { t: String(d.fonteT || u).trim().slice(0, 200), u, d: today() } : null, just: String(d.just || '').trim().slice(0, 500), status, origem, por: (typeof ME !== 'undefined' && ME.id) || '', em: nowISO() };
}
function relCommit(r, acao, resumo) { r.rev++; r.atualizadoEm = today(); hist(r, acao, resumo); const n = solChanged(r, 'complementos alterados'); return n; }
/* curadoria do executivo: entra já validada */
function relAdd(solId, d) {
  const r = S.solutions.find(x => x.id === solId); if (!r) return; const e = relErros(r, d); if (e.length) { UI.relErr = { id: solId, e }; return render(); }
  UI.relErr = null; (r.complementos ||= []).push(relMk(d, 'validada', 'executivo')); relCommit(r, 'complemento', `Relação cadastrada: ${solNomeRel(d.para)} — ${d.processo}`); toast('Relação cadastrada e validada por você.'); render();
}
/* sugestões automáticas (IA, radar): SEMPRE pendentes; duplicidades ignoradas */
function relSugerir(solId, itens, origem = 'ia') {
  const r = S.solutions.find(x => x.id === solId); if (!r) return 0; let n = 0;
  (itens || []).forEach(d => { if (relErros(r, { ...d, just: d.just || 'Sugestão automática — sem validação' }).length) return; (r.complementos ||= []).push(relMk({ ...d, just: d.just || 'Sugestão automática (' + origem + ') — revisar antes de usar.' }, 'pendente', origem)); n++; });
  if (n) relCommit(r, 'complemento sugerido', `${n} relação(ões) sugerida(s) por ${origem}, pendente(s) de revisão.`); return n;
}
function relSet(solId, id, st) {
  const r = S.solutions.find(x => x.id === solId), x = r && relsOf(r).find(y => y.id === id); if (!x || !REL_ST[st]) return;
  x.status = st; x.revisadoPor = (typeof ME !== 'undefined' && ME.id) || ''; x.revisadoEm = nowISO(); relCommit(r, 'complemento ' + st, `${solNomeRel(x.para)} — ${x.processo}`); render();
}
function relDel(solId, id) { const r = S.solutions.find(x => x.id === solId); if (!r) return; const x = relsOf(r).find(y => y.id === id); if (!x) return; r.complementos = relsOf(r).filter(y => y.id !== id); relCommit(r, 'complemento removido', `${solNomeRel(x.para)} — ${x.processo}`); render(); }
const solNomeRel = id => S.solutions.find(s => s.id === id)?.nome || id;
const REL_ACT = {
  relAdd: t => relAdd(t.dataset.id, { para: $('#rl-p').value, processo: $('#rl-pr').value, condicoes: $('#rl-c').value, dependencias: $('#rl-d').value, fonteT: $('#rl-ft').value, fonteU: $('#rl-fu').value, just: $('#rl-j').value }),
  relOk: t => relSet(t.dataset.id, t.dataset.rl, 'validada'), relNo: t => relSet(t.dataset.id, t.dataset.rl, 'rejeitada'), relDel: t => relDel(t.dataset.id, t.dataset.rl)
};
/* seção no detalhe da solução */
function relSection(r) {
  const L = relsOf(r), inv = S.solutions.filter(s => !s.arquivado && relsOf(s).some(x => x.para === r.id && x.status === 'validada')), er = UI.relErr?.id === r.id ? UI.relErr.e : [];
  const row = x => { const [l, k] = REL_ST[x.status] || ['?', 'off'];
    return `<tr><td><b>${esc(solNomeRel(x.para))}</b></td><td>${esc(x.processo)}</td><td>${esc(x.condicoes || '—')}</td><td>${esc(x.dependencias || '—')}</td><td>${x.fonte?.u ? `<a href="${esc(safeUrl(x.fonte.u))}" target="_blank" rel="noopener noreferrer">${esc(x.fonte.t)}</a>` : esc(x.fonte?.t || '')}${x.just ? `<div class="sm muted">${esc(x.just)}</div>` : ''}</td>
    <td>${pill(l, k)}<div class="sm muted">${esc(x.origem)} • ${esc(dtBR(x.em))}</div></td><td>${x.status !== 'validada' ? `<button class="btn sm" data-a="relOk" data-id="${r.id}" data-rl="${x.id}">Validar</button> ` : ''}${x.status !== 'rejeitada' ? `<button class="btn ghost sm" data-a="relNo" data-id="${r.id}" data-rl="${x.id}">Rejeitar</button> ` : ''}<button class="btn ghost sm" data-a="relDel" data-id="${r.id}" data-rl="${x.id}">Remover</button></td></tr>`; };
  const op = S.solutions.filter(s => !s.arquivado && s.id !== r.id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return `<div class="card" style="margin-top:10px"><h4>Complementos desta solução ${chip('NECESSITA VALIDAÇÃO')}</h4>
    <p class="sm muted">Relação núcleo → complemento. Não é regra automática (ex.: ter Financeiro não implica precisar de Techfin) e uma relação comercial não prova integração técnica. Só relações <b>validadas</b> geram indicação de complemento nos clientes; sugestões automáticas ficam pendentes.</p>
    ${inv.length ? `<p class="sm">Também é complemento de: ${inv.map(s => esc(s.nome)).join(', ')}.</p>` : ''}
    ${L.length ? `<div class="tw"><table class="sm"><thead><tr><th>Complemento</th><th>Processo atendido</th><th>Condições de aderência</th><th>Dependências</th><th>Fonte / justificativa</th><th>Validação</th><th></th></tr></thead><tbody>${L.map(row).join('')}</tbody></table></div>` : '<p class="sm muted">Nenhuma relação cadastrada. O catálogo não presume relações: cadastre apenas as que você consegue justificar.</p>'}
    <details><summary class="sm">Cadastrar relação</summary>
    ${er.length ? `<div class="alert b sm"><ul style="margin:0">${er.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <div class="grid g2"><label class="sm">Complemento *<select id="rl-p" style="width:100%"><option value="">—</option>${op.map(s => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join('')}</select></label>
    <label class="sm">Processo atendido *<input id="rl-pr" type="text" style="width:100%"></label>
    <label class="sm">Condições de aderência<input id="rl-c" type="text" style="width:100%" placeholder="quando faz sentido (ex.: opera filiais com cobrança própria)"></label>
    <label class="sm">Dependências<input id="rl-d" type="text" style="width:100%" placeholder="técnicas, de release ou de contrato"></label>
    <label class="sm">Título da fonte<input id="rl-ft" type="text" style="width:100%"></label><label class="sm">URL da fonte<input id="rl-fu" type="text" style="width:100%" placeholder="https://"></label></div>
    <label class="sm">Justificativa (obrigatória se não houver URL)<textarea id="rl-j" rows="2" style="width:100%"></textarea></label>
    <button class="btn pri sm" data-a="relAdd" data-id="${r.id}">Cadastrar relação (validada por você)</button></details></div>`;
}
/* indicação: cliente com o núcleo DOCUMENTADO em ficha e sem o complemento identificado, para relações VALIDADAS */
function relOpps(c) {
  if (!fichasOk(c).length) return [];
  const fat = cmpProd(c).fat, out = [], covered = new Set((c.opps || []).flatMap(o => (o.sols || []).map(s => s.id)));
  activeSols().forEach(orig => {
    if (!fat.has(orig.id)) return;
    relsOf(orig).filter(x => x.status === 'validada').forEach(x => {
      const comp = S.solutions.find(s => s.id === x.para && !s.arquivado); if (!comp || fat.has(comp.id) || (c.productsIdent || []).some(p => p.id === comp.id) || covered.has(comp.id)) return;
      const l = solLegacy(comp), lo = solLegacy(orig);
      out.push(mkOpp(c, { ruleId: `rel_${orig.id}_${comp.id}`, tipo: 'Cross-sell', tipoBase: 'Cross-sell', nome: `Complemento de solução: ${comp.nome} (a partir de ${orig.nome})`, modo: 'investigacao',
        problema: `INVESTIGAÇÃO RECOMENDADA: o catálogo registra “${comp.nome}” como complemento de “${orig.nome}” para o processo “${x.processo}”. O cliente tem “${orig.nome}” documentado no faturamento e não tem o complemento identificado. A relação não prova necessidade nem integração técnica.`,
        impacto: 'HIPÓTESE: sem estimativa de receita; o complemento só orienta a conversa.', evInd: [{ cls: 'FATO', text: `“${orig.nome}” identificado em ficha de faturamento; relação curada no catálogo (${REL_ST.validada[0].toLowerCase()}, ${dtBR(x.em)}): ${x.processo}`, src: 'Ficha de faturamento + catálogo' }],
        sols: [l], extraBase: [comp.id], natureza: ['COMPLEMENTO DE SOLUÇÃO'], deps: [x.dependencias, ...(comp.prerequisitos || []).map(p => p.t)].filter(Boolean).slice(0, 4), origemTipo: ['Complemento de solução'], origens: ['catálogo (complementos)'],
        relInfo: { orig: orig.nome, comp: comp.nome, processo: x.processo, condicoes: x.condicoes, dependencias: x.dependencias, fonte: x.fonte, just: x.just, em: x.em },
        perg: [`O processo “${x.processo}” existe no cliente e hoje é atendido como?`, ...(x.condicoes ? [`Condição de aderência: ${x.condicoes} — isso se confirma no cliente?`] : []), `Há dependência técnica a verificar (${x.dependencias || 'release, integração, contrato'})?`],
        acao: 'Validar o processo e as condições com o cliente e confirmar dependências técnicas antes de qualquer proposta.' },
        { evidencia: 1, aderencia: l.integraProtheus === true ? 3 : 2, impacto: 1, urgencia: 0, viabilidade: l.integraProtheus === true ? 3 : 2, dados: dataQuality(c) }));
    });
  });
  return out.slice(0, 4);
}
const relHtml = o => o.relInfo ? `<dt>Relação de complemento</dt><dd class="sm"><b>${esc(o.relInfo.orig)}</b> → <b>${esc(o.relInfo.comp)}</b> — processo: ${esc(o.relInfo.processo)}<br>Condições: ${esc(o.relInfo.condicoes || '—')} • Dependências: ${esc(o.relInfo.dependencias || '—')}<br>Fonte: ${o.relInfo.fonte?.u ? `<a href="${esc(safeUrl(o.relInfo.fonte.u))}" target="_blank" rel="noopener noreferrer">${esc(o.relInfo.fonte.t)}</a>` : esc(o.relInfo.fonte?.t || o.relInfo.just || '—')}<div class="muted">Relação validada pelo executivo; não comprova integração técnica.</div></dd>` : '';
