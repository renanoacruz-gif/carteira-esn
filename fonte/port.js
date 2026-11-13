/* Portfólio TOTVS: classificação de cada solução da Base por cliente, com pontuação explicável (0–100).
   Só usa o que está registrado (contratos identificados, segmento, oportunidades do motor, hipóteses de dor, linha e integrações da solução).
   O que não está registrado aparece como "validar" — nunca como compatível, integrado ou contratado. */
const PT_CLS = { contratada: ['Contratada', 'ok'], possivel: ['Possivelmente utilizada', 'info'], potencial: ['Potencial', 'warn'], validar: ['Necessita validação', 'warn'], incompativel: ['Incompatível', 'bad'], nao_ident: ['Não identificada', 'info'] };
const PT_ORD = ['potencial', 'validar', 'possivel', 'contratada', 'nao_ident', 'incompativel'];
const PT_PESO = [['segmento', 'Segmento', 20], ['dor', 'Dor ou oportunidade', 25], ['compat', 'Compatibilidade', 20], ['compl', 'Complementaridade', 15], ['viab', 'Viabilidade', 10], ['mat', 'Maturidade do registro', 10]];
const PT_LINHAS = ['Protheus', 'RM', 'Datasul', 'Winthor', 'Logix'];
const ptLinhaDe = r => PT_LINHAS.find(l => new RegExp('(^|[^a-z])' + l.toLowerCase() + '($|[^a-z])').test(norm(r.linha || ''))) || '';
/* contexto do cliente, calculado uma vez por classificação em lote */
function ptCtx(c) {
  const ident = new Map((c.productsIdent || []).map(p => [p.id, p])), opp = new Map();
  for (const o of c.opps || []) for (const s of o.sols || []) { const a = opp.get(s.id); if (!a || (o.score || 0) > (a.score || 0)) opp.set(s.id, o); }
  const hip = new Map(); for (const h of c.dorHip || []) if (!hip.has(h.solId)) hip.set(h.solId, h);
  const segId = c.segInfo?.id || '', sg = segId ? KB.segments.find(s => s.id === segId) : null;
  const temNomes = (c.productsIdent || []).map(p => norm(p.nome));
  return { c, ident, opp, hip, segId, segNome: sg?.nome || (segId && typeof segName === 'function' ? segName(segId) : '') || '', segApl: new Set((sg?.aplicacoes || []).map(a => a.sol)), linhas: baseLines(c), temNomes, rej: c.prodDec || {} };
}
function ptClass(X, r) {
  const c = X.c, p = X.ident.get(r.id), linhaSol = ptLinhaDe(r), F = {}, set = (k, pts, motivo) => { F[k] = { pts, motivo }; };
  /* 1) posse */
  let cls = '', porque = '';
  if (p && (p.nivel === 'estruturado' || p.nivel === 'manual' || p.conf)) { cls = 'contratada'; porque = p.nivel === 'manual' ? 'Informada manualmente por você neste cliente.' : p.conf ? 'Reconhecida e confirmada por você.' : `Identificada em ${p.ev?.[0]?.src || 'planilha/ficha'}${p.ev?.[0]?.loc ? ' (' + p.ev[0].loc + ')' : ''}.`; }
  else if (p) { cls = 'possivel'; porque = `Citada apenas em texto (${p.ev?.[0]?.src || 'documento'}); sem item de contrato que confirme.`; }
  /* 2) fatores */
  const segSol = (r.segmentos || []).includes(X.segId) || X.segApl.has(r.id);
  if (!X.segId) set('segmento', 0, 'Segmento do cliente ainda não classificado.'); else if (segSol) set('segmento', 20, `Solução registrada para o segmento ${X.segNome || X.segId}.`); else if (!(r.segmentos || []).length) set('segmento', 10, 'Solução sem segmento registrado (aplicação geral, a confirmar).'); else set('segmento', 0, 'Solução registrada para outros segmentos.');
  const h = X.hip.get(r.id), o = X.opp.get(r.id);
  if (h) set('dor', 25, `Hipótese sua: “${String(h.frase || '').slice(0, 90)}”.`); else if (o) set('dor', Math.max(10, Math.min(25, Math.round((o.score || 0) / 100 * 25))), `Oportunidade do motor: ${String(o.titulo || o.title || o.nome || 'ver aba de oportunidades').slice(0, 90)} (prioridade ${o.score ?? '—'}).`); else set('dor', 0, 'Nenhuma dor, hipótese ou oportunidade registrada para este cliente.');
  const ints = r.integracoes || [], intCli = ints.filter(i => X.linhas.some(l => norm(i.sistema) === norm(l))), nega = intCli.find(i => i.estado === 'nao_integra'), conf = intCli.find(i => i.estado === 'confirmada');
  let incompat = '';
  if (linhaSol && X.linhas.length && !X.linhas.includes(linhaSol)) { incompat = `Solução da linha ${linhaSol}; o cliente tem ${X.linhas.join(', ')}.`; set('compat', 0, incompat); }
  else if (nega) { incompat = `Registro da Base indica que não integra com ${nega.sistema}.`; set('compat', 0, incompat); }
  else if (linhaSol && X.linhas.includes(linhaSol)) set('compat', 20, `Mesma linha do cliente (${linhaSol}).`);
  else if (conf) set('compat', 20, `Integração com ${conf.sistema} registrada na Base${conf.f ? ' (fonte: ' + String(conf.f).slice(0, 60) + ')' : ''}.`);
  else if (!X.linhas.length) set('compat', 8, 'Linha de ERP do cliente não identificada — validar.');
  else set('compat', 10, `Compatibilidade com ${X.linhas.join(', ')} não registrada na Base — validar antes de afirmar.`);
  const par = ints.find(i => i.estado === 'confirmada' && X.temNomes.some(n => n && norm(i.sistema) && (n.includes(norm(i.sistema)) || norm(i.sistema).includes(n))));
  if (par) set('compl', 15, `Integra com ${par.sistema}, que o cliente já tem.`); else if (linhaSol && X.linhas.includes(linhaSol)) set('compl', 8, `Complementa a linha ${linhaSol} já contratada.`); else set('compl', 0, 'Sem integração registrada com o que o cliente já tem.');
  if (c.emp?.ausente) set('viab', 0, 'Cliente ausente da última base da carteira.'); else if (c.emp && (c.emp.mrrP || 0) > 0) set('viab', 10, 'Cliente ativo na carteira, com receita recorrente.'); else if (c.emp) set('viab', 5, 'Cliente na carteira, sem receita recorrente registrada.'); else set('viab', 5, 'Sem dados da carteira (Empodera) para avaliar.');
  const of = !!r.oficial || (r.fontes || []).some(f => f.u && isOfficialUrl(f.u));
  if (r.status === 'Validado') set('mat', of ? 10 : 7, of ? 'Registro validado, com fonte oficial.' : 'Registro validado, sem fonte oficial vinculada.'); else if (r.status === 'Em revisão') set('mat', of ? 6 : 4, 'Registro em revisão.'); else set('mat', 2, 'Registro ainda não validado.');
  const score = PT_PESO.reduce((a, [k]) => a + F[k].pts, 0), sinal = segSol || !!h || !!o;
  /* 3) classe para o que o cliente não tem */
  if (!cls) {
    if (incompat) { cls = 'incompativel'; porque = incompat; }
    else if (X.rej[r.id]?.st === 'rejeitado') { cls = 'nao_ident'; porque = 'Você marcou que este cliente não tem esta solução.'; }
    else if (sinal && r.status === 'NECESSITA VALIDAÇÃO') { cls = 'validar'; porque = 'Há indício de aderência, mas o registro da solução ainda não foi validado.'; }
    else if (sinal && F.compat.pts < 20 && !h && !o) { cls = 'validar'; porque = 'Aderente ao segmento; compatibilidade técnica ainda não registrada.'; }
    else if (sinal) { cls = 'potencial'; porque = [h && 'hipótese de dor', o && 'oportunidade do motor', segSol && 'aderência ao segmento'].filter(Boolean).join(' + ') + '.'; porque = porque[0].toUpperCase() + porque.slice(1); }
    else { cls = 'nao_ident'; porque = 'Sem indício registrado de uso ou de aderência.'; }
  }
  return { id: r.id, cls, porque, score: cls === 'contratada' ? null : score, fatores: PT_PESO.map(([k, rot, peso]) => ({ k, rot, peso, ...F[k] })) };
}
const ptSols = () => activeSols();
function ptCliente(c) { const X = ptCtx(c); return ptSols().map(r => ({ r, ...ptClass(X, r) })); }
function ptSolucao(r) { return clients().map(c => ({ c, ...ptClass(ptCtx(c), r) })); }
const ptRank = (a, b) => PT_ORD.indexOf(a.cls) - PT_ORD.indexOf(b.cls) || (b.score ?? -1) - (a.score ?? -1);
const ptPill = x => pill(PT_CLS[x.cls][0], PT_CLS[x.cls][1]);
const ptBarra = x => x.score == null ? '<span class="muted">—</span>' : `<span class="pt-sc" title="Pontuação de aderência"><span class="pt-bar"><i style="width:${x.score}%"></i></span><b>${x.score}</b></span>`;
const ptExpl = x => `<details class="pt-ex"><summary class="sm">Ver pontuação por fator</summary><ul class="pt-ft">${x.fatores.map(f => `<li><b>${esc(f.rot)} ${f.pts}/${f.peso}</b> <span class="muted">— ${esc(f.motivo)}</span></li>`).join('')}</ul>${x.score == null ? '<div class="sm muted">Solução já contratada: a pontuação de aderência não se aplica.</div>' : ''}</details>`;
function ptUI() { return UI.pt ||= { q: '', linha: '', tipo: '', pag: 0, sel: '', cls: '', cq: '', ccls: '' }; }
const ptHay = r => norm(`${r.nome} ${r.sigla || ''} ${r.linha || ''} ${r.categoria || ''} ${(r.termos || []).join(' ')} ${r.finalidade || ''} ${(r.funcionalidades || []).map(x => x.t).join(' ')} ${(r.dores || []).map(x => x.t).join(' ')} ${(r.necessidades || []).map(n => NEED_LABEL[n] || n).join(' ')}`);
/* busca: todas as palavras precisam aparecer (nome, linha, termos, funcionalidades, dores, necessidades); nome pesa mais */
function ptBusca(q) {
  const ts = norm(q).split(/\s+/).filter(t => t.length > 1), U = ptUI();
  return ptSols().map(r => { if (U.linha && (r.linha || '') !== U.linha) return null; if (U.tipo && r.tipo !== U.tipo) return null; if (!ts.length) return { r, w: 0 }; const hay = ptHay(r), nm = norm(r.nome); if (!ts.every(t => hay.includes(t))) return null; return { r, w: ts.reduce((a, t) => a + (nm.includes(t) ? 3 : 1), 0) }; }).filter(Boolean).sort((a, b) => b.w - a.w || a.r.nome.localeCompare(b.r.nome, 'pt'));
}
function vPortfolio() {
  const U = ptUI(), sel = U.sel && ptSols().find(r => r.id === U.sel);
  if (sel) return ptOnde(sel);
  const all = ptSols(), res = ptBusca(U.q), POR = 50, pags = Math.max(1, Math.ceil(res.length / POR)); if (U.pag >= pags) U.pag = 0;
  const tem = new Map(); for (const c of clients()) for (const p of c.productsIdent || []) if (p.nivel !== 'texto' || p.conf) tem.set(p.id, (tem.get(p.id) || 0) + 1);
  const linhas = [...new Set(all.map(r => r.linha).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')), opt = (v, t, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(t)}</option>`;
  const nCli = clients().length;
  return `<div class="card"><h3>Portfólio TOTVS <span class="muted sm">(${all.length} solução(ões) na Base)</span></h3>
  <p class="sm muted">Escolha uma solução para ver <b>onde ela pode ser vendida</b> na sua carteira. A classificação usa só o que está registrado; o que falta aparece como “validar”.</p>
  <div class="row" style="gap:8px;flex-wrap:wrap"><input type="text" data-i="ptq" value="${esc(U.q)}" placeholder="Buscar por nome, linha, funcionalidade, dor ou necessidade" style="min-width:280px;flex:1"><select data-c="ptlinha" aria-label="Linha">${opt('', 'Todas as linhas', U.linha)}${linhas.map(l => opt(l, l, U.linha)).join('')}</select><select data-c="pttipo" aria-label="Tipo">${opt('', 'Todos os tipos', U.tipo)}${Object.entries(TIPOS).map(([k, v]) => opt(k, v, U.tipo)).join('')}</select></div>
  ${res.length ? `<div class="tw" style="margin-top:10px"><table><thead><tr><th style="min-width:220px">Solução</th><th>Tipo</th><th>Linha / categoria</th><th>Registro</th><th class="num">Clientes que já têm</th><th></th></tr></thead><tbody>${res.slice(U.pag * POR, U.pag * POR + POR).map(({ r }) => `<tr><td><b>${esc(r.nome)}</b>${r.finalidade ? `<div class="sm muted">${esc(String(r.finalidade).slice(0, 110))}</div>` : ''}</td><td class="sm">${esc(TIPOS[r.tipo] || r.tipo)}</td><td class="sm">${esc(r.linha || '—')}${r.categoria ? ' · ' + esc(r.categoria) : ''}</td><td>${pill(r.status, r.status === 'Validado' ? 'ok' : r.status === 'Em revisão' ? 'info' : 'warn')}</td><td class="num">${tem.get(r.id) || 0}${nCli ? ` <span class="muted sm">de ${nCli}</span>` : ''}</td><td><button class="btn sm pri" data-a="ptSel" data-id="${esc(r.id)}">Onde posso vender?</button></td></tr>`).join('')}</tbody></table></div>
  <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm ghost" data-a="ptPag" data-d="-1" ${U.pag > 0 ? '' : 'disabled'}>Anterior</button><span class="sm muted">Página ${U.pag + 1} de ${pags} · ${res.length} resultado(s)</span><button class="btn sm ghost" data-a="ptPag" data-d="1" ${U.pag + 1 < pags ? '' : 'disabled'}>Próxima</button></div>` : '<p class="sm muted" style="margin-top:10px">Nenhuma solução encontrada com esse filtro.</p>'}</div>`;
}
function ptOnde(r) {
  const U = ptUI(), all = ptSolucao(r).sort(ptRank), n = k => all.filter(x => x.cls === k).length, lista = all.filter(x => !U.cls || x.cls === U.cls);
  const chip = (k, t) => `<button class="btn sm ${U.cls === k ? 'pri' : 'ghost'}" data-a="ptCls" data-k="${k}">${esc(t)}${k ? ` (${n(k)})` : ` (${all.length})`}</button>`;
  return `<div class="card"><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm ghost" data-a="ptVoltar">← Portfólio</button><span class="sp"></span><button class="btn sm ghost" data-a="ptAbrirSol" data-id="${esc(r.id)}">Abrir registro na Base</button></div>
  <h3 style="margin-top:8px">Onde posso vender: ${esc(r.nome)}</h3>
  <p class="sm muted">${esc(TIPOS[r.tipo] || r.tipo)}${r.linha ? ' · linha ' + esc(r.linha) : ''}${r.categoria ? ' · ' + esc(r.categoria) : ''} · registro ${esc(r.status)}${r.finalidade ? ' — ' + esc(String(r.finalidade).slice(0, 200)) : ''}</p>
  ${r.status !== 'Validado' ? '<div class="alert w"><b>Registro ainda não validado.</b> Confirme o conteúdo na fonte oficial antes de levar ao cliente.</div>' : ''}
  ${all.length ? `<div class="row" style="gap:6px;flex-wrap:wrap;margin:8px 0">${chip('', 'Todos')}${PT_ORD.filter(k => n(k)).map(k => chip(k, PT_CLS[k][0])).join('')}</div>
  <div class="tw"><table><thead><tr><th style="min-width:200px">Cliente</th><th>Classificação</th><th>Aderência</th><th style="min-width:280px">Explicação</th></tr></thead><tbody>${lista.slice(0, 300).map(x => `<tr><td><a href="#" data-a="open" data-k="${esc(x.c.key)}"><b>${esc(x.c.name)}</b></a><div class="sm muted">${esc(x.c.segInfo?.id ? (segName(x.c.segInfo.id) || x.c.segInfo.id) : 'segmento não classificado')}</div></td><td>${ptPill(x)}</td><td>${ptBarra(x)}</td><td><div class="pt-xp"><div class="sm">${esc(x.porque)}</div>${ptExpl(x)}</div></td></tr>`).join('')}</tbody></table></div>${lista.length > 300 ? `<p class="sm muted">Mostrando os 300 primeiros de ${lista.length}.</p>` : ''}` : '<p class="sm muted">Importe a carteira para ver onde esta solução pode ser vendida.</p>'}
  <p class="sm muted" style="margin-top:10px">Pontuação (0–100): segmento 20 · dor ou oportunidade 25 · compatibilidade 20 · complementaridade 15 · viabilidade 10 · maturidade do registro 10. É um apoio de priorização, não uma garantia de aderência nem de retorno.</p></div>`;
}
function ptTab(c) {
  const U = ptUI(), all = ptCliente(c).sort(ptRank), n = k => all.filter(x => x.cls === k).length, q = norm(U.cq || ''), lista = all.filter(x => (!U.ccls || x.cls === U.ccls) && (!q || ptHay(x.r).includes(q)));
  const chip = (k, t) => `<button class="btn sm ${U.ccls === k ? 'pri' : 'ghost'}" data-a="ptCCls" data-k="${k}">${esc(t)} (${k ? n(k) : all.length})</button>`;
  return `<div class="card"><h3>Portfólio TOTVS neste cliente</h3><p class="sm muted">Cada solução da Base classificada para ${esc(c.name)}. A classificação usa só o que está registrado; “validar” indica o que precisa de confirmação antes de afirmar ao cliente.</p>
  <div class="row" style="gap:6px;flex-wrap:wrap;margin:8px 0">${chip('', 'Todas')}${PT_ORD.filter(k => n(k)).map(k => chip(k, PT_CLS[k][0])).join('')}<span class="sp"></span><input type="text" data-i="ptcq" value="${esc(U.cq || '')}" placeholder="Buscar solução" style="min-width:200px"></div>
  ${lista.length ? `<div class="tw"><table><thead><tr><th style="min-width:220px">Solução</th><th>Classificação</th><th>Aderência</th><th style="min-width:280px">Explicação</th></tr></thead><tbody>${lista.slice(0, 200).map(x => `<tr><td><b>${esc(x.r.nome)}</b><div class="sm muted">${esc(TIPOS[x.r.tipo] || x.r.tipo)}${x.r.linha ? ' · ' + esc(x.r.linha) : ''}</div></td><td>${ptPill(x)}</td><td>${ptBarra(x)}</td><td><div class="pt-xp"><div class="sm">${esc(x.porque)}</div>${ptExpl(x)}</div></td></tr>`).join('')}</tbody></table></div>${lista.length > 200 ? `<p class="sm muted">Mostrando as 200 primeiras de ${lista.length}. Use a busca para refinar.</p>` : ''}` : '<p class="sm muted">Nenhuma solução neste filtro.</p>'}</div>`;
}
const PT_ACT = {
  ptSel: t => { const U = ptUI(); U.sel = t.dataset.id; U.cls = ''; render(); window.scrollTo(0, 0); },
  ptVoltar: () => { ptUI().sel = ''; render(); },
  ptPag: t => { const U = ptUI(); U.pag = Math.max(0, U.pag + (+t.dataset.d || 0)); render(); },
  ptCls: t => { ptUI().cls = t.dataset.k || ''; render(); },
  ptCCls: t => { ptUI().ccls = t.dataset.k || ''; render(); },
  ptAbrirSol: t => { UI.solSel = t.dataset.id; UI.view = 'solucoes'; render(); window.scrollTo(0, 0); }
};
function ptChange(c, v) { const U = ptUI(); if (c === 'ptlinha') { U.linha = v; U.pag = 0; render(); return true; } if (c === 'pttipo') { U.tipo = v; U.pag = 0; render(); return true; } return false; }
