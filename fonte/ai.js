/* ===== IA (Gemini via backend externo): pedidos, importação de respostas, revisão ===== */
/* Limite do ambiente (verificado): o artefato não chama outros hosts (CSP) e não tem cofre de segredos.
   Por isso a chave fica SOMENTE no backend externo; o app gera o pedido (sem dados sensíveis) e importa a resposta. */
const AI_CONSULTA = '2026-11-04';
const AI_DOCS = [
  { t: 'Gemini API — Modelos', u: 'https://ai.google.dev/gemini-api/docs/models' },
  { t: 'Gemini API — Interactions API', u: 'https://ai.google.dev/gemini-api/docs/interactions' },
  { t: 'Gemini API — Grounding com Google Search', u: 'https://ai.google.dev/gemini-api/docs/google-search' },
  { t: 'Gemini API — Solução de problemas (códigos de erro)', u: 'https://ai.google.dev/gemini-api/docs/troubleshooting' },
  { t: 'Gemini API — Chaves de API (nunca expor no cliente)', u: 'https://ai.google.dev/gemini-api/docs/api-key' },
  { t: 'OpenAI — Modelos', u: 'https://developers.openai.com/api/docs/models' },
  { t: 'OpenAI — Web search (Responses API)', u: 'https://developers.openai.com/api/docs/guides/tools-web-search' },
  { t: 'OpenAI — Structured Outputs', u: 'https://developers.openai.com/api/docs/guides/structured-outputs' },
  { t: 'Anthropic — Visão geral dos modelos', u: 'https://platform.claude.com/docs/en/models/overview' },
  { t: 'Anthropic — Ferramenta de busca web', u: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool' }
];
const AI_MODELS = [
  { id: 'gemini-3.8-flash', l: 'Gemini 3.8 Flash (padrão)', est: 'estável' }, { id: 'gemini-4-argon', l: 'Gemini 4 Argon', est: 'estável' }, { id: 'gemini-3.6-flash', l: 'Gemini 3.6 Flash', est: 'estável' },
  { id: 'gemini-3.5-flash-lite', l: 'Gemini 3.5 Flash-Lite', est: 'estável' }, { id: 'gemini-3.1-pro-preview', l: 'Gemini 3.1 Pro (prévia)', est: 'prévia' }
];
const AI_ERR = { confirmacao_ausente: 'Confirmação de envio ao provedor ausente.', muito_grande: 'Arquivo acima do limite do backend.', limite_local: 'Limite local de pedidos por minuto do backend.', chave_invalida: 'Chave de API inválida ou revogada.', limite_de_uso: 'Limite de uso/cota atingido.', sem_permissao: 'Permissão negada para o modelo/projeto.', indisponivel: 'Serviço Gemini indisponível.', modelo_indisponivel: 'Modelo não encontrado.', tempo_esgotado: 'Tempo esgotado.', sem_creditos: 'Créditos/faturamento esgotados.', chave_ausente: 'Backend sem GEMINI_API_KEY configurada.', nao_autorizado: 'APP_TOKEN incorreto.', dados_sensiveis: 'Pedido recusado: continha CNPJ ou valores.', resposta_invalida: 'Resposta fora do formato esperado.', autenticacao_necessaria: 'A página exige login e o backend não tem credencial TDN válida.', dominio_nao_permitido: 'Domínio fora da lista permitida (TOTVS).', nao_encontrado: 'Página não encontrada.', conteudo_nao_legivel: 'Conteúdo não legível (tipo não suportado ou vazio).', muito_grande: 'Conteúdo acima do limite do backend.', tempo_esgotado_pagina: 'A página demorou demais para responder.' };
const aiCfg = () => (S.meta.ai ||= { modelo: 'gemini-3.8-flash', buscaWeb: true, backendUrl: '', teste: null });
const SECRET_RE = /AIza[0-9A-Za-z_\-]{20,}|\bsk-[A-Za-z0-9_\-]{20,}|Bearer\s+[A-Za-z0-9._\-]{20,}/;
const CNPJ_TXT = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, MONEY_TXT = /R\$\s*[\d.,]+|\b\d{1,3}(?:\.\d{3})+,\d{2}\b/g, MAIL_TXT = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const scrub = t => String(t ?? '').replace(CNPJ_TXT, '[removido]').replace(MONEY_TXT, '[removido]').replace(MAIL_TXT, '[removido]').trim();
const NEED_TXT = n => NEED_LABEL[n] || n;

/* ----- Montagem de pedidos (somente segmento, processos e necessidades por padrão) ----- */
function pesqPrepare(tipo, ref) {
  let d;
  if (tipo === 'regulatorio') d = { tipo, alvoLabel: 'Atualizações fiscais e regulatórias', segmento: '', tema: 'Reforma Tributária do consumo (IBS, CBS, Imposto Seletivo), documentos fiscais eletrônicos, eSocial, EFD-Reinf, SPED, NFS-e, CNPJ alfanumérico', processos: regsOk().map(r => r.nome.split(':')[0]).slice(0, 10).join('\n'), necessidades: 'Mudanças publicadas, prorrogações, vigências, prazos e períodos de teste', incluirProdutos: false };
  else if (tipo === 'marcos') d = { tipo, alvoLabel: 'Marcos de sustentação de releases', segmento: '', produto: 'TOTVS Backoffice Linha Protheus', releases: [...new Set(Object.values(S.clients).flatMap(c => relRows(c).map(r => r.rel).filter(Boolean)).concat(marcosOk().map(m => m.release)))].join('\n'), processos: '', necessidades: 'Data oficial de expiração de cada release e de Garantia Estendida', incluirProdutos: false };
  if (d) { UI.pesqReq = d; UI.view = 'ia'; render(); window.scrollTo(0, 0); return; }
  if (tipo === 'cliente') {
    const c = S.clients[ref]; if (!c) return; const needs = [...new Set(c.opps.map(o => RULES.find(r => r.id === o.ruleId)?.need).filter(n => n && n !== 'retencao'))];
    d = { tipo, alvoKey: c.key, alvoSeg: c.segInfo.id || '', alvoLabel: `Cliente: ${c.name}`, segmento: segName(c.segInfo.id) || '', necessidades: needs.map(NEED_TXT).join('\n'), processos: c.opps.filter(o => o.ruleId !== 'retencao').map(o => o.problema.replace(/^.*?:\s*/, '')).filter((x, i, a) => a.indexOf(x) === i).join('\n'), produtosTxt: c.productsIdent.map(p => p.nome).join('\n'), incluirProdutos: false };
  } else if (tipo === 'segmento') {
    const g = KB.segments.find(x => x.id === ref); if (!g) return; const cnt = {}; Object.values(S.clients).filter(c => c.segInfo.id === g.id).forEach(c => c.opps.forEach(o => { const n = RULES.find(r => r.id === o.ruleId)?.need; if (n && n !== 'retencao') cnt[n] = (cnt[n] || 0) + 1; }));
    d = { tipo, alvoKey: '', alvoSeg: g.id, alvoLabel: `Segmento: ${g.nome}`, segmento: g.nome, necessidades: Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([n]) => NEED_TXT(n)).join('\n'), processos: (g.dores || []).slice(0, 5).map(x => x.t || x).join('\n'), produtosTxt: '', incluirProdutos: false };
  } else {
    const r = S.solutions.find(x => x.id === ref); if (!r) return;
    d = { tipo: 'produto', alvoKey: '', alvoSeg: '', alvoSol: r.id, alvoLabel: `Produto: ${r.nome}`, produto: r.nome + (r.linha ? ` (linha ${r.linha})` : ''), segmento: '', necessidades: r.necessidades.map(NEED_TXT).join('\n'), processos: '', produtosTxt: '', incluirProdutos: false };
  }
  UI.pesqReq = d; UI.view = 'ia'; render(); window.scrollTo(0, 0);
}
const lines = t => String(t || '').split(/\n+/).map(scrub).filter(Boolean);
const PESQ_TAREFA = { regulatorio: 'regulatorio', marcos: 'regulatorio' };
function pesqFinal(d) {
  const T = aiTarefa(PESQ_TAREFA[d.tipo] || 'pesquisa'); return { versao: 1, pedidoId: 'p_' + uid(), tipo: d.tipo, provedor: T.prov, modelo: T.modelo, buscaWeb: !!T.busca,
    dados: { ...(d.tipo === 'produto' || d.tipo === 'marcos' ? { produto: scrub(d.produto) } : {}), ...(d.tipo === 'marcos' ? { releases: lines(d.releases) } : {}), ...(d.tipo === 'regulatorio' ? { tema: scrub(d.tema) } : {}), segmento: scrub(d.segmento) || null, processos: lines(d.processos), necessidades: lines(d.necessidades), ...(d.incluirProdutos ? { produtosTotvs: lines(d.produtosTxt) } : {}) } };
}
function pesqEnviar() {
  const d = UI.pesqReq; if (!d) return; const req = pesqFinal(d), flat = JSON.stringify(req.dados);
  if (/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/.test(flat) || /R\$\s*\d/.test(flat)) return toast('O pedido ainda contém CNPJ ou valores.');
  if (!req.dados.segmento && !req.dados.produto && !req.dados.necessidades.length) return toast('Informe ao menos segmento, produto ou necessidades.');
  const sig = JSON.stringify([d.tipo, req.provedor, req.modelo, req.buscaWeb, d.alvoKey || '', d.alvoSeg || '', d.alvoSol || '', req.dados]), dup = S.pesq.find(p => p.status === 'aguardando' && p.sig === sig);
  if (dup) { UI.pesqReq = null; UI.pesqSel = dup.id; offer(`pedido-pesquisa-${dup.id}.json`, JSON.stringify({ ...req, pedidoId: dup.id }, null, 1)); toast('Já existe pedido idêntico aguardando resposta: o mesmo arquivo foi reofertado, sem criar outro.'); return render(); }
  const rec = { sig, id: req.pedidoId, tipo: d.tipo, alvo: d.alvoLabel, alvoKey: d.alvoKey || '', alvoSeg: d.alvoSeg || '', alvoSol: d.alvoSol || '', at: new Date().toISOString(), status: 'aguardando', provedor: req.provedor, modelo: req.modelo, buscaWeb: req.buscaWeb, enviado: req.dados, resposta: null };
  S.pesq.unshift(rec); touchPes(rec.id); UI.pesqReq = null; UI.pesqSel = rec.id; offer(`pedido-pesquisa-${rec.id}.json`, JSON.stringify(req, null, 1)); log(`Pedido de pesquisa gerado (${d.alvoLabel}). Execute-o no backend e importe a resposta.`, 'ok'); render();
}
function aiTestRequest() { const c = aiCfg(); offer('pedido-teste-conexao.json', JSON.stringify({ versao: 1, pedidoId: 't_' + uid(), tipo: 'teste', modelo: c.modelo, buscaWeb: !!c.buscaWeb, dados: {} }, null, 1)); }

