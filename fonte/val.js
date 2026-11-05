/* ===== Avaliação do ESN + Validação com documentos reais (R13 §1, §5, §6) =====
   c.aval[ruleId]  = { classe, semAderencia, evidErrada, correcao, proxAcao, ajuste, at, hist[] }   (qualidade da análise — NÃO é a decisão da oportunidade)
   c.valid         = { docs:{[hash]:{res,perdeu,incorreto,formato,orig,at}}, naoIdent:[{id,t,why,at}], dim:{[k]:{nivel,nota}}, obs }
   S.meta.motorSug = { [ruleId]: { st:'analisada'|'descartada', nota, at } }  (sugestões de ajuste: sempre revisadas por humano, nunca aplicadas sozinhas) */
const AV_CL = { faz_sentido: ['Faz sentido', 'ok'], ajuste: ['Precisa de ajuste', 'warn'], generica: ['Genérica', 'warn'], incorreta: ['Incorreta', 'bad'], atendida: ['Já atendida', 'off'] };
const AV_DIM = [['extracao', 'Fidelidade da extração dos documentos'], ['assoc', 'Acerto da associação dos documentos ao cliente'], ['necess', 'Necessidades relevantes encontradas'], ['incorr', 'Recomendações incorretas ou genéricas'], ['fontes', 'Qualidade das fontes'], ['util', 'Utilidade das perguntas e próximas ações']];
const AV_NV = { boa: 'Boa', parcial: 'Parcial', fraca: 'Fraca', na: 'Não avaliada' };
const avGet = (c, id) => (c.aval || {})[id] || null;
function avSave(key, id, patch) {
  const c = S.clients[key]; if (!c) return; c.aval ||= {}; const cur = c.aval[id] || {}, n = { ...cur, ...patch, at: nowISO() };
  n.hist = [{ at: n.at, classe: n.classe, correcao: n.correcao || '' }, ...(cur.hist || [])].slice(0, 8);
  c.aval[id] = n; touchC(key); render();
}
function avQuick(key, id, cl) { if (!AV_CL[cl]) return; avSave(key, id, { classe: cl }); toast('Avaliação registrada (não altera a decisão da oportunidade).', 'ok'); }
function avForm(key, id) {
  const g = k => ($('#av_' + k)?.value || '').trim().slice(0, 1200), cl = $('#av_cl')?.value;
  if (!AV_CL[cl]) return toast('Escolha a avaliação.', 'bad');
  if ((cl === 'incorreta' || cl === 'ajuste' || cl === 'generica') && !g('co')) return toast('Informe a correção e a justificativa comercial.', 'bad');
  avSave(key, id, { classe: cl, semAderencia: !!$('#av_sa')?.checked, evidErrada: g('ev'), correcao: g('co'), proxAcao: g('px'), ajuste: g('aj') });
  toast('Avaliação do ESN registrada.', 'ok');
}
function avClear(key, id) { const c = S.clients[key]; if (!c?.aval?.[id]) return; delete c.aval[id]; touchC(key); render(); }
function avPill(c, o) { const a = avGet(c, o.ruleId); return a?.classe ? pill('ESN: ' + AV_CL[a.classe][0], AV_CL[a.classe][1]) : ''; }
function avBar(c, o) {
  const a = avGet(c, o.ruleId), k = esc(c.key), id = esc(o.ruleId);
  return `<div class="row sm" style="gap:4px;margin:4px 0"><span class="muted">Avaliação do ESN (qualidade da análise):</span>${Object.entries(AV_CL).map(([cl, [l]]) => `<button class="btn ${a?.classe === cl ? 'pri' : 'ghost'} sm" data-a="avQuick" data-k="${k}" data-id="${id}" data-cl="${cl}">${l}</button>`).join('')}</div>`;
}
function avDiagSec(c, o) {
  const a = avGet(c, o.ruleId) || {}, id = o.ruleId;
  const ta = (k, l, ph) => `<label class="sm"><b>${l}</b><textarea id="av_${k}" rows="2" placeholder="${ph}" style="width:100%">${esc(a[{ ev: 'evidErrada', co: 'correcao', px: 'proxAcao', aj: 'ajuste' }[k]] || '')}</textarea></label>`;
  return `<div class="card"><h3>Avaliação do ESN</h3><p class="sm">Avalia a <b>qualidade da análise</b>, separada da decisão da oportunidade (validar/descartar continua no painel de decisão). "Incorreta" e "Já atendida" tiram a recomendação da lista de prioridades <b>somente deste cliente</b>. Nada aqui vira regra global sem revisão.</p>
  <label class="sm"><b>Avaliação</b> <select id="av_cl"><option value="">Escolha…</option>${Object.entries(AV_CL).map(([k, [l]]) => `<option value="${k}" ${a.classe === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="sm"><input type="checkbox" id="av_sa" ${a.semAderencia ? 'checked' : ''}> A solução recomendada não tem aderência ao caso</label>
  ${ta('ev', 'Evidência mal interpretada', 'Qual trecho foi lido de forma errada e o que ele realmente diz')}${ta('co', 'Correção e justificativa comercial', 'O que estaria certo e por que faz (ou não) sentido comercialmente')}${ta('px', 'Próxima ação realmente útil', 'O que você faria na prática com este cliente')}${ta('aj', 'Ajuste realizado ou proposto na ferramenta', 'Preencha depois de tratado (opcional)')}
  <div class="row"><button class="btn pri sm" data-a="avSave" data-k="${esc(c.key)}" data-id="${esc(id)}">Registrar avaliação</button>${a.classe ? `<button class="btn ghost sm" data-a="avClear" data-k="${esc(c.key)}" data-id="${esc(id)}">Limpar</button><span class="muted sm">Última: ${esc(fmtDate(a.at))}</span>` : ''}</div></div>`;
}

/* ---------- sugestões de ajuste do motor (agregado, sempre sob revisão) ---------- */
function motorSug() {
  const m = new Map();
  Object.values(S.clients).forEach(c => Object.entries(c.aval || {}).forEach(([id, a]) => {
    if (!a.classe) return; const e = m.get(id) || { id, nome: '', tot: 0, ruins: 0, porClasse: {}, clientes: [], notas: [] };
    e.tot++; e.porClasse[a.classe] = (e.porClasse[a.classe] || 0) + 1;
    if (['ajuste', 'generica', 'incorreta'].includes(a.classe)) { e.ruins++; e.clientes.push(c.name); if (a.correcao) e.notas.push(`${c.name}: ${a.correcao.slice(0, 160)}`); }
    if (!e.nome) e.nome = ((c.opps || []).find(o => o.ruleId === id) || {}).nome || id; m.set(id, e);
  }));
  return [...m.values()].filter(e => e.ruins).sort((a, b) => b.ruins - a.ruins);
}
function motorSugHtml() {
  const l = motorSug(); if (!l.length) return '';
  const nCl = Object.values(S.clients).filter(c => Object.keys(c.aval || {}).length).length;
  return `<div class="card"><h3>Avaliação do ESN — sugestões de ajuste do motor</h3><p class="sm">Agregado das avaliações por regra. <b>Sugestões exigem revisão</b>: nenhuma é aplicada automaticamente, e uma avaliação de um único cliente não é base para mudar regra global. Amostra atual: ${nCl} cliente(s) com avaliação.</p>
  ${l.map(e => { const d = (S.meta.motorSug || {})[e.id]; return `<div class="opp"><div class="row"><h4>${esc(e.nome)}</h4><span class="sp"></span>${d ? pill(d.st === 'analisada' ? 'Revisada' : 'Descartada', d.st === 'analisada' ? 'ok' : 'off') : pill('Pendente de revisão', 'warn')}</div>
  <p class="sm">${e.ruins} de ${e.tot} avaliação(ões) apontaram problema (${Object.entries(e.porClasse).map(([k, n]) => `${AV_CL[k][0]}: ${n}`).join('; ')}). Clientes: ${e.clientes.map(esc).join(', ')}.${e.clientes.length < 2 ? ' <b>Amostra de 1 cliente: apenas registre; não generalize.</b>' : ''}</p>${e.notas.length ? `<ul class="sm">${e.notas.slice(0, 4).map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  <div class="row"><input id="ms_${esc(e.id)}" placeholder="Nota da revisão (o que foi decidido)" value="${esc(d?.nota || '')}" style="flex:1;min-width:200px"><button class="btn ghost sm" data-a="msSet" data-id="${esc(e.id)}" data-st="analisada">Marcar como revisada</button><button class="btn ghost sm" data-a="msSet" data-id="${esc(e.id)}" data-st="descartada">Descartar sugestão</button></div></div>`; }).join('')}</div>`;
}
function msSet(id, st) { S.meta.motorSug ||= {}; S.meta.motorSug[id] = { st, nota: ($('#ms_' + id)?.value || '').trim().slice(0, 400), at: nowISO() }; touchMeta(); render(); }

/* ---------- documentos reais ---------- */
const vFmtV = v => typeof v === 'number' ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v ?? '');
function valDocs(c) {
  const out = [];
  (c.fichas || []).forEach(f => out.push({ tipo: 'Ficha', hash: f.hash, nome: f.file, at: f.at, state: f.state, by: f.by, comps: fichaComps(f), itens: f.items || [], texto: f.matchText || '', trunc: f.itemsTrunc || 0, dup: f.dupComps }));
  (c.docs || []).forEach(d => out.push({ tipo: d.ocr ? 'Print (OCR)' : 'Documento / ata', hash: d.hash, nome: d.name, at: d.at, state: d.state, by: d.by, comps: [], itens: [], texto: d.text || '', trunc: d.trunc ? 1 : 0, ocr: !!d.ocr }));
  (c.cdocs || []).forEach(d => out.push({ tipo: 'Documento de contrato/cadastro', hash: d.hash || d.id, nome: d.name || d.file || '(sem nome)', at: d.at, state: d.state, comps: [], itens: [], texto: d.text || '' }));
  return out.filter(d => d.hash);
}
function valProdsDoc(c, d) { return (c.productsIdent || []).filter(p => (p.ev || []).some(e => e.src && d.nome && String(e.src).includes(d.nome))); }
function valDocHtml(c, d) {
  const v = (c.valid?.docs || {})[d.hash] || {}, k = esc(c.key), h = esc(d.hash), prods = valProdsDoc(c, d);
  const soma = d.itens.reduce((s, i) => { const x = i.vals?.[i.vi]; return typeof x === 'number' ? s + x : s; }, 0);
  const incertos = prods.filter(p => p.nivel !== 'estruturado' && !(c.prodDec || {})[p.id]);
  const resP = { ok: pill('Conferido: correto', 'ok'), div: pill('Conferido: com divergência', 'warn') }[v.res] || pill('Não conferido', 'off');
  const stP = d.state ? pill({ confirmado: 'Associação confirmada', sugerido: 'Associação sugerida — confirmar', divergente: 'Associação divergente' }[d.state] || d.state, d.state === 'confirmado' ? 'ok' : 'warn') : '';
  return `<div class="opp"><div class="row"><h4>${esc(d.nome)}</h4>${chip(d.tipo === 'Ficha' ? 'FATO' : 'INFERÊNCIA')}<span class="muted sm">${esc(d.tipo)}</span><span class="sp"></span>${stP}${resP}</div>
  <p class="sm">Arquivo original: <code>${esc(d.nome)}</code> · identificador (SHA-256 parcial): <code>${h}</code> · carregado em ${esc(fmtDate(d.at))}${d.by ? ' · associado por ' + esc(d.by) : ''}${v.orig ? ` · <b>${v.orig.ok ? 'original reconferido: mesmo arquivo' : 'ATENÇÃO: o arquivo selecionado é diferente do carregado'}</b> (${esc(fmtDate(v.orig.at))})` : ''}</p>
  <p class="sm">Extraído: competência(s) <b>${d.comps.length ? d.comps.map(esc).join(', ') : '—'}</b> · ${d.itens.length} item(ns)${d.trunc ? ' (lista truncada)' : ''}${d.itens.length ? ` · soma dos valores extraídos <b>${vFmtV(soma)}</b>` : ''} · produtos/serviços reconhecidos: <b>${prods.length ? prods.map(p => esc(p.nome)).join(', ') : 'nenhum'}</b>${d.dup ? ' · <b>competência repetida em outra ficha</b>' : ''}</p>
  ${incertos.length ? `<div class="alert w"><b>Reconhecimento incerto (texto livre, sem item estruturado):</b>${incertos.map(p => `<div class="row sm">${esc(p.nome)}<input id="vp_${esc(p.id)}" placeholder="Nota (obrigatória ao rejeitar)" style="flex:1;min-width:160px"><button class="btn ghost sm" data-a="valProd" data-k="${k}" data-id="${esc(p.id)}" data-st="confirmado">Confirmar</button><button class="btn ghost sm" data-a="valProd" data-k="${k}" data-id="${esc(p.id)}" data-st="rejeitado">Rejeitar</button></div>`).join('')}</div>` : ''}
  <details class="sm"><summary>Comparar com o original: valores e texto armazenados</summary>${d.itens.length ? `<div class="tw"><table><thead><tr><th>Local</th><th>Descrição extraída</th><th>Competência</th><th>Valor extraído</th><th>Classe</th></tr></thead><tbody>${d.itens.slice(0, 80).map(i => `<tr><td>${esc(i.loc || '')}</td><td>${esc(i.desc)}</td><td>${esc(i.comp || '—')}</td><td>${(i.vals || []).length ? vFmtV(i.vals[i.vi]) : '—'}</td><td>${esc(i.kind || '')}</td></tr>`).join('')}</tbody></table></div>${d.itens.length > 80 ? `<p class="muted sm">Mostrando 80 de ${d.itens.length}.</p>` : ''}` : ''}<p class="muted sm">Texto extraído (trecho — o binário original não é guardado no app; o identificador permite reconferir o arquivo):</p><pre style="white-space:pre-wrap;max-height:180px;overflow:auto">${esc((d.texto || '').slice(0, 1500))}</pre></details>
  <div class="row sm"><label>Resultado da conferência <select id="vd_r_${h}"><option value="">Não conferido</option><option value="ok" ${v.res === 'ok' ? 'selected' : ''}>Correto</option><option value="div" ${v.res === 'div' ? 'selected' : ''}>Com divergência</option></select></label><label>Reconferir arquivo original <input type="file" data-c="valOrig" data-k="${k}" data-id="${h}"></label></div>
  <div class="row sm"><input id="vd_p_${h}" placeholder="O que a extração perdeu" value="${esc(v.perdeu || '')}" style="flex:1;min-width:160px"><input id="vd_i_${h}" placeholder="O que extraiu errado" value="${esc(v.incorreto || '')}" style="flex:1;min-width:160px"><input id="vd_f_${h}" placeholder="Limitação de formato (PDF escaneado, tabela, etc.)" value="${esc(v.formato || '')}" style="flex:1;min-width:160px"><button class="btn pri sm" data-a="valDoc" data-k="${k}" data-id="${h}">Salvar conferência</button></div></div>`;
}
function valDocSave(key, hash) {
  const c = S.clients[key]; if (!c) return; const g = p => ($('#vd_' + p + '_' + hash)?.value || '').trim().slice(0, 400);
  c.valid ||= {}; c.valid.docs ||= {}; const cur = c.valid.docs[hash] || {};
  c.valid.docs[hash] = { ...cur, res: g('r'), perdeu: g('p'), incorreto: g('i'), formato: g('f'), at: nowISO() }; touchC(key); render(); toast('Conferência registrada.', 'ok');
}
async function valOrig(key, hash, file) {
  const c = S.clients[key]; if (!c || !file) return; const h = await sha(await file.arrayBuffer()); c.valid ||= {}; c.valid.docs ||= {};
  c.valid.docs[hash] = { ...(c.valid.docs[hash] || {}), orig: { ok: h === hash, at: nowISO(), nome: file.name } }; touchC(key); render();
  toast(h === hash ? 'Mesmo arquivo do carregado.' : 'Arquivo diferente do carregado.', h === hash ? 'ok' : 'bad');
}
function valProd(key, id, st) {
  const nota = ($('#vp_' + id)?.value || '').trim(); prodDecSet(key, id, st, st === 'confirmado' ? (nota || 'Conferido contra o documento original (aba Validação)') : nota);
}

/* ---------- aba Validação (por cliente) ---------- */
function valNaoIdent(c) {
  const l = c.valid?.naoIdent || [];
  return `<h4>Necessidades importantes que a ferramenta não identificou</h4>${l.length ? `<ul class="sm">${l.map(x => `<li>${esc(x.t)}${x.why ? ` — <span class="muted">${esc(x.why)}</span>` : ''} <button class="btn ghost sm" data-a="valNiRm" data-k="${esc(c.key)}" data-id="${esc(x.id)}">remover</button></li>`).join('')}</ul>` : '<p class="sm muted">Nenhuma registrada.</p>'}
  <div class="row sm"><input id="ni_t" placeholder="Necessidade que ficou de fora" style="flex:1;min-width:200px"><input id="ni_w" placeholder="Por que é importante / onde aparece" style="flex:1;min-width:200px"><button class="btn ghost sm" data-a="valNiAdd" data-k="${esc(c.key)}">Registrar</button></div>`;
}
function valDimHtml(c, docs) {
  const D = c.valid?.dim || {}, av = Object.values(c.aval || {}), n = k => av.filter(a => a.classe === k).length;
  const apoio = {
    extracao: `${docs.filter(d => (c.valid?.docs || {})[d.hash]?.res).length} de ${docs.length} documento(s) conferido(s); ${docs.filter(d => (c.valid?.docs || {})[d.hash]?.res === 'div').length} com divergência`,
    assoc: `${docs.filter(d => d.state === 'confirmado').length} confirmada(s), ${docs.filter(d => d.state && d.state !== 'confirmado').length} sugerida(s)/divergente(s)`,
    necess: `${n('faz_sentido')} recomendação(ões) avaliada(s) como "faz sentido"; ${(c.valid?.naoIdent || []).length} necessidade(s) não identificada(s) registrada(s)`,
    incorr: `${n('incorreta')} incorreta(s), ${n('generica')} genérica(s), ${n('ajuste')} a ajustar, ${n('atendida')} já atendida(s)`,
    fontes: `${ctxFontes(c).length} fonte(s) usada(s) na análise`, util: `${(c.opps || []).length} recomendação(ões) geradas; avalie as perguntas do Raio-X na conversa real`
  };
  return `<h4>Dimensões avaliadas (qualitativo — sem percentual)</h4><div class="tw"><table><thead><tr><th>Dimensão</th><th>Apoio objetivo</th><th>Avaliação</th><th>Nota</th></tr></thead><tbody>${AV_DIM.map(([k, l]) => `<tr><td>${l}</td><td class="sm">${esc(apoio[k])}</td><td><select id="vm_n_${k}">${Object.entries(AV_NV).map(([v, t]) => `<option value="${v}" ${(D[k]?.nivel || 'na') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td><td><input id="vm_t_${k}" value="${esc(D[k]?.nota || '')}" style="width:100%"></td></tr>`).join('')}</tbody></table></div><div class="row"><button class="btn pri sm" data-a="valDim" data-k="${esc(c.key)}">Salvar dimensões</button></div>`;
}
function valTab(c) {
  const docs = valDocs(c), recs = rxRecs(c), nAv = Object.values(c.aval || {}).filter(a => a.classe).length;
  let h = `<div class="card" style="border-left:4px solid var(--ciano)"><h3>Validação — ${esc(c.name)}</h3><p class="sm">Conferência do que a ferramenta extraiu e concluiu contra os documentos reais e o seu julgamento comercial. <b>Amostra pequena:</b> estes resultados valem para este cliente e não medem acerto geral (nenhum percentual é calculado sem referência definida). Os arquivos originais não ficam guardados no app: ficam registrados nome, identificador e o texto extraído; você pode reconferir o original pelo identificador.</p>
  <div class="row"><button class="btn ghost sm" data-a="valExport" data-k="${esc(c.key)}">Exportar validação (HTML)</button><span class="muted sm">${docs.length} documento(s) · ${recs.length} recomendação(ões) · ${nAv} avaliada(s)</span></div></div>`;
  h += `<div class="card"><h3>1. Documentos reais</h3>${docs.length ? docs.map(d => valDocHtml(c, d)).join('') : '<p class="sm muted">Nenhum documento carregado para este cliente. Carregue fichas, atas e prints do cliente na aba Fichas ou em Importar; eles aparecem aqui para conferência.</p>'}</div>`;
  h += `<div class="card"><h3>2. Comparativo: ferramenta × avaliação do ESN</h3>${recs.length ? `<div class="tw"><table class="chain"><thead><tr><th>O que a ferramenta identificou</th><th>Evidência</th><th>Avaliação do ESN</th><th>O que perdeu ou interpretou mal</th><th>Ajuste realizado</th></tr></thead><tbody>${recs.map(r => { const o = r.o, a = avGet(c, o.ruleId) || {}, ev = (o.evInd || []).filter(e => e.cls === 'FATO').slice(0, 2); return `<tr><td><b>${esc(o.nome)}</b><br><span class="muted sm">${esc(RX_CL[r.cl][0])}${(o.sols || []).length ? ' · ' + o.sols.map(s => esc(s.nome)).join(', ') : ''}</span></td><td class="sm">${ev.length ? ev.map(e => `${esc(String(e.text).slice(0, 180))} <span class="muted">— ${esc(e.src || '')}</span>`).join('<br>') : '<span class="muted">sem evidência individual (hipótese)</span>'}</td><td>${a.classe ? pill(AV_CL[a.classe][0], AV_CL[a.classe][1]) : '<span class="muted">não avaliada</span>'}<div class="sm">${esc(a.correcao || '')}</div><button class="btn ghost sm" data-a="dxOpen" data-k="${esc(c.key)}" data-id="${esc(o.id)}">${a.classe ? 'Editar' : 'Avaliar'}</button></td><td class="sm">${[a.semAderencia ? 'Solução sem aderência ao caso.' : '', a.evidErrada ? 'Evidência mal lida: ' + esc(a.evidErrada) : ''].filter(Boolean).join('<br>') || '—'}</td><td class="sm">${esc(a.ajuste || '—')}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="sm muted">Sem recomendações geradas para comparar.</p>'}${valNaoIdent(c)}</div>`;
  h += `<div class="card"><h3>3. Resultado por dimensão</h3>${valDimHtml(c, docs)}</div>`;
  return h;
}
function valExport(key) {
  const c = S.clients[key]; if (!c) return; const docs = valDocs(c), recs = rxRecs(c);
  const body = `<h1>Validação — ${esc(c.name)}</h1><p>Gerado em ${esc(fmtDate(nowISO()))}. Amostra pequena: não representa acerto geral; sem percentuais.</p><h2>Documentos</h2><table border=1 cellpadding=4><tr><th>Arquivo</th><th>Tipo</th><th>Identificador</th><th>Competência</th><th>Conferência</th><th>Perdeu</th><th>Errou</th><th>Formato</th></tr>${docs.map(d => { const v = (c.valid?.docs || {})[d.hash] || {}; return `<tr><td>${esc(d.nome)}</td><td>${esc(d.tipo)}</td><td>${esc(d.hash)}</td><td>${esc(d.comps.join(', '))}</td><td>${esc({ ok: 'Correto', div: 'Divergência' }[v.res] || 'Não conferido')}</td><td>${esc(v.perdeu || '')}</td><td>${esc(v.incorreto || '')}</td><td>${esc(v.formato || '')}</td></tr>`; }).join('')}</table><h2>Recomendações</h2><table border=1 cellpadding=4><tr><th>Identificado</th><th>Evidência</th><th>Avaliação ESN</th><th>Correção / justificativa</th><th>Perdeu / interpretou mal</th><th>Ajuste</th></tr>${recs.map(r => { const o = r.o, a = avGet(c, o.ruleId) || {}; return `<tr><td>${esc(o.nome)} (${esc(RX_CL[r.cl][0])})</td><td>${esc((o.evInd || []).filter(e => e.cls === 'FATO').slice(0, 2).map(e => String(e.text).slice(0, 180)).join(' | '))}</td><td>${esc(a.classe ? AV_CL[a.classe][0] : 'não avaliada')}</td><td>${esc(a.correcao || '')}</td><td>${esc([a.semAderencia ? 'sem aderência' : '', a.evidErrada || ''].filter(Boolean).join('; '))}</td><td>${esc(a.ajuste || '')}</td></tr>`; }).join('')}</table><h2>Necessidades não identificadas</h2><ul>${(c.valid?.naoIdent || []).map(x => `<li>${esc(x.t)} — ${esc(x.why || '')}</li>`).join('') || '<li>nenhuma</li>'}</ul><h2>Dimensões</h2><ul>${AV_DIM.map(([k, l]) => `<li>${l}: ${AV_NV[c.valid?.dim?.[k]?.nivel || 'na']} ${esc(c.valid?.dim?.[k]?.nota || '')}</li>`).join('')}</ul>`;
  offer(`validacao_${String(c.name).replace(/[^\w]+/g, '_').slice(0, 40)}.html`, `<!doctype html><meta charset="utf-8"><title>Validação</title><body style="font-family:sans-serif">${body}</body>`);
}
const VAL_ACT = {
  avQuick: t => avQuick(t.dataset.k, t.dataset.id, t.dataset.cl), avSave: t => avForm(t.dataset.k, t.dataset.id), avClear: t => avClear(t.dataset.k, t.dataset.id),
  msSet: t => msSet(t.dataset.id, t.dataset.st), valDoc: t => valDocSave(t.dataset.k, t.dataset.id), valProd: t => valProd(t.dataset.k, t.dataset.id, t.dataset.st), valExport: t => valExport(t.dataset.k),
  valNiAdd: t => { const c = S.clients[t.dataset.k], x = ($('#ni_t')?.value || '').trim(); if (!c || !x) return toast('Descreva a necessidade.', 'bad'); c.valid ||= {}; (c.valid.naoIdent ||= []).push({ id: 'ni_' + uid(), t: x.slice(0, 300), why: ($('#ni_w')?.value || '').trim().slice(0, 300), at: nowISO() }); touchC(c.key); render(); },
  valNiRm: t => { const c = S.clients[t.dataset.k]; if (!c?.valid) return; c.valid.naoIdent = (c.valid.naoIdent || []).filter(x => x.id !== t.dataset.id); touchC(c.key); render(); },
  valDim: t => { const c = S.clients[t.dataset.k]; if (!c) return; c.valid ||= {}; c.valid.dim = Object.fromEntries(AV_DIM.map(([k]) => [k, { nivel: $('#vm_n_' + k)?.value || 'na', nota: ($('#vm_t_' + k)?.value || '').trim().slice(0, 300) }])); touchC(c.key); render(); toast('Dimensões salvas.', 'ok'); }
};
