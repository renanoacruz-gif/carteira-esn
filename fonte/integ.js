/* ===== CAMADA DE INTEGRAÇÃO =====
   Implementadas no backend: IA multiprovedor, Consulta de CNPJ, importação de links/TDN. Motor de vendas, CRM e Protheus seguem planejados: nenhuma API é presumida.
   O que existe e funciona hoje: ids internos estáveis, campos de id externo, mapa de campos, regras de vínculo/duplicidade/conflito
   (funções puras, testadas), registro de operações e a trava de autorização. Um conector só roda se estiver 'ativa' E registrado. */
const INT_CONEXOES = [
  { id: 'ia', nome: 'IA multiprovedor (Gemini · OpenAI · Anthropic)', real: true, nota: 'Adaptador no backend (Worker) com chaves como segredos, teste de conexão, tratamento de erro/limite/tempo e resposta padronizada.' },
  { id: 'cnpj', nome: 'Consulta de CNPJ', real: true, nota: 'Provedores públicos terceiros via backend (BrasilAPI, CNPJ.ws, ReceitaWS). Não oficial; sem chave.' },
  { id: 'tdn', nome: 'Importação de links / TDN', real: true, nota: 'Leitura de páginas públicas pelo backend. Páginas que exigem login precisam de credencial configurada no backend.' },
  { id: 'motor', nome: 'Motor de vendas TOTVS', estado: 'planejada', nota: 'Sem API documentada fornecida. A leitura de oportunidades/propostas depende do contrato do serviço.' },
  { id: 'crm', nome: 'CRM', estado: 'planejada', nota: 'CRM não definido. Quando houver sistema e documentação (API, autenticação, mapeamentos), o conector entra nesta camada.' },
  { id: 'protheus', nome: 'Protheus', estado: 'planejada', nota: 'Depende da documentação oficial das APIs/serviços REST do ambiente do cliente. Nada é presumido.' }
];
const INT_ESTADO = { nao_configurada: ['Não configurada', 'off'], planejada: ['Planejada', 'info'], impl: ['Pronta para configurar', 'warn'], testada: ['Conectada e testada', 'ok'], erro: ['Com erro', 'bad'], ativa: ['Ativa', 'ok'] };
/* Estado operacional de uma conexão real: só vira "Conectada e testada" depois de uma execução bem-sucedida registrada (teste real); simulação não conta. */
const INT_EXT = INT_CONEXOES.filter(x => !x.real);
const intEst = () => (S.meta.intEst ||= {});
function intSet(id, o) { const e = intEst(); e[id] = { at: o.at || new Date().toISOString(), ok: !!o.ok, msg: String(o.msg || '').slice(0, 200) }; touchMeta(); }
function intEstadoDe(x) {
  if (!x.real) return x.estado;
  if (x.id === 'ia') { const t = iaInit().testes, ks = Object.keys(t); if (ks.some(k => t[k].ok)) return 'testada'; return ks.length ? 'erro' : 'impl'; }
  const e = intEst()[x.id]; return !e ? 'impl' : e.ok ? 'testada' : 'erro';
}
function intUltima(x) {
  if (x.id === 'ia') { const t = Object.entries(iaInit().testes).sort((a, b) => (b[1].at || '').localeCompare(a[1].at || ''))[0]; return t ? `${AI_PROV[t[0]]?.nome || t[0]}: ${t[1].ok ? 'teste OK' : 'falha ' + (t[1].erro?.codigo || '')} • ${dtBR(t[1].at)}` : ''; }
  const e = intEst()[x.id]; return e ? `${e.ok ? 'OK' : 'Falha'} • ${dtBR(e.at)} • ${e.msg}` : '';
}
/* mapa de campos: interno ↔ externo. Origem = de onde o dado interno vem hoje (rastreável). O nome externo é registrado pelo usuário e só será usado por um conector real. */
const INT_CAMPOS = [
  { k: 'cnpj', l: 'CNPJ', ent: 'cliente', origem: 'planilha da carteira / ficha', chave: true },
  { k: 'code', l: 'Código do cliente', ent: 'cliente', origem: 'planilha da carteira', chave: true },
  { k: 'name', l: 'Razão social', ent: 'cliente', origem: 'planilha da carteira' },
  { k: 'seg', l: 'Segmento', ent: 'cliente', origem: 'planilha (ou inferido, sinalizado)' },
  { k: 'release', l: 'Release', ent: 'cliente', origem: 'ficha / documentos / registro manual' },
  { k: 'cloud', l: 'Ambiente de hospedagem', ent: 'cliente', origem: 'cadastro estratégico / documentos' },
  { k: 'mrr', l: 'Receita recorrente (MRR)', ent: 'cliente', origem: 'planilha / ficha de faturamento' },
  { k: 'opp', l: 'Oportunidade (estágio, decisão)', ent: 'oportunidade', origem: 'análise + decisão do executivo' },
  { k: 'sol', l: 'Solução / produto', ent: 'solução', origem: 'Base de Soluções (catálogo compartilhado)' }
];
const intMap = () => (S.meta.intMap ||= {});
/* ---- identificadores ---- */
function ensureIids() { let n = 0; Object.values(S.clients).forEach(c => { if (!c.iid) { c.iid = 'cli_' + uid(); touchC(c.key); n++; } c.ext ||= {}; }); return n; }
function extSet(key, sis, v) { const c = S.clients[key]; if (!c || !INT_EXT.some(x => x.id === sis)) return; c.ext ||= {}; v = String(v || '').trim().slice(0, 80); if (v) c.ext[sis] = v; else delete c.ext[sis]; touchC(key); }
/* ---- vínculo / duplicidade / conflito: propõe, nunca grava ----
   rec = { sistema, extId, cnpj, code, name }. Só enxerga a carteira do usuário atual (S.clients). */
