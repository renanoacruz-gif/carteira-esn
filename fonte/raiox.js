/* ===== Contexto do cliente, contratação por estado e Raio-X consultivo (rodada 11) =====
   Reutiliza o motor único (c.opps = buildOpps + consOpps + solContentOpps, unificados) e as decisões por oportunidade.
   Nada aqui cria oportunidade paralela: o Raio-X organiza e classifica o que o motor já produz. */
const CT_EST = { uso: 'Uso efetivo confirmado', faturamento: 'Identificada no faturamento', mencionada: 'Mencionada em outro documento', desconhecida: 'Não identificada' };
const CT_EST_K = { uso: 'ok', faturamento: 'info', mencionada: 'warn', desconhecida: 'off' };
const RX_CL = { prioridade: ['Prioridade para abordagem', 'ok'], investigar: ['Investigar na próxima conversa', 'warn'], nao: ['Não priorizar agora', 'off'] };

/* ---------- contratação: quatro estados; ausência = "não identificada", nunca "não possui" ---------- */
const _ctc = new WeakMap();
function ctxContratacao(c) {
  const ck = (c.analyzedAt || '') + '|' + JSON.stringify(c.usoConf || {}) + '|' + (c.fichas || []).map(f => f.id + f.state + (f.items || []).length).join(',') + '|' + (c.productsIdent || []).length; const hit = _ctc.get(c); if (hit && hit.k === ck) return hit.v;
  const v = ctxContratacaoRaw(c); _ctc.set(c, { k: ck, v }); return v;
}
function ctxContratacaoRaw(c) {
  const out = []; const uso = c.usoConf || {};
  (c.productsIdent || []).forEach(p => {
    const fat = [], men = [];
    fichasOk(c).forEach(f => (f.items || []).forEach(it => { if (it.dup) return; if (findProducts(it.desc, { src: f.file, loc: it.loc }).some(x => x.id === p.id)) fat.push({ src: f.file, loc: it.loc, comp: it.comp || f.comp || null, valor: it.vals?.[it.vi] ?? null, kind: it.kind, desc: it.desc }); }));
    (p.ev || []).forEach(e => { if (e.src === 'Planilha' || e.texto) men.push({ src: e.src, loc: e.loc, term: e.term }); });
    const estado = uso[p.id] ? 'uso' : fat.length ? 'faturamento' : men.length || p.conf ? 'mencionada' : 'desconhecida';
    const incerto = estado === 'faturamento' ? fat.every(x => x.kind === 'outro') && !p.conf : estado === 'mencionada' && !p.conf;
    const comps = [...new Set(fat.map(x => x.comp).filter(Boolean))].sort();
    out.push({ id: p.id, nome: p.nome, estado, incerto, fat, men, comps, ultima: comps.slice(-1)[0] || null, uso: uso[p.id] || null });
  });
  return out;
}
function contratEstado(c, solId) { const p = ctxContratacao(c).find(x => x.id === solId); return p ? p.estado : 'desconhecida'; }
function ctxSemCatalogo(c) { /* itens cobrados sem correspondência no catálogo: visíveis, nunca descartados em silêncio */
  const out = []; fichasOk(c).forEach(f => (f.items || []).forEach(it => { if (it.dup || !['recorrente', 'avulso', 'excedente'].includes(it.kind)) return; if (!findProducts(it.desc, { src: f.file, loc: it.loc }).length) out.push({ src: f.file, loc: it.loc, comp: it.comp || f.comp, desc: it.desc, kind: it.kind, valor: it.vals?.[it.vi] ?? null }); })); return out;
}
function usoSet(key, solId, on, fonte) {
  const c = S.clients[key]; if (!c) return; c.usoConf ||= {};
  if (on) { if (!String(fonte || '').trim()) return toast('Informe como o uso efetivo foi confirmado (conversa, tela, relatório…).'); c.usoConf[solId] = { at: nowISO(), fonte: String(fonte).trim().slice(0, 300) }; } else delete c.usoConf[solId];
  reanalyze([key], 'Uso efetivo de solução ' + (on ? 'confirmado' : 'desmarcado')); render();
}

