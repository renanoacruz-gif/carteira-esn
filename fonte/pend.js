/* ===== Central de Pendências, acompanhamento de recomendações e preparação de abordagem ===== */
UI.pd = { tipo: '', q: '' };
const PD_TIPOS = { doc: 'Documento/ficha ausente', rev: 'Ficha para revisar', conf: 'Conflito a resolver', acao: 'Ação vencida', prox: 'Ação a vencer (7 dias)', seg: 'Segmento a confirmar', ref: 'Referência a revisar', inbox: 'Documento sem cliente', acomp: 'Recomendação sem acompanhamento' };
const PD_DIAS_ACOMP = 30;
const PD_ACAO = { doc: 'Importar a ficha (Carteira → Importar) ou associar pelo código/CNPJ.', rev: 'Abrir o cliente e confirmar ou corrigir a leitura.', conf: 'Abrir o cliente e definir qual fonte vale.', acao: 'Atualizar a situação ou o prazo da ação.', prox: 'Acompanhar a ação antes do prazo.', seg: 'Confirmar ou definir o segmento do cliente.', ref: 'Aprovar ou rejeitar em Releases e regulatório.', inbox: 'Associar o documento a um cliente.', acomp: 'Registrar o próximo passo ou encerrar a recomendação.' };
const dias = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
function pendItems() {
  const out = [], hoje = today(), em7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const seen = new Set(), add = (tipo, c, titulo, detalhe, extra = {}) => { const id = `${tipo}|${c?.key || ''}|${titulo}|${detalhe}`; if (seen.has(id)) return; seen.add(id); out.push({ tipo, key: c?.key || null, cliente: c?.name || '—', titulo, detalhe, acao: PD_ACAO[tipo] || '', ...extra }); };
  const todos = clients(), semFicha = todos.filter(c => c.doc?.k === 'nao_anexada' || c.fstat?.k === 'nao_carregada'), agrupaFicha = semFicha.length >= 3 && semFicha.length >= todos.length * 0.5;
  if (agrupaFicha) add('doc', null, `Fichas de faturamento não carregadas em ${semFicha.length} de ${todos.length} cliente(s)`, `Provável causa comum: o lote de fichas ainda não foi importado. Clientes: ${semFicha.slice(0, 12).map(c => c.name).join('; ')}${semFicha.length > 12 ? '…' : ''}.`, { nav: 'importar', grupo: semFicha.length });
  clients().forEach(c => {
    const fk = c.fstat?.k;
    if (!agrupaFicha && (c.doc?.k === 'nao_anexada' || fk === 'nao_carregada')) add('doc', c, 'Ficha de faturamento não carregada', 'Sem ficha, a contratação não pode ser conferida e o MRR depende só da planilha.');
    if (fk === 'desatualizada') add('doc', c, 'Ficha desatualizada', (c.fstat.why || []).join(' ') || 'Competência da ficha anterior à de referência.');
    if (['erro', 'revisao'].includes(fk)) add('rev', c, FSTAT[fk], (c.fstat.why || []).slice(0, 3).join(' • '));
    if (c.doc?.k === 'sugerida') add('rev', c, 'Associação de ficha apenas sugerida', 'Confirmar ou rejeitar o vínculo.');
    (c.conflicts || []).forEach(x => add('conf', c, 'Divergência planilha × ficha', x.text));
    (c.cadConf || []).filter(x => !x.res).forEach(x => add('conf', c, `Conflito de cadastro: ${x.campo}`, `${x.de} → ${x.para} (${x.fonte})`));
    if (mrrOf(c).div) add('conf', c, 'MRR divergente entre ficha e planilha', 'Definir a fonte do MRR na competência.');
    if (['inferido', 'ausente', 'nao_mapeado'].includes(c.segInfo?.mode)) add('seg', c, 'Segmento não confirmado', c.segInfo.ev || '');
    c.opps.filter(o => oppAtiva(c, o)).forEach(o => {
      const d = decGet(c, o.ruleId);
      if (d.prazo && !['contratada', 'encerrada'].includes(d.sit)) { if (d.prazo < hoje) add('acao', c, `Prazo vencido: ${o.tipo}`, `${o.titulo || o.acao} • prazo ${fmtD(d.prazo)}${d.resp ? ' • resp. ' + d.resp : ''}`, { prazo: d.prazo }); else if (d.prazo <= em7) add('prox', c, `Prazo próximo: ${o.tipo}`, `${o.titulo || o.acao} • prazo ${fmtD(d.prazo)}`, { prazo: d.prazo }); }
      if (d.valid === 'validada' && d.sit === 'nao_iniciada' && dias(d.at || nowISO()) >= PD_DIAS_ACOMP) add('acomp', c, 'Validada sem avanço comercial', `${o.titulo || o.acao} • validada há ${dias(d.at)} dia(s), situação ainda "Não iniciada".`);
      else if (['descoberta', 'reuniao', 'negociacao'].includes(d.sit) && d.at && dias(d.at) >= PD_DIAS_ACOMP) add('acomp', c, `Parada em "${SIT_L[d.sit]}"`, `${o.titulo || o.acao} • sem registro há ${dias(d.at)} dia(s).`);
    });
    Object.entries(c.act || {}).filter(([k, a]) => !k.startsWith('opp:') && a.prazo && !['Concluído', 'Descartado'].includes(a.status)).forEach(([k, a]) => { if (a.prazo < hoje) add('acao', c, 'Prazo vencido: tarefa do plano', `${k.startsWith('ins:') ? 'Ação de mercado' : (a.texto || 'Tarefa')} • prazo ${fmtD(a.prazo)}${a.resp ? ' • resp. ' + a.resp : ''}`, { prazo: a.prazo }); else if (a.prazo <= em7) add('prox', c, 'Prazo próximo: tarefa do plano', `${a.texto ? a.texto + ' • ' : ''}prazo ${fmtD(a.prazo)}`, { prazo: a.prazo }); });
  });
  S.inbox.forEach(it => add('inbox', null, `${it.file}${it.loc ? ' • ' + it.loc : ''}`, it.note || 'Associar a um cliente.', { inbox: true }));
  const rp = refPending().length; if (rp) add('ref', null, `${rp} item(ns) de release/regulatório aguardando revisão`, 'Confirmar ou rejeitar antes de entrarem no diagnóstico.', { nav: 'refs' });
  return out;
}
function vPend() {
  const p = UI.pd, all = pendItems(), q = norm(p.q), rows = all.filter(r => (!p.tipo || r.tipo === p.tipo) && (!q || norm(r.cliente + r.titulo + r.detalhe).includes(q)));
  const cnt = Object.fromEntries(Object.keys(PD_TIPOS).map(k => [k, all.filter(r => r.tipo === k).length]));
  const funil = Object.keys(SIT_L).map(k => [k, clients().reduce((n, c) => n + c.opps.filter(o => oppAtiva(c, o) || decGet(c, o.ruleId).sit === 'encerrada').filter(o => decGet(c, o.ruleId).sit === k).length, 0)]);
  let h = `<div class="card"><h3>Central de Pendências</h3><p class="sm">Tudo que depende de você, em um lugar: documentos ausentes, conflitos, ações vencidas e recomendações sem andamento. Derivado dos dados atuais — resolver na origem remove o item.</p>
  <div class="row">${Object.entries(PD_TIPOS).map(([k, l]) => `<button class="btn sm ${p.tipo === k ? 'pri' : 'ghost'}" data-a="pdTipo" data-t="${k}">${esc(l)} <b>${cnt[k]}</b></button>`).join('')}</div>
  <div class="row"><input type="text" data-i="pdq" value="${esc(p.q)}" placeholder="Buscar cliente ou pendência…" style="min-width:240px"><button class="btn ghost sm" data-a="pdTipo" data-t="">Limpar filtro</button></div></div>
  <div class="card"><h3>Acompanhamento das recomendações</h3><p class="sm muted">Oportunidades ativas por situação comercial (descartadas ficam fora). Sem estimativa de valor ou probabilidade.</p><div class="row">${funil.map(([k, n]) => `<span class="pill p-${k === 'contratada' ? 'ok' : k === 'encerrada' ? 'off' : 'info'}">${esc(SIT_L[k])}: ${n}</span>`).join(' ')}</div><p class="sm muted">Alerta de "sem acompanhamento": validada e não iniciada, ou parada em descoberta/reunião/negociação, há ${PD_DIAS_ACOMP}+ dias. Alertas existem somente dentro do app.</p></div>
  <div class="muted sm" style="margin-bottom:6px">${rows.length} de ${all.length} pendência(s)</div>`;
  h += rows.length ? `<div class="tw"><table><thead><tr><th>Tipo</th><th>Cliente</th><th>Pendência</th><th>Motivo / evidência</th><th>Como resolver</th><th></th></tr></thead><tbody>${rows.slice(0, 500).map(r => `<tr><td>${pill(PD_TIPOS[r.tipo], r.tipo === 'acao' ? 'bad' : r.tipo === 'prox' || r.tipo === 'acomp' ? 'warn' : 'info')}</td><td>${r.key ? `<a href="#" data-a="open" data-k="${esc(r.key)}">${esc(r.cliente)}</a>` : esc(r.cliente)}</td><td class="sm">${esc(r.titulo)}</td><td class="sm" style="max-width:420px">${esc(String(r.detalhe).slice(0, 300))}</td><td class="sm muted" style="max-width:240px">${esc(r.acao || '')}</td><td>${r.key ? `<button class="btn ghost sm" data-a="open" data-k="${esc(r.key)}">Abrir</button>` : r.nav ? `<button class="btn ghost sm" data-a="nav" data-v="${r.nav}">Abrir</button>` : r.inbox ? '<button class="btn ghost sm" data-a="nav" data-v="importar">Associar</button>' : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="card"><p class="sm muted">${all.length ? 'Nada com este filtro.' : clients().length ? 'Nenhuma pendência identificada nos dados atuais.' : 'Sem dados importados.'}</p></div>`;
  return h;
}
const PEND_ACT = { pdTipo: t => { UI.pd.tipo = t.dataset.t || ''; render(); } };
/* Preparação de abordagem (no cliente): histórico, contexto de mercado, perguntas e pendências. Só reúne o que já existe. */
function abordBlock(c) {
  const hist = Object.values(c.act || {}).flatMap(a => (a.hist || []).map(h => ({ at: h.at, t: (h.mudancas || []).join('; '), n: h.nota }))).sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 4);
  const ativas = c.opps.filter(o => oppAtiva(c, o)), perg = [...new Set(ativas.slice(0, 5).flatMap(o => o.perg || []))].slice(0, 6);
  const salvos = new Set((c.insRef || []).map(r => r.id)), rel = S.insights.filter(i => !salvos.has(i.id) && mkRelated(i).some(x => x.key === c.key)).slice(0, 3);
  const pend = pendItems().filter(r => r.key === c.key).slice(0, 4);
  if (!hist.length && !perg.length && !rel.length && !pend.length && !c.lastChange) return '';
  return `<div class="card"><h3>Preparação de abordagem</h3><p class="sm muted">Reúne o que já está registrado; nada aqui é evidência nova. Validar necessidade e contratação com o cliente.</p>
  <dl class="sm"><dt>Histórico recente</dt><dd>${hist.length ? '<ul>' + hist.map(h => `<li>${esc(dtBR(h.at))} — ${esc(h.t)}${h.n ? ' • ' + esc(h.n) : ''}</li>`).join('') + '</ul>' : '<span class="muted">sem decisões registradas</span>'}${c.lastChange ? `<div class="muted">Última mudança na carteira: ${esc(c.lastChange.at ? dtBR(c.lastChange.at) : '')} ${esc(c.lastChange.txt || c.lastChange.t || '')}</div>` : ''}</dd>
  <dt>Contexto de mercado do recorte</dt><dd>${rel.length ? '<ul>' + rel.map(i => `<li>${esc(i.titulo)} ${pill(i.classe === 'contexto' ? 'contexto' : 'hipótese', i.classe === 'contexto' ? 'ok' : 'warn')} <span class="muted">${esc(fmtD(i.datas?.evento || i.datas?.publicacao))}</span></li>`).join('') + '</ul>' : '<span class="muted">nenhum insight não salvo para segmento/UF deste cliente (veja Inteligência Comercial)</span>'}</dd>
  <dt>Perguntas de descoberta</dt><dd>${perg.length ? '<ul>' + perg.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<span class="muted">sem oportunidades ativas</span>'}</dd>
  <dt>Pendências do cliente</dt><dd>${pend.length ? '<ul>' + pend.map(r => `<li>${esc(r.titulo)}</li>`).join('') + '</ul>' : '<span class="muted">nenhuma</span>'}</dd></dl></div>`;
}