function intMatch(rec, clientes = Object.values(S.clients)) {
  const dg = digits(rec.cnpj || ''), cd = String(rec.code || '').trim(), mot = [];
  const byExt = rec.extId ? clientes.filter(c => c.ext?.[rec.sistema] === rec.extId) : [];
  const byCnpj = dg.length === 14 ? clientes.filter(c => c.cnpj === dg) : [];
  const byCode = cd ? clientes.filter(c => String(c.code || '').trim() === cd) : [];
  if (byExt.length > 1) return { tipo: 'conflito', alvos: byExt.map(c => c.key), motivos: ['o mesmo id externo está em mais de um cliente'] };
  if (byExt.length === 1) {
    const a = byExt[0];
    if (byCnpj.length && !byCnpj.includes(a)) return { tipo: 'conflito', alvos: [a.key, ...byCnpj.map(c => c.key)], motivos: ['id externo aponta para um cliente e o CNPJ para outro'] };
    return { tipo: 'vinculado', alvo: a.key, motivos: ['id externo já vinculado'] };
  }
  if (byCnpj.length > 1) { const c2 = byCode.filter(c => byCnpj.includes(c)); if (c2.length === 1) return { tipo: 'vinculado', alvo: c2[0].key, motivos: ['CNPJ + código'] }; return { tipo: 'conflito', alvos: byCnpj.map(c => c.key), motivos: ['CNPJ presente em mais de um cliente da carteira (filiais/duplicidade): decisão manual'] }; }
  if (byCnpj.length === 1) { const a = byCnpj[0]; if (cd && a.code && String(a.code).trim() !== cd) return { tipo: 'conflito', alvos: [a.key], motivos: [`CNPJ igual, código diferente (${a.code} × ${cd})`] }; return { tipo: 'vinculado', alvo: a.key, motivos: ['CNPJ'] }; }
  if (byCode.length === 1) { const a = byCode[0]; if (dg.length === 14 && a.cnpj && a.cnpj !== dg) return { tipo: 'conflito', alvos: [a.key], motivos: ['código igual, CNPJ diferente'] }; return { tipo: 'revisar', alvo: a.key, motivos: ['só o código coincide'] }; }
  if (byCode.length > 1) return { tipo: 'conflito', alvos: byCode.map(c => c.key), motivos: ['código presente em mais de um cliente'] };
  return { tipo: 'novo', motivos: ['sem correspondência na sua carteira'] };
}
/* diferenças campo a campo: devolve conflitos de sincronização, sem aplicar nada */
function intDiff(c, rec, sistema) {
  const m = intMap()[sistema] || {}, out = [];
  INT_CAMPOS.filter(f => f.ent === 'cliente' && m[f.k] && rec.campos && rec.campos[m[f.k]] !== undefined).forEach(f => {
    const ext = String(rec.campos[m[f.k]] ?? '').trim(), cur = String(f.k === 'cloud' ? (c.cloud?.ambiente || '') : (c[f.k] ?? '')).trim();
    if (ext && cur && norm(ext) !== norm(cur)) out.push({ campo: f.l, interno: cur, externo: ext, origemInterna: f.origem });
  });
  return out;
}
/* ---- registro de operações e erros (privado: quem opera vê só as próprias) ---- */
function intLog(o) {
  const r = { id: 'il_' + uid(), at: new Date().toISOString(), dono: ME.id || '', sistema: o.sistema || '', op: o.op || '', estado: o.estado || 'ok', msg: String(o.msg || '').slice(0, 300), n: o.n ?? null };
  S.intlog.unshift(r); touchG('integlog', r.id);
  while (S.intlog.length > 200) { const x = S.intlog.pop(); dropG('integlog', x.id); }
  return r;
}
const INT_ADAPT = {}; /* registro de conectores reais: {id: {leitura(ctx)}} — vazio hoje */
async function intRun(sistema, op, args = {}) { /* único ponto de execução: trava + log + escopo do dono */
  const cx = INT_CONEXOES.find(x => x.id === sistema), ad = INT_ADAPT[sistema];
  if (!cx || cx.estado !== 'ativa' || !ad) { intLog({ sistema, op, estado: 'bloqueado', msg: 'Conector não configurado' }); throw new Error('Integração "' + (cx?.nome || sistema) + '" não está configurada.'); }
  if (!ME.id) { intLog({ sistema, op, estado: 'bloqueado', msg: 'Sem conta autenticada' }); throw new Error('Sem conta autenticada.'); }
  try { const res = await ad[op]({ ...args, dono: ME.id, clientes: Object.values(S.clients) }); intLog({ sistema, op, estado: 'ok', n: Array.isArray(res) ? res.length : null }); return res; }
  catch (e) { intLog({ sistema, op, estado: 'erro', msg: e.message }); throw e; }
}
const INT_ACT = {
  intMapSet: t => { const [sis, k] = t.dataset.k.split('|'); const m = (intMap()[sis] ||= {}); const v = t.value.trim().slice(0, 60); if (v) m[k] = v; else delete m[k]; touchMeta(); },
  extSet: t => extSet(t.dataset.key, t.dataset.s, t.value)
};
function extBlock(c) {
  const e = c.ext || {};
  return `<details class="card"><summary class="sm"><b>Identificadores</b> • interno <code>${esc(c.iid || '—')}</code>${Object.keys(e).length ? ' • externos: ' + Object.keys(e).map(k => esc(INT_EXT.find(x => x.id === k)?.nome || k)).join(', ') : ''}</summary>
  <p class="sm muted">O id interno é estável (não muda se o CNPJ ou o código forem corrigidos). Os ids externos são anotações para vínculo com motor de vendas, CRM e Protheus (conectores ainda planejados).</p>
  <div class="grid g3">${INT_EXT.map(x => `<label class="sm">${esc(x.nome)}<input type="text" data-c="extSet" data-key="${esc(c.key)}" data-s="${x.id}" value="${esc(e[x.id] || '')}" placeholder="id no sistema (opcional)" maxlength="80"></label>`).join('')}</div></details>`;
}
const USO = { d: null, t: 0, busy: false };
async function usoCarregar() { if (!window.__HOSTED__ || USO.busy || Date.now() - USO.t < 60000) return; USO.busy = true; try { const r = await fetch('/api/uso', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' }); if (r.ok) { const prim = !USO.d; USO.d = await r.json(); USO.t = Date.now(); if (UI.view === 'integra' || (prim && UI.view === 'cliente')) render(); } } catch { /* sem efeito */ } finally { USO.busy = false; } }
function usoCard() { if (!window.__HOSTED__) return ''; usoCarregar(); const u = USO.d; if (!u || !u.ok) return ''; return `<div class="card" id="uso-card"><h3>Seu consumo hoje</h3><p class="sm muted">Limites diários por usuário para operações que geram custo ou acesso externo. A contagem fica no servidor e zera à meia-noite (UTC).</p><div class="tw"><table><thead><tr><th>Operação</th><th class="num">Usado hoje</th><th class="num">Limite</th></tr></thead><tbody>${u.itens.map(x => `<tr><td>${esc(x.rot)}</td><td class="num">${x.usado}${x.usado >= x.limite ? ' <span class="pill p-warn">limite atingido</span>' : ''}</td><td class="num">${x.limite}</td></tr>`).join('')}</tbody></table></div></div>`; }
function vIntegra() {
  const acao = x => ({ ia: `<button class="btn ghost sm" data-a="nav" data-v="ia">Configurar e testar</button>`, cnpj: `<button class="btn ghost sm" data-a="nav" data-v="cnpj">Abrir consulta</button>`, tdn: `<button class="btn ghost sm" data-a="nav" data-v="importar">Importar link</button>` }[x.id] || '');
  let h = `<div class="card"><h3>Integrações</h3><p class="sm">Estados: <b>Planejada</b> (nada implementado) • <b>Pronta para configurar</b> (existe no backend; falta segredo/URL ou ainda não houve teste real) • <b>Conectada e testada</b> (houve execução real bem-sucedida, registrada aqui) • <b>Com erro</b> (última execução falhou). Simulações e testes de código não promovem uma integração a “testada”. Credenciais ficam só como segredos do backend; o registro abaixo nunca guarda chaves.</p>
  <div class="row"><button class="btn ghost sm" data-a="bkStatus">Verificar backend (segredos configurados)</button><span class="sm muted">${iaInit().status ? 'Último status do backend: ' + esc(dtBR(iaInit().status.at)) : 'Status do backend ainda não importado.'}</span></div>
  ${icapHtml()}<div class="grid g3">${INT_CONEXOES.map(x => { const [l, k] = INT_ESTADO[intEstadoDe(x)], u = x.real ? intUltima(x) : ''; return `<div class="kpi"><div class="row"><b>${esc(x.nome)}</b><span class="sp"></span>${pill(l, k)}</div><div class="sm muted" style="margin-top:6px">${esc(x.nota)}</div>${u ? `<div class="sm" style="margin-top:4px">Última execução: ${esc(u)}</div>` : ''}${x.real ? `<div style="margin-top:6px">${acao(x)}</div>` : ''}</div>`; }).join('')}</div></div>`;
  h += `<div class="card"><h3>Mapa de campos e origem dos dados</h3><p class="sm muted">Coluna "Campo externo": registre o nome do campo no sistema de destino quando ele existir. É apenas anotação — não é usado até haver um conector real.</p>
  <div class="tw"><table><thead><tr><th>Dado</th><th>Entidade</th><th>Origem hoje</th>${INT_EXT.map(x => `<th>${esc(x.nome)}</th>`).join('')}</tr></thead><tbody>${INT_CAMPOS.map(f => `<tr><td><b>${esc(f.l)}</b>${f.chave ? ' <span class="pill info">chave de vínculo</span>' : ''}</td><td>${esc(f.ent)}</td><td class="sm">${esc(f.origem)}</td>${INT_EXT.map(x => `<td><input type="text" data-c="intMapSet" data-k="${x.id}|${f.k}" value="${esc((intMap()[x.id] || {})[f.k] || '')}" maxlength="60" aria-label="${esc(f.l)} em ${esc(x.nome)}" style="width:100%"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  h += `<div class="card"><h3>Regras já implementadas</h3><ul class="sm"><li><b>Vínculo e duplicidade:</b> id externo → CNPJ+código → CNPJ → código. Coincidência parcial vira "revisar"; id externo contraditório com o CNPJ, CNPJ repetido ou código divergente vira "conflito". Nada é mesclado ou gravado automaticamente.</li>
  <li><b>Conflito de sincronização:</b> valor externo diferente do interno gera divergência campo a campo; o dado interno confirmado nunca é sobrescrito.</li>
  <li><b>Autorização:</b> toda operação passa por <code>intRun</code>, que exige conta autenticada, conector ativo e entrega apenas a carteira do próprio executivo.</li>
  <li><b>Credenciais:</b> nunca ficam no app. Quando houver conector, as chaves serão segredos do backend (Worker). ${window.__HOSTED__ ? 'A identidade do executivo chega ao Worker pelo Cloudflare Access.' : 'Pendência de projeto: como o backend verificará a identidade do executivo — o artefato não envia prova de identidade ao Worker hoje.'}</li></ul></div>`;
  const L = S.intlog.slice(0, 30);
  h += `<div class="card"><h3>Registro de operações e erros</h3>${L.length ? `<div class="tw"><table><thead><tr><th>Quando</th><th>Sistema</th><th>Operação</th><th>Resultado</th><th>Detalhe</th></tr></thead><tbody>${L.map(x => `<tr><td>${esc(dtBR(x.at))}</td><td>${esc(x.sistema)}</td><td>${esc(x.op)}</td><td>${pill(x.estado, x.estado === 'ok' ? 'ok' : x.estado === 'erro' ? 'bad' : 'warn')}</td><td class="sm">${esc(x.msg || (x.n != null ? x.n + ' registro(s)' : ''))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="sm muted">Nenhuma operação registrada.</p>'}</div>`;
  return h + usoCard();
}