/* ---------- fontes e lacunas ---------- */
function ctxFontes(c) {
  const f = [], mf = S.meta.files.find(x => x.kind === 'carteira' && c.src && x.name === c.src.file);
  if (c.src) f.push({ tipo: 'Planilha', nome: `${c.src.file}${c.src.sheet ? ' • ' + c.src.sheet : ''} • linha ${c.src.row}`, data: mf?.at || null, estado: 'declarado', nat: 'planilha' });
  (c.fichas || []).forEach(x => f.push({ tipo: 'Ficha', nome: x.file, data: x.at, estado: usableF(x) ? 'usada' : x.state, nat: 'documento', evid: `${(x.items || []).length} item(ns) • competência ${x.comp || 'desconhecida'}` }));
  (c.docs || []).forEach(d => f.push({ tipo: d.ocr ? 'OCR' : 'Documento', nome: d.name, data: d.at, estado: d.state === 'sugerido' ? 'vínculo a confirmar' : 'usado', nat: d.ocr ? 'ocr' : 'documento', evid: d.ocr ? 'texto lido por OCR — conferir' : '' }));
  if (c.site) f.push({ tipo: 'Site institucional', nome: c.site, data: c.edits?.site?.at || null, estado: 'informado pelo executivo', nat: 'manual', url: c.site });
  if (c.cnpjCad) f.push({ tipo: 'Consulta CNPJ', nome: c.cnpjCad.provedor || 'provedor cadastral', data: c.cnpjCad.consultadoEm, estado: 'usada', nat: 'publico' });
  (S.pesq || []).filter(p => p.status === 'incorporada' && (p.alvoKey === c.key || (p.alvoSeg && p.alvoSeg === c.segInfo?.id))).forEach(p => f.push({ tipo: 'Pesquisa IA', nome: p.alvo, data: p.at, estado: p.alvoKey === c.key ? 'individual' : 'setorial', nat: 'ia' }));
  (c.insRef || []).forEach(r => f.push({ tipo: 'Insight de mercado', nome: r.titulo, data: r.at, estado: 'contexto setorial', nat: 'publico', url: r.fonte }));
  if (c.edits && Object.keys(c.edits).length || (c.custom || []).length) f.push({ tipo: 'Edição manual', nome: 'Dados editados pelo executivo', data: Object.values(c.edits || {}).map(x => x.at).sort().slice(-1)[0] || null, estado: 'confirmado pelo executivo', nat: 'manual' });
  (c.fatos || []).forEach(x => f.push({ tipo: 'Fato do cliente', nome: x.titulo, data: x.data, estado: 'individual', nat: x.origem === 'ia-confirmado' ? 'publico' : 'manual', url: x.url, evid: 'identidade: ' + x.identidade }));
  (c.sugFatos || []).filter(x => x.estado === 'pendente').forEach(x => f.push({ tipo: 'Pesquisa IA (sugestão)', nome: x.texto.slice(0, 80), data: x.data || x.at, estado: 'a confirmar', nat: 'ia', url: x.url, evid: 'identidade segundo a IA: ' + x.identidadeIA }));
  if (c.mgmt?.notes) f.push({ tipo: 'Anotação', nome: 'Observações manuais', data: null, estado: 'executivo', nat: 'manual' });
  return f;
}
/* "O que falta → por que importa → qual decisão depende disso": só o que pode mudar a recomendação */
function ctxLacunas(c) {
  const L = [], temF = fichasOk(c).length > 0, prot = (c.productsIdent || []).some(p => /protheus/i.test(p.nome)) || /protheus/i.test(c.productsRaw || '');
  const ind = (c.docs || []).length || c.notes || c.mgmt?.notes;
  if (!temF) L.push({ falta: 'Ficha de faturamento', importa: 'Sem ela a contratação fica “não identificada” e o motor não distingue o que já está contratado do que pode ser oferecido.', decisao: 'Quais soluções abordar e quais já estão em uso (evita oferta redundante).', acao: ['ctab', 'fichas', 'Anexar ficha'] });
  if (!ind) L.push({ falta: 'Observação, ata, proposta ou e-mail do cliente', importa: 'Sem evidência individual, as recomendações ficam como hipótese setorial.', decisao: 'Se uma necessidade vira “Prioridade para abordagem” ou continua “Investigar”.', acao: ['ctab', 'fichas', 'Adicionar documento'] });
  if (!c.segInfo?.id) L.push({ falta: 'Segmento', importa: 'Define dores, tendências e soluções do setor.', decisao: 'Recorte setorial do raio-X e das pesquisas.', acao: ['ceOpen', c.key, 'Editar dados'] });
  if (!(c.cnpj && validCnpj(c.cnpj))) L.push({ falta: 'CNPJ válido', importa: 'Confirma a identidade da empresa nas fichas e nas pesquisas e permite consulta cadastral (CNAE, porte).', decisao: 'Se documentos e notícias pertencem mesmo a este cliente.', acao: ['ceOpen', c.key, 'Editar dados'] });
  if (prot && !evOk(c.rel || []).some(e => e.extra?.tipo === 'producao')) L.push({ falta: 'Release do Protheus em produção', importa: 'Condiciona atualização, Reforma Tributária e requisitos de outras soluções.', decisao: 'Se há diagnóstico de atualização antes de qualquer outra oferta.', acao: ['ctab', 'tecnologia', 'Informar release'] });
  if (!c.cad?.hosp?.v && prot) L.push({ falta: 'Hospedagem (local, nuvem, Cloud)', importa: 'Muda a oferta de Cloud e de infraestrutura.', decisao: 'Se Cloud entra como hipótese.', acao: ['ctab', 'cadastro', 'Informar hospedagem'] });
  if (c.cnpj && !c.cnpjCad) L.push({ falta: 'Consulta cadastral (CNAE, porte)', importa: 'Qualifica a atividade real da empresa.', decisao: 'Aderência por atividade (não por palavra-chave).', acao: ['open-cnpj', c.key, 'Consultar CNPJ'] });
  const sg = ctxSinais(c);
  if (!activeSols().length) L.push({ falta: 'Base de Soluções vazia', importa: 'Sem ela as recomendações vêm só das regras internas e não cobrem o portfólio TOTVS pertinente.', decisao: 'Quais soluções do portfólio oficial podem ser apresentadas.', acao: ['nav', 'solucoes', 'Abrir Base de Soluções'] });
  else if (sg.some(x => ['manual', 'dificuldade'].includes(x.tipo)) && !(c.opps || []).some(o => o.modo === 'evidencia')) L.push({ falta: 'Solução da Base para a dor citada nos textos', importa: 'O cliente cita rotina manual ou dificuldade, mas nenhuma solução cadastrada correspondeu.', decisao: 'Se existe solução oficial a investigar para essa dor.', acao: ['nav', 'solucoes', 'Enriquecer Base de Soluções'] });
  if (!(c.fatos || []).length && !(c.sugFatos || []).length) L.push({ falta: 'Pesquisa da empresa e do mercado', importa: 'Sem fatos recentes com fonte, o momento da empresa fica desconhecido.', decisao: 'O gancho e o timing da abordagem.', acao: ['emPrep', c.key, 'Pesquisar empresa (IA)'] });
  return L;
}

