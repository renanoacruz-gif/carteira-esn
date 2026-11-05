/* ===== CAMADA DE PROVEDORES DE IA (Gemini · OpenAI · Anthropic) =====
   Catálogo, escolha padrão e por tarefa, teste de conexão e importação padronizada.
   Documentação oficial consultada em 2026-11-04: OpenAI (developers.openai.com/api/docs/models, /guides/tools-web-search, /guides/structured-outputs),
   Anthropic (platform.claude.com/docs/en/models/overview, /agents-and-tools/tool-use/web-search-tool), Gemini (lista já adotada, acima).
   As chaves existem SOMENTE como segredos do backend (GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY): nunca aqui.
   Groq (console.groq.com/docs, consultada em 2026-11-05): POST api.groq.com/openai/v1/chat/completions, Bearer; busca web = ferramenta browser_search (somente openai/gpt-oss-20b|120b|safeguard-20b; não combina com saída estruturada);
   modelos de produção: llama-3.1-8b-instant, llama-3.3-70b-versatile, openai/gpt-oss-20b, openai/gpt-oss-120b. Visão (qwen/qwen3.8-27b, prévia) NÃO é usada aqui. */
const AI_PROV = {
  gemini: { nome: 'Google Gemini', secret: 'GEMINI_API_KEY', modelos: AI_MODELS, busca: 'Grounding com Google Search', caps: { texto: 1, estruturado: 1, pesquisa: 1, documentos: 1, imagens: 1, ocr: 1 }, lim: 'Cota por projeto/modelo no Google AI Studio' },
  openai: { nome: 'OpenAI', secret: 'OPENAI_API_KEY', modelos: [{ id: 'gpt-6-astra', l: 'GPT-6 Astra', est: 'estável' }, { id: 'gpt-6.1-sol', l: 'GPT-6.1 Sol', est: 'estável' }, { id: 'gpt-6.1-terra', l: 'GPT-6.1 Terra', est: 'estável' }, { id: 'gpt-6-luna', l: 'GPT-6 Luna (mais econômico)', est: 'estável' }], busca: 'web_search (Responses API)', caps: { texto: 1, estruturado: 1, pesquisa: 1, documentos: 0, imagens: 0, ocr: 0 }, lim: 'Limites da organização na OpenAI' },
  anthropic: { nome: 'Anthropic (Claude)', secret: 'ANTHROPIC_API_KEY', modelos: [{ id: 'claude-fable-5-1', l: 'Claude Fable 5.1', est: 'estável' }, { id: 'claude-opus-5-5', l: 'Claude Opus 5.5', est: 'estável' }, { id: 'claude-sonnet-5-5', l: 'Claude Sonnet 5.5', est: 'estável' }, { id: 'claude-haiku-5-5', l: 'Claude Haiku 5.5 (mais econômico)', est: 'estável' }], busca: 'web_search_20250305 (Messages API)', caps: { texto: 1, estruturado: 1, pesquisa: 1, documentos: 0, imagens: 0, ocr: 0 }, lim: 'Contexto 1M / saída até 128K tokens (doc. oficial); limites da organização na Anthropic' },
  groq: { nome: 'Groq', secret: 'GROQ_API_KEY', padrao: 0, modelos: [{ id: 'openai/gpt-oss-120b', l: 'GPT-OSS 120B (com busca web)', est: 'estável' }, { id: 'openai/gpt-oss-20b', l: 'GPT-OSS 20B (com busca web, mais rápido)', est: 'estável' }, { id: 'llama-3.3-70b-versatile', l: 'Llama 3.3 70B Versatile (sem busca web)', est: 'estável' }, { id: 'llama-3.1-8b-instant', l: 'Llama 3.1 8B Instant (sem busca web, mais econômico)', est: 'estável' }], busca: 'browser_search (apenas modelos GPT-OSS; sem fontes estruturadas documentadas)', buscaModelos: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'], caps: { texto: 1, estruturado: 1, pesquisa: 1, documentos: 0, imagens: 0, ocr: 0 }, lim: 'Limites por organização/modelo no console da Groq; busca não combina com JSON estruturado' }
};
AI_PROV.pagina = { nome: 'Claude desta página (sem chave)', secret: 'nenhum (capacidade sample do artefato)', padrao: 0, modelos: [{ id: 'padrao', l: 'Modelo padrão da página', est: 'estável' }, { id: 'rapido', l: 'Rápido (tarefas simples)', est: 'estável' }, { id: 'complexo', l: 'Avançado (mais lento)', est: 'estável' }], busca: 'Não disponível: sem busca web', caps: { texto: 1, estruturado: 1, pesquisa: 0, documentos: 0, imagens: 1, ocr: 1 }, lim: 'Limites e consentimento do runtime do artefato (claude.ai)' };
const AI_CAP = { texto: 'Texto', estruturado: 'Extração estruturada (JSON validado)', pesquisa: 'Pesquisa web nativa', documentos: 'Documentos', imagens: 'Imagens', ocr: 'OCR' };
const AI_TAREFAS = { semantica: 'Análise semântica do cliente (sem busca web)', ocr: 'OCR de imagens de clientes', pesquisa: 'Pesquisa de soluções (cliente, segmento, produto)', regulatorio: 'Regulatório e marcos de release', mercado: 'Inteligência de mercado' };
const AI_PROV_IDS = Object.keys(AI_PROV);
function iaInit() {
  const c = aiCfg(); c.provedor ||= 'gemini'; c.modelos ||= {}; AI_PROV_IDS.forEach(p => { c.modelos[p] ||= (p === 'gemini' ? c.modelo : AI_PROV[p].modelos[AI_PROV[p].padrao ?? (p === 'openai' ? 3 : 2)].id) || AI_PROV[p].modelos[0].id; });
  c.tarefas ||= {}; Object.keys(AI_TAREFAS).forEach(t => { c.tarefas[t] ||= { prov: '', modelo: '', busca: c.buscaWeb !== false }; }); c.fallback ||= { ativo: false }; c.testes ||= {}; return c;
}
/* Provedor/modelo/busca efetivos de uma tarefa (padrão quando a tarefa não define) */
function aiTarefa(t) {
  const c = iaInit(), x = c.tarefas[t] || {}, prov = x.prov && AI_PROV[x.prov] ? x.prov : c.provedor; const modelo = x.prov && x.modelo && AI_PROV[prov].modelos.some(m => m.id === x.modelo) ? x.modelo : c.modelos[prov];
  return { prov, modelo, busca: x.busca !== false };
}
function iaStatusOf(p) {
  const t = iaInit().testes[p]; if (!t) return { k: 'nao_verificado', l: 'Não verificado' };
  return t.ok ? { k: 'verificado', l: 'Conectado e testado', t } : { k: 'falha', l: 'Com erro', t };
}
async function iaTestar(p) {
  const c = iaInit(), pedido = { versao: 1, pedidoId: 't_' + uid(), tipo: 'ia_teste', provedor: p, modelo: c.modelos[p], buscaWeb: c.buscaWeb !== false };
  try {
    const r = await bkChamar('ia_teste', pedido, `pedido-teste-${p}.json`);
    if (r.via === 'direto') { await iaTesteResposta(r.resp); return; }
    toast(`Pedido de teste de ${AI_PROV[p].nome} gerado. ${r.motivo ? r.motivo + ' ' : ''}Envie-o na página do backend e importe a resposta.`);
  } catch (e) { toast(e.message); }
  render();
}
async function iaTesteResposta(j) {
  const p = AI_PROV[j.provedor] ? j.provedor : null; if (!p) throw new Error('Provedor desconhecido na resposta.');
  const c = iaInit(); c.testes[p] = { at: new Date().toISOString(), consultadoEm: s4(j.consultadoEm, 40), ok: !!j.ok, modelo: s4(j.modelo, 60), chaveId: s4(j.chaveId, 20), buscaSolicitada: !!j.buscaSolicitada, usouBusca: !!j.usouBusca, latenciaMs: +j.latenciaMs || null, aviso: s4(j.aviso, 300), uso: j.uso ? { entrada: j.uso.entrada ?? null, saida: j.uso.saida ?? null, buscas: j.uso.buscas ?? 0 } : null, erro: j.erro ? { codigo: s4(j.erro.codigo, 40), mensagem: s4(j.erro.mensagem, 300) } : null };
  if (p === 'gemini') c.teste = { at: c.testes[p].at, consultadoEm: c.testes[p].consultadoEm, ok: c.testes[p].ok, modelo: c.testes[p].modelo, chaveId: c.testes[p].chaveId, buscaWebSolicitada: c.testes[p].buscaSolicitada, usouBuscaWeb: c.testes[p].usouBusca, latenciaMs: c.testes[p].latenciaMs, aviso: c.testes[p].aviso, erro: c.testes[p].erro };
  touchMeta(); log(`${AI_PROV[p].nome}: teste ${j.ok ? 'bem-sucedido' : 'com falha'}.`, j.ok ? 'ok' : 'bad'); render();
}
function intStatusResposta(j) { // resposta de /api/status: quais segredos existem no backend (nunca valores)
  const c = iaInit(); c.status = { at: new Date().toISOString(), ia: Object.fromEntries(AI_PROV_IDS.map(p => [p, { configurado: !!j.ia?.[p]?.configurado, chaveId: s4(j.ia?.[p]?.chaveId, 12) }])), cnpjProv: cap(j.cnpj?.provedores, 6).map(x => ({ id: s4(x.id, 20), nome: s4(x.nome, 60) })), tdnAuth: !!j.tdn?.autenticacao, kv: !!j.kv };
  intSet('ia', { at: c.status.at, ok: true, msg: 'Status do backend recebido' }); touchMeta(); log('Status do backend importado.', 'ok'); render();
}
function iaProvCards() {
  const c = iaInit(), st = c.status;
  const rows = AI_PROV_IDS.map(p => {
    const P = AI_PROV[p], s = iaStatusOf(p), usos = Object.keys(AI_TAREFAS).filter(t => aiTarefa(t).prov === p).map(t => AI_TAREFAS[t].split(' (')[0]);
    const cred = window.__HOSTED__ ? (hkChave(p) ? `<span class="muted sm">sua chave ${hkFim(hkChave(p))} (neste navegador)</span>` : '<span class="muted sm">sem chave sua — cadastre abaixo</span>') : p === 'pagina' ? '<span class="muted sm">sem chave: usa o Claude da própria página; só funciona no artefato publicado</span>' : `<code>${P.secret}</code><br><span class="muted sm">${st?.ia?.[p] ? (st.ia[p].configurado ? 'configurado no backend ' + esc(st.ia[p].chaveId || '') : 'NÃO configurado no backend') : s.t?.chaveId ? 'última chave testada ' + esc(s.t.chaveId) : 'importe o status do backend'}</span>`;
    return `<tr><td><label><input type="radio" name="iaprov" data-c="iaprov" value="${p}" ${c.provedor === p ? 'checked' : ''}> <b>${P.nome}</b></label>${c.provedor === p ? ' <span class="pill p-ok">padrão</span>' : ''}</td>
    <td><select data-c="iamod" data-p="${p}">${P.modelos.map(m => optS(m.id, `${m.l}${m.est === 'prévia' ? ' (prévia)' : ''}`, c.modelos[p])).join('')}</select></td><td>${cred}</td>
    <td class="sm">${usos.length ? esc(usos.join('; ')) : '<span class="muted">nenhuma tarefa</span>'}</td>
    <td class="sm">${Object.keys(AI_CAP).map(k => `<span class="pill ${P.caps[k] ? 'p-ok' : 'p-off'}" title="${P.caps[k] ? 'implementado no backend' : 'não implementado no backend'}">${AI_CAP[k].split(' (')[0]}${P.caps[k] ? '' : ' —'}</span>`).join(' ')}<br><span class="muted">Busca: ${esc(P.busca)}</span></td>
    <td class="sm">${esc(P.lim)}<br><span class="muted">Backend: 3 tentativas, pedido ≤ 12 mil caracteres</span></td>
    <td><span class="pill p-${{ nao_verificado: 'off', verificado: 'ok', falha: 'bad' }[s.k]}">${s.l}</span><div class="sm muted">${s.t ? `${dtBR(s.t.at)} • ${esc(s.t.modelo || '')}${s.t.ok ? (s.t.buscaSolicitada ? (s.t.usouBusca ? ' • busca confirmada' : ' • busca NÃO confirmada') : '') : ' • ' + esc(s.t.erro?.codigo || '') + (s.t.erro?.mensagem ? ': ' + esc(s.t.erro.mensagem) : '')}` : ''}</div><button class="btn ghost sm" data-a="iaTestar" data-p="${p}">Testar</button></td></tr>`;
  }).join('');
  const tarefas = Object.entries(AI_TAREFAS).map(([t, l]) => { const x = c.tarefas[t], ef = aiTarefa(t); return `<tr><td>${esc(l)}</td><td><select data-c="iatar" data-t="${t}" data-f="prov"><option value="">Padrão (${AI_PROV[c.provedor].nome})</option>${AI_PROV_IDS.map(p => optS(p, AI_PROV[p].nome, x.prov)).join('')}</select></td><td><select data-c="iatar" data-t="${t}" data-f="modelo" ${x.prov ? '' : 'disabled'}>${(x.prov ? AI_PROV[x.prov].modelos : AI_PROV[c.provedor].modelos).map(m => optS(m.id, m.l, x.prov ? ef.modelo : c.modelos[c.provedor])).join('')}</select></td><td><label class="sm"><input type="checkbox" data-c="iatar" data-t="${t}" data-f="busca" ${x.busca !== false ? 'checked' : ''}> pesquisa web</label></td><td class="sm muted">${AI_PROV[ef.prov].nome} • ${esc(ef.modelo)}${ef.busca && AI_PROV[ef.prov].buscaModelos && !AI_PROV[ef.prov].buscaModelos.includes(ef.modelo) ? `<div>${pill('este modelo não tem busca web na Groq', 'warn')}</div>` : ''}</td></tr>`; }).join('');
  const modo = bkModo();
  return `<div class="card"><h3>Provedores de IA, modelos e capacidades</h3><div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>Provedor</th><th>Modelo</th><th>Credencial (segredo no backend)</th><th>Finalidade</th><th>Capacidades</th><th>Limites</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="sm muted">Modelos conforme a documentação oficial consultada em ${AI_CONSULTA} (inclui os IDs de OpenAI e Anthropic). Para usar um modelo novo sem reimplantar, defina <code>MODELOS_EXTRA_OPENAI</code> / <code>_ANTHROPIC</code> / <code>_GEMINI</code> no backend. “—” = capacidade não implementada no backend (não há simulação). O serviço de busca é o nativo de cada provedor; um serviço de busca independente ainda não está implementado.</p>
  <h4>Escolha por tarefa</h4><div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>Tarefa</th><th>Provedor</th><th>Modelo</th><th>Busca</th><th>Efetivo</th></tr></thead><tbody>${tarefas}</tbody></table></div>
  <label class="sm"><input type="checkbox" data-c="iafb" ${c.fallback.ativo ? 'checked' : ''}> Permitir alternativa entre provedores: quando uma pesquisa falha, oferecer “Refazer com outro provedor”. Nunca é automático e a pesquisa web nunca é removida em silêncio.</label>
  <p class="sm muted">Dados enviados: apenas segmento, processos, necessidades e, quando você incluir, nomes de produtos — nunca CNPJ, valores ou documentos de clientes.</p></div>
  ${window.__HOSTED__ ? hkCard() : ''}
  ${window.__HOSTED__ ? '' : `<div class="card"><h3>Conexão com o backend <span class="pill p-${modo === 'direto' ? 'ok' : 'off'}">${esc(BK_TXT[modo])}</span></h3>
  <div class="grid g2"><label class="sm">URL do backend<input type="text" data-c="aiurl" value="${esc(c.backendUrl)}" placeholder="https://…workers.dev" style="width:100%"></label>
  <label class="sm">APP_TOKEN (só na memória desta sessão; não é salvo nem entra em backup)<input type="password" data-i="bktoken" value="${esc(BK.token)}" autocomplete="off" placeholder="opcional — habilita chamada direta" style="width:100%"></label></div>
  <div class="row"><button class="btn" data-a="bkStatus">Verificar backend (segredos configurados)</button><label class="btn ghost" style="cursor:pointer">Importar resposta do backend<input type="file" id="f-ai" accept=".json" hidden></label><button class="btn ghost" data-a="aiPack">Baixar pacote do backend</button></div>
  <p class="sm muted">Neste artefato o navegador não pode chamar outros hosts (política de segurança): o app gera o arquivo de pedido, você o envia na página do backend e importa a resposta. Em um aplicativo hospedado fora do artefato, defina <code>ALLOWED_ORIGINS</code> no Worker e a chamada passa a ser direta. ${BK.ultimoErro ? '<br>Último aviso: ' + esc(BK.ultimoErro) : ''}</p></div>`}`;
}
const IA_ACT = {
  iaTestar: t => iaTestar(t.dataset.p),
  bkStatus: async () => { try { const r = await bkChamar('status', { versao: 1, pedidoId: 's_' + uid(), tipo: 'status' }, 'pedido-status-backend.json'); if (r.via === 'direto') intStatusResposta(r.resp); else toast('Pedido de status gerado. Envie-o na página do backend e importe a resposta.'); } catch (e) { toast(e.message); } render(); }
};
function iaChange(t, c, v) { // chamado pelo manipulador de change
  const cfg = iaInit();
  if (c === 'iaprov') { cfg.provedor = v; cfg.modelo = cfg.modelos.gemini; touchMeta(); render(); return true; }
  if (c === 'iamod') { const p = t.dataset.p; if (AI_PROV[p].modelos.some(m => m.id === v)) { cfg.modelos[p] = v; if (p === 'gemini') cfg.modelo = v; touchMeta(); render(); } return true; }
  if (c === 'iatar') { const x = cfg.tarefas[t.dataset.t], f = t.dataset.f; if (f === 'prov') { x.prov = v; x.modelo = v ? cfg.modelos[v] : ''; } else if (f === 'modelo') x.modelo = v; else if (f === 'busca') { x.busca = t.checked; if (t.dataset.t === 'pesquisa') cfg.buscaWeb = t.checked; } touchMeta(); render(); return true; }
  if (c === 'iafb') { cfg.fallback.ativo = t.checked; touchMeta(); render(); return true; }
  return false;
}
const iaFb = () => iaInit().fallback;
/* Alternativa entre provedores: NUNCA automática; novo pedido, mesma busca solicitada, registro próprio. */
IA_ACT.pesqRefazer = t => {
  const rec = S.pesq.find(x => x.id === t.dataset.id), p = t.dataset.p, c = iaInit(); if (!rec || !rec.enviado || !AI_PROV[p]) return;
  const req = { versao: 1, pedidoId: 'p_' + uid(), tipo: rec.tipo, provedor: p, modelo: c.modelos[p], buscaWeb: !!rec.buscaWeb, dados: rec.enviado };
  const nr = { sig: JSON.stringify([rec.tipo, p, req.modelo, req.buscaWeb, rec.alvoKey || '', rec.alvoSeg || '', rec.alvoSol || '', rec.enviado]), id: req.pedidoId, tipo: rec.tipo, alvo: rec.alvo, alvoKey: rec.alvoKey || '', alvoSeg: rec.alvoSeg || '', alvoSol: rec.alvoSol || '', at: new Date().toISOString(), status: 'aguardando', provedor: p, modelo: req.modelo, buscaWeb: req.buscaWeb, enviado: rec.enviado, resposta: null, refazDe: rec.id };
  S.pesq.unshift(nr); touchPes(nr.id); UI.pesqSel = nr.id; offer(`pedido-pesquisa-${nr.id}.json`, JSON.stringify(req, null, 1)); log(`Pedido refeito com ${AI_PROV[p].nome} (busca web ${req.buscaWeb ? 'solicitada' : 'não solicitada'}).`, 'ok'); render();
};
