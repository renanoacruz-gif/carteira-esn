/* ===== MOTOR DE ADERÊNCIA CLIENTE × SOLUÇÃO (sobre o Catálogo Enxoval) =====
   Três indicadores independentes, todos rastreáveis:
   - Aderência (0–100): média ponderada das dimensões QUE TÊM INFORMAÇÃO. Dimensão sem dado não vale zero: fica fora da conta.
   - Cobertura (0–100%): soma dos pesos das dimensões com informação. Diz quanto do cenário é conhecido.
   - Confiança (alta/média/baixa): qualidade da fonte do produto (ficha técnica?) e presença de evidência dita por você.
   Regras duras: linha de ERP diferente da do cliente é BLOQUEIO (nenhuma nota compensa); o motor nunca chega a "aderência confirmada"
   sozinho — só você confirma, depois de validar necessidade e compatibilidade; aderência não é probabilidade de fechamento. */
const AD_DIM = [['processos', 'Aderência aos processos'], ['dor', 'Necessidade ou dor comprovada'], ['tecnologica', 'Aderência tecnológica'], ['setorial', 'Aderência setorial'], ['estrategico', 'Potencial estratégico'], ['viabilidade', 'Viabilidade comercial']];
const AD_PESOS_PADRAO = { processos: 25, dor: 20, tecnologica: 20, setorial: 15, estrategico: 10, viabilidade: 10 };
const AD_CLS = { confirmada: ['Aderência confirmada', 'ok'], alta: ['Alta aderência potencial', 'ok'], condicional: ['Aderência condicional', 'warn'], investigar: ['Investigar', 'info'], baixa: ['Baixa aderência', 'off'], nao_rec: ['Não recomendada', 'bad'], insuf: ['Dados insuficientes', 'off'], possui: ['Já possui', 'info'] };
const AD_ORD = ['confirmada', 'alta', 'condicional', 'investigar', 'baixa', 'insuf', 'possui', 'nao_rec'], AD_REC = ['confirmada', 'alta', 'condicional', 'investigar'];
const AD_CONF = { alta: ['alta', 'ok'], media: ['média', 'info'], baixa: ['baixa', 'warn'] };
const AD_STOP = new Set('totvs linha gestao sistema sistemas solucao solucoes cliente clientes empresa empresas sobre para como mais pelo pela entre processo processos controle dados novo nova melhor maior todos todas area areas modulo modulos protheus datasul winthor logix oportunidade necessidade integracao integrado atraves'.split(' '));
const adPesos = () => { const p = ENX.pesos; return p && AD_DIM.every(([k]) => Number.isInteger(p[k])) && AD_DIM.reduce((a, [k]) => a + p[k], 0) === 100 ? p : AD_PESOS_PADRAO; };
const AD_SIGLA = new Set('wms mes aps tms oms yms crm pdv pos pms edi tef esg lgpd rh bi ged ecm bpm sst cte nfe mrp plm dms ipaas api okr'.split(' ')); /* siglas curtas contam, mas só como palavra inteira */
const adTok = t => new Set(norm(t || '').split(/[^a-z0-9]+/).filter(w => (w.length >= 5 && !AD_STOP.has(w)) || AD_SIGLA.has(w)));
function adHay(p) { const H = ENX.hay ||= new Map(); let h = H.get(p.id); if (!h) { const l = t => ' ' + norm(t).replace(/[^a-z0-9]+/g, ' ') + ' '; h = { nome: normName(p.nome), tit: l(`${p.nome} ${p.grupo || ''}`), txt: l(`${p.nome} ${p.grupo || ''} ${p.kw || ''}`) }; H.set(p.id, h); } return h; }
const adHits = (toks, h, campo = 'txt') => [...toks].filter(w => h[campo].includes(AD_SIGLA.has(w) ? ' ' + w + ' ' : ' ' + w)); /* a palavra precisa começar igual; "manutencao" casa "manutencoes" */
function adCtx(c) {
  const dores = (c.dorHip || []).map(h => ({ rot: 'Hipótese sua', frase: String(h.frase || ''), sol: S.solutions.find(r => r.id === h.solId)?.nome || '' })); if (c.gst?.oportunidade) dores.push({ rot: 'Oportunidade que você anotou', frase: String(c.gst.oportunidade), sol: '' });
  dores.forEach(x => { x.tok = adTok(x.frase + ' ' + x.sol); x.solN = x.sol ? normName(x.sol) : ''; });
  const opps = (c.opps || []).map(o => ({ titulo: String(o.title || o.titulo || o.nome || o.need || 'oportunidade do motor').slice(0, 90), tok: adTok(`${o.nome || o.title || o.titulo || ''} ${(o.sols || []).map(s => s.nome || s.name || '').join(' ')}`) })).filter(o => o.tok.size); /* só o nome da oportunidade e das soluções ligadas: o texto longo casaria com qualquer produto */
  const fatos = (c.fatos || []).map(f => ({ titulo: String(f.titulo || '').slice(0, 90), tok: adTok(f.titulo) })).filter(f => f.tok.size);
  const tem = (c.productsIdent || []).filter(p => p.nivel !== 'texto' || p.conf).map(p => normName(p.nome || '')).filter(n => n.length >= 6);
  return { c, segId: c.segInfo?.id || '', segNome: c.segInfo?.id && typeof segName === 'function' ? segName(c.segInfo.id) : '', linhas: baseLines(c), dores, opps, fatos, tem, vinc: c.enxVinc || {}, P: adPesos() };
}
function adCalc(X, p) {
  const c = X.c, h = adHay(p), D = {}, set = (k, nota, motivo) => { D[k] = { nota, motivo }; }, segs = enxSegs(p.seg), kbSegs = segs.map(k => (ENX_SEG[k] || [])[1]).filter(Boolean);
  /* setorial */
  if (!X.segId) set('setorial', null, 'Segmento do cliente ainda não classificado.'); else if (segs[0] === '*') set('setorial', 60, 'Produto listado no Enxoval para todos os segmentos (aderência setorial genérica).'); else if (kbSegs.includes(X.segId)) set('setorial', 100, `Produto listado no Enxoval para o segmento do cliente (${X.segNome || X.segId}).`); else set('setorial', 0, `Produto listado para outros segmentos: ${segs.map(enxSegNome).join(', ')}.`);
  /* tecnológica — bloqueio quando a linha do produto não é a do cliente */
  const lp = PT_LINHAS.find(l => norm(p.linha || '') === l.toLowerCase()) || ''; let bloqueio = '';
  if (lp && !X.linhas.length) set('tecnologica', null, `Produto da linha ${lp}; a linha de ERP do cliente não foi identificada.`); else if (lp && X.linhas.includes(lp)) set('tecnologica', 100, `Mesma linha de ERP do cliente (${lp}).`); else if (lp) { bloqueio = `Produto da linha ${lp}; o cliente tem ${X.linhas.join(', ')}.`; set('tecnologica', 0, bloqueio); }
  else set('tecnologica', null, `A fonte pública não documenta requisitos nem compatibilidade${X.linhas.length ? ' com ' + X.linhas.join(', ') : ''}${p.tp && p.tp[5] === '1' ? ' de forma estruturada (a ficha tem seção de requisitos: leia)' : ''}. Confirmar antes de afirmar.`);
  /* dor comprovada — só o que você registrou */
  if (!X.dores.length) set('dor', null, 'Nenhuma dor, hipótese ou oportunidade registrada por você para este cliente.');
  else { let best = null; for (const d of X.dores) { const igual = d.solN && (d.solN === h.nome || (d.solN.length >= 8 && (h.nome.includes(d.solN) || d.solN.includes(h.nome)))), hs = adHits(d.tok, h), n = igual ? 99 : hs.length; if (!best || n > best.n) best = { n, d, hs, igual }; }
    if (best.igual) set('dor', 100, `${best.d.rot}: “${best.d.frase.slice(0, 90)}”, ligada a esta solução na sua Base.`); else if (best.n >= 2) set('dor', 100, `${best.d.rot}: “${best.d.frase.slice(0, 90)}” (termos em comum: ${best.hs.slice(0, 4).join(', ')}).`); else if (best.n === 1) set('dor', 60, `${best.d.rot}: “${best.d.frase.slice(0, 90)}” — relação por um único termo (${best.hs[0]}); confirmar.`); else set('dor', 0, 'As dores e oportunidades que você registrou não têm relação identificada com este produto.'); }
  /* processos — oportunidades do motor do cliente × o que a fonte documenta do produto */
  if (!X.opps.length) set('processos', null, 'O motor não tem oportunidades calculadas para este cliente (faltam fichas ou dados).');
  else if (p.nivel !== 'ficha' && !(p.kw || '').trim()) set('processos', null, 'Produto sem ficha técnica pública lida: processos atendidos não confirmados.');
  else { let best = null; for (const o of X.opps) { const ht = adHits(o.tok, h, 'tit'), hs = adHits(o.tok, h), nota = ht.length >= 2 ? 100 : ht.length === 1 ? 70 : hs.length >= 2 ? 60 : hs.length === 1 ? 40 : 10; if (!best || nota > best.nota) best = { o, ht, hs, nota }; }
    set('processos', best.nota, best.ht.length ? `Oportunidade do cliente “${best.o.titulo}” coincide com o nome ou a família do produto (${best.ht.slice(0, 4).join(', ')}).` : best.hs.length ? `Oportunidade do cliente “${best.o.titulo}” coincide com funcionalidades documentadas do produto (${best.hs.slice(0, 4).join(', ')}).` : 'Nenhuma oportunidade calculada para o cliente tem relação identificada com este produto.'); }
  /* estratégico — só fatos registrados sobre o cliente */
  if (!X.fatos.length) set('estrategico', null, 'Nenhum fato registrado sobre o cliente (expansão, mudanças, projetos).'); else { const f = X.fatos.map(x => ({ x, hs: adHits(x.tok, h) })).sort((a, b) => b.hs.length - a.hs.length)[0]; if (f.hs.length) set('estrategico', 80, `Fato registrado: “${f.x.titulo}” (termo em comum: ${f.hs[0]}).`); else set('estrategico', null, 'Os fatos registrados não têm relação identificada com este produto.'); }
  /* viabilidade */
  if (c.emp?.ausente) set('viabilidade', 0, 'Cliente ausente da última base da carteira.'); else if (c.emp && (c.emp.mrrP || 0) > 0) set('viabilidade', 100, 'Cliente ativo na carteira, com receita recorrente.'); else if (c.emp) set('viabilidade', 50, 'Cliente na carteira, sem receita recorrente registrada.'); else set('viabilidade', null, 'Sem dados da carteira para avaliar.');
  let sw = 0, sn = 0; for (const [k] of AD_DIM) if (D[k].nota != null) { sw += X.P[k]; sn += X.P[k] * D[k].nota; }
  const ad = sw ? Math.round(sn / sw) : null, cob = sw, conf = p.nivel === 'ficha' && cob >= 70 && D.dor.nota != null ? 'alta' : (p.nivel === 'ficha' || p.nivel === 'portal') && cob >= 40 ? 'media' : 'baixa';
  const v = X.vinc[p.id] || null, possui = X.tem.some(n => n === h.nome || (h.nome.length >= 8 && (n.includes(h.nome) || h.nome.includes(n))));
  const evid = (D.processos.nota ?? 0) >= 60 || (D.dor.nota ?? 0) >= 60; let cls, porque;
  if (possui) { cls = 'possui'; porque = 'O cliente já tem um produto com este nome nos itens identificados. Avalie ampliação de uso, não nova contratação.'; }
  else if (v?.st === 'descartada') { cls = 'nao_rec'; porque = `Você descartou esta solução para o cliente em ${fmtD(String(v.em || '').slice(0, 10))}.`; }
  else if (bloqueio) { cls = 'nao_rec'; porque = 'Bloqueio técnico: ' + bloqueio; }
  else if (v?.st === 'validada') { cls = 'confirmada'; porque = `Você confirmou necessidade e compatibilidade em ${fmtD(String(v.em || '').slice(0, 10))}.`; }
  else if (ad == null || cob < 30) { cls = 'insuf'; porque = `Só ${cob}% dos critérios têm informação. Complete o perfil do cliente antes de concluir.`; }
  else if (D.setorial.nota === 0 && (D.dor.nota ?? 0) < 60) { cls = 'baixa'; porque = `Produto listado para outros segmentos (${segs.map(enxSegNome).join(', ')}) e sem dor registrada por você que o justifique neste cliente.`; } /* produto de outro segmento só sobe com dor dita pelo executivo */
  else if (!evid && ad >= 40) { cls = 'investigar'; porque = 'Só o segmento ou a linha coincidem: não há processo nem dor registrada que sustente recomendar. Use as perguntas de descoberta.'; } /* segmento sozinho nunca vira recomendação forte */
  else if (ad >= 70 && cob >= 50 && D.tecnologica.nota != null) { cls = 'alta'; porque = 'Forte indício de aderência; necessidades ainda exigem descoberta com o cliente.'; }
  else if (ad >= 55 && D.tecnologica.nota == null) { cls = 'condicional'; porque = 'Pode ser adequada, desde que requisitos e compatibilidade sejam confirmados.'; }
  else if (ad >= 40) { cls = 'investigar'; porque = 'Há sinais que justificam investigar, mas a informação não sustenta uma recomendação.'; }
  else { cls = 'baixa'; porque = 'Os dados disponíveis indicam pouca relação com o cenário conhecido do cliente.'; }
  return { p, cls, porque, ad, cob, conf, bloqueio, vinc: v, forca: Math.max(D.dor.nota ?? 0, D.processos.nota ?? 0), dims: AD_DIM.map(([k, rot]) => ({ k, rot, peso: X.P[k], ...D[k] })) };
}
function adCliente(c) { if (!ENX.idx || !ENX.meta) return null; const X = adCtx(c); return ENX.idx.filter(p => p.nivel !== 'inativo').map(p => adCalc(X, p)); }
const adRank = (a, b) => AD_ORD.indexOf(a.cls) - AD_ORD.indexOf(b.cls) || b.forca - a.forca || ((b.ad ?? -1) * (b.cob || 0)) - ((a.ad ?? -1) * (a.cob || 0)) || a.p.nome.localeCompare(b.p.nome, 'pt');
/* perguntas de descoberta: sobre o processo, sem pressupor que existe dor */
function adPerguntas(x) {
  const tema = norm(x.p.grupo || '').length > 3 && !/^totvs/i.test(x.p.grupo) ? x.p.grupo.toLowerCase() : x.p.nome.replace(/^TOTVS\s+/i, '').replace(/\s*-\s*Linha.*$/i, ''), Q = [`Como vocês executam hoje o processo ligado a ${tema}? Quais sistemas ou planilhas participam?`, 'Há etapas manuais ou retrabalho nesse processo?', 'Quais indicadores vocês acompanham sobre isso, e de onde vêm os números?'];
  if (x.dims.find(d => d.k === 'tecnologica').nota == null) Q.push('Qual é a linha e a versão do ERP em uso, e que integrações já existem? (compatibilidade ainda não confirmada)');
  if (x.dims.find(d => d.k === 'estrategico').nota == null) Q.push('Há mudança, expansão ou troca de sistema prevista para essa área nos próximos 12 meses?');
  return Q;
}
const adUI = () => UI.ad ||= { q: '', cls: '', mais: 0 };
const adKpi = x => `<div class="ad-kpi sm"><span>Aderência <b>${x.ad == null ? '—' : x.ad + '/100'}</b></span><span>Cobertura <b>${x.cob}%</b></span><span>Confiança ${pill(AD_CONF[x.conf][0], AD_CONF[x.conf][1])}</span></div>`;
const adDims = x => `<details class="pt-ex"><summary class="sm">Ver critérios, evidências e perguntas</summary><ul class="ad-dim sm">${x.dims.map(d => `<li><b>${esc(d.rot)}</b> (peso ${d.peso}): ${d.nota == null ? '<span class="pill p-off">sem informação</span>' : `<b>${d.nota}/100</b>`} <span class="muted">— ${esc(d.motivo)}</span></li>`).join('')}</ul><div class="sm" style="margin-top:6px"><b>Perguntas de descoberta</b><ol style="margin:4px 0 0 18px">${adPerguntas(x).map(q => `<li>${esc(q)}</li>`).join('')}</ol></div><div class="sm muted" style="margin-top:6px">Aderência não é probabilidade de fechamento. Fonte do produto: Catálogo Enxoval (${esc(ENX_NV[x.p.nivel]?.[0] || x.p.nivel)}), coletado em ${esc(fmtD(ENX.meta?.coletadoEm || ''))}.</div></details>`;
function adAcoes(c, x) {
  const k = esc(c.key), id = esc(x.p.id), b = (a, t, cl = 'ghost') => `<button class="btn sm ${cl}" data-a="${a}" data-k="${k}" data-id="${id}">${t}</button>`, v = x.vinc?.st;
  if (x.cls === 'possui') return b('adFicha', 'Ver ficha');
  if (v === 'descartada') return b('adSoltar', 'Desfazer descarte') + b('adFicha', 'Ver ficha');
  if (v === 'vinculada' || v === 'validada') return (v === 'vinculada' ? b('adValidar', 'Confirmar aderência', 'pri') : '') + b('adSemana', 'Levar para a semana') + b('adFicha', 'Ver ficha') + b('adSoltar', 'Desvincular');
  return (x.bloqueio ? '' : b('adVinc', 'Vincular ao cliente', 'pri')) + b('adFicha', 'Ver ficha') + (x.bloqueio ? '' : b('adDesc', 'Descartar'));
}
const adLinha = (c, x) => `<div class="ad-row" data-ad="${esc(x.p.id)}"><div class="ad-m"><div><b>${esc(x.p.nome)}</b> ${pill(AD_CLS[x.cls][0], AD_CLS[x.cls][1])}${x.vinc?.st === 'vinculada' ? ' ' + pill('vinculada', 'info') : ''}</div>${x.p.grupo ? `<div class="sm muted">${esc(x.p.grupo)}${x.p.linha ? ' · Linha ' + esc(x.p.linha) : ''}</div>` : ''}${adKpi(x)}<div class="sm" style="margin-top:4px">${esc(x.porque)}</div>${adDims(x)}</div><div class="ad-acts">${adAcoes(c, x)}</div></div>`;
/* visão inversa, no fim da ficha do produto no Catálogo Enxoval: quais clientes da carteira são aderentes a ESTA solução */
function adSolucao(id) { const p = (ENX.idx || []).find(x => x.id === id); return p && p.nivel !== 'inativo' ? clients().map(c => ({ c, ...adCalc(adCtx(c), p) })) : null; }
function adClientesCard(id) {
  const all = adSolucao(id); if (!all) return ''; const nc = all.length, U = adUI();
  if (!nc) return '<div class="card" id="ad-cli"><h3>Clientes aderentes a esta solução</h3><p class="sm muted">Sua carteira está vazia. Importe a carteira para ver em quais clientes esta solução se encaixa.</p></div>';
  const n = k => all.filter(x => x.cls === k).length, ader = all.filter(x => AD_REC.includes(x.cls) || (x.vinc && x.vinc.st !== 'descartada')).sort((a, b) => adRank(a, b) || a.c.name.localeCompare(b.c.name, 'pt')), lim = 20 + (U.cmais || 0) * 40;
  const fora = [['possui', 'já possuem'], ['nao_rec', 'não recomendada (bloqueio técnico ou descarte seu)'], ['baixa', 'baixa aderência'], ['insuf', 'dados insuficientes']].filter(([k]) => n(k)).map(([k, t]) => `<b>${n(k)}</b> ${t}`).join(' · ');
  return `<div class="card" id="ad-cli"><h3>Clientes aderentes a esta solução <span class="muted sm">(${ader.length} de ${nc} na sua carteira)</span></h3>
  <p class="sm muted">Mesmo motor da ficha do cliente: usa só o que está registrado de cada conta. Segmento sozinho não entra como aderente forte, e linha de ERP diferente bloqueia.${fora ? ' Fora da lista: ' + fora + '.' : ''}</p>
  ${ader.length ? ader.slice(0, lim).map(x => `<div class="ad-row" data-adc="${esc(x.c.key)}"><div class="ad-m"><div><a href="#" data-a="open" data-k="${esc(x.c.key)}"><b>${esc(x.c.name)}</b></a> ${pill(AD_CLS[x.cls][0], AD_CLS[x.cls][1])}${x.vinc?.st === 'vinculada' ? ' ' + pill('vinculada', 'info') : ''}</div><div class="sm muted">${esc(x.c.segInfo?.id ? (segName(x.c.segInfo.id) || x.c.segInfo.id) : 'segmento não classificado')}${baseLines(x.c).length ? ' · ' + esc(baseLines(x.c).join(', ')) : ''}</div>${adKpi(x)}<div class="sm" style="margin-top:4px">${esc(x.porque)}</div>${adDims(x)}</div><div class="ad-acts">${x.vinc && x.vinc.st !== 'descartada' ? `<button class="btn sm ghost" data-a="adSoltar" data-k="${esc(x.c.key)}" data-id="${esc(id)}">Desvincular</button>` : `<button class="btn sm pri" data-a="adVinc" data-k="${esc(x.c.key)}" data-id="${esc(id)}">Vincular ao cliente</button>`}<button class="btn sm ghost" data-a="open" data-k="${esc(x.c.key)}">Abrir cliente</button></div></div>`).join('') + (ader.length > lim ? `<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-a="adCMais">Mostrar mais (${ader.length - lim} restante(s))</button></div>` : '') : '<p class="sm" style="margin-top:6px">Nenhum cliente da carteira tem indício suficiente para esta solução. Isso não quer dizer que não haja oportunidade: faltam processo ou dor registrada que sustentem a recomendação.</p>'}</div>`;
}
/* cartão que abre a ficha do cliente: vinculadas + as 3 mais aderentes */
function adResumoCard(c) {
  if (!window.__HOSTED__) return ''; enxCarregar(); const all = adCliente(c); if (!all) return ENX.idx && !ENX.meta ? '<div class="card" id="ad-res"><h3>Soluções recomendadas</h3><p class="sm muted">O Catálogo Enxoval ainda não foi importado. Depois da importação, as soluções recomendadas para este cliente aparecem aqui.</p></div>' : '';
  const vinc = all.filter(x => x.vinc && x.vinc.st !== 'descartada').sort(adRank), rec = all.filter(x => AD_REC.includes(x.cls) && !x.vinc).sort(adRank), mini = x => `<div class="ad-row" data-ad="${esc(x.p.id)}"><div class="ad-m"><b>${esc(x.p.nome)}</b> ${pill(AD_CLS[x.cls][0], AD_CLS[x.cls][1])}${adKpi(x)}<div class="sm muted">${esc(x.porque)}</div></div><div class="ad-acts">${x.vinc ? '' : `<button class="btn sm pri" data-a="adVinc" data-k="${esc(c.key)}" data-id="${esc(x.p.id)}">Vincular ao cliente</button>`}</div></div>`;
  return `<div class="card" id="ad-res"><div class="row"><h3>Soluções recomendadas</h3><span class="sp"></span><button class="btn sm ghost" data-a="ctab" data-v="portfolio">Ver todas (${rec.length + vinc.length})</button></div>
  ${vinc.length ? `<div class="sm muted" style="margin-top:4px">Vinculadas por você (${vinc.length})</div>${vinc.slice(0, 5).map(mini).join('')}` : ''}
  ${rec.length ? `<div class="sm muted" style="margin-top:${vinc.length ? 10 : 4}px">Mais aderentes pelo que está registrado</div>${rec.slice(0, 3).map(mini).join('')}` : vinc.length ? '' : '<p class="sm" style="margin-top:6px">Nenhuma solução do catálogo tem indício suficiente para este cliente. Faltam dados: classifique o segmento, anexe fichas ou registre uma dor para o motor ter o que cruzar.</p>'}
  <p class="sm muted" style="margin-top:8px">Recomendação pelo que está registrado, não promessa de aderência: confirme requisitos e necessidade antes de afirmar ao cliente.</p></div>`;
}
/* lista completa, na aba Portfólio do cliente */
function adTab(c) {
  if (!window.__HOSTED__) return ''; enxCarregar(); const all = adCliente(c); if (!all) return ENX.idx && !ENX.meta ? '<div class="card" id="ad-tab"><h3>Soluções recomendadas (Catálogo Enxoval)</h3><p class="sm muted">Catálogo ainda não importado pelo administrador.</p></div>' : '';
  const U = adUI(), n = k => all.filter(x => x.cls === k).length, ws = norm(U.q || '').split(/\s+/).filter(Boolean), vinc = all.filter(x => x.vinc && x.vinc.st !== 'descartada').sort(adRank);
  const base = all.filter(x => (U.cls ? x.cls === U.cls : AD_REC.includes(x.cls)) && (!ws.length || ws.every(w => adHay(x.p).txt.includes(w)))).sort(adRank), lim = 15 + (U.mais || 0) * 30;
  const chip = (k, t, q) => `<button class="btn sm ${U.cls === k ? 'pri' : 'ghost'}" data-a="adCls" data-v="${k}">${esc(t)} (${q})</button>`, P = adPesos();
  return `<div class="card" id="ad-tab"><h3>Soluções recomendadas <span class="muted sm">(Catálogo Enxoval, ${all.length} produto(s) avaliados)</span></h3>
  <p class="sm muted">Cada produto do catálogo avaliado contra o que está registrado de ${esc(c.name)}. <b>Aderência</b> usa só critérios com informação; <b>cobertura</b> mostra quanto do cenário é conhecido; critério sem dado aparece como “sem informação”, não como zero. Pesos: ${AD_DIM.map(([k, r]) => `${esc(r.replace(/^Aderência /, '').replace(/^aos /, ''))} ${P[k]}`).join(' · ')}.</p>
  ${vinc.length ? `<h4 style="margin-top:10px">Vinculadas a este cliente (${vinc.length})</h4>${vinc.map(x => adLinha(c, x)).join('')}` : ''}
  <div class="row" style="gap:6px;flex-wrap:wrap;margin:12px 0 4px">${chip('', 'Recomendadas', all.filter(x => AD_REC.includes(x.cls)).length)}${AD_ORD.filter(k => n(k)).map(k => chip(k, AD_CLS[k][0], n(k))).join('')}<span class="sp"></span><input type="text" data-i="adq" value="${esc(U.q || '')}" placeholder="Buscar produto" style="min-width:200px"></div>
  ${base.length ? base.slice(0, lim).map(x => adLinha(c, x)).join('') + (base.length > lim ? `<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-a="adMais">Mostrar mais (${base.length - lim} restante(s))</button></div>` : '') : `<p class="sm muted" style="margin-top:8px">${U.cls || ws.length ? 'Nenhum produto com esse filtro.' : 'Nenhuma recomendação: faltam dados do cliente para o motor cruzar. Veja “Dados insuficientes”.'}</p>`}</div>`;
}
function adMarcar(key, id, st) {
  const c = S.clients[key], p = (ENX.idx || []).find(x => x.id === id); if (!c || !p) return null; c.enxVinc ||= {};
  if (!st) delete c.enxVinc[id]; else { const x = adCalc(adCtx(c), p); c.enxVinc[id] = { st, nome: p.nome.slice(0, 160), em: nowISO(), ad: x.ad, cob: x.cob }; }
  touchC(key); return p;
}
const AD_ACT = {
  adVinc: t => { const p = adMarcar(t.dataset.k, t.dataset.id, 'vinculada'); if (p) { render(); toast(`${p.nome} vinculada a este cliente. Ela fica no topo das recomendações até você confirmar ou descartar.`); } },
  adDesc: t => { const p = adMarcar(t.dataset.k, t.dataset.id, 'descartada'); if (p) { render(); toast('Descartada para este cliente. Não será recomendada de novo.'); } },
  adSoltar: t => { if (adMarcar(t.dataset.k, t.dataset.id, '')) { render(); toast('Vínculo removido.'); } },
  adValidar: t => { if (!confirm('Confirmar aderência significa que VOCÊ validou com o cliente a necessidade e a compatibilidade técnica desta solução. Confirmar?')) return; const p = adMarcar(t.dataset.k, t.dataset.id, 'validada'); if (p) { render(); toast('Aderência confirmada por você.'); } },
  adSemana: t => { const c = S.clients[t.dataset.k], p = (ENX.idx || []).find(x => x.id === t.dataset.id); if (!c || !p) return; const g = c.gst ||= {}; if (g.proximaAcao || g.dataAcao) return toast(`Este cliente já tem próxima ação${g.proximaAcao ? ': “' + g.proximaAcao.slice(0, 60) + '”' : ''}. Ajuste em Gestão da conta.`); const d7 = new Date(Date.now() + 7 * 864e5); g.proximaAcao = `Conversa de descoberta: ${p.nome}`.slice(0, 200); g.dataAcao = d7.getFullYear() + '-' + String(d7.getMonth() + 1).padStart(2, '0') + '-' + String(d7.getDate()).padStart(2, '0'); g.em = nowISO(); touchC(c.key); render(); toast(`Ação criada para ${fmtD(g.dataAcao)}. Ela aparece no Plano da semana.`); },
  adFicha: t => { const U = ptUI(); U.aba = 'enx'; U.sel = ''; UI.view = 'portfolio'; enxAbrir(t.dataset.id); },
  adCMais: () => { adUI().cmais = (adUI().cmais || 0) + 1; render(); },
  adCls: t => { const U = adUI(); U.cls = t.dataset.v || ''; U.mais = 0; render(); }, adMais: () => { adUI().mais = (adUI().mais || 0) + 1; render(); }
};