/* ---------- classificação das recomendações (sobre o motor existente) ---------- */
function rxClass(c, o) {
  const d = decGet(c, o.ruleId), sols = o.sols || [], ct = sols.map(s => contratEstado(c, s.id));
  if (d.valid === 'descartada') return { cl: 'nao', why: 'Descartada pelo executivo' + (d.nota ? `: ${d.nota}` : '.') };
  const av = (c.aval || {})[o.ruleId]; if (av && (av.classe === 'incorreta' || av.classe === 'atendida')) return { cl: 'nao', why: 'Avaliação do ESN: ' + AV_CL[av.classe][0] + (av.correcao ? ' — ' + av.correcao.slice(0, 140) : '') + '.' };
  if (['contratada', 'encerrada'].includes(d.sit)) return { cl: 'nao', why: `Situação comercial: ${SIT_L[d.sit]}.` };
  if (sols.length && o.tipoBase !== 'Otimização' && ct.every(x => x === 'uso')) return { cl: 'nao', why: 'Necessidade já atendida: uso efetivo confirmado da solução.' };
  if (o.baseOK === false) return { cl: 'nao', why: 'Impedimento de base/compatibilidade registrado.' };
  if (o.modo !== 'evidencia' && (o.crit?.aderencia ?? 2) <= 1) return { cl: 'nao', why: 'Baixa aderência documentada e sem evidência individual.' };
  /* palavra-chave num texto NÃO prova necessidade: prioridade exige dado objetivo do cliente ou o mesmo indício em 2+ fontes independentes */
  const ev = (o.evInd || []).filter(e => e.cls === 'FATO' && !/setorial/i.test(e.src || '')), kw = e => /^Termos?\s+["“”']/.test(String(e.text)), obj = ev.filter(e => !kw(e) && !isOcrSrc(e.src)), kws = new Set(ev.filter(kw).map(e => e.src)), soOcr = ev.length > 0 && ev.every(e => isOcrSrc(e.src));
  if (o.semVazio) return { cl: 'investigar', why: 'A Base de Soluções não documenta a capacidade desta solução: complemente a documentação antes de priorizar.' };
  if (soOcr) return { cl: 'investigar', why: 'Indício apenas em print/imagem (OCR): um print isolado não define o processo inteiro. Confirme antes de priorizar.' };
  if (o.modo === 'evidencia' && (obj.length > 0 || kws.size >= 2) && o.conf !== 'baixo') return { cl: 'prioridade', why: obj.length ? `${obj.length} dado(s) objetivo(s) do cliente (${[...new Set(obj.map(e => e.src))].slice(0, 2).join('; ')}).` : `Mesmo indício em ${kws.size} fontes independentes.` };
  return { cl: 'investigar', why: ev.length && !obj.length ? 'Indício apenas por palavra-chave em uma fonte: confirme com o cliente antes de priorizar.' : o.modo === 'evidencia' ? 'Indício individual fraco ou de baixa confiança.' : 'Hipótese plausível ainda sem confirmação do cliente.' };
}
function rxRecs(c) { return (c.opps || []).map(o => ({ o, ...rxClass(c, o) })); }
function rxFind(c, id) { return (c.opps || []).find(o => o.id === id || o.ruleId === id || (o.aliases || []).includes(id)); }

/* ---------- Raio-X ---------- */
const rxSec = (n, t, body, extra = '') => `<div class="card"><h3>${n}. ${t} ${extra}</h3>${body}</div>`;
function rxPerfil(c) {
  const seg = c.segInfo?.id ? segName(c.segInfo.id) : null, comp = complet(c), cd = c.cnpjCad;
  const rows = [['Razão social', c.name], ['CNPJ', c.cnpj ? fmtCnpj(c.cnpj) : ''], ['Site institucional', c.site || ''], ['Segmento', seg ? seg + (c.segInfo.mode === 'inferido' ? ' (inferido)' : '') : ''], ['Cidade/UF', [c.city, c.uf].filter(Boolean).join(' / ')], ['Porte', c.size], ['Atividade (consulta CNPJ)', cd ? (cd.cnaePrincipal || cd.atividade || cd.naturezaJuridica || '') : ''], ['Faturamento do cliente', c.cad?.fat?.v ? fatTxt(c.cad.fat.v) : ''], ['Hospedagem', c.cad?.hosp?.v ? HOSP[c.cad.hosp.v] || c.cad.hosp.v : ''], ['Release em produção', evOk(c.rel || []).find(e => e.extra?.tipo === 'producao')?.v || '']];
  return `<table><tbody>${rows.map(([k, v]) => `<tr><td class="muted sm nw">${k}</td><td>${v ? esc(v) : '<span class="muted">não informado</span>'}</td></tr>`).join('')}${(c.custom || []).map(x => `<tr><td class="muted sm nw">${esc(x.nome)}</td><td>${esc(x.valor)}</td></tr>`).join('')}</tbody></table>
  <div class="row"><button class="btn ghost sm" data-a="ceOpenTab" data-k="${esc(c.key)}">Editar dados do cliente</button></div>
  <p class="sm">${chip('FATO')} dados cadastrais acima. <b>Lacunas:</b> ${comp.miss.length ? comp.miss.map(x => esc(x[1])).join(', ') : 'nenhuma no cadastro'}.</p>`;
}
function rxContrHtml(c) {
  const ct = ctxContratacao(c), sem = ctxSemCatalogo(c);
  let h = ct.length ? `<div class="tw"><table><thead><tr><th>Produto / serviço</th><th>Estado</th><th>Fonte e competência</th><th>Valor (último)</th><th></th></tr></thead><tbody>${ct.map(p => { const last = p.fat.filter(x => x.comp === p.ultima)[0]; return `<tr><td><b>${esc(p.nome)}</b>${p.incerto ? `<div class="sm">${pill('correspondência incerta', 'warn')}</div>` : ''}</td><td>${pill(CT_EST[p.estado], CT_EST_K[p.estado])}${p.estado === 'uso' ? `<div class="sm muted">${esc(p.uso.fonte)}</div>` : ''}</td>
    <td class="sm">${p.fat.length ? esc([...new Set(p.fat.map(x => x.src))].slice(0, 2).join('; ')) + (p.comps.length ? ' • comp. ' + esc(p.comps.join(', ')) : '') : p.men.length ? esc(p.men.map(x => x.src).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).join('; ')) : '—'}</td><td class="sm nw">${last && last.valor != null ? fmtBRL(last.valor) + ' <span class="muted">(' + esc(KIND_LABEL[last.kind] || last.kind) + ')</span>' : '—'}</td>
    <td class="nw">${p.estado === 'uso' ? `<button class="btn ghost sm" data-a="usoOff" data-k="${esc(c.key)}" data-id="${esc(p.id)}">Desmarcar uso</button>` : `<button class="btn ghost sm" data-a="usoAsk" data-id="${esc(p.id)}">Confirmar uso</button>`}${UI.usoAsk === p.id ? `<div class="row sm"><input id="uso_f" type="text" placeholder="Como o uso foi confirmado?" style="min-width:220px"><button class="btn sm" data-a="usoOn" data-k="${esc(c.key)}" data-id="${esc(p.id)}">Salvar</button></div>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted sm">Nenhum produto identificado na planilha, fichas ou documentos.</p>';
  if (sem.length) h += `<details><summary class="sm">${sem.length} item(ns) cobrado(s) sem correspondência no catálogo (não descartados)</summary><ul class="sm">${sem.slice(0, 20).map(x => `<li>${esc(x.desc)} — ${esc(KIND_LABEL[x.kind])}${x.valor != null ? ', ' + fmtBRL(x.valor) : ''} • ${esc(x.src)} ${x.comp ? '(' + esc(x.comp) + ')' : ''}</li>`).join('')}</ul></details>`;
  return h + `<p class="muted sm">Ausência na ficha significa “não identificada”, nunca “o cliente não possui”. A cobrança não prova uso, maturidade nem direito de licenciamento; competências nunca são somadas e valores duplicados entre arquivos são ignorados.</p>`;
}
function rxNecessidades(c) {
  const hits = Object.keys(KB.NEEDS || {}).map(n => ({ n, h: needHits(c, n) })).filter(x => x.h.length);
  const hip = rxRecs(c).filter(r => r.o.modo !== 'evidencia' && r.cl !== 'nao');
  return `<h4>Sinais extraídos dos materiais (sistemas, rotinas, dificuldades, indicadores)</h4>${sgHtml(c)}${semPanel(c)}<h4>Indícios por necessidade ${chip('INFERÊNCIA')}</h4>${hits.length ? `<ul class="sm">${hits.slice(0, 8).map(x => `<li><b>${esc(NEED_TXT(x.n))}</b> — termo “${esc(x.h[0].term)}” em ${esc(x.h[0].src)}: …${esc(x.h[0].snip)}… <span class="muted">(correspondência por palavra: não confirma a necessidade)</span></li>`).join('')}</ul>` : '<p class="muted sm">Nenhuma necessidade citada nos textos disponíveis.</p>'}
  <h4>Hipóteses a validar ${chip('HIPÓTESE')}</h4>${hip.length ? `<ul class="sm">${hip.slice(0, 8).map(r => `<li>${esc(r.o.nome)} — ${esc(r.o.problema)}</li>`).join('')}</ul>` : '<p class="muted sm">Nenhuma hipótese aberta.</p>'}`;
}
function rxMercado(c) {
  const ind = (S.pesq || []).filter(p => p.status === 'incorporada' && p.alvoKey === c.key), set = (S.pesq || []).filter(p => p.status === 'incorporada' && !p.alvoKey && p.alvoSeg && p.alvoSeg === c.segInfo?.id);
  const ins = (c.insRef || []).map(r => ({ ...r, ins: S.insights.find(i => i.id === r.id) }));
  const seg = KB.segments.find(s => s.id === c.segInfo?.id);
  const li = (t, tag, items) => `<h4>${t} ${tag}</h4>` + (items.length ? `<ul class="sm">${items.join('')}</ul>` : '<p class="muted sm">Nada registrado.</p>');
  return li('Evidência individual (pesquisa/fatos sobre este cliente)', chip('FATO'), [...(c.fatos || []).map(x => `<li>${esc(x.titulo)} ${link({ t: x.fonteNome, u: x.url })} <span class="muted">(evento ${esc(fmtD(x.data))}; identidade: ${esc(x.identidade)})</span></li>`), ...ind.map(p => `<li>${esc(p.resumo || p.alvo)} <span class="muted">(${esc(dtBR(p.at))}, ${esc(p.provedor || '')})</span></li>`)]) +
    li('Contexto setorial salvo (não é evidência do cliente)', chip('INFERÊNCIA'), [...ins.map(r => `<li>${esc(r.titulo)} ${r.fonte ? link({ t: r.ins?.fonte?.nome || 'fonte', u: r.fonte }) : ''} <span class="muted">(salvo em ${esc(dtBR(r.at))})</span></li>`), ...set.map(p => `<li>Pesquisa setorial: ${esc(p.resumo || p.alvo)} (${esc(dtBR(p.at))})</li>`), ...(seg ? seg.tendencias.slice(0, 2).map(t => `<li>${esc(t.t)} <span class="muted">(base do segmento ${esc(seg.nome)}, consulta ${esc(KB.consulta)})</span></li>`) : [])]) +
    emPanel(c) +
    (!ind.length && !ins.length && !(c.fatos || []).length ? `<p class="sm">Sem pesquisa individual: use <a href="#" data-a="mkIndiv" data-k="${esc(c.key)}">Inteligência Comercial → visão individual</a> para pesquisar ou registrar fatos, e “Pesquisar soluções para este cliente” para IA. Nada é simulado.</p>` : '');
}
function rxRecHtml(c, r) {
  const o = r.o, sols = o.sols || [], ct = sols.map(s => ({ s, e: contratEstado(c, s.id) })), ind = o.evInd || [], k = RX_CL[r.cl];
  const aderTxt = sols.length ? sols.map(s => `${s.nome}: ${s.integraProtheus === true ? 'integração com Protheus documentada na fonte' : s.integraProtheus === false ? 'NÃO integra com Protheus segundo a fonte' : 'compatibilidade com Protheus não verificada'}`).join('; ') : 'ação de relacionamento (sem solução de produto)';
  return `<div class="opp ${o.modo === 'investigacao' ? 'inv' : ''}"><div class="row"><h4>${esc(o.nome)}</h4>${pill(k[0], k[1])}${avPill(c, o)}<span class="sp"></span><button class="btn pri sm" data-a="dxOpen" data-k="${esc(c.key)}" data-id="${esc(o.id)}">Ver Diagnóstico Completo</button></div>
  ${avBar(c, o)}<table class="chain"><tbody>
  <tr><th>Solução/serviço</th><td>${sols.length ? sols.map(s => esc(s.nome)).join(', ') : '<span class="muted">—</span>'}</td></tr>
  <tr><th>Necessidade atendida</th><td>${chip(o.modo === 'evidencia' ? 'INFERÊNCIA' : 'HIPÓTESE')} ${esc(o.problema || '')}</td></tr>
  <tr><th>Evidência do cliente</th><td>${ind.length ? ind.slice(0, 3).map(e => `${chip(e.cls)} ${esc(String(e.text).slice(0, 240))} <span class="muted sm">— ${esc(e.src || '')}</span>`).join('<br>') : '<span class="muted">Sem evidência individual.</span>'}</td></tr>
  <tr><th>Cadeia semântica</th><td>${semCadeiaHtml(o) || '—'}</td></tr>
  <tr><th>Aderência</th><td>${chip('INFERÊNCIA')} ${o.crit?.aderencia ?? '—'}/3 — ${esc(aderTxt)}</td></tr>
  <tr><th>Benefício possível</th><td>${chip('HIPÓTESE')} ${esc(o.impacto || '—')}</td></tr>
  <tr><th>Contratação identificada</th><td>${ct.length ? ct.map(x => `${esc(x.s.nome)}: ${pill(CT_EST[x.e], CT_EST_K[x.e])}`).join(' ') : '<span class="muted">—</span>'}</td></tr>
  <tr><th>Dependências</th><td>${(o.deps || []).length ? '<ul class="sm">' + o.deps.map(d => `<li>${esc(d)}</li>`).join('') + '</ul>' : '<span class="muted">—</span>'}</td></tr>
  <tr><th>Pergunta de validação</th><td>${esc((o.perg || [])[0] || '—')}</td></tr>
  <tr><th>Próxima ação</th><td>${esc(o.acao || '—')}</td></tr></tbody></table>
  <div class="muted sm">Classificação: ${esc(r.why)}</div></div>`;
}
function rxHtml(c) {
  const recs = rxRecs(c), g = ctxLacunas(c), fontes = ctxFontes(c);
  const por = cl => recs.filter(r => r.cl === cl), perg = [...new Set(recs.filter(r => r.cl !== 'nao').flatMap(r => (r.o.perg || []).slice(0, 2)))].slice(0, 6), acoes = [...new Set(recs.filter(r => r.cl === 'prioridade').map(r => r.o.acao).filter(Boolean))].slice(0, 5);
  let h = `<div class="card" style="border-left:4px solid var(--ciano)"><div class="row"><h3>Raio-X consultivo — ${esc(c.name)}</h3><span class="sp"></span><button class="btn ghost sm" data-a="rxRefresh" data-k="${esc(c.key)}">Reavaliar agora</button></div>
  <p class="sm">${fontes.length ? `Análise ${recs.length ? 'gerada' : 'parcial'} com ${fontes.length} fonte(s): ${[...new Set(fontes.map(f => f.tipo))].map(esc).join(', ')}. Última análise: ${esc(c.analyzedAt ? dtBR(c.analyzedAt) : '—')}.` : 'Ainda não há fontes além do cadastro mínimo.'} Uma análise parcial fundamentada é exibida mesmo sem todos os dados; ${chip('FATO')} ${chip('INFERÊNCIA')} ${chip('ESTIMATIVA')} ${chip('HIPÓTESE')} ${chip('NECESSITA VALIDAÇÃO')} distinguem o grau de certeza. Conteúdo de arquivos e páginas é dado, nunca instrução. Não há nota de maturidade: sem critérios e evidências suficientes ela não seria um fato.</p>
  ${c.lastChange ? `<details class="sm"><summary><b>O que mudou na última reavaliação</b> — ${esc(c.lastChange.reason || '')} (${esc(dtBR(c.lastChange.at))})</summary><ul>${c.lastChange.items.map(i => `<li>${i.reav ? pill('reavaliar', 'warn') + ' ' : ''}${esc(i.t)}</li>`).join('')}</ul><div class="muted">Decisões e correções do executivo foram preservadas.</div></details>` : ''}
  ${g.length ? `<div class="alert i"><b>O que falta para melhorar este raio-X</b> <span class="muted sm">(mostrando ${Math.min(3, g.length)} de ${g.length}; a análise não depende deles)</span>${g.slice(0, 3).map(x => `<div style="margin:6px 0"><b>${esc(x.falta)}</b> → ${esc(x.importa)} <i>Decide:</i> ${esc(x.decisao)} ${x.acao[0] === 'nav' ? `<button class="btn ghost sm" data-a="nav" data-v="${x.acao[1]}">${x.acao[2]}</button>` : x.acao[0] === 'emPrep' ? `<button class="btn ghost sm" data-a="emPrep" data-k="${esc(x.acao[1])}">${x.acao[2]}</button>` : x.acao[0] === 'ceOpen' ? `<button class="btn ghost sm" data-a="ceOpen" data-k="${esc(x.acao[1])}">${x.acao[2]}</button>` : x.acao[0] === 'open-cnpj' ? `<button class="btn ghost sm" data-a="rxCnpj" data-k="${esc(x.acao[1])}">${x.acao[2]}</button>` : `<button class="btn ghost sm" data-a="ctab" data-v="${x.acao[1]}">${x.acao[2]}</button>`}</div>`).join('')}</div>` : '<div class="alert i sm">Sem lacunas relevantes para a recomendação neste momento.</div>'}</div>`;
  h += rxSec(1, 'Perfil e operação', rxPerfil(c)) + rxSec(2, 'Contratação identificada', rxContrHtml(c)) + rxSec(3, 'Processos e necessidades', rxNecessidades(c)) + rxSec(4, 'Mercado e momento da empresa', rxMercado(c));
  h += rxSec(5, 'Soluções e serviços', ['prioridade', 'investigar', 'nao'].map(cl => `<h4>${RX_CL[cl][0]} <span class="muted sm">(${por(cl).length})</span></h4>${por(cl).length ? por(cl).map(r => rxRecHtml(c, r)).join('') : '<p class="muted sm">Nenhuma.</p>'}`).join('') + '<p class="muted sm">Sem quantidade mínima: só entram recomendações sustentadas pelo motor. Palavra-chave ou segmento isolados não provam necessidade.</p>');
  h += rxSec(6, 'Próxima conversa', rxProxima(c, recs, perg, acoes)) + covPanel(c);
  h += `<details class="card"><summary><b>Fontes utilizadas (${fontes.length})</b></summary><div class="tw"><table><thead><tr><th>Tipo</th><th>Origem</th><th>Data</th><th>Natureza</th><th>Situação</th><th>Evidência</th></tr></thead><tbody>${fontes.map(f => `<tr><td>${esc(f.tipo)}</td><td class="sm">${esc(f.nome)}${f.url ? ' ' + link({ t: 'fonte', u: f.url }) : ''}</td><td class="sm nw">${f.data ? esc(dtBR(f.data)) : '—'}</td><td class="sm">${esc(SG_NAT[f.nat] || '')}</td><td class="sm">${esc(f.estado || '')}</td><td class="sm">${esc(f.evid || '')}</td></tr>`).join('')}</tbody></table></div></details>`;
  return h;
}
const rxTab = c => rxHtml(c);

/* ---------- Diagnóstico completo da oportunidade (mesma fonte: c.opps) ---------- */
function dxOpen(key, id) { UI.dx = { key, id, from: UI.view, ctab: UI.ctab }; UI.view = 'diag'; render(); window.scrollTo(0, 0); }
function dxBack() { const d = UI.dx; UI.view = d && d.from && d.from !== 'diag' ? d.from : 'cliente'; if (d?.key && UI.view === 'cliente') UI.sel = d.key; UI.dx = null; render(); }
function vDiag() {
  const d = UI.dx, c = d && S.clients[d.key];
  if (!c) return `<div class="card"><h3>Diagnóstico</h3><p>Cliente não encontrado.</p><button class="btn ghost" data-a="dxBack">Voltar</button></div>`;
  const o = rxFind(c, d.id), back = `<div class="row" style="margin-bottom:10px"><button class="btn ghost sm" data-a="dxBack">← Voltar</button><button class="btn ghost sm" data-a="open" data-k="${esc(c.key)}">Ir para o cliente</button><h2>${esc(c.name)}</h2></div>`;
  if (!o) {
    const g = ctxLacunas(c);
    return back + `<div class="card"><h3>Diagnóstico ainda não disponível</h3><p class="sm">Esta oportunidade não está na análise atual de <b>${esc(c.name)}</b>: ela pode ter perdido a evidência (ficha removida ou dado alterado) ou ainda não foi gerada. Nenhum conteúdo genérico ou de outro cliente é exibido.</p>
    <p class="sm"><b>Dependências para gerar:</b> ${g.length ? g.slice(0, 3).map(x => esc(x.falta)).join(', ') : 'nenhuma lacuna crítica'}; fichas utilizáveis: ${fichasOk(c).length}; documentos: ${(c.docs || []).length}.</p><div class="row"><button class="btn pri" data-a="dxGerar" data-k="${esc(c.key)}" data-id="${esc(d.id)}">Gerar/atualizar análise deste cliente</button></div>${d.msg ? `<div class="alert b sm">${esc(d.msg)}</div>` : ''}</div>`;
  }
  const r = { o, ...rxClass(c, o) }, k = RX_CL[r.cl], sols = o.sols || [], ct = ctxContratacao(c), dv = decGet(c, o.ruleId);
  const gaps = ctxLacunas(c).filter(x => (o.validar ? true : true)).slice(0, 3), setor = o.setorial || [];
  const sec = (t, b) => `<div class="card"><h3>${t}</h3>${b}</div>`, ul = a => a.length ? `<ul class="sm">${a.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p class="muted sm">Nada registrado.</p>';
  let h = back + `<div class="card" style="border-left:4px solid var(--ciano)"><div class="row"><h3>${esc(o.nome)}</h3>${pill(k[0], k[1])}${pill(o.tipo, 'info')}${o.modo === 'investigacao' ? chip('HIPÓTESE') : ''}<span class="sp"></span><div class="score">${o.score}</div></div><p class="sm muted">Mesma oportunidade e mesma decisão da página do cliente (${esc(o.id)}). ${esc(r.why)} Análise de ${esc(c.analyzedAt ? dtBR(c.analyzedAt) : '—')}.</p></div>`;
  h += sec('Contexto', `<p class="sm"><b>${esc(c.name)}</b> • ${esc(segName(c.segInfo?.id) || 'segmento não definido')} ${c.segInfo?.mode === 'inferido' ? chip('INFERÊNCIA') : ''} • ${esc([c.city, c.uf].filter(Boolean).join('/') || 'localidade não informada')}. ${chip('HIPÓTESE')} ${esc(o.problema || '')}</p>`);
  h += sec('Evidências', `<h4>Do cliente</h4>${ul((o.evInd || []).map(e => `${chip(e.cls)} ${esc(String(e.text).slice(0, 400))} <span class="muted">— ${esc(e.src || '')}</span>`))}<h4>Contexto setorial (não é evidência individual)</h4>${ul(setor.map(e => `${chip(e.cls || 'INFERÊNCIA')} ${esc(e.text || String(e))} ${e.src ? '<span class="muted">— ' + esc(e.src) + '</span>' : ''}`))}${o.solEvid ? `<h4>Trecho da Base de Soluções que sustenta</h4><p class="sm"><b>${esc(o.solEvid.nome)}</b>: termos em comum ${esc(o.solEvid.termos.join(', '))}. ${o.solEvid.itens.map(i => `${esc(i.k)}: “${esc(i.t)}”`).join(' • ')} ${o.solEvid.fonte ? link({ t: o.solEvid.fonte.t, u: o.solEvid.fonte.u }) + ' <span class="muted">(' + esc(o.solEvid.fonte.d || '') + ')</span>' : ''}</p>${(o.solEvid.mat || []).map(m => `<p class="sm">Material “${esc(m.titulo)}” (${esc(SM_ORIG[m.origem] || m.origem)}${m.oficial ? '' : ', não oficial'}, ${esc(fmtD(m.d))}): termos ${esc(m.termos.join(', '))} — …${esc(m.snip)}… ${m.url ? link({ t: 'origem', u: m.url }) : ''}</p>`).join('')}` : ''}`);
  h += sec('Cadeia: processo → dificuldade → impacto → capacidade → validação', semCadeiaHtml(o) || '<p class="muted sm">Sem cadeia disponível.</p>');
  h += sec('Solução e aderência', (sols.length ? '<ul class="sm">' + sols.map(s => `<li><b>${esc(s.nome)}</b> <span class="muted">(${esc(s.cat || '')})</span> — ${esc(s.finalidade || '')}<div class="muted">Limites: ${esc(s.limites || '—')}</div><div>Contratação: ${pill(CT_EST[contratEstado(c, s.id)], CT_EST_K[contratEstado(c, s.id)])} • Fonte: ${link(s.fonte)} • consulta ${esc(s.consulta || '')}</div><div>${s.integraProtheus === true ? 'Integração com Protheus documentada.' : s.integraProtheus === false ? 'NÃO integra com Protheus segundo a fonte.' : 'Compatibilidade com Protheus não verificada — validar.'}</div></li>`).join('') + '</ul>' : '<p class="muted sm">Ação de relacionamento, sem solução de produto.</p>') + `<details><summary class="sm">Critérios (${o.score}/100)</summary><div class="crit">${Object.entries(o.crit || {}).map(([kk, v]) => `<div>${esc(CRIT[kk])}</div><div>${v}/3</div>`).join('')}</div></details>`);
  h += sec('Benefícios possíveis', `<p class="sm">${chip('HIPÓTESE')} ${esc(o.impacto || '—')} Sem estimativa de receita nem preços (não inventados).</p>`);
  h += `<div class="grid g2">${sec('Premissas e requisitos', ul((o.deps || []).map(esc)) + (o.escopo?.length ? '<h4>Escopo preliminar</h4>' + ul(o.escopo.map(esc)) : ''))}${sec('Pendências', ul([...(o.validar ? [esc(String(o.validar))] : []), ...gaps.map(x => `${esc(x.falta)} — ${esc(x.decisao)}`)]))}</div>`;
  h += `<div class="grid g2">${sec('Perguntas de validação', ul((o.perg || []).map(esc)))}${sec('Próxima ação', `<p class="sm">${esc(o.acao || '—')}</p>`)}</div>`;
  h += avDiagSec(c, o);
  h += sec('Situação comercial e decisão', `${pill(VALID_L[dv.valid], dv.valid === 'validada' ? 'ok' : dv.valid === 'descartada' ? 'bad' : 'warn')} ${pill(SIT_L[dv.sit], 'info')}${dimsHtml(c, o)}${decCtl(c, o)}<p class="muted sm">Validações, descartes e encerramentos são preservados nas reavaliações.</p>`);
  return h;
}

const RX_ACT = {
  dxOpen: t => dxOpen(t.dataset.k, t.dataset.id), dxBack,
  dxOpenLnk: (t, e) => { e.preventDefault(); dxOpen(t.dataset.k, t.dataset.id); },
  dxGerar: t => { const c = S.clients[t.dataset.k]; reanalyze([t.dataset.k], 'Análise gerada a partir do diagnóstico'); if (!rxFind(S.clients[t.dataset.k], t.dataset.id)) UI.dx.msg = 'Após reavaliar, esta oportunidade continua sem evidência suficiente. Veja o Raio-X do cliente para as lacunas.'; render(); },
  rxRefresh: t => { reanalyze([t.dataset.k], 'Reavaliação manual do Raio-X'); render(); toast('Raio-X reavaliado.'); },
  rxCnpj: t => { UI.sel = t.dataset.k; UI.view = 'cnpj'; render(); },
  usoAsk: t => { UI.usoAsk = UI.usoAsk === t.dataset.id ? null : t.dataset.id; render(); },
  usoOn: t => { const f = $('#uso_f')?.value; UI.usoAsk = null; usoSet(t.dataset.k, t.dataset.id, true, f); if (!S.clients[t.dataset.k].usoConf?.[t.dataset.id]) { UI.usoAsk = t.dataset.id; render(); } },
  ceOpenTab: t => { UI.ctab = 'resumo'; ceOpen(t.dataset.k); },
  usoOff: t => usoSet(t.dataset.k, t.dataset.id, false)
};
