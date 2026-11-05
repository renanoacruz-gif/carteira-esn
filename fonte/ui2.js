/* ===== FICHAS POR CLIENTE, AVISOS, COBERTURA, MUDANÇAS ===== */
const FPILL = { nao_carregada: 'off', processando: 'info', disponivel: 'ok', revisao: 'bad', desatualizada: 'warn' };
const fPill = c => `<span class="pill p-${FPILL[c.fstat.k]}" title="${esc(c.fstat.why.join(' | '))}">${esc(c.fstat.l)}</span>`;
const upBtn = (c, cls = 'ghost') => `<label class="btn ${cls} sm noopen" style="cursor:pointer">Anexar ficha<input type="file" data-c="attach" data-k="${esc(c.key)}" data-t="ficha" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md" hidden></label>`;
const dtBR = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
const ST_F = { confirmado: ['vínculo confirmado', 'ok'], sugerido: ['vínculo sugerido', 'warn'], divergente: ['identificação divergente', 'bad'] };

function clientBanner(c) {
  const parts = [];
  if (partial(c)) parts.push(`<div class="alert b"><b>Análise parcial: contratação e faturamento ainda não conferidos.</b><div class="sm">${c.fstat.k === 'nao_carregada' ? esc(MSG_SEM_FICHA) : esc(c.fstat.l + ': ' + (c.fstat.why[0] || ''))} Ausência de ficha ou de item faturado não prova que o cliente não possui uma solução.</div></div>`);
  else if (c.fstat.k !== 'disponivel') parts.push(`<div class="alert"><b>Ficha: ${esc(c.fstat.l)}.</b> ${esc(c.fstat.why[0] || '')}</div>`);
  const fl = c.reviewFlags || []; if (fl.length) parts.push(`<div class="alert i"><b>Base de Soluções atualizada:</b> ${fl.length} diagnóstico(s) podem precisar de revisão (${fl.slice(0, 3).map(x => esc(x.nome)).join(', ')}${fl.length > 3 ? '…' : ''}). Análises anteriores continuam registradas em “O que mudou”.</div>`);
  return parts.join('');
}