/* ----- Importação de respostas do backend ----- */
const cap = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
const s4 = (v, n = 400) => String(v ?? '').slice(0, n);
function cleanClaim(c) { return { t: s4(c?.t), validar: c?.validar !== false, evidencias: cap(c?.evidencias, 4).map(e => ({ u: s4(e?.u, 500), trecho: s4(e?.trecho, 300), oficial: !!e?.oficial, comprovada: !!e?.comprovada })) }; }
async function aiImportFile(file) {
  try {
    const raw = decodeText(await readBuf(file)); let j; try { j = JSON.parse(raw); } catch { throw new Error('Arquivo não é um JSON válido.'); }
    if (!['importar_link', 'ocr_material'].includes(j?.tipo) && SECRET_RE.test(raw)) throw new Error('O arquivo contém algo que parece uma credencial (chave/token). Não foi importado. Nunca coloque chaves em arquivos.'); if (j && (j.tipo === 'cnpj' || j.tipo === 'status' || (j.versao === 2 && (j.tarefa === 'teste' || j.pedidoId)))) { await bkResposta(j); return; } if (!j || typeof j !== 'object' || j.versao !== 1) throw new Error('Arquivo não é uma resposta do backend (versao 1).');
    if (j.tipo === 'importar_link') return await lkResponse(j);
    if (j.tipo === 'ocr_material') return (j.pedidoId && S.ocr.some(o => o.pedidoId === j.pedidoId)) ? await ocrClienteResposta(j) : await ocrResponse(j);
    if (j.tipo === 'teste') { await iaTesteResposta({ ...j, provedor: 'gemini', buscaSolicitada: j.buscaWebSolicitada, usouBusca: j.usouBuscaWeb }); return; }
    let rec = S.pesq.find(x => x.id === j.pedidoId);
    if (!rec) { rec = { id: s4(j.pedidoId, 40) || 'p_' + uid(), tipo: j.tipo, alvo: 'Resposta importada sem pedido correspondente', alvoKey: '', alvoSeg: '', at: new Date().toISOString(), status: 'aguardando', modelo: s4(j.modelo, 60), enviado: null }; S.pesq.unshift(rec); }
    if (j.ok && (j.tipo === 'regulatorio' || j.tipo === 'marcos') && Array.isArray(j[j.tipo === 'marcos' ? 'marcos' : 'eventos'])) { const n = aiRefImport(j); rec.status = n ? 'em revisão' : 'sem resultados'; rec.resposta = { ok: true, consultadoEm: s4(j.consultadoEm, 40), modelo: s4(j.modelo, 60), usouBuscaWeb: !!j.usouBuscaWeb, fallbackSemBusca: !!j.fallbackSemBusca, daCache: !!j.daCache, consultas: cap(j.consultas, 10).map(x => s4(x, 200)), fontes: cap(j.fontes, 40).map(f => ({ t: s4(f.t, 120), u: s4(f.u, 500), oficial: !!f.oficial })), sugestoesBuscaHtml: cap(j.sugestoesBuscaHtml, 3).map(x => s4(x, 8000)), resumo: `${n} registro(s) enviados para revisão em Releases e regulatório.`, semResultados: !n, avisos: cap(j.avisos, 6).map(x => s4(x, 300)), itens: [], importadoEm: nowISO() }; touchPes(rec.id); UI.pesqSel = rec.id; log(`Resposta importada: ${n} registro(s) pendentes de revisão (${j.usouBuscaWeb ? 'COM' : 'SEM'} busca web).`, 'ok'); return render(); }
    rec.resposta = { ok: !!j.ok, erro: j.erro ? { codigo: s4(j.erro.codigo, 40), mensagem: s4(j.erro.mensagem, 300), repetir: !!j.erro.repetir, aguardarSegundos: +j.erro.aguardarSegundos || null, tentativas: +j.erro.tentativas || null } : null, consultadoEm: s4(j.consultadoEm, 40), modelo: s4(j.modelo, 60), usouBuscaWeb: !!j.usouBuscaWeb, fallbackSemBusca: !!j.fallbackSemBusca, daCache: !!j.daCache, consultas: cap(j.consultas, 10).map(x => s4(x, 200)), fontes: cap(j.fontes, 40).map(f => ({ t: s4(f.t, 120), u: s4(f.u, 500), oficial: !!f.oficial })), sugestoesBuscaHtml: cap(j.sugestoesBuscaHtml, 3).map(x => s4(x, 8000)), resumo: s4(j.resumo, 600), semResultados: !!j.semResultados, avisos: cap(j.avisos, 6).map(x => s4(x, 300)), importadoEm: new Date().toISOString(),
      itens: cap(j.itens, 15).map(it => ({ nome: s4(it.nome, 120), tipo: ['produto', 'modulo', 'complementar', 'servico'].includes(it.tipo) ? it.tipo : 'produto', categoria: s4(it.categoria, 80), linha: s4(it.linha, 60), fornecedor: s4(it.fornecedor, 80), segmentos: cap(it.segmentos, 8).map(x => s4(x, 40)), dores: cap(it.dores, 10).map(cleanClaim), funcionalidades: cap(it.funcionalidades, 20).map(cleanClaim), prerequisitos: cap(it.prerequisitos, 10).map(cleanClaim), integracoes: cap(it.integracoes, 10).map(i => ({ ...cleanClaim(i), sistema: s4(i.sistema, 60), estado: ['confirmada', 'nao_integra', 'nao_verificada'].includes(i.estado) ? i.estado : 'nao_verificada' })), licenciamento: cleanClaim(it.licenciamento), dec: '', acao: '', alvo: '' })) };
    rec.status = !j.ok ? 'falhou' : rec.resposta.semResultados || !rec.resposta.itens.length ? 'sem resultados' : 'em revisão'; touchPes(rec.id); UI.pesqSel = rec.id;
    log(j.ok ? `Resposta importada (${rec.resposta.itens.length} item(ns); ${rec.resposta.usouBuscaWeb ? 'COM busca web' : 'SEM busca web — conhecimento do modelo'}). Revise antes de incorporar.` : `Resposta com falha: ${rec.resposta.erro?.mensagem || 'erro'}`, j.ok ? 'ok' : 'bad'); render();
  } catch (e) { log('✖ Resposta do backend: ' + e.message, 'bad'); toast(e.message); render(); }
}

