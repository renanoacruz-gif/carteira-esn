/* ===== Rodada 12: sinais estruturados, regra de print isolado, pesquisa da empresa, interlocutores, roteiro e adoção ===== */
const SG_T = { sistema: 'Sistema/ferramenta citado', manual: 'Rotina manual', dificuldade: 'Dificuldade ou dor', estrutura: 'Estrutura e expansão', indicador: 'Indicador numérico' };
const SG_RE = {
  sistema: /\b(excel|planilhas?|whats\s?app|sap(?:\s?b1)?|oracle|senior|dom[ií]nio|sankhya|omie|bling|conta azul|power\s?bi|access|winthor|mega\s?erp|nasajon|fortes|erp (?:antigo|legado)|sistema (?:antigo|legado|pr[oó]prio))\b/i,
  manual: /(digita[cç][aã]o manual|lan[cç]ad\w+ manual\w*|controle (?:em|na) planilha|confer[eê]ncia manual|processo manual|feito (?:[aà] m[aã]o|manualmente)|em papel|no papel|retrabalho|planilhas? paralela|planilhas? de controle)/i,
  dificuldade: /(dificuldade|demora|atraso|lentid[aã]o|erros? (?:de|no|na)|falta de (?:visibilidade|controle|integra[cç][aã]o)|n[aã]o consegu\w+|gargalo|perdas?\b|diverg[eê]ncia|inconsist[eê]ncia|reclama\w*)/i,
  estrutura: /(nova (?:filial|unidade|planta|f[aá]brica|loja)|expans[aã]o|abertura de|aquisi[cç][aã]o|fus[aã]o|\bfiliais?\b|\d+ (?:filiais|lojas|unidades|colaboradores|funcion[aá]rios))/i,
  indicador: /\d[\d.,]*\s?(?:%|por cento|horas?\b|dias?\b|colaboradores|funcion[aá]rios|usu[aá]rios|pedidos|toneladas|m[²2]\b)/i
};
const SG_NAT = { planilha: 'Declarado na planilha', documento: 'Extraído de documento', ocr: 'Extraído por OCR (conferir)', manual: 'Declaração do executivo', publico: 'Informação pública (fonte e link)', ia: 'Inferência da IA (a confirmar)' };
const SG_CLS = { sistema: 'FATO', estrutura: 'FATO', indicador: 'FATO', manual: 'INFERÊNCIA', dificuldade: 'INFERÊNCIA' };
const OCR_Q = 'O print/imagem representa o processo completo ou só uma etapa? Quem executa, com que frequência e em qual sistema?';
const isOcrSrc = s => /\(OCR\b/.test(String(s || ''));

/* ---------- 1) sinais: extração única, com natureza, fonte, data e trecho ---------- */
function sgExtrair(t, meta) {
  const txt = String(t || '').slice(0, 60000), out = [], seen = new Set();
  for (const [tipo, re] of Object.entries(SG_RE)) {
    const g = new RegExp(re.source, 'ig'); let x, n = 0;
    while ((x = g.exec(txt)) && n < 3) {
      const tr = snippet(txt, x.index, 140), k = tipo + '|' + norm(tr).slice(0, 80); if (seen.has(k)) continue; seen.add(k); n++;
      out.push({ tipo, termo: x[0].trim(), trecho: tr, cls: meta.ocr ? 'NECESSITA VALIDAÇÃO' : SG_CLS[tipo], ...meta });
    }
  }
  return out;
}
const _sg = new WeakMap();
function ctxSinais(c) {
  const ck = [c.notes?.length || 0, c.mgmt?.notes?.length || 0, (c.docs || []).map(d => d.id + (d.text || '').length).join(',')].join('|'), hit = _sg.get(c); if (hit && hit.k === ck) return hit.v;
  const parts = []; if (c.notes) parts.push({ t: c.notes, src: 'Planilha (Observações)', nat: 'planilha', data: null });
  (c.docs || []).forEach(d => parts.push({ t: d.text, src: d.name, nat: d.ocr ? 'ocr' : 'documento', data: d.at || null, ocr: !!d.ocr }));
  if (c.mgmt?.notes) parts.push({ t: c.mgmt.notes, src: 'Observações manuais', nat: 'manual', data: null });
  const v = parts.flatMap(p => sgExtrair(p.t, { src: p.src, nat: p.nat, data: p.data, ocr: p.ocr })); _sg.set(c, { k: ck, v }); return v;
}
function sgHtml(c) {
  const L = ctxSinais(c); if (!L.length) return '<p class="muted sm">Nenhum sistema, rotina manual, dificuldade, indicador ou expansão foi extraído dos textos disponíveis. Anexe atas, propostas, e-mails ou prints para enriquecer.</p>';
  const ocr = [...new Set(L.filter(x => x.ocr).map(x => x.src.replace(/ \(OCR.*$/, '')))];
  return `<div class="tw"><table><thead><tr><th>Tipo</th><th>Trecho</th><th>Natureza</th><th>Fonte / data</th><th>Rótulo</th></tr></thead><tbody>${Object.keys(SG_T).flatMap(t => L.filter(x => x.tipo === t).slice(0, 4)).map(x => `<tr><td class="sm nw">${esc(SG_T[x.tipo])}</td><td class="sm">…${esc(x.trecho)}…</td><td class="sm">${pill(SG_NAT[x.nat], x.ocr ? 'warn' : 'info')}</td><td class="sm">${esc(x.src)}${x.data ? ' • ' + esc(dtBR(x.data)) : ''}</td><td>${chip(x.cls)}</td></tr>`).join('')}</tbody></table></div>
  <p class="muted sm">Extração por termos, feita uma vez e reutilizada nas recomendações. Termo encontrado indica pista, não confirma a dor nem o processo.</p>${ocr.length ? `<div class="alert i sm"><b>Print isolado não define o processo inteiro.</b> ${ocr.map(n => `Sobre “${esc(n)}”: ${esc(OCR_Q)}`).join('<br>')}</div>` : ''}`;
}
/* após a análise: oportunidade sustentada só por OCR ganha a pergunta de confirmação e fica marcada */
function sgPost(c) {
  (c.opps || []).forEach(o => { const ev = o.evInd || []; if (ev.length && ev.every(e => isOcrSrc(e.src))) { o.ocrIsolado = true; o.perg = [OCR_Q, ...(o.perg || []).filter(p => p !== OCR_Q)]; } });
}

/* ---------- 2) uso do que já é cobrado: adoção, treinamento, parametrização ---------- */
function adocaoOpps(c) {
  const out = [], dq = dataQuality(c);
  ctxContratacaoRaw(c).filter(p => p.estado === 'faturamento' && !p.incerto).slice(0, 3).forEach(p => {
    const s = activeSols().find(x => x.id === p.id); if (!s || !(s.funcionalidades || []).length) return;
    const l = solLegacy(s), fn = s.funcionalidades.slice(0, 3).map(x => x.t);
    out.push(mkOpp(c, { ruleId: 'adocao_' + p.id, tipo: 'Otimização', tipoBase: 'Otimização', nome: `Adoção e uso de “${p.nome}” (cobrança identificada)`, modo: 'investigacao',
      problema: `INVESTIGAÇÃO RECOMENDADA: “${p.nome}” aparece no faturamento, mas cobrança não prova uso nem maturidade; verificar se há funcionalidades subutilizadas antes de propor nova solução.`,
      impacto: 'HIPÓTESE: melhor aproveitamento do que já é contratado (treinamento, parametrização, revisão de processos); sem estimativa de ganho.',
      evInd: [{ cls: 'FATO', text: `Item cobrado: ${p.nome} (competência ${p.ultima || 'não informada'})`, src: p.fat[0]?.src || 'Ficha de faturamento' }], sols: [l], extraBase: [s.id], natureza: ['TREINAMENTO', 'PARAMETRIZAÇÃO', 'PROCESSO'],
      deps: ['Confirmar com o cliente o que está em uso hoje', 'Disponibilidade comercial de serviços de capacitação a confirmar'],
      perg: [`Quais funcionalidades de ${p.nome} estão em uso e por quais áreas?`, ...fn.map(t => `A rotina “${t}” é usada hoje, feita fora do sistema ou ainda não existe?`)].slice(0, 4), acao: 'Levantar o uso real e avaliar treinamento, parametrização ou revisão de processo.', origens: ['faturamento + Base de Soluções'] },
      { evidencia: 1, aderencia: l.integraProtheus === true ? 3 : 2, impacto: 1, urgencia: 0, viabilidade: 2, dados: dq }));
  });
  return out;
}

/* ---------- 3) interlocutores por função e roteiro da abordagem ---------- */
const SG_FUNC = { fiscal: 'Controladoria / Fiscal-Tributário', sst: 'RH / Departamento Pessoal / SST', financeiro: 'Financeiro / Tesouraria', processos: 'Gestão de processos / TI', producao: 'Produção / PCP / Manutenção', analytics: 'Diretoria / Controladoria', logistica: 'Logística / Supply Chain', sustentacao: 'TI / Infraestrutura', treinamento: 'Gestor da área e usuários-chave', nfse: 'Fiscal / Contabilidade', obras: 'Engenharia / Suprimentos', retencao: 'Patrocinador (diretoria / proprietário)' };
function oppFuncao(o) {
  if (/^adocao_/.test(o.ruleId)) return SG_FUNC.treinamento; if (/^release_/.test(o.ruleId)) return SG_FUNC.sustentacao; if (o.ruleId === 'regulatorio') return SG_FUNC.fiscal;
  const need = RULES.find(r => r.id === o.ruleId)?.need || (o.sols || []).flatMap(s => s.necessidades || [])[0]; return SG_FUNC[need] || null;
}
function rxInterlocutores(c, recs) {
  const m = new Map(); recs.filter(r => r.cl !== 'nao').forEach(r => { const f = oppFuncao(r.o); if (f) (m.get(f) || m.set(f, []).get(f)).push(r.o.nome); });
  const L = [...m].map(([f, n]) => ({ f, n: n.slice(0, 3) })); if (recs.some(r => r.cl === 'prioridade')) L.push({ f: 'Patrocinador (diretoria / proprietário)', n: ['decisão e prioridade'] }); return L;
}
function rxRoteiro(c) {
  const recs = rxRecs(c), pri = recs.filter(r => r.cl === 'prioridade'), inv = recs.filter(r => r.cl === 'investigar'), lac = ctxLacunas(c).slice(0, 3), ft = (c.fatos || []).slice(0, 2);
  const L = [`ROTEIRO DE ABORDAGEM — ${c.name}`, `Gerado em ${dtBR(nowISO())}. Base: dados já registrados; nada aqui é evidência nova. Validar tudo com o cliente.`, '', 'ABERTURA (fatos com fonte)'];
  L.push(...(ft.length ? ft.map(x => `- ${x.titulo} (${x.fonteNome}, ${fmtD(x.data)})`) : ['- Sem fato individual registrado; abrir com perguntas de contexto.']));
  L.push('', 'TEMAS PRIORITÁRIOS'); L.push(...(pri.length ? pri.map(r => `- ${r.o.nome}: ${r.o.acao || ''}`) : ['- Nenhuma recomendação priorizada.']));
  L.push('', 'A INVESTIGAR'); L.push(...(inv.length ? inv.slice(0, 4).map(r => `- ${r.o.nome}`) : ['- —']));
  L.push('', 'PERGUNTAS'); L.push(...[...new Set([...pri, ...inv].flatMap(r => (r.o.perg || []).slice(0, 2)))].slice(0, 8).map((p, i) => `${i + 1}. ${p}`));
  L.push('', 'INTERLOCUTORES SUGERIDOS (por função; confirmar com o cliente)'); L.push(...rxInterlocutores(c, recs).map(x => `- ${x.f}: ${x.n.join('; ')}`));
  L.push('', 'CUIDADOS'); L.push('- Ausência na ficha não prova que o cliente não possui a solução; cobrança não prova uso.'); if (recs.some(r => r.o.ocrIsolado)) L.push('- Há indício vindo apenas de print: confirmar o processo completo.');
  L.push(...lac.map(x => `- Falta: ${x.falta} (decide: ${x.decisao})`)); return L.join('\n');
}
function rxProxima(c, recs, perg, acoes) {
  const itl = rxInterlocutores(c, recs);
  const desc = recs.some(r => r.cl === 'prioridade') ? [] : semDescoberta(c);
  return `<h4>Perguntas essenciais</h4>${perg.length ? '<ol class="sm">' + perg.map(p => `<li>${esc(p)}</li>`).join('') + '</ol>' : '<p class="muted sm">Sem perguntas pendentes.</p>'}
  ${desc.length ? `<h4>Perguntas de descoberta <span class="muted sm">(sem evidência suficiente para priorizar; baseadas nos processos típicos do segmento)</span></h4><ol class="sm">${desc.map(p => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}
  <h4>Interlocutores sugeridos por função ${chip('HIPÓTESE')}</h4>${itl.length ? '<ul class="sm">' + itl.map(x => `<li><b>${esc(x.f)}</b> <span class="muted">— ${esc(x.n.join('; '))}</span></li>`).join('') + '</ul><p class="muted sm">Sugestão por função, sem nomes: confirme quem exerce o papel no cliente.</p>' : '<p class="muted sm">Sem recomendações ativas para sugerir funções.</p>'}
  <h4>Ações práticas</h4>${acoes.length ? '<ul class="sm">' + acoes.map(p => `<li>${esc(p)}</li>`).join('') + '</ul>' : '<p class="muted sm">Nenhuma recomendação priorizada ainda; investigue as hipóteses acima.</p>'}
  <h4>Síntese de abordagem <span class="muted sm">(motivo, assunto, solução possível, pergunta; nada é enviado)</span></h4>${abCliHtml(c)}
  <div class="row"><button class="btn pri sm" data-a="rxCopiar" data-k="${esc(c.key)}">Copiar roteiro da abordagem</button><button class="btn ghost sm" data-a="rxBaixar" data-k="${esc(c.key)}">Baixar .txt</button></div>`;
}

/* ---------- 4) pesquisa da empresa e do mercado (IA com busca web; nada simulado) ---------- */
const EM_TOP = { atividade: 'Atividades e produtos', mercado: 'Mercados atendidos', estrutura: 'Estrutura operacional', expansao: 'Expansão', investimento: 'Investimento', custos: 'Pressão de custo/produtividade', tendencia: 'Tendência tecnológica', regulatorio: 'Mudança regulatória', noticia: 'Notícia' };
const EM_FATO = { atividade: 'mercado', mercado: 'mercado', estrutura: 'mudanca', expansao: 'expansao', investimento: 'investimento', custos: 'pressao', tendencia: 'mercado', regulatorio: 'mudanca', noticia: 'noticia' };
function emDados(c) { const cd = c.cnpjCad; return { nome: scrub(c.name), local: [c.city, c.uf].filter(Boolean).join(' / '), site: c.site || '', atividade: scrub(cd ? (cd.cnaePrincipal || cd.atividade || '') : ''), segmento: c.segInfo?.id ? segName(c.segInfo.id) : '' }; }
function emPrompt(d) {
  return `Você é analista de inteligência comercial. Pesquise na web, em fontes confiáveis e verificáveis, a empresa abaixo e o contexto do seu mercado.
Empresa: ${d.nome}. Local: ${d.local || 'não informado'}. Site: ${d.site || 'não informado'}. Atividade: ${d.atividade || 'não informada'}. Segmento: ${d.segmento || 'não informado'}.
Cubra: atividades, produtos, serviços e mercados atendidos; estrutura operacional publicamente identificável; expansões, investimentos e acontecimentos relevantes; pressões de custo, produtividade e competitividade; tendências tecnológicas e mudanças regulatórias aplicáveis ao segmento.
Regras: IDENTIDADE primeiro. Existem empresas de nomes semelhantes: só marque "confirmada" quando site, cidade/UF ou atividade da fonte coincidem com os dados acima; use "provavel" ou "ambigua" quando não der para afirmar e liste os homônimos em "homonimos". Inclua SOMENTE itens com fonte consultada, URL exata e data; não invente números, datas ou fontes; tendência setorial NÃO é dor comprovada da empresa; inferências ficam em "implicacao" como hipótese. Máximo 10 itens.
Devolva apenas JSON: {"itens":[{"topico":"atividade|mercado|estrutura|expansao|investimento|custos|tendencia|regulatorio|noticia","afirmacao":"","fonteNome":"","fonteUrl":"","dataEvento":"AAAA-MM-DD","dataPublicacao":"AAAA-MM-DD","identidade":"confirmada|provavel|ambigua","evidenciaIdentidade":"como a fonte coincide com a empresa","implicacao":"possível implicação comercial (hipótese)"}],"homonimos":[""]}`;
}
function emPrep(key) { UI.em = UI.em?.key === key && UI.em.prev ? null : { key, prev: true }; render(); }
async function emEnviar(key) {
  const c = S.clients[key]; if (!c || UI.em?.busy) return; const T = aiTarefa('mercado'), d = emDados(c), prompt = emPrompt(d);
  if (new RegExp(CNPJ_TXT.source).test(prompt) || new RegExp(MONEY_TXT.source).test(prompt)) return toast('O pedido ainda contém CNPJ ou valores.');
  const pedido = { versao: 2, pedidoId: 'e_' + uid(), provedor: T.prov, modelo: T.modelo, tarefa: 'pesquisa', formato: 'json', buscaWeb: T.busca !== false, prompt };
  S.meta.emPend = { ...(S.meta.emPend || {}), [pedido.pedidoId]: { key, at: nowISO() } }; const ks = Object.keys(S.meta.emPend); if (ks.length > 8) delete S.meta.emPend[ks.sort((a, b) => S.meta.emPend[a].at.localeCompare(S.meta.emPend[b].at))[0]]; touchMeta();
  UI.em = { key, busy: true }; render();
  try { const r = await bkChamar('ia', pedido, `pedido-empresa-${pedido.pedidoId}.json`); if (r.via === 'direto') await empresaResposta(r.resp); else { UI.em = { key, aviso: `Pedido gerado como arquivo. ${r.motivo || ''} Envie-o ao backend e importe a resposta em “Importar resposta”.` }; } }
  catch (e) { UI.em = { key, err: e.message }; intLog({ sistema: 'ia', op: 'empresa', estado: 'erro', msg: e.message }); }
  render();
}
async function empresaResposta(j) {
  const f = (S.meta.emPend || {})[j.pedidoId], c = f && S.clients[f.key]; if (!c) throw new Error('Resposta de pesquisa da empresa sem pedido/cliente correspondente neste navegador.');
  if (!j.ok) { UI.em = { key: c.key, err: `${j.erro?.codigo || 'erro'}: ${j.erro?.mensagem || 'falha'}` }; if (j.provedor !== 'pagina') intSet('empresa', { ok: false, msg: j.erro?.codigo || 'erro' }); return true; }
  if (j.provedor !== 'pagina') intSet('empresa', { ok: !!j.usouBusca, msg: j.usouBusca ? 'pesquisa com busca web' : 'respondeu sem busca web (não comprova a capacidade)' });
  const itens = Array.isArray(j.dados?.itens) ? j.dados.itens.slice(0, 12) : [], fontes = cap(j.fontes, 40).map(x => normUrl(s4(x.u, 500))), rep = { total: itens.length, novos: 0, dup: 0, semFonte: 0, ambig: 0, homonimos: cap(j.dados?.homonimos, 6).map(x => s4(x, 100)).filter(Boolean), usouBusca: !!j.usouBusca, avisos: cap(j.avisos, 5).map(x => s4(x, 300)) };
  c.sugFatos ||= [];
  for (const x of itens) {
    const url = /^https?:\/\//i.test(String(x.fonteUrl || '')) ? s4(x.fonteUrl, 500) : '', txt = s4(x.afirmacao, 500).trim(); if (!url || txt.length < 8) { rep.semFonte++; continue; }
    const id0 = ['confirmada', 'provavel', 'ambigua'].includes(x.identidade) ? x.identidade : 'ambigua', verif = !!(j.usouBusca && fontes.includes(normUrl(url)));
    if ((c.sgRej || []).includes(normUrl(url))) { rep.rej = (rep.rej || 0) + 1; continue; } /* fonte já rejeitada por você: não volta */
    if (c.sugFatos.some(y => y.url === url && norm(y.texto) === norm(txt)) || (c.fatos || []).some(y => y.url === url && norm(y.titulo) === norm(txt.slice(0, 200)))) { rep.dup++; continue; }
    if (id0 === 'ambigua') rep.ambig++;
    c.sugFatos.unshift({ id: 'sg_' + uid(), topico: EM_TOP[x.topico] ? x.topico : 'noticia', texto: txt, fonteNome: s4(x.fonteNome, 120), url, data: mkIso(x.dataEvento) || mkIso(x.dataPublicacao), verificada: verif, identidadeIA: id0, evidIdent: s4(x.evidenciaIdentidade, 300), impl: s4(x.implicacao, 400), at: nowISO(), prov: s4(j.provedor, 20), usouBusca: !!j.usouBusca, estado: 'pendente' }); rep.novos++;
  }
  c.sugFatos = c.sugFatos.slice(0, 40); delete S.meta.emPend[j.pedidoId]; touchC(c.key); touchMeta();
  if (!itens.length) rep.avisos.push(j.dados ? 'A resposta não trouxe itens.' : 'O modelo não devolveu JSON válido; nada foi gravado.');
  UI.em = { key: c.key, rep }; intLog({ sistema: 'ia', op: 'empresa', estado: rep.novos ? 'ok' : 'aviso', msg: `${rep.novos} sugestão(ões), ${rep.dup} duplicada(s), ${rep.ambig} ambígua(s)`, n: rep.novos }); render(); return true;
}
function sgConfirmar(key, id) {
  const c = S.clients[key], s = (c?.sugFatos || []).find(x => x.id === id); if (!s) return;
  if (!mkIso(s.data)) return toast('Sem data válida: registre manualmente em “+ Registrar fato” depois de conferir a fonte.');
  if (s.identidadeIA === 'ambigua' && !confirm('A IA marcou a identidade como ambígua (possível homônimo). Confirmar mesmo assim que a fonte é sobre ESTA empresa?')) return;
  c.fatos ||= []; c.fatos.unshift({ id: 'ft_' + uid(), titulo: s.texto.slice(0, 200), tipo: EM_FATO[s.topico] || 'outro', fonteNome: s.fonteNome || 'fonte', url: s.url, data: s.data, identidade: `Confirmada pelo executivo sobre sugestão da IA (${s.identidadeIA}). ${s.evidIdent || ''}`.slice(0, 300), resumo: [s.texto, s.impl ? 'Possível implicação (hipótese): ' + s.impl : ''].filter(Boolean).join(' ').slice(0, 800), origem: 'ia-confirmado', at: nowISO() });
  s.estado = 'confirmado'; reanalyze([key], 'Fato confirmado a partir de pesquisa da empresa'); render(); toast('Fato registrado com identidade confirmada por você.');
}
function sgDescartar(key, id) { const c = S.clients[key], s = (c?.sugFatos || []).find(x => x.id === id); if (!s) return; s.estado = 'descartado'; s.estadoEm = nowISO(); const k = normUrl(s.url); if (k) { c.sgRej = [k, ...(c.sgRej || []).filter(x => x !== k)].slice(0, 200); } touchC(key); render(); toast('Rejeitado. Esta fonte não volta a ser sugerida para este cliente.'); }
function sgArquivar(key, id) { const c = S.clients[key], s = (c?.sugFatos || []).find(x => x.id === id); if (!s) return; s.estado = 'arquivado'; s.estadoEm = nowISO(); touchC(key); render(); }
function sgRestaurar(key, id) { const c = S.clients[key], s = (c?.sugFatos || []).find(x => x.id === id); if (!s) return; s.estado = 'pendente'; const k = normUrl(s.url); c.sgRej = (c.sgRej || []).filter(x => x !== k); touchC(key); render(); }
function emPanel(c) {
  const e = UI.em?.key === c.key ? UI.em : null, T = aiTarefa('mercado'), st = iaStatusOf(T.prov), sug = (c.sugFatos || []).filter(x => x.estado === 'pendente');
  let h = `<h4>Pesquisa da empresa e do mercado (IA com busca web)</h4><div class="row sm"><button class="btn pri sm" data-a="emPrep" data-k="${esc(c.key)}">${e?.prev ? 'Fechar' : 'Pesquisar empresa e mercado'}</button><span class="muted">${esc(AI_PROV[T.prov].nome)} / ${esc(T.modelo)} — ${esc(st.l)}</span></div>`;
  if (e?.prev) { const d = emDados(c); h += `<div class="alert i sm"><b>Será enviado ao provedor:</b> razão social “${esc(d.nome)}”, local ${esc(d.local || '—')}, site ${esc(d.site || '—')}, atividade ${esc(d.atividade || '—')}, segmento ${esc(d.segmento || '—')}. <b>Não será enviado:</b> CNPJ, valores, fichas, documentos nem observações.<div class="row" style="margin-top:6px"><button class="btn pri sm" data-a="emEnviar" data-k="${esc(c.key)}">Autorizar e enviar</button></div></div>`; }
  h += bdPanel(c);
  if (e?.busy) h += '<p class="sm muted">Pesquisando…</p>'; if (e?.err) h += `<div class="alert b sm" role="alert">${esc(e.err)}</div>`; if (e?.aviso) h += `<div class="alert i sm">${esc(e.aviso)}</div>`;
  if (e?.rep) h += `<div class="alert i sm">${e.rep.novos} sugestão(ões) nova(s) a confirmar • ${e.rep.dup} duplicada(s) • ${e.rep.semFonte} sem fonte descartada(s) • ${e.rep.ambig} com identidade ambígua${e.rep.rej ? ` • ${e.rep.rej} de fonte que você já rejeitou (ignorada)` : ''}. ${e.rep.usouBusca ? '' : '<b>Busca web não utilizada:</b> conteúdo do conhecimento do modelo, sem fonte verificada. '}${e.rep.homonimos.length ? 'Nomes semelhantes citados: ' + e.rep.homonimos.map(esc).join('; ') + '. ' : ''}${e.rep.avisos.map(esc).join(' ')}</div>`;
  h += sug.length ? `<p class="sm"><b>${sug.length} sugestão(ões) da IA aguardando sua confirmação</b> ${chip('NECESSITA VALIDAÇÃO')} — só viram fato após você confirmar que a fonte é sobre esta empresa.</p>` + sug.map(s => `<div class="opp"><div class="row"><b>${esc(EM_TOP[s.topico])}</b>${pill('identidade: ' + s.identidadeIA, s.identidadeIA === 'confirmada' ? 'ok' : s.identidadeIA === 'provavel' ? 'warn' : 'bad')}${s.verificada ? pill('fonte citada na busca', 'ok') : pill('fonte não verificada', 'warn')}<span class="sp"></span><button class="btn pri sm" data-a="sgConf" data-k="${esc(c.key)}" data-id="${s.id}">Confirmar identidade e registrar</button><button class="btn ghost sm" data-a="sgArq" data-k="${esc(c.key)}" data-id="${s.id}" title="Guarda sem registrar como fato; pode ser restaurado">Arquivar</button><button class="btn ghost sm" data-a="sgDesc" data-k="${esc(c.key)}" data-id="${s.id}" title="A fonte não volta a ser sugerida para este cliente">Rejeitar</button></div><div class="sm">${esc(s.texto)}</div><div class="sm muted">${link({ t: s.fonteNome || 'fonte', u: s.url })} • ${s.data ? esc(fmtD(s.data)) : 'sem data'} • ${esc(s.evidIdent || 'sem evidência de identidade')}${s.impl ? ' • implicação (hipótese): ' + esc(s.impl) : ''}</div></div>`).join('') : '';
  { const fora = (c.sugFatos || []).filter(x => x.estado === 'descartado' || x.estado === 'arquivado'); if (fora.length) h += `<details class="sm" id="sg-fora"><summary>Rejeitados e arquivados (${fora.length})</summary>${fora.map(s => `<div class="row sm" style="gap:8px;padding:4px 0;border-top:1px solid var(--bd2)">${pill(s.estado === 'descartado' ? 'rejeitado' : 'arquivado', s.estado === 'descartado' ? 'bad' : 'off')}<span style="flex:1">${esc(s.texto.slice(0, 160))} <span class="muted">— ${esc(s.fonteNome || hostOf(s.url) || 'fonte')}</span></span><button class="btn ghost sm" data-a="sgRest" data-k="${esc(c.key)}" data-id="${s.id}">Restaurar</button></div>`).join('')}</details>`; }
  return h + (st.k !== 'verificado' ? '<p class="muted sm">Sem provedor testado, não há pesquisa automática: registre fatos manualmente (fonte, link e data). Nada é simulado.</p>' : '');
}
/* Busca dedicada (versão hospedada): provedor de pesquisa configurado no servidor. Vai só razão social e cidade, com autorização.
   Resultado é indício: entra como sugestão PENDENTE, com identidade "ambígua" até o executivo confirmar. Sem provedor, nada é simulado. */
function bdPanel(c) {
  if (!window.__HOSTED__) return ''; usoCarregar(); if (!USO.d) return ''; const prov = USO.d.busca, b = UI.bd?.key === c.key ? UI.bd : null;
  if (!prov) return '<p class="sm muted" id="bd-off"><b>Busca dedicada: não configurada.</b> Nenhum provedor de pesquisa está ligado ao servidor; registre fatos manualmente (fonte, link e data). Nada é simulado.</p>';
  const d = emDados(c), q = [d.nome, c.city].filter(Boolean).join(' ');
  let h = `<div class="row sm" id="bd"><button class="btn sm" data-a="bdPrep" data-k="${esc(c.key)}">${b?.prev ? 'Fechar' : 'Buscar notícias (' + esc(prov) + ')'}</button><span class="muted">Busca dedicada, sem IA: devolve links para você conferir.</span></div>`;
  if (b?.prev) h += `<div class="alert i sm"><b>Será enviado ao provedor de busca:</b> “${esc(q)}”. <b>Não será enviado:</b> CNPJ, valores, fichas, documentos nem observações.<div class="row" style="margin-top:6px"><button class="btn pri sm" data-a="bdBuscar" data-k="${esc(c.key)}">Autorizar e buscar</button></div></div>`;
  if (b?.busy) h += '<p class="sm muted">Buscando…</p>'; if (b?.err) h += `<div class="alert b sm" role="alert">${esc(b.err)}</div>`;
  if (b?.res) h += `<div class="alert i sm">${b.res.length} resultado(s) de ${esc(b.prov)} em ${esc(dtBR(b.em))}. <b>São indícios</b>: abra a fonte e confirme que trata desta empresa.</div>` + b.res.map((r, i) => `<div class="opp"><div class="row"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(r.titulo)}</b></a><span class="sp"></span>${r.ok ? pill('guardada', 'ok') : `<button class="btn ghost sm" data-a="bdGuardar" data-k="${esc(c.key)}" data-i="${i}">Guardar como sugestão</button>`}</div><div class="sm muted">${esc(r.host)}${r.data ? ' • ' + esc(fmtD(r.data)) : ' • sem data informada pelo provedor'}</div>${r.trecho ? `<div class="sm">${esc(r.trecho)}</div>` : ''}</div>`).join('');
  return h;
}
const BD_ACT = {
  bdPrep: t => { const k = t.dataset.k; UI.bd = UI.bd?.key === k && UI.bd.prev ? null : { key: k, prev: true }; render(); },
  bdBuscar: async t => {
    const c = S.clients[t.dataset.k]; if (!c || UI.bd?.busy) return; const q = [emDados(c).nome, c.city].filter(Boolean).join(' ');
    if (new RegExp(CNPJ_TXT.source).test(q) || new RegExp(MONEY_TXT.source).test(q)) return toast('A consulta ainda contém CNPJ ou valores.');
    UI.bd = { key: c.key, busy: true }; render();
    try { const r = await fetch('/api/busca', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', redirect: 'manual', body: JSON.stringify({ q, n: 6 }) }); let j = null; try { j = await r.json(); } catch { /* sem corpo */ }
      if (!j || !j.ok) { const m = j?.erro?.mensagem || 'A busca não respondeu.'; UI.bd = { key: c.key, err: m }; intLog({ sistema: 'busca', op: 'noticias', estado: 'erro', msg: m }); }
      else { UI.bd = { key: c.key, prov: s4(j.provedor, 40), em: j.consultadoEm, res: cap(j.resultados, 8).filter(x => /^https:\/\//i.test(String(x?.url || ''))).map(x => ({ titulo: s4(x.titulo, 200), url: s4(x.url, 500), host: s4(x.host, 120), trecho: s4(x.trecho, 400), data: mkIso(x.data) || '' })) }; intLog({ sistema: 'busca', op: 'noticias', estado: 'ok', msg: `${UI.bd.res.length} resultado(s)`, n: UI.bd.res.length }); USO.t = 0; } }
    catch (e) { UI.bd = { key: c.key, err: 'Sem conexão com o servidor.' }; }
    render();
  },
  bdGuardar: t => {
    const c = S.clients[t.dataset.k], b = UI.bd, r = b?.key === c?.key ? b.res?.[+t.dataset.i] : null; if (!c || !r) return; c.sugFatos ||= [];
    if ((c.sgRej || []).includes(normUrl(r.url))) return toast('Você já rejeitou esta fonte para este cliente.');
    if (c.sugFatos.some(y => normUrl(y.url) === normUrl(r.url)) || (c.fatos || []).some(y => normUrl(y.url) === normUrl(r.url))) { r.ok = true; render(); return toast('Esta fonte já está nas sugestões ou nos fatos do cliente.'); }
    c.sugFatos.unshift({ id: 'sg_' + uid(), topico: 'noticia', texto: [r.titulo, r.trecho].filter(Boolean).join(' — ').slice(0, 500), fonteNome: r.host, url: r.url, data: r.data || '', verificada: true, identidadeIA: 'ambigua', evidIdent: 'Resultado de busca dedicada; identidade não verificada.', impl: '', at: nowISO(), prov: b.prov, usouBusca: true, estado: 'pendente' });
    c.sugFatos = c.sugFatos.slice(0, 40); r.ok = true; touchC(c.key); render(); toast('Guardada como sugestão pendente. Confirme a identidade antes de virar fato.');
  }
};
const SG_ACT = {
  emPrep: t => emPrep(t.dataset.k), emEnviar: t => emEnviar(t.dataset.k), sgConf: t => sgConfirmar(t.dataset.k, t.dataset.id), sgDesc: t => sgDescartar(t.dataset.k, t.dataset.id), sgArq: t => sgArquivar(t.dataset.k, t.dataset.id), sgRest: t => sgRestaurar(t.dataset.k, t.dataset.id),
  rxCopiar: async t => { const c = S.clients[t.dataset.k]; if (!c) return; const txt = rxRoteiro(c); try { await navigator.clipboard.writeText(txt); toast('Roteiro copiado.'); } catch (e) { offer(`roteiro-${norm(c.name).replace(/\W+/g, '-').slice(0, 40)}.txt`, txt); toast('Cópia bloqueada neste ambiente: arquivo gerado.'); } },
  rxBaixar: t => { const c = S.clients[t.dataset.k]; if (c) offer(`roteiro-${norm(c.name).replace(/\W+/g, '-').slice(0, 40)}.txt`, rxRoteiro(c)); }
};
