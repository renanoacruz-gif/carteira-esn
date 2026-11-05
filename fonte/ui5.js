/* ===== VIEWS: INTELIGÊNCIA POR SEGMENTO, CADASTRO ESTRATÉGICO, IMPORTAÇÃO COM PRÉVIA, QUALIDADE E REFERÊNCIAS ===== */
const pct1 = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
const stPillC = st => st ? pill(ST_L[st] || st, st === 'confirmado' ? 'ok' : 'warn') : '';
const SEGL = id => id === SEG_NONE ? 'Segmento não informado' : segName(id) || id;

/* ---------- Bloco do dashboard ---------- */
function segCard(forExport) {
  const I = segIntel(), t = I.tot, comp = mrrComp(), prec = S.meta.mrrPrec || 'ficha';
  let h = `<div class="card" id="segintel"><div class="row"><h3>Inteligência por Segmento de Atuação</h3><span class="sp"></span>${forExport ? '' : `<button class="btn ghost sm" data-a="segCfg" aria-expanded="${!!UI.segCfg}">${UI.segCfg ? 'Fechar configurações' : 'Configurar contagem, MRR e segmentos'}</button>`}</div>
  <p class="sm">Unidade de contagem: <b>${esc(UNIT_L[I.u])}</b> • MRR: competência de referência <b>${esc(comp)}</b>, somente valores recorrentes • Precedência em caso de divergência: <b>${prec === 'planilha' ? 'planilha' : 'ficha da competência'}</b> (tolerância ${mrrTol()}%)</p>
  ${forExport ? (t.semComp ? `<div class="alert sm">${t.semComp} conta(s) com MRR na planilha sem competência declarada (${S.meta.mrrPlanComp ? 'declarada ' + esc(S.meta.mrrPlanComp) + ', diferente da referência' : 'não declarada'}): ficam fora das somas como <b>desconhecido</b> (desconhecido ≠ zero).</div>` : '') : mrrAviso(t)}
  ${t.div ? `<div class="alert b sm">${t.div} conta(s) com divergência entre MRR da planilha e da ficha na mesma competência: aplicada a precedência configurada; os dois valores nunca são somados. Veja o filtro "Com conflitos".</div>` : ''}
  ${!forExport && UI.segCfg ? segCfgPanel() : ''}
  <div class="tw"><table class="segtbl"><caption class="sm muted" style="text-align:left">Clique ou pressione Enter em um segmento para abrir a lista de clientes filtrada.</caption><thead><tr><th>Segmento (principal)</th><th class="r">Clientes</th><th class="r">% da carteira</th><th class="r">MRR identificado</th><th class="r">Participação no MRR conhecido</th><th>Cobertura do MRR</th><th>Cobertura de fichas</th><th class="r">Dados estratégicos incompletos</th><th class="r">Oportunidades fundamentadas</th>${forExport ? '' : '<th></th>'}</tr></thead><tbody>
  ${I.rows.map(r => `<tr ${forExport ? '' : `class="clk" tabindex="0" role="button" data-a="segGo" data-id="${esc(r.id)}" aria-label="Abrir clientes do segmento ${esc(SEGL(r.id))}"`}><td><b>${esc(SEGL(r.id))}</b>${r.sec ? ` <span class="pill p-off" title="Unidades que têm este segmento como secundário (não somadas aqui)">+${r.sec} secundário</span>` : ''}${r.mixed ? ` <span class="pill p-warn" title="Unidades cujos registros têm segmentos diferentes">${r.mixed} misto</span>` : ''}</td>
    <td class="r">${r.units}</td><td class="r">${pct1(r.units, t.units)}%</td><td class="r nw">${r.known ? fmtBRL(r.mrr) : '<span class="muted">desconhecido</span>'}</td><td class="r">${t.mrr ? pct1(r.mrr, t.mrr) + '%' : '—'}</td>
    <td class="sm nw">${r.known}/${r.members} (${pct1(r.known, r.members)}%)<div class="muted">${r.orig.ficha ? r.orig.ficha + ' ficha' : ''}${r.orig.ficha && r.orig.planilha ? ' • ' : ''}${r.orig.planilha ? r.orig.planilha + ' planilha' : ''}${r.div ? ` • <span style="color:var(--bad)">${r.div} diverg.</span>` : ''}</div></td>
    <td class="sm">${r.ficha}/${r.units} (${pct1(r.ficha, r.units)}%)</td><td class="r">${r.incompl}</td><td class="r">${r.opps}</td>${forExport ? '' : `<td class="noopen"><button class="btn ghost sm" data-a="segStudy" data-id="${esc(r.id)}" ${r.id === SEG_NONE ? 'disabled' : ''}>Estudo</button></td>`}</tr>`).join('')}
  </tbody><tfoot><tr><th>Total</th><th class="r">${t.units}</th><th class="r">100%</th><th class="r nw">${fmtBRL(t.mrr)}</th><th class="r">${t.mrr ? '100%' : '—'}</th><th class="sm">${t.known}/${t.members}</th><th colspan="${forExport ? 3 : 4}"></th></tr></tfoot></table></div>
  <p class="muted sm">Contagem por identificador único (${esc(UNIT_L[I.u]).toLowerCase()}); somas usam apenas o segmento principal — secundários aparecem como etiqueta e não são somados. MRR = recorrente TOTVS da competência ${esc(comp)}; avulsos, faturamento anual do cliente e outras competências ficam fora. Oportunidades fundamentadas = com evidência individual classificada como FATO.</p>`;
  if (!forExport && UI.segStudy) h += segStudyPanel(UI.segStudy);
  return h + '</div>';
}
function segCfgPanel() {
  const vals = segRawValues(), mp = S.meta.segMap || {}, cr = S.meta.compCrit || {};
  return `<div class="card" style="background:var(--bg2,#f6f8fa)"><div class="grid g3">
  <label class="sm">Unidade de contagem<select data-c="segUnit" style="width:100%">${Object.entries(UNIT_L).map(([k, l]) => optS(k, l, segUnit())).join('')}</select></label>
  <label class="sm">Competência de referência do MRR (AAAA-MM)<input type="month" data-c="mrrComp" value="${esc(S.meta.mrrComp || '')}" placeholder="${esc(refCompOf(S))}" style="width:100%"></label>
  <label class="sm">Competência do MRR informado na planilha<input type="month" data-c="mrrPlanComp" value="${esc(S.meta.mrrPlanComp || '')}" style="width:100%"></label>
  <label class="sm">Precedência quando planilha e ficha divergem<select data-c="mrrPrec" style="width:100%">${optS('ficha', 'Ficha da competência prevalece', S.meta.mrrPrec || 'ficha')}${optS('planilha', 'Planilha prevalece', S.meta.mrrPrec || 'ficha')}</select></label>
  <label class="sm">Tolerância para divergência (%)<input type="number" min="0" max="100" data-c="mrrTol" value="${mrrTol()}" style="width:100%"></label>
  <label class="sm">Lembretes contratuais (dias de antecedência)<input type="text" data-c="renovDays" value="${esc(renovDays().join(', '))}" style="width:100%"></label></div>
  <h4>Mapeamento de segmentos (valor original preservado)</h4>${vals.length ? `<div class="tw" style="max-height:240px"><table><thead><tr><th>Valor na planilha</th><th class="r">Ocorrências</th><th>Segmento usado</th></tr></thead><tbody>${vals.map(([k, o]) => `<tr><td>${esc(o.raw)}</td><td class="r">${o.n}</td><td><select data-c="segMap" data-raw="${esc(k)}">${optS('', 'Automático (' + (KB.segments.find(s => s.re.test(k))?.nome || 'sem correspondência') + ')', mp[k] || '')}${optS(SEG_NONE, 'Segmento não informado', mp[k] || '')}${KB.segments.map(s => optS(s.id, s.nome, mp[k] || '')).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted sm">Nenhum valor de segmento na planilha.</p>'}
  <h4>Critérios de completude (visíveis e configuráveis)</h4><div class="row sm" style="flex-wrap:wrap">${COMP_DEF.map(([k, l]) => `<label><input type="checkbox" data-c="compCrit" data-k="${k}" ${cr[k] !== false ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
  <h4>Regimes tributários (lista editável, um por linha)</h4><textarea rows="4" data-c="regimes" style="width:100%">${esc(regimesList().join('\n'))}</textarea><p class="muted sm">"Não informado" e "Outros" são sempre mantidos.</p></div>`;
}
function segStudyPanel(id) {
  const g = KB.segments.find(s => s.id === id); if (!g) return ''; const cs = clients().filter(c => c.segInfo?.id === id), n = cs.length;
  const cnt = f => { const m = {}; cs.forEach(c => { const v = f(c); if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const hosp = cnt(c => c.cad?.hosp?.v && stOf(c.cad.hosp) === 'confirmado' ? HOSP[c.cad.hosp.v] : null), reg = cnt(c => c.fis?.regime?.v && stOf(c.fis.regime) === 'confirmado' ? c.fis.regime.v : null);
  const prods = cnt(c => null); cs.forEach(c => (c.productsIdent || []).forEach(p => { const e = prods.find(x => x[0] === p.nome); e ? e[1]++ : prods.push([p.nome, 1]); })); prods.sort((a, b) => b[1] - a[1]);
  const fund = cs.flatMap(c => (c.opps || []).filter(oppFund).map(o => o.nome)), fm = {}; fund.forEach(x => fm[x] = (fm[x] || 0) + 1);
  const li = a => a.length ? `<ul class="sm">${a.join('')}</ul>` : '<p class="muted sm">Sem dados confirmados.</p>';
  return `<div class="card" style="border-left:4px solid var(--ciano)"><div class="row"><h3>Estudo — ${esc(g.nome)}</h3><span class="sp"></span><button class="btn ghost sm" data-a="openSeg" data-id="${esc(id)}">Abrir estudo completo</button><button class="btn ghost sm" data-a="segStudy" data-id="">Fechar</button></div>
  <div class="grid g3"><div><h4>Tendências de mercado ${chip('FATO')}<span class="muted sm"> (fonte externa)</span></h4>${g.tendencias?.length ? `<ul class="sm">${g.tendencias.map(t => `<li>${esc(t.t)} <span class="muted">— ${link(t.fonte)}</span></li>`).join('')}</ul>` : `<p class="muted sm">${esc(g.resumo || 'Estudo não carregado.')}</p>`}</div>
  <div><h4>Evidências dos clientes ${chip('FATO')}<span class="muted sm"> (${n} cliente(s), só dados confirmados)</span></h4>${li([...hosp.map(([k, v]) => `<li>Hospedagem ${esc(k)}: ${v}</li>`), ...reg.map(([k, v]) => `<li>Regime ${esc(k)}: ${v}</li>`), `<li>Release em produção confirmada: ${cs.filter(relConf).length}</li>`, ...prods.slice(0, 6).map(([k, v]) => `<li>Contratação identificada — ${esc(k)}: ${v}</li>`), ...Object.entries(fm).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `<li>Oportunidade com evidência individual — ${esc(k)}: ${v}</li>`)])}</div>
  <div><h4>Hipóteses comerciais ${chip('HIPÓTESE')}</h4>${li([...(g.dores || []).map(d => `<li>${esc(d)}</li>`), ...(g.demandas || []).map(d => `<li>Demanda provável: ${esc(d)}</li>`), ...(g.aplicacoes || []).map(a => `<li>${esc(solById(a.sol)?.nome || a.sol)}: ${esc(a.porque)}</li>`)])}</div></div></div>`;
}

/* ---------- Aviso de MRR com competência (mesmo estado das configurações: refComp / mrrComp / mrrPlanComp) ---------- */
function mrrEstados() {
  const r = { n: 0, conhecido: 0, zero: 0, semCompPlan: 0, semValor: 0, semFicha: 0 };
  clients().forEach(c => { const m = mrrOf(c); r.n++; if (m.v != null) { r.conhecido++; if (m.v === 0) r.zero++; } else if (m.semComp) r.semCompPlan++; else r.semValor++; if (m.fic == null) r.semFicha++; });
  return r;
}
function mrrAviso(t) {
  const e = mrrEstados(); if (!e.n || (!e.semCompPlan && !e.semValor && !e.semFicha && !t.semComp)) return '';
  const mi = (c, v, l) => `<label class="sm">${l} <input type="month" data-c="${c}" value="${esc(v || '')}" pattern="\\d{4}-\\d{2}" placeholder="AAAA-MM" aria-label="${esc(l)}" style="width:150px"></label>`;
  const parts = [`<b>${e.conhecido}</b> de ${e.n} conta(s) com MRR conhecido${e.zero ? ` (${e.zero} com valor confirmado igual a zero)` : ''}`];
  if (e.semCompPlan) parts.push(`<b>${e.semCompPlan}</b> desconhecido: valor na planilha sem competência declarada (${S.meta.mrrPlanComp ? 'declarada ' + esc(S.meta.mrrPlanComp) + ', diferente da referência' : 'não declarada'})`);
  if (e.semValor) parts.push(`<b>${e.semValor}</b> desconhecido: sem valor em nenhuma fonte`);
  if (e.semFicha) parts.push(`<b>${e.semFicha}</b> sem ficha na competência ${esc(mrrComp())}`);
  return `<div class="alert sm" id="mrraviso" role="status"><div class="row">${mi('mrrRef', mrrComp(), 'Competência de referência')}${mi('mrrPlanComp', S.meta.mrrPlanComp, 'Competência do MRR da planilha')}</div>
  <div>${parts.join(' • ')}.</div><div class="muted">Desconhecido não é zero: contas sem dado ficam fora das somas. Ao alterar a competência, indicadores e cobertura de fichas são recalculados.</div></div>`;
}

/* ---------- Painel "Hoje" (usa o score e as regras do plano de ação; sem motor próprio) ---------- */
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isoBR = s => s ? s.split('-').reverse().join('/') : '';
function hojeRows() {
  const hoje = hojeISO(), seen = new Set(), out = [];
  planRows().forEach(r => {
    if (r.score < 0 || !r.dec || seen.has(r.id)) return; seen.add(r.id);
    const a = actOf(r.id, r.key);
    if (r.dec.valid === 'descartada' || ['encerrada', 'contratada'].includes(r.dec.sit) || ['Concluído', 'Descartado'].includes(a.status)) return;
    const p = a.prazo || ''; if (p && p > hoje) return;
    out.push({ ...r, a, sit: !p ? 'sem prazo' : p < hoje ? 'vencida' : 'hoje' });
  });
  return out.sort((x, y) => y.score - x.score || (x.a.prazo || '9999-99-99').localeCompare(y.a.prazo || '9999-99-99'));
}
function hojeCard() {
  const all = hojeRows(), top = all.slice(0, 5);
  if (!top.length) return `<div class="card" id="hoje"><h3>Hoje</h3><p class="muted sm">Nenhuma ação aberta vencida, prevista para hoje ou sem prazo. Ações com prazo futuro continuam no <a href="#" data-a="nav" data-v="plano">Plano de ação</a>.</p></div>`;
  const sp = s => s === 'vencida' ? pill('Vencida', 'bad') : s === 'hoje' ? pill('Hoje', 'warn') : pill('Sem prazo', 'off');
  return `<div class="card" id="hoje"><div class="row"><h3>Hoje</h3><span class="pill p-info">${top.length} de ${all.length}</span><span class="sp"></span><button class="btn ghost sm" data-a="nav" data-v="plano">Ver plano de ação</button></div>
  <div class="tw hojetw"><table><thead><tr><th>Cliente</th><th>Ação</th><th>Prioridade / score</th><th>Prazo</th><th>Responsável</th><th></th></tr></thead><tbody>${top.map(r => `<tr><td><a href="#" data-a="open" data-k="${esc(r.key)}">${esc(r.cliente)}</a></td><td class="sm">${esc(r.acao)}</td><td class="nw">${pill(r.prio + ' ' + r.score, PRIOK[r.prio])}</td><td class="nw">${sp(r.sit)}${r.a.prazo ? ' <span class="sm">' + isoBR(r.a.prazo) + '</span>' : ''}</td><td class="sm">${esc(r.a.resp || '—')}</td><td class="nw"><button class="btn ghost sm" data-a="openOpp" data-k="${esc(r.key)}">Abrir ação</button> <button class="btn sm" data-a="hojeOk" data-id="${esc(r.id)}" data-k="${esc(r.key)}">Concluir</button></td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------- Plano de ação: seleção e atribuição de responsável em lote ---------- */
function planBulkBar(scope) {
  const sel = UI.planSel || (UI.planSel = {}), ids = Object.keys(sel), inScope = new Set(scope.map(r => r.id)), dentro = ids.filter(i => inScope.has(i)).length;
  return `<div class="alert i sm" id="pbar" role="region" aria-label="Atribuição em lote"><div class="row"><b>${ids.length} selecionada(s)</b><span class="muted">${dentro} dentro do filtro atual (${scope.length} linhas filtradas)${ids.length - dentro ? ` • ${ids.length - dentro} fora do filtro` : ''}</span><span class="sp"></span>
  <button class="btn ghost sm" data-a="planSelAll">Selecionar as ${scope.length} filtradas</button><button class="btn ghost sm" data-a="planSelClr" ${ids.length ? '' : 'disabled'}>Limpar seleção</button></div>
  <div class="row"><label class="sm">Responsável <input type="text" data-i="pbulk" value="${esc(UI.planBulk || '')}" placeholder="nome do responsável" style="width:200px"></label><button class="btn sm" data-a="planBulkGo" ${ids.length ? '' : 'disabled'}>Atribuir à seleção</button><button class="btn ghost sm" data-a="planBulkMe" ${ids.length && (ME.nome || ME.id) ? '' : 'disabled'}>Atribuir a mim</button></div></div>`;
}
function planBulkGo(resp) {
  const sel = UI.planSel || {}, ids = Object.keys(sel); resp = String(resp || '').trim();
  if (!ids.length) return toast('Selecione ao menos uma ação.');
  if (!resp) return toast('Informe o responsável.');
  const subst = ids.filter(id => { const a = actOf(id, sel[id] || null); return a.resp && a.resp !== resp; }).length;
  if (subst && !confirm(`${subst} das ${ids.length} ação(ões) selecionada(s) já têm outro responsável e serão substituídas por “${resp}”. Continuar?`)) return;
  let ok = 0; const falhas = [];
  ids.forEach(id => { try { setAct(id, sel[id] || null, { resp }); delete sel[id]; ok++; } catch (e) { falhas.push(id); } });
  UI.planBulk = ''; render();
  toast(falhas.length ? `${ok} atualizada(s); ${falhas.length} falharam e continuam selecionadas.` : `Responsável definido em ${ok} ação(ões).`);
}

function remindCard() {
  const L = clients().flatMap(ctReminders).filter(x => x.nivel === 'alerta' || x.nivel === 'passada').sort((a, b) => a.d - b.d); const decl = clients().flatMap(ctReminders).filter(x => x.nivel === 'declarada').length;
  if (!L.length && !decl) return '';
  return `<div class="card"><h3>Lembretes contratuais internos <span class="pill p-info">${L.length}</span></h3><p class="muted sm">Somente no aplicativo (sem e-mail ou mensagem externa). Gerados apenas a partir de datas confirmadas; antecedência: ${renovDays().join(', ')} dias.${decl ? ` ${decl} data(s) declarada(s) aguardam confirmação.` : ''}</p>${L.length ? `<div class="tw" style="max-height:260px"><table><thead><tr><th>Cliente</th><th>Contrato</th><th>Evento</th><th>Data</th><th class="r">Dias</th></tr></thead><tbody>${L.map(x => `<tr class="clk" data-a="openCad" data-k="${esc(x.c.key)}"><td>${esc(x.c.name)}</td><td>${esc(x.ct.ident)}</td><td>${esc(x.l)}</td><td class="nw">${fmtD(x.data)}</td><td class="r">${x.d < 0 ? '<span style="color:var(--bad)">' + x.d + '</span>' : x.d}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
}

/* ---------- Lista de clientes: filtros ativos e qualidade ---------- */
const FLBL = { seg: v => 'Segmento: ' + (v === 'none' ? 'Segmento não informado' : segName(v) || v), fs: v => 'Ficha: ' + (v === 'nao_carregada' ? 'sem ficha' : FSTAT[v] || v), prio: v => 'Prioridade: ' + v, conf: v => 'Confiança: ' + v, dq: v => 'Qualidade: ' + (DQF[v] || v), q: v => `Busca: "${v}"`, sol: v => 'Solução: ' + (S.solutions.find(r => r.id === v)?.nome || v), est: v => 'Estágio: ' + (EST_SIT[v] || v), hosp: v => 'Hospedagem: ' + (HOSP[v] || v), rel: v => 'Release: ' + v, ult: v => 'Último contato: ' + (ULT_L[v] || v), prox: v => 'Próxima ação: ' + (PROX_L[v] || v) };
function fchips() { const f = UI.f, a = Object.keys(FLBL).filter(k => f[k]); if (!a.length) return ''; return `<div class="fchips" role="group" aria-label="Filtros ativos"><span class="sm muted">Filtros ativos:</span> ${a.map(k => `<span class="fchip">${esc(FLBL[k](f[k]))} <button class="x" data-a="fclr" data-k="${k}" aria-label="Remover filtro ${esc(FLBL[k](f[k]))}">×</button></span>`).join(' ')} <button class="btn ghost sm" data-a="fclr" data-k="*">Limpar filtros</button></div>`; }
const compPill = c => { const k = complet(c); return `<span class="pill p-${k.pct >= 80 ? 'ok' : k.pct >= 50 ? 'warn' : 'bad'}" title="Completude de dados (não é potencial comercial). Faltam: ${esc(k.miss.map(x => x[1]).join(', ') || 'nada')}">${k.pct}%</span>`; };

/* ---------- Aba do cliente: Cadastro estratégico, contratos, regras ---------- */
function cadEditor(c, k) {
  const cur = k === 'regime' ? c.fis?.regime : c.cad?.[k]; const v = cur?.v;
  let ctl; if (k === 'hosp') ctl = `<select id="ce_v">${optS('', '— limpar —', v || '')}${Object.entries(HOSP).map(([a, b]) => optS(a, b, v || '')).join('')}</select>`;
  else if (k === 'regime') ctl = `<select id="ce_v">${optS('', '— limpar —', v || '')}${regimesList().map(x => optS(x, x, v || '')).join('')}</select>`;
  else if (k === 'fat') ctl = `<input id="ce_v" type="text" value="${esc(v ? (v.faixa || v.valor) : '')}" placeholder="valor ou faixa (ex.: 10 a 50 milhões)"><input id="ce_moeda" type="text" value="${esc(v?.moeda || 'BRL')}" style="width:60px" aria-label="Moeda"><input id="ce_ex" type="text" value="${esc(v?.exercicio || '')}" placeholder="exercício" style="width:90px">`;
  else ctl = `<input id="ce_v" type="number" min="0" step="1" value="${v ?? ''}" style="width:110px">`;
  return `<tr class="edit"><td colspan="7"><div class="row sm">${ctl}<input id="ce_f" type="text" placeholder="Fonte * (documento, conversa registrada, sistema…)" style="min-width:240px"><label>Data de referência <input id="ce_d" type="date" value="${esc(cur?.dref || '')}"></label><select id="ce_st">${optS('declarado', 'Declarado (informado, não verificado)', 'declarado')}${optS('confirmado', 'Confirmado (verificado em documento/sistema)', '')}</select><input id="ce_m" type="text" placeholder="Motivo da alteração" style="min-width:160px"><button class="btn sm" data-a="cadSave" data-k="${kk(c)}" data-f="${k}">Salvar</button><button class="btn ghost sm" data-a="cadCancel">Cancelar</button></div></td></tr>`;
}
function cadRow(c, k, l, cur, opts = {}) {
  const v = cur?.v; return `<tr><td><b>${esc(l)}</b>${opts.sub ? `<div class="muted sm">${opts.sub}</div>` : ''}</td><td>${v == null || v === '' ? '<span class="muted">não informado</span>' : esc(opts.txt ? opts.txt(v) : cadTxt(k, v))}</td><td class="sm">${cur ? esc(fonteTxt(cur.fonte)) : '—'}</td><td class="nw sm">${fmtD(cur?.dref)}</td><td class="nw sm">${cur?.at ? dtBR(cur.at) : '—'}${cur?.at && isStale(cur.at) ? ' ' + pill('antiga', 'warn') : ''}</td><td>${v != null && v !== '' ? stPillC(stOf(cur)) : ''}</td>
  <td class="nw">${opts.ro ? opts.ro : `<button class="btn ghost sm" data-a="cadEd" data-k="${kk(c)}" data-f="${k}">Editar</button>`}${cur?.hist?.length ? `<details><summary class="sm">Histórico (${cur.hist.length})</summary><ul class="sm">${cur.hist.map(x => `<li>${dtBR(x.at)}: ${esc(x.de == null ? '—' : typeof x.de === 'object' ? fatTxt(x.de) : String(x.de))} → ${esc(x.para == null ? '—' : typeof x.para === 'object' ? fatTxt(x.para) : String(x.para))} ${x.st ? '(' + esc(ST_L[x.st] || x.st) + ')' : ''} ${esc(x.fonte || '')} ${esc(x.motivo || '')}</li>`).join('')}</ul></details>` : ''}</td></tr>${UI.cadEd === c.key + '|' + k ? cadEditor(c, k) : ''}`;
}
function tabCadastro(c) {
  cadInit(c); const m = mrrOf(c), comp = complet(c), rel = evOk(c.rel).filter(e => e.extra?.tipo === 'producao').sort((a, b) => (b.conf || '').localeCompare(a.conf || ''))[0], relDecl = evCand(c.rel).find(e => e.extra?.tipo === 'producao');
  let h = `<div class="grid g2"><div class="card boxmrr"><h3>💠 Receita recorrente TOTVS (MRR)</h3><div class="kpi" style="padding:8px 14px"><span class="v" style="font-size:22px">${m.v == null ? 'Desconhecido' : fmtBRL(m.v)}</span></div>
  <p class="sm">Competência de referência: <b>${esc(m.comp)}</b> • Origem: ${m.origem ? `<b>${m.origem === 'ficha' ? 'ficha de faturamento (itens recorrentes)' : 'planilha (declarado)'}</b>` : '—'}</p>
  <p class="sm muted">Ficha (${esc(m.comp)}): ${fmtBRL(m.fic)} • Planilha: ${c.mrr == null ? '—' : fmtBRL(c.mrr) + (m.semComp ? ' (competência não declarada — fora das somas)' : '')}</p>${m.div ? `<div class="alert b sm">Divergência acima de ${mrrTol()}% entre planilha e ficha: aplicada a precedência "${S.meta.mrrPrec === 'planilha' ? 'planilha' : 'ficha'}". Os valores não são somados.</div>` : ''}<p class="sm muted">Não inclui avulsos nem o faturamento operacional do cliente.</p></div>
  <div class="card boxfat"><h3>🏭 Faturamento anual do cliente <span class="sm muted">(porte — não é receita TOTVS)</span></h3><div class="kpi" style="padding:8px 14px"><span class="v" style="font-size:22px">${esc(fatTxt(c.cad.fat?.v))}</span></div><p class="sm">${c.cad.fat ? `${esc(fonteTxt(c.cad.fat.fonte))} • ${stPillC(stOf(c.cad.fat))}` : '<span class="muted">Não informado.</span>'}</p><p class="sm muted">Usado só como indicador de porte. Nunca define limite de crédito, aprovação ou elegibilidade.</p></div></div>`;
  h += `<div class="card"><div class="row"><h3>Cadastro estratégico</h3><span class="sp"></span>${compPill(c)}<span class="sm muted">completude (não é potencial comercial)</span></div>
  <div class="tw"><table><thead><tr><th>Campo</th><th>Valor</th><th>Fonte</th><th>Data de referência</th><th>Atualização</th><th>Situação</th><th></th></tr></thead><tbody>
  ${cadRow(c, 'regime', 'Regime tributário', c.fis?.regime, { sub: 'Critério regulatório entre outros' })}
  ${cadRow(c, 'hosp', 'Hospedagem', c.cad.hosp)}
  ${cadRow(c, 'release', 'Release Protheus em produção', rel ? { v: rel.v, fonte: rel.fonte, at: rel.conf, st: 'confirmado' } : relDecl ? { v: relDecl.v, fonte: relDecl.fonte, at: relDecl.at, st: 'declarado' } : null, { ro: `<button class="btn ghost sm" data-a="ctab" data-v="tecnologia">${rel ? 'Ver' : 'Confirmar'} na aba Tecnologia</button>`, sub: rel ? 'confirmada em ' + dtBR(rel.conf) : relDecl ? 'declarada — alertas só após confirmação' : '' })}
  ${cadRow(c, 'func', 'Funcionários CLT', c.cad.func, { sub: 'Contexto; nunca base de recomendação' })}
  ${cadRow(c, 'fat', 'Faturamento anual do cliente', c.cad.fat, { sub: 'Valor ou faixa, moeda e exercício' })}
  ${cadRow(c, 'filiais', 'Filiais', c.cad.filiais)}${cadRow(c, 'cds', 'Centros de distribuição', c.cad.cds)}</tbody></table></div>
  <details><summary class="sm">Critérios de completude (${comp.ok.length}/${comp.n})</summary><div class="sm">${comp.ok.map(x => pill('✓ ' + x[1], 'ok')).join(' ')} ${comp.miss.map(x => pill('✗ ' + x[1], 'off')).join(' ')}</div></details></div>`;
  const cf = (c.cadConf || []); if (cf.length) h += `<div class="card"><h3>Conflitos de importação <span class="pill p-${cf.some(x => !x.res) ? 'bad' : 'off'}">${cf.filter(x => !x.res).length} aberto(s)</span></h3><ul class="sm">${cf.map(x => `<li>${esc(x.campo)}: atual “${esc(x.de)}” × planilha “${esc(x.para)}” <span class="muted">${esc(x.fonte)} • ${dtBR(x.at)}</span> ${x.res ? pill(x.res, 'off') : `<button class="btn ghost sm" data-a="cfRes" data-k="${kk(c)}" data-id="${x.id}">Marcar como revisado (mantido)</button>`}</li>`).join('')}</ul></div>`;
  h += `<div class="card"><div class="row"><h3>Contratos</h3><span class="sp"></span><input type="text" id="ct_new" placeholder="Identificação do contrato" style="min-width:200px"><button class="btn ghost sm" data-a="ctNew" data-k="${kk(c)}">+ Contrato</button></div><p class="sm muted">Cada contrato tem seus próprios prazos. Renovação e reajuste podem ocorrer em datas diferentes; periodicidade e índice nunca são presumidos.</p>
  ${c.contratos.length ? c.contratos.map(ct => `<h4>${esc(ct.ident)}</h4><div class="tw"><table><thead><tr><th>Campo</th><th>Valor</th><th>Fonte</th><th>Data de referência</th><th>Atualização</th><th>Situação</th><th></th></tr></thead><tbody>${CT_F.map(([k, l]) => ctRow(c, ct, k, l)).join('')}</tbody></table></div>${ctReminders({ contratos: [ct] }).map(x => `<div class="alert ${x.nivel === 'alerta' ? 'b' : ''} sm">${esc(x.msg)}</div>`).join('')}`).join('') : '<p class="muted sm">Nenhum contrato registrado.</p>'}</div>`;
  const R = cadRules(c), mp = c.cadMap || {};
  h += `<div class="card"><h3>Regras explicáveis do cadastro</h3><div class="alert i sm">As regras do cadastro alimentam o <b>mesmo motor de recomendações</b> da carteira: cada item é incorporado a uma oportunidade (quando existe) e a decisão é registrada uma única vez, em quatro dimensões separadas — fundamentação, validação, contratação e situação comercial. Nenhum dado isolado gera recomendação automática.</div>
  ${R.CTX.length ? `<h4>Contexto (sem recomendação derivada)</h4><ul class="sm">${R.CTX.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${R.R.map(r => { const tid = mp[r.id], o = tid ? (c.opps || []).find(x => x.ruleId === tid) : null; return `<div class="opp" style="margin:8px 0"><div class="row"><h4>${esc(r.titulo)}</h4>${o ? pill('na oportunidade: ' + o.nome, 'info') : pill('contexto de descoberta (não é oportunidade)', 'off')}</div>
    <table class="chain"><tbody><tr><th>Evidência</th><td>${r.evid.map(esc).join('<br>')}</td></tr><tr><th>Hipótese ou necessidade</th><td>${chip('HIPÓTESE')} ${esc(r.hip)}</td></tr><tr><th>Solução possível</th><td>${r.sols.length ? r.sols.map(esc).join(', ') : '<span class="muted">—</span>'}</td></tr><tr><th>Dependências</th><td><ul class="sm">${r.deps.map(d => `<li>${esc(d)}</li>`).join('')}</ul></td></tr><tr><th>Pergunta de validação</th><td><ul class="sm">${r.perg.map(d => `<li>${esc(d)}</li>`).join('')}</ul></td></tr><tr><th>Próxima ação</th><td>${esc(r.acao)}</td></tr></tbody></table>
    ${o ? dimsHtml(c, o) + decCtl(c, o) : ''}</div>`; }).join('') || '<p class="muted sm">Nenhuma regra disparada com os dados atuais.</p>'}
  ${R.Q.length ? `<h4>Perguntas de descoberta (dados ausentes)</h4><ul class="sm">${R.Q.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  return h;
}
function ctRow(c, ct, k, l) {
  const cur = ct[k], v = cur?.v, ed = UI.cadEd === c.key + '|' + ct.id + '|' + k;
  return `<tr><td>${esc(l)}</td><td>${v == null ? '<span class="muted">não informado</span>' : esc(cadTxt(k, v))}</td><td class="sm">${cur ? esc(fonteTxt(cur.fonte)) : '—'}</td><td class="sm nw">${fmtD(cur?.dref)}</td><td class="sm nw">${cur?.at ? dtBR(cur.at) : '—'}</td><td>${v != null ? stPillC(stOf(cur)) : ''}</td><td><button class="btn ghost sm" data-a="ctEd" data-k="${kk(c)}" data-id="${ct.id}" data-f="${k}">Editar</button></td></tr>
  ${ed ? `<tr class="edit"><td colspan="7"><div class="row sm"><input id="cte_v" type="${k === 'indice' ? 'text' : 'date'}" value="${esc(v || '')}" ${k === 'indice' ? 'placeholder="ex.: IPCA"' : ''}><input id="cte_f" type="text" placeholder="Fonte * (contrato, aditivo…)" style="min-width:220px"><select id="cte_st">${optS('declarado', 'Declarado', 'declarado')}${optS('confirmado', 'Confirmado (verificado no contrato)', '')}</select><input id="cte_m" type="text" placeholder="Motivo"><button class="btn sm" data-a="ctSave" data-k="${kk(c)}" data-id="${ct.id}" data-f="${k}">Salvar</button><button class="btn ghost sm" data-a="cadCancel">Cancelar</button></div></td></tr>` : ''}`;
}

/* ---------- Importação: prévia ---------- */
function impPreview() {
  const w = UI.wiz, P = impPlan(), s = P.sum, show = P.rows.filter(r => r.act !== 'atualizar' || r.ch.length || r.cf.length || r.warn.length || r.amb).slice(0, 300);
  const fmtV = (k, v) => v == null || v === '' ? '∅' : typeof v === 'object' ? fatTxt(v) : k === 'hosp' ? HOSP[v] || v : String(v);
  return `<div class="card" style="border-color:var(--ciano2)"><h3>Prévia da importação — ${esc(w.name)}</h3><div class="alert i sm">Nada foi gravado ainda. Correspondência por código TOTVS ou CNPJ; razão social é só sugestão. Células vazias preservam o valor existente. Valores importados entram como <b>declarados</b>; informações confirmadas só são substituídas com sua escolha.</div>
  <div class="row sm">${pill(s.novo + ' novo(s)', 'info')}${pill(s.atualizar + ' a atualizar', 'ok')}${pill(s.igual + ' sem alteração', 'off')}${pill(s.ignorar + ' ignorada(s)', 'off')}${s.cont ? pill(s.cont + ' linha(s) de contrato adicional', 'info') : ''}${s.pendente ? pill(s.pendente + ' ambígua(s) — decidir', 'bad') : ''}${s.cf ? pill(s.cf + ' conflito(s) com dado confirmado', 'warn') : ''}${pill(s.keep + ' campo(s) preservado(s) (célula vazia)', 'off')}${s.warn ? pill(s.warn + ' aviso(s)', 'warn') : ''}</div>
  <label class="sm"><input type="checkbox" data-c="impClear" ${w.opt?.clear ? 'checked' : ''}> Limpar campos existentes quando a célula estiver vazia (desmarcado = preservar)</label>
  <div class="tw" style="max-height:420px"><table><thead><tr><th>Linha</th><th>Identificação</th><th>Ação</th><th>Alterações</th><th>Conflitos / avisos</th></tr></thead><tbody>${show.map(r => `<tr><td>${r.line}</td><td class="sm"><b>${esc(r.name || '—')}</b><div class="muted">${esc(r.code || 'sem código')} • ${r.cnpj.length === 14 ? fmtCnpj(r.cnpj) : 'sem CNPJ'}</div></td>
    <td class="sm">${r.amb || r.dupOf ? `<select data-c="impRes" data-i="${r.i}"><option value="auto">${r.amb ? '— escolher —' : 'Ignorar (repetida)'}</option>${r.cands.map(c => optS(c.key, `Atualizar: ${c.name} (${c.by})`, w.res[r.i])).join('')}${optS('novo', 'Criar novo cliente', w.res[r.i])}${optS('ignorar', 'Ignorar linha', w.res[r.i])}</select>${r.amb ? '<div>' + pill('correspondência ambígua', 'bad') + '</div>' : ''}` : r.cont ? pill('contrato adicional', 'info') + `<div class="muted">mesma conta da linha ${r.cont.line}</div>` : r.act === 'novo' ? pill('novo', 'info') : r.act === 'ignorar' ? pill('ignorar', 'off') : pill('atualizar', 'ok') + `<div class="muted">${esc(S.clients[r.target]?.name || '')}</div>`}</td>
    <td class="sm">${r.ch.length ? `<ul>${r.ch.map(x => `<li>${esc(x.l)}: ${esc(fmtV(x.k, x.de))} → <b>${esc(fmtV(x.k, x.para))}</b>${x.clear ? ' ' + pill('limpar', 'warn') : ''}</li>`).join('')}</ul>` : '<span class="muted">—</span>'}</td>
    <td class="sm">${r.cf.map(x => `<div>${pill('confirmado', 'ok')} ${esc(x.l)}: “${esc(x.de)}” × planilha “${esc(x.para)}” ${x.info ? `<div class="muted">${esc(x.info)}</div>` : `<select data-c="impCf" data-id="${esc(x.id)}">${optS('manter', 'Manter o confirmado', w.cf[x.id] || 'manter')}${optS('substituir', 'Substituir pela planilha (fica declarado)', w.cf[x.id] || 'manter')}</select>`}</div>`).join('')}${r.warn.map(x => `<div style="color:var(--lar)">⚠ ${esc(x)}</div>`).join('')}</td></tr>`).join('')}</tbody></table></div>${P.rows.length > show.length ? `<p class="muted sm">${P.rows.length - show.length} linha(s) sem alteração não exibidas.</p>` : ''}
  <div class="row"><button class="btn pri" data-a="impGo" ${s.pendente ? 'disabled title="Resolva as correspondências ambíguas"' : ''}>Confirmar importação</button><button class="btn ghost" data-a="impBack">Voltar ao mapeamento</button><button class="btn ghost" data-a="cancelWiz">Cancelar</button></div></div>`;
}
function unmappedFat() { const w = UI.wiz; if (!w) return []; const sh = w.sheets[w.si], hdr = (sh.rows[w.h] || []).map(x => String(x ?? '')), used = new Set(Object.values(w.map)); return hdr.map((x, i) => [x, i]).filter(([x, i]) => !used.has(i) && /fatura|receita/i.test(norm(x))); }

/* ---------- Base de Soluções: painel das 24 referências e notas internas ---------- */
function ref24Panel() {
  const D = refDec(), pend = new Set(refPending().map(p => p.id));
  const rows = REF24.all.map(it => { const tgt = it.kind === 'sol' ? (S.solutions.find(s => s.id === it.rec.id) || (it.rec.sigla ? S.solutions.find(s => s.sigla === it.rec.sigla) : null)) : S.solutions.find(s => s.id === it.alvo);
    const dec = D[it.id] || (pend.has(it.id) ? 'pendente' : '—'); const gravado = dec === 'aprovado' && tgt ? (!META ? 'em memória (sem persistência)' : dirtyS.has(tgt.id) ? 'gravando…' : 'gravado') : '—';
    return { it, tgt, dec, gravado, st: it.kind === 'solfix' ? 'corrigida' : it.rec?.refStatus || 'pendente' }; });
  const n = { ap: rows.filter(r => r.dec === 'aprovado').length, pe: rows.filter(r => r.dec === 'pendente').length, gr: rows.filter(r => r.gravado === 'gravado').length };
  return `<details class="card" ${UI.r24 || n.pe ? 'open' : ''} id="r24"><summary><b>Referências consolidadas (${REF24.items.length} + ${REF24.extras.length} complementos/correções)</b> — ${n.ap} aprovada(s), ${n.gr} gravada(s), ${n.pe} pendente(s) de revisão</summary>
  <div class="alert i sm">Pesquisa em fontes oficiais (TDN, Central de Atendimento, documentação TOTVS) em ${fmtD(REF24.consultadoEm)}. Nada entra na base antes da sua aprovação; registros existentes recebem complemento e conflitos ficam pendentes no próprio registro (sem substituição silenciosa). "Gravado" só aparece após a gravação confirmada.</div>
  <div class="row"><button class="btn sm" data-a="r24All" ${n.pe ? '' : 'disabled'}>Aprovar todas as pendentes com fonte oficial</button><span class="muted sm">Pendentes também aparecem em "Releases e regulatório".</span></div>
  <div class="tw"><table><thead><tr><th>ID interno</th><th>Sigla oficial</th><th>Nome oficial / alvo</th><th>Grupo</th><th>Operação</th><th>Validação</th><th>Decisão</th><th>Gravação</th><th></th></tr></thead><tbody>${rows.map(r => { const it = r.it;
    return `<tr><td class="nw"><b>${esc(it.ref)}</b></td><td>${esc(it.rec?.sigla || (it.kind === 'solcomp' ? it.set?.sigla || '—' : '—'))}</td><td class="sm">${esc(it.kind === 'sol' ? it.rec.nome : it.kind === 'solfix' ? it.novo : '(complemento)')}<div class="muted">${it.kind === 'sol' ? (r.tgt && r.tgt.id !== it.rec.id ? 'existente com mesma sigla: ' + esc(r.tgt.nome) : '') : 'alvo: ' + esc(r.tgt?.nome || it.alvo)}</div></td><td class="sm">${esc(it.grupo)}</td><td class="sm">${it.kind === 'sol' ? (r.tgt ? 'complementar existente' : 'novo registro') : it.kind === 'solcomp' ? 'complementar existente' : 'correção sugerida (pendente)'}</td>
    <td>${pill(REF_ST[r.st] || r.st, REF_STK[r.st] || 'off')}${it.rec?.refNota || it.nota ? `<div class="muted sm" style="max-width:320px">${esc(it.rec?.refNota || it.nota)}</div>` : ''}</td><td>${pill(r.dec, r.dec === 'aprovado' ? 'ok' : r.dec === 'pendente' ? 'warn' : 'off')}</td><td class="sm">${esc(r.gravado)}</td>
    <td class="nw">${r.dec === 'pendente' ? `<button class="btn sm" data-a="refOk" data-id="${it.id}">Aprovar</button><button class="btn ghost sm" data-a="refNo" data-id="${it.id}">Descartar</button>` : r.tgt ? `<button class="btn ghost sm" data-a="solView" data-id="${r.tgt.id}">Ver</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></details>`;
}
function solNotesSec(r) {
  const N = r.notasInt || [];
  return `<div class="card" style="background:#fffbea;border-left:4px solid var(--lar)"><h4>Notas comerciais internas (${N.length}) <span class="pill p-warn">não é informação oficial</span></h4><p class="muted sm">Separadas da documentação oficial; não aparecem como fonte nem no PDF em modo cliente.</p>${N.length ? `<ul class="sm">${N.map((n, i) => `<li>${esc(n.t)} <span class="muted">${dtBR(n.at)}</span> <button class="btn ghost sm" data-a="solNotaRm" data-id="${r.id}" data-i="${i}">Remover</button></li>`).join('')}</ul>` : ''}<div class="row"><input type="text" id="sn_t" placeholder="Nota interna (ex.: argumento comercial, experiência de implantação)" style="min-width:380px"><button class="btn ghost sm" data-a="solNota" data-id="${r.id}">Adicionar nota interna</button></div></div>`;
}
function solOfficialHead(r) {
  const p = r.prerequisitos || [];
  return `<div class="card" style="border-left:4px solid var(--ok);margin:8px 0"><h4>Informação oficial ${pill('fontes oficiais', 'ok')}</h4><p class="sm">Sigla oficial: <b>${esc(r.sigla || '—')}</b> • ID interno: <b>${esc(r.refId || '—')}</b>${r.codOferta ? ` • Código de oferta: <b>${esc(r.codOferta)}</b>` : ''} • Grupo: ${esc(r.grupo || '—')} • Validação: ${r.refStatus ? pill(REF_ST[r.refStatus], REF_STK[r.refStatus]) : pill('sem situação registrada', 'off')}</p>${r.refNota ? `<p class="sm"><b>Nota de validação:</b> ${esc(r.refNota)}</p>` : ''}${r.finalidade ? `<p class="sm"><b>Finalidade:</b> ${esc(r.finalidade)}</p>` : ''}${(r.processos || []).length ? `<p class="sm"><b>Processos:</b> ${r.processos.map(esc).join(' • ')}</p>` : ''}${p.some(x => x.escopo) ? `<p class="sm"><b>Requisitos por funcionalidade/integração:</b></p><ul class="sm">${p.filter(x => x.escopo).map(x => `<li><b>${esc(x.escopo)}</b>: ${esc(x.t)} ${x.u ? `<a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.f || hostOf(x.u))}</a>` : esc(x.f || '')}</li>`).join('')}</ul>` : ''}${(r.lacunas || []).length ? `<div class="alert sm"><b>Lacunas:</b> ${r.lacunas.map(esc).join(' ')}</div>` : ''}<p class="muted sm">Consulta: ${esc(r.consultadoEm || r.atualizadoEm)}</p></div>`;
}

function retbl() { const t = $('#tbl'); if (t) t.innerHTML = tbl(); const f = $('#fch'); if (f) f.innerHTML = fchips(); const b = $('#fbtn'); if (b) b.textContent = fbtnTxt(); }