/* ----- Revisão: incorporar à base ----- */
function itemToCand(rec, it) {
  const r = rec.resposta, dt = (r.consultadoEm || r.importadoEm || '').slice(0, 10) || today(), org = `pesquisa de IA (${r.modelo}, ${r.usouBuscaWeb ? 'com busca web' : 'SEM busca web'}) em ${dt}`;
  const mk = c => ({ t: c.t, o: org, f: c.evidencias[0]?.u || '', loc: c.evidencias.map(e => e.u).filter(Boolean).slice(0, 2).join(' ; '), v: c.validar, ev: c.evidencias.filter(e => e.u).map(e => e.u).slice(0, 3) });
  const c = candBase(''); c.fontes = []; c.nome = it.nome; c.tipo = it.tipo; c.categoria = it.categoria; c.linha = it.linha; c.fornecedor = it.fornecedor || ''; c.status = 'NECESSITA VALIDAÇÃO'; c.termos = [it.nome.replace(/^TOTVS\s+/i, '')];
  c.dores = it.dores.filter(x => x.t).map(mk); c.funcionalidades = it.funcionalidades.filter(x => x.t).map(mk); c.prerequisitos = it.prerequisitos.filter(x => x.t).map(mk);
  c.integracoes = it.integracoes.filter(x => x.sistema).map(i => ({ sistema: i.sistema, estado: i.validar ? 'nao_verificada' : i.estado, ...mk({ ...i, t: (i.validar ? '[sem evidência comprovada] ' : '') + (i.t || i.sistema) }) }));
  if (it.licenciamento?.t) c.limites = `Licenciamento (${it.licenciamento.validar ? 'NECESSITA VALIDAÇÃO' : 'com evidência'}): ${it.licenciamento.t}`;
  const urls = new Map(); [...it.dores, ...it.funcionalidades, ...it.prerequisitos, ...it.integracoes, it.licenciamento].forEach(x => (x?.evidencias || []).forEach(e => { if (e.u) urls.set(e.u, e); }));
  urls.forEach((e, u) => c.fontes.push({ t: hostOf(u) || u, u, d: dt, origem: org + (e.comprovada ? ' • citada pela busca' : ' • URL não comprovada pela busca') + (isOfficialUrl(u) ? ' • domínio oficial TOTVS' : ' • domínio externo') }));
  if (!c.fontes.length) c.fontes.push({ t: 'Pesquisa de IA sem fonte citada', u: '', d: dt, origem: org });
  enrichFromText(c, [it.nome, ...c.funcionalidades.map(x => x.t)].join('\n'), 'pesquisa IA'); c.fontes = c.fontes.filter(f => f.t !== 'pesquisa IA'); return c;
}
function pesqDups(pid, idx) { const rec = S.pesq.find(x => x.id === pid), it = rec?.resposta?.itens[idx]; if (!it) return []; const c = itemToCand(rec, it); return findDups(c).slice(0, 4).map(x => ({ id: x.rec.id, nome: x.rec.nome, score: x.score, why: x.why.join(', ') })); }
function pesqIncorporar(pid, idx) {
  const rec = S.pesq.find(x => x.id === pid), it = rec?.resposta?.itens[idx]; if (!it || it.dec) return; const c = itemToCand(rec, it); let r;
  if (it.acao && it.acao.startsWith('mesclar:')) { r = S.solutions.find(x => x.id === it.acao.slice(8)); if (!r) return toast('Registro de destino não encontrado.'); mergeCand(r, c, { tipo: 'depois', categoria: 'depois', linha: 'depois' }, { f: 'pesquisa IA' }); }
  else { r = createFromCand(c, { origem: 'pesquisa IA' }); S.solutions.push(r); }
  it.dec = 'incorporado'; it.destino = r.id; const n = solChanged(r, 'incorporada de pesquisa IA'); pesqStatus(rec); touchPes(rec.id); log(`"${r.nome}" incorporada à base com status NECESSITA VALIDAÇÃO. ${n} diagnóstico(s) sinalizado(s).`, 'ok'); render();
}
function pesqDescartar(pid, idx) { const rec = S.pesq.find(x => x.id === pid), it = rec?.resposta?.itens[idx]; if (!it || it.dec) return; it.dec = 'descartado'; pesqStatus(rec); touchPes(rec.id); render(); }
function pesqStatus(rec) { const its = rec.resposta?.itens || []; if (its.length && its.every(x => x.dec)) { rec.status = its.some(x => x.dec === 'incorporado') ? 'incorporada' : 'descartada'; rec.resumo = rec.resposta.resumo || rec.alvo; } else if (its.some(x => x.dec === 'incorporado')) rec.status = 'parcial'; }
function pesqRemove(pid) { S.pesq = S.pesq.filter(x => x.id !== pid); dirtyP.delete(pid); delP.add(pid); sched(); if (UI.pesqSel === pid) UI.pesqSel = null; render(); }
function aiStatus() {
  const t = aiCfg().teste;
  if (!t) return { k: 'nao_verificado', l: 'Não verificado', msg: 'Nenhum resultado de teste importado. O artefato não consegue chamar o backend; o teste é feito no backend e o resultado é importado aqui.' };
  if (!t.ok) return { k: 'falha', l: 'Falha no último teste', msg: (AI_ERR[t.erro?.codigo] || '') + ' ' + (t.erro?.mensagem || '') };
  return { k: 'verificado', l: 'Backend verificado', msg: `Teste de ${dtBR(t.at)}: ${t.modelo}, chave ${t.chaveId || '(não informada)'}. ${t.buscaWebSolicitada ? (t.usouBuscaWeb ? 'Busca web confirmada.' : 'Busca web solicitada, mas NÃO confirmada na resposta.') : 'Teste sem busca web.'}` };
}