function fichaBlock(c, f) {
  const k = esc(c.key), st = ST_F[f.state] || ST_F.confirmado, confirm = UI.confirm === 'del:' + f.id;
  const kopts = cur => Object.entries(KIND_LABEL).map(([kk, l]) => `<option value="${kk}" ${cur === kk ? 'selected' : ''}>${l}</option>`).join('');
  const bord = f.state === 'divergente' ? 'var(--bad)' : f.state === 'sugerido' ? 'var(--lar)' : 'var(--ok)';
  return `<div class="card" style="margin:8px 0;border-left:4px solid ${bord}"><div class="row"><b>${esc(f.file)}</b><span class="muted sm">${esc(f.loc)}</span>${pill(...st)}<span class="sm muted">por ${esc(f.by || '—')}</span><span class="sp"></span>
  <label class="btn ghost sm" style="cursor:pointer">Substituir arquivo<input type="file" data-c="replF" data-k="${k}" data-id="${f.id}" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md" hidden></label>
  ${f.state === 'sugerido' ? `<button class="btn sm" data-a="confF" data-k="${k}" data-id="${f.id}" data-t="ficha">Confirmar vínculo</button>` : ''}<button class="btn ghost sm" data-a="rejF" data-k="${k}" data-id="${f.id}" data-t="ficha" title="Envia para Pendências de associação">Desvincular</button>
  ${confirm ? `<button class="btn dng sm" data-a="delF" data-k="${k}" data-id="${f.id}">Confirmar exclusão</button><button class="btn ghost sm" data-a="delF0">Cancelar</button>` : `<button class="btn dng sm" data-a="delF1" data-id="${f.id}">Excluir</button>`}</div>
  ${f.state === 'divergente' ? `<div class="alert b sm"><b>Revisão necessária.</b> ${esc(f.divergencia?.msg || '')} Os itens desta ficha NÃO entram na análise até a revisão.<div class="row" style="margin-top:6px"><button class="btn sm" data-a="confF" data-k="${k}" data-id="${f.id}" data-t="ficha">Confirmar que pertence a este cliente</button><input type="text" placeholder="Mover para: código ou CNPJ do cliente correto" data-c="moveF" data-k="${k}" data-id="${f.id}" style="min-width:290px"></div></div>` : ''}
  ${f.state === 'sugerido' ? '<div class="alert sm">Itens desta ficha NÃO entram na análise até confirmar o vínculo.</div>' : ''}
  ${f.dupComps?.length ? `<div class="alert sm">${pill('competência repetida', 'warn')} Já existe ficha utilizável para ${f.dupComps.map(esc).join(', ')}. Itens idênticos são ignorados na soma; se for versão corrigida, use “Substituir arquivo” na ficha antiga.</div>` : ''}
  <div class="row sm" style="margin:6px 0"><span>Competência: ${f.comp ? `<b>${esc(f.comp)}</b> ${chip(/expl|manual/.test(f.compMode || '') ? 'FATO' : 'INFERÊNCIA')} <span class="muted">(${esc(f.compMode)})</span>` : '<b style="color:var(--bad)">não identificada</b>'}</span>
  <label class="sm">${f.comp ? 'Corrigir' : 'Informar'} competência <input type="month" value="${esc(f.comp || '')}" data-c="fcomp" data-k="${k}" data-id="${f.id}"></label><span class="muted">• Carregada em <b>${dtBR(f.at)}</b> (data de upload ≠ competência)</span></div>
  <div class="sm" style="margin-bottom:6px">Modalidade: ${f.modalidade ? `${esc(f.modalidade.term)} ${chip('FATO')} <span class="muted">"…${esc(f.modalidade.snip)}…"</span>` : '<span class="muted">não identificada (não deduzida)</span>'}${f.splitFromBatch ? ` • ${chip('INFERÊNCIA')} dividida de arquivo em lote${f.inferredLines ? ` (${f.inferredLines} linhas sem identificador atribuídas ao bloco anterior)` : ''}` : ''}${f.itemsTrunc ? ` • ${pill('exibindo 150 de ' + f.itemsTrunc + ' itens', 'warn')}` : ''}</div>
  <details><summary>Ver conteúdo extraído (${(f.items || []).length} itens)</summary><p class="muted sm">O arquivo original não é armazenado (limite do banco do artefato): ficam os itens e o trecho de texto lido abaixo. Para ver o original, reenvie o arquivo.</p>
  <div class="tw" style="max-height:300px"><table><thead><tr><th>Local</th><th>Descrição</th><th>Competência</th><th>Classe (inferida — editável)</th><th class="r">Valor</th></tr></thead><tbody>${(f.items || []).map(i => `<tr style="${i.kind === 'total' || i.kind === 'imposto' || i.dup ? 'opacity:.55' : ''}"><td class="sm nw">${esc(i.loc)}</td><td>${esc(i.desc)}${i.dup ? ' ' + pill('duplicado em outro arquivo', 'warn') : ''}</td><td class="sm nw">${esc(i.comp || '—')}</td><td><select data-c="kind" data-k="${k}" data-f="${f.id}" data-i="${i.id}">${kopts(i.kind)}</select> <span class="chip ${i.kindMode === 'manual' ? 'c-fato' : 'c-inf'}">${i.kindMode === 'manual' ? 'MANUAL' : 'INFERÊNCIA'}</span></td><td class="r nw">${i.vals.length > 1 ? `<select data-c="vi" data-k="${k}" data-f="${f.id}" data-i="${i.id}">${i.vals.map((v, n) => `<option value="${n}" ${n === i.vi ? 'selected' : ''}>${fmtBRL(v)}</option>`).join('')}</select>` : fmtBRL(i.vals[0])}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhum item monetário identificado nesta ficha.</td></tr>'}</tbody></table></div>
  <details style="margin-top:6px"><summary class="sm">Texto lido (primeiros 3.000 caracteres)</summary><pre class="sm" style="white-space:pre-wrap;max-height:200px;overflow:auto">${esc(f.matchText || '')}</pre></details></details></div>`;
}

function fichasSection(c) {
  const fs = c.fstat, k = esc(c.key), ref = refCompOf(S), rec = recurringByComp(c), rc = Object.keys(rec).sort();
  const byC = {}; fichasOk(c).forEach(f => fichaComps(f).forEach(cp => (byC[cp] ||= new Set()).add(f.file))); const dupC = Object.entries(byC).filter(([, a]) => a.size > 1);
  const sorted = [...c.fichas].sort((a, b) => (fichaComps(b).slice(-1)[0] || '').localeCompare(fichaComps(a).slice(-1)[0] || '') || (b.at || '').localeCompare(a.at || ''));
  let h = `<div class="card" id="fichas"><div class="row"><h3>Fichas de Faturamento</h3>${fPill(c)}<span class="sm muted">referência: <b>${esc(ref)}</b>${S.meta.refComp ? '' : ' (automática: mês anterior)'}${fs.last ? ` • última competência: <b>${esc(fs.last)}</b>` : ''}</span><span class="sp"></span>
  <label class="btn ${c.fichas.length ? 'ghost' : 'pri'} sm" style="cursor:pointer">${c.fichas.length ? '+ Anexar outra competência' : 'Anexar primeira ficha'}<input type="file" data-c="attach" data-k="${k}" data-t="ficha" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md" hidden></label>
  <label class="btn ghost sm" style="cursor:pointer">+ Documento complementar<input type="file" data-c="attach" data-k="${k}" data-t="doc" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md" hidden></label></div>
  <p class="muted sm">O arquivo é validado contra este cliente (código TOTVS, CNPJ ou razão social). Se divergir, fica retido para revisão e não entra na análise.</p>`;
  if (fs.k === 'nao_carregada') h += `<div class="alert b">${esc(MSG_SEM_FICHA)}</div>`;
  else if (fs.why.length) h += `<div class="alert ${fs.k === 'revisao' ? 'b' : ''}"><b>${esc(fs.l)}</b><ul class="sm" style="margin:4px 0 0">${fs.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
  (c.fichaErr || []).forEach(e => { h += `<div class="alert b sm"><div class="row"><b>${pill('erro de processamento', 'bad')} ${esc(e.file)}</b><span class="muted">enviado em ${dtBR(e.at)}</span><span class="sp"></span><button class="btn ghost sm" data-a="dismErr" data-k="${k}" data-id="${e.id}">Remover registro</button></div>${esc(e.msg)} — o arquivo <b>não</b> conta como “não carregada”: corrija e reenvie.</div>`; });
  if (dupC.length) h += `<div class="alert sm">${pill('competência em mais de um arquivo', 'warn')} ${dupC.map(([cp, a]) => `${esc(cp)}: ${[...a].map(esc).join(' × ')}`).join(' • ')} — itens idênticos não são somados duas vezes; confira se é reenvio.</div>`;
  if (rc.length) h += `<div class="alert i sm"><b>Recorrente por competência</b> ${chip('INFERÊNCIA')} (emitido ≠ recebido; competências nunca somadas): ${rc.map(kk => `${esc(kk)}: <b>${fmtBRL(rec[kk])}</b>`).join(' • ')}</div>`;
  if (sorted.length) h += `<h4>Histórico (${sorted.length})</h4><div class="tw"><table><thead><tr><th>Competência</th><th>Carregada em</th><th>Arquivo</th><th>Estado</th></tr></thead><tbody>${sorted.map(f => `<tr><td class="nw">${f.comp ? `<b>${esc(f.comp)}</b>` : '<span style="color:var(--bad)">desconhecida</span>'} <span class="muted sm">${esc(f.compMode ? f.compMode.split(' ')[0] : '')}</span>${fichaComps(f).length > 1 ? ` <span class="muted sm">+ ${fichaComps(f).filter(x => x !== f.comp).join(', ')}</span>` : ''}</td><td class="nw">${dtBR(f.at)}</td><td>${esc(f.file)}</td><td>${pill(...(ST_F[f.state] || ST_F.confirmado))}</td></tr>`).join('')}</tbody></table></div>${sorted.map(f => fichaBlock(c, f)).join('')}`;
  if (c.docs.length) h += `<h4 style="margin-top:12px">Documentos complementares</h4>${c.docs.map(d => `<div class="row sm" style="padding:4px 0"><b>${esc(d.name)}</b>${d.state === 'sugerido' ? pill('vínculo sugerido', 'warn') : ''}<span class="muted">por ${esc(d.by || '—')}${d.trunc ? ' • texto truncado em 12 mil caracteres' : ''}</span><span class="sp"></span>${d.state === 'sugerido' ? `<button class="btn sm" data-a="confF" data-k="${k}" data-id="${d.id}" data-t="doc">Confirmar</button>` : ''}<button class="btn dng sm" data-a="rejF" data-k="${k}" data-id="${d.id}" data-t="doc">Desvincular</button></div>`).join('')}`;
  return h + '</div>';
}

/* Separação das fontes da análise */
function baseAnaliseCard(c) {
  const pl = [c.productsRaw && `Produtos informados: ${c.productsRaw}`, c.mrr != null && `MRR (autodeclarado): ${fmtBRL(c.mrr)}`, c.seg && `Segmento: ${c.seg}`, c.churn && `Churn/risco: ${c.churn}`, c.nps && `NPS: ${c.nps}`].filter(Boolean);
  const fi = c.productsIdent.map(p => ({ p, ev: p.ev.filter(e => e.src !== 'Planilha' && fichasOk(c).some(f => f.file === e.src)) })).filter(x => x.ev.length);
  const rec = recurringByComp(c), seg = KB.segments.find(s => s.id === c.segInfo.id);
  const sector = seg ? seg.tendencias.slice(0, 3).map(t => t.t) : [];
  const pes = (S.pesq || []).filter(p => p.status === 'incorporada' && (p.alvoKey === c.key || (p.alvoSeg && p.alvoSeg === c.segInfo.id)));
  const hip = c.opps.map(o => `${o.nome} — ${o.modo === 'investigacao' ? 'investigação recomendada' : 'hipótese com indício individual'} (score ${o.score})`);
  const col = (t, tag, body) => `<div class="card" style="margin:0"><h4>${t} ${tag}</h4>${body}</div>`;
  const ul = a => a.length ? `<ul class="sm" style="margin:4px 0;padding-left:16px">${a.map(x => `<li>${x}</li>`).join('')}</ul>` : '<span class="muted sm">Nada registrado.</span>';
  return `<div class="card"><h3>Base da análise <span class="muted sm">(o que é confirmado, por qual fonte)</span></h3><div class="grid g2">
  ${col('Confirmado pela planilha', chip('FATO'), ul(pl.map(esc)))}
  ${col('Confirmado pela ficha', chip('FATO'), fi.length || Object.keys(rec).length ? ul([...fi.map(x => `<b>${esc(x.p.nome)}</b> em ${esc(x.ev[0].src)} ${esc(x.ev[0].loc || '')}`), ...Object.keys(rec).sort().map(k => `Recorrente ${esc(k)}: ${fmtBRL(rec[k])} ${chip('INFERÊNCIA')}`)]) : `<span class="muted sm">${partial(c) ? 'Sem ficha utilizável — contratação e faturamento não conferidos.' : 'Nenhum produto/valor identificado nas fichas.'}</span>`)}
  ${col('Contexto setorial pesquisado', chip('FATO'), ul([...sector.map(esc), ...pes.map(p => `Pesquisa de IA incorporada (${esc(dtBR(p.at))}): ${esc(p.resumo || p.alvo)}`)]))}
  ${col('Hipóteses comerciais pendentes', chip('HIPÓTESE'), ul(hip.map(esc)))}</div>
  <p class="muted sm" style="margin-top:8px">Ausência de ficha ou de item faturado significa “não identificado nos documentos”, nunca “o cliente não possui a solução”.</p></div>`;
}

function changesCard(c) {
  const ch = c.changes || [], fl = c.reviewFlags || []; if (!ch.length && !fl.length) return '';
  const blk = x => `<div style="margin:6px 0"><b class="sm">${esc(dtBR(x.at))} ${new Date(x.at).toLocaleTimeString('pt-BR').slice(0, 5)} — ${esc(x.reason)}</b><ul class="sm" style="margin:2px 0">${x.items.map(i => `<li>${i.reav ? pill('reavaliar', 'warn') + ' ' : ''}${esc(i.t)}</li>`).join('')}</ul></div>`;
  return `<div class="card" style="border-left:4px solid var(--ciano)"><h3>O que mudou na análise</h3>
  ${fl.length ? `<div class="alert i sm"><b>Diagnósticos a revisar (Base de Soluções atualizada)</b>${fl.map(x => `<div class="row" style="padding:2px 0"><span>${esc(x.nome)} — ${esc(x.motivo)} (rev ${x.rev}, ${esc(dtBR(x.at))})</span><span class="sp"></span><button class="btn ghost sm" data-a="markRev" data-k="${esc(c.key)}" data-id="${esc(x.solId)}">Marcar como revisado</button></div>`).join('')}<div class="muted">Análises anteriores não foram apagadas: o histórico abaixo as preserva.</div></div>` : ''}
  ${ch[0] ? `<h4>Última atualização</h4>${blk(ch[0])}` : ''}${ch.length > 1 ? `<details><summary class="sm">Histórico (${ch.length - 1} anteriores)</summary>${ch.slice(1).map(blk).join('')}</details>` : ''}</div>`;
}

/* Painel de cobertura documental */
function covCard(s, forExport) {
  const n = s.n, cnt = k => s.cs.filter(c => c.fstat.k === k).length, com = s.cs.filter(c => !partial(c)).length;
  const kp = (v, l, nn, c = '') => `<div class="kpi ${c}"><div class="v">${v}</div><div class="l">${l}</div><div class="n">${nn}</div></div>`;
  const pend = s.cs.filter(c => c.fstat.k !== 'disponivel').sort((a, b) => ['nao_carregada', 'revisao', 'processando', 'desatualizada'].indexOf(a.fstat.k) - ['nao_carregada', 'revisao', 'processando', 'desatualizada'].indexOf(b.fstat.k) || a.name.localeCompare(b.name));
  const ref = refCompOf(S);
  return `<div class="card" id="cob"><div class="row"><h3>Cobertura documental — fichas de faturamento</h3><span class="sp"></span>${forExport ? `<span class="sm muted">Competência de referência: ${esc(ref)}</span>` : `<label class="sm">Competência de referência <input type="month" value="${esc(ref)}" data-c="refcomp"></label>${S.meta.refComp ? '<button class="btn ghost sm" data-a="refAuto">Automática</button>' : '<span class="muted sm">(automática: mês anterior)</span>'}`}</div>
  <div class="grid g4">${kp(cnt('nao_carregada'), 'Sem ficha', 'ficha não carregada', 'r')}${kp(com, 'Com ficha utilizável', `${s.pct(com, n)}% de cobertura documental`, 'm')}${kp(cnt('revisao') + cnt('processando'), 'Revisão necessária', `${cnt('processando')} em processamento`, 'w')}${kp(cnt('desatualizada'), 'Desatualizadas', `última competência < ${esc(ref)}`, 'w')}</div>
  <p class="muted sm">Cobertura = clientes com ao menos uma ficha confirmada e utilizável ÷ clientes da carteira. Avisos existem apenas dentro do aplicativo (sem e-mail ou mensagens externas).</p>
  ${forExport ? '' : `<div class="row"><button class="btn sm" data-a="filtSem">Filtrar clientes sem ficha de faturamento</button></div>`}
  <h4>Pendências nominais (${pend.length})</h4>${pend.length ? `<div class="tw" style="max-height:340px"><table><thead><tr><th>Cliente</th><th>Status</th><th>Motivo</th>${forExport ? '' : '<th></th>'}</tr></thead><tbody>${pend.slice(0, forExport ? 40 : 150).map(c => `<tr class="clk" ${forExport ? '' : `data-a="open" data-k="${esc(c.key)}"`}><td><b>${esc(c.name)}</b><div class="muted sm">${esc(c.code)}</div></td><td>${fPill(c)}</td><td class="sm">${esc(c.fstat.k === 'nao_carregada' ? 'Ficha não carregada.' : c.fstat.why[0] || '')}</td>${forExport ? '' : `<td>${upBtn(c)}</td>`}</tr>`).join('')}</tbody></table></div>${pend.length > (forExport ? 40 : 150) ? `<p class="muted sm">Mostrando ${forExport ? 40 : 150} de ${pend.length}; use o filtro em Clientes.</p>` : ''}` : '<p class="muted">Todos os clientes com ficha disponível.</p>'}</div>`;
}