async function aiPack() {
  if (!window.JSZip) { offer('worker.js', WORKER_SRC); return toast('JSZip indisponível: baixado só worker.js (veja wrangler.toml e LEIAME no aplicativo).'); }
  const z = new JSZip(); z.file('worker.js', WORKER_SRC); z.file('wrangler.toml', WORKER_TOML); z.file('LEIAME.md', WORKER_README);
  offer('backend-gemini-carteira.zip', await z.generateAsync({ type: 'blob' }));
}

/* Respostas de pesquisa de marcos/regulatório: viram registros PENDENTES (aprovação em Releases e regulatório) */
function aiRefImport(j) {
  const dt = (j.consultadoEm || '').slice(0, 10) || today(), org = `pesquisa de IA (${s4(j.modelo, 60)}, ${j.usouBuscaWeb ? 'com busca web' : 'SEM busca web'}) em ${fmtD(dt)}`; let n = 0;
  const ev0 = x => (cap(x.evidencias, 4).find(e => e.comprovada && e.u) || cap(x.evidencias, 4).find(e => e.u) || null);
  if (j.tipo === 'marcos') cap(j.marcos, 20).forEach(m => { if (!relKey(m.release)) return; const e = ev0(m); const rec = { id: 'mk_ai_' + uid(), produto: s4(m.produto, 40) || 'Protheus', release: '12.1.' + String(m.release).match(/12\.1\.(\d+)/)[1], tipo: s4(m.tipo, 60) || 'Expiração do release', data: /^\d{4}-\d{2}-\d{2}$/.test(m.data || '') ? m.data : null, fonte: { t: e ? (hostOf(e.u) || e.u) : 'Sem fonte citada', u: e?.u || '', oficial: !!(e && isOfficialUrl(e.u)) }, obs: (m.validar !== false || !e?.comprovada ? 'NECESSITA VALIDAÇÃO: data sem evidência comprovada pela busca. ' : '') + s4(m.t || '', 200), st: 'pendente', origem: org, consultadoEm: dt, hist: [{ at: nowISO(), acao: 'importado de pesquisa (pendente de aprovação)' }] }; S.marcos.push(rec); touchG('marcos', rec.id); n++; });
  else cap(j.eventos, 20).forEach(r => { if (!r.nome) return; const e = ev0(r); const d = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null; const rec = { id: 'rg_ai_' + uid(), nome: s4(r.nome, 200), orgao: s4(r.orgao, 100), fonte: { t: e ? (hostOf(e.u) || e.u) : 'Sem fonte citada', u: e?.u || '', oficial: !!(e && (isOfficialUrl(e.u) || /gov\.br|planalto|in\.gov/.test(e.u))) }, publicacao: d(r.publicacao), vigencia: d(r.vigencia), prazo: d(r.prazo), testes: r.testes?.ini ? { ini: d(r.testes.ini), fim: d(r.testes.fim), desc: s4(r.testes.desc, 120) } : null,
    criterios: { regimes: cap(r.criterios?.regimes, 6).filter(x => REGIMES.includes(x)), ufs: cap(r.criterios?.ufs, 27).filter(x => UFS.includes(x)), ops: cap(r.criterios?.ops, 8).filter(x => OPS[x]), nota: s4(r.criterios?.nota, 200) }, acoes: cap(r.acoes, 6).filter(x => ACOES_REG[x]), confianca: r.validar === false && e?.comprovada ? 'média' : 'baixa', obsData: r.validar !== false || !e?.comprovada ? 'NECESSITA VALIDAÇÃO: datas sem evidência comprovada pela busca.' : '', st: 'pendente', origem: org, consultadoEm: dt, hist: [{ at: nowISO(), acao: 'importado de pesquisa (pendente de aprovação)' }] }; S.regs.push(rec); touchG('regulatorio', rec.id); n++; });
  return n;
}
