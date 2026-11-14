/* ===== PAINEL ADMINISTRADOR: acesso exclusivo, coleta de eventos de utilização e saúde operacional =====
   Acesso: identidade VERIFICADA pelo Cloudflare Access (JWT: assinatura RS256, emissor, AUD, validade) → e-mail + sub (id estável da conta no Access).
   A permissão é do e-mail PAINEL_ADMIN_EMAIL (padrão renan.oscar@totvs.com.br) e fica vinculada ao `sub`: no primeiro acesso verificado grava-se o vínculo
   (adm_conta); depois, e-mail igual com `sub` diferente é NEGADO e registrado. Nada vem de formulário, URL, localStorage ou cabeçalho do cliente.
   Privacidade: o painel só lê contagens e metadados (tabelas próprias). Não lê nomes de clientes, CNPJ, valores, documentos, diagnósticos, chaves ou respostas de IA;
   os eventos aceitam apenas campos numéricos ou de lista fechada (sem texto livre). Falha na coleta nunca bloqueia a operação principal. */
const ADM_FUNCS = {
  acesso: { rot: 'Acesso (entrada autenticada)', util: 0, org: 's' },
  import_carteira: { rot: 'Importação da carteira', util: 1, org: 'c' },
  ficha_upload: { rot: 'Fichas de faturamento (upload/lote)', util: 1, org: 'c' },
  doc_upload: { rot: 'Documentos complementares / imagens', util: 1, org: 'c' },
  ocr_leitura: { rot: 'Leitura por OCR', util: 1, org: 's' },
  raiox_gerar: { rot: 'Geração/atualização do raio-X', util: 1, org: 'c' },
  diag_abrir: { rot: 'Diagnóstico completo aberto', util: 1, org: 'c' },
  pesquisa_ic: { rot: 'Pesquisa na Inteligência Comercial', util: 1, org: 's' },
  radar_regulatorio: { rot: 'Radar regulatório / marcos', util: 1, org: 's' },
  cnpj_consulta: { rot: 'Consulta de CNPJ', util: 1, org: 's' },
  solucao_importar: { rot: 'Importação de soluções (texto, arquivo, link)', util: 1, org: 'sc' },
  recomendacao_leitura: { rot: 'Validação/descarte de recomendação', util: 1, org: 'c' },
  relatorio_exportar: { rot: 'Exportação de relatório', util: 1, org: 'c' },
  dados_backup: { rot: 'Backup, restauração e limpeza', util: 0, org: 'c' },
  integracao_teste: { rot: 'Teste de integração', util: 0, org: 'sc' },
  coleta_falha: { rot: 'Falha da coleta (relatada pelo navegador)', util: 0, org: 'c' },
  desempenho_abertura: { rot: 'Desempenho da abertura (tempos do navegador)', util: 0, org: 'c' }
};
const ADM_PRINCIPAIS = ['import_carteira', 'ficha_upload', 'raiox_gerar', 'diag_abrir', 'recomendacao_leitura', 'pesquisa_ic'];
const ADM_CFG0 = { inatividade_dias: 14, sessao_min: 30, retencao_dias: 180, principais: ADM_PRINCIPAIS };
const ADM_FASES = ['iniciada', 'concluida', 'erro'], ADM_RES = ['ok', 'parcial', 'erro', 'cancelado'];
const ADM_NUM = ['n', 'n_ok', 'n_erro', 'n_dup', 'n_pend', 'clientes', 'itens', 'conc', 'fcp_ms', 'lcp_ms', 'pronto_ms', 'cls_m'];
const ADM_ENUM = { via: ['link', 'arquivo', 'texto', 'backend', 'pagina', 'manual', 'direto'], tipo: ['pdf', 'json', 'csv', 'html', 'xlsx', 'raiox', 'ficha', 'doc', 'imagem', 'carteira', 'backup', 'cliente', 'segmento', 'produto', 'regulatorio', 'marcos', 'teste', 'status', 'ia', 'oportunidades'], leitura: ['faz_sentido', 'investigar', 'ja_atendida', 'descartar', 'validada', 'descartada'], op: ['export', 'import', 'limpar', 'restaurar'], modo: ['lote', 'individual', 'auto'] };
const ADM_COD = /^[a-z0-9_]{1,40}$/, ADM_ID = /^[A-Za-z0-9_\-]{1,64}$/;
const ADM_MEM = { init: null, falhas: 0, ultimaFalha: '', rate: new Map() };
const ADM_DDL = [
  'CREATE TABLE IF NOT EXISTS adm_conta (email TEXT PRIMARY KEY, sub TEXT NOT NULL, vinculado_em TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS usuarios (email TEXT PRIMARY KEY, sub TEXT, nome TEXT, primeiro_acesso TEXT NOT NULL, ultimo_acesso TEXT NOT NULL, acessos INTEGER NOT NULL DEFAULT 1)',
  'CREATE TABLE IF NOT EXISTS adm_roster (email TEXT PRIMARY KEY, nome TEXT, incluido_em TEXT NOT NULL, origem TEXT)',
  'CREATE TABLE IF NOT EXISTS eventos (id TEXT PRIMARY KEY, ts TEXT NOT NULL, usuario TEXT NOT NULL, func TEXT NOT NULL, fase TEXT NOT NULL, resultado TEXT, corr TEXT, dur_ms INTEGER, origem TEXT NOT NULL, meta TEXT)',
  'CREATE INDEX IF NOT EXISTS eventos_ts ON eventos(ts)', 'CREATE INDEX IF NOT EXISTS eventos_usr ON eventos(usuario, ts)',
  'CREATE TABLE IF NOT EXISTS adm_cfg (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS adm_tentativas (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, usuario TEXT, motivo TEXT NOT NULL, rota TEXT)',
  'CREATE TABLE IF NOT EXISTS sugestoes (id TEXT PRIMARY KEY, email TEXT NOT NULL, em TEXT NOT NULL, area TEXT NOT NULL, texto TEXT NOT NULL, lida INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS csp_obs (chave TEXT PRIMARY KEY, diretiva TEXT NOT NULL, alvo TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 1, ultimo TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS adm_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, usuario TEXT NOT NULL, acao TEXT NOT NULL, detalhe TEXT, resultado TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS uso_dia (dia TEXT NOT NULL, usuario TEXT NOT NULL, rota TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, usuario, rota))',
  'CREATE TABLE IF NOT EXISTS cat_fontes (id TEXT PRIMARY KEY, nome TEXT NOT NULL, url TEXT NOT NULL, estado TEXT NOT NULL, erro TEXT, autenticado INTEGER NOT NULL DEFAULT 0, testada_em TEXT, ultima_sinc TEXT)',
  'CREATE TABLE IF NOT EXISTS cat_paginas (chave TEXT PRIMARY KEY, url TEXT NOT NULL, fonte TEXT NOT NULL, pai TEXT, titulo TEXT, prof INTEGER NOT NULL DEFAULT 0, estado TEXT NOT NULL, erro TEXT, hash TEXT, filhos INTEGER, vista_em TEXT, alterada_em TEXT, revisada_em TEXT)',
  'CREATE INDEX IF NOT EXISTS cat_pag_fe ON cat_paginas(fonte, estado, prof)',
  'CREATE TABLE IF NOT EXISTS cat_exec (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, fonte TEXT NOT NULL, op TEXT NOT NULL, lidas INTEGER NOT NULL DEFAULT 0, novas INTEGER NOT NULL DEFAULT 0, erros INTEGER NOT NULL DEFAULT 0, detalhe TEXT)'
];
const admDb = env => env && env.DB && typeof env.DB.prepare === 'function' ? env.DB : null;
async function admInit(env) {
  const db = admDb(env); if (!db) return false;
  if (!ADM_MEM.init) ADM_MEM.init = (async () => { await db.batch(ADM_DDL.map(s => db.prepare(s))); await db.prepare('INSERT OR IGNORE INTO adm_cfg(chave,valor) VALUES(?,?)').bind('cobertura_inicio', JSON.stringify(new Date().toISOString())).run(); return true; })().catch(e => { ADM_MEM.init = null; throw e; });
  return ADM_MEM.init;
}
/* falha de coleta: nunca propaga; conta em memória e, se o banco responder, grava o contador */
async function admFalha(env) {
  ADM_MEM.falhas++; ADM_MEM.ultimaFalha = new Date().toISOString();
  try { const db = admDb(env); if (db) { await db.prepare('INSERT INTO adm_cfg(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor').bind('m_falhas_servidor', JSON.stringify({ n: ADM_MEM.falhas, ultima: ADM_MEM.ultimaFalha })).run(); } } catch { /* banco indisponível: o contador fica em memória */ }
}
const admCfgLer = async db => {
  const r = await db.prepare('SELECT chave, valor FROM adm_cfg').all(), o = {}; (r.results || []).forEach(x => { try { o[x.chave] = JSON.parse(x.valor); } catch { /* ignora */ } });
  const c = { ...ADM_CFG0, ...(o.cfg || {}) }; c.principais = (Array.isArray(c.principais) ? c.principais : ADM_PRINCIPAIS).filter(f => ADM_FUNCS[f]);
  return { cfg: c, cobertura: o.cobertura_inicio || null, falhasServidor: o.m_falhas_servidor || null, ultimaPurga: o.ultima_purga || null };
};
const admEhJwt = au => !!(au && au.user && au.verif && au.sub);
/* tentativa negada: registra sem dados sensíveis (sem IP, token, corpo ou cabeçalhos) e com teto de gravação */
async function admNegar(env, au, rota, motivo) {
  try {
    const db = admDb(env); if (db) {
      await admInit(env); const n = await db.prepare('SELECT COUNT(*) c FROM adm_tentativas WHERE ts>?').bind(new Date(Date.now() - 60000).toISOString()).first();
      if ((n?.c || 0) < 30) await db.prepare('INSERT INTO adm_tentativas(ts,usuario,motivo,rota) VALUES(?,?,?,?)').bind(new Date().toISOString(), au && au.user ? au.user : null, String(motivo).slice(0, 40), String(rota).slice(0, 60)).run();
    }
  } catch { /* o bloqueio vale mesmo sem registro */ }
  return J({ ok: false, erro: { codigo: 'proibido', mensagem: 'Acesso restrito ao administrador.' } }, 403);
}
/* devolve true só para a conta do administrador, com identidade verificada e `sub` vinculado */
async function admPermitido(env, au) {
  try {
    if (!admEhJwt(au)) return { ok: false, motivo: au && au.user ? 'identidade_nao_verificada' : 'sem_identidade' };
    if (au.user !== String(env.PAINEL_ADMIN_EMAIL || 'renan.oscar@totvs.com.br').toLowerCase()) return { ok: false, motivo: 'conta_nao_admin' };
    const db = admDb(env); if (!db) return { ok: false, motivo: 'sem_banco' }; await admInit(env);
    let r = await db.prepare('SELECT sub FROM adm_conta WHERE email=?').bind(au.user).first();
    if (!r) { await db.prepare('INSERT OR IGNORE INTO adm_conta(email,sub,vinculado_em) VALUES(?,?,?)').bind(au.user, au.sub, new Date().toISOString()).run(); r = await db.prepare('SELECT sub FROM adm_conta WHERE email=?').bind(au.user).first(); }
    return r && r.sub === au.sub ? { ok: true } : { ok: false, motivo: 'sub_divergente' };
  } catch { return { ok: false, motivo: 'erro_interno' }; }
}
async function admGuard(env, au, rota) { const p = await admPermitido(env, au); return p.ok ? null : admNegar(env, au, rota, p.motivo); }

/* ---- coleta ---- */
function admMetaLimpa(m) {
  const o = {}; if (!m || typeof m !== 'object' || Array.isArray(m)) return o;
  for (const k of ADM_NUM) if (k in m) { const v = +m[k]; if (Number.isFinite(v) && v >= 0 && v < 1e7) o[k] = Math.round(v); }
  for (const k of Object.keys(ADM_ENUM)) if (typeof m[k] === 'string' && ADM_ENUM[k].includes(m[k])) o[k] = m[k];
  if (typeof m.codigo === 'string' && ADM_COD.test(m.codigo)) o.codigo = m.codigo;
  if (typeof m.prov === 'string' && /^[a-z0-9_]{1,20}$/.test(m.prov)) o.prov = m.prov;
  if (m.cache === 1 || m.cache === true) o.cache = 1;
  return o;
}
function admEvento(e, user, origem, agora) {
  if (!e || typeof e !== 'object') return null; const f = ADM_FUNCS[e.func]; if (!f || e.func === 'acesso') return null;
  if (!ADM_FASES.includes(e.fase)) return null; if (!ADM_ID.test(String(e.id || ''))) return null;
  let res = e.resultado == null || e.resultado === '' ? (e.fase === 'erro' ? 'erro' : e.fase === 'concluida' ? 'ok' : null) : String(e.resultado); if (res && !ADM_RES.includes(res)) return null;
  if (e.fase === 'erro') res = 'erro'; if (e.fase === 'iniciada') res = null;
  const corr = e.corr == null || e.corr === '' ? null : (ADM_ID.test(String(e.corr)) ? String(e.corr) : null);
  const dur = Number.isFinite(+e.dur) && +e.dur >= 0 && +e.dur < 36e5 ? Math.round(+e.dur) : null;
  let ts = agora; if (e.ts) { const t = Date.parse(e.ts); if (Number.isFinite(t) && t <= Date.parse(agora) + 300000 && t >= Date.parse(agora) - 86400000) ts = new Date(t).toISOString(); }
  const meta = admMetaLimpa(e.meta);
  return { id: String(e.id), ts, usuario: user, func: e.func, fase: e.fase, resultado: res, corr, dur_ms: dur, origem, meta: Object.keys(meta).length ? JSON.stringify(meta) : null };
}
async function admGravar(env, linhas) {
  const db = admDb(env); if (!db || !linhas.length) return 0; await admInit(env);
  const st = db.prepare('INSERT OR IGNORE INTO eventos(id,ts,usuario,func,fase,resultado,corr,dur_ms,origem,meta) VALUES(?,?,?,?,?,?,?,?,?,?)');
  await db.batch(linhas.map(l => st.bind(l.id, l.ts, l.usuario, l.func, l.fase, l.resultado, l.corr, l.dur_ms, l.origem, l.meta)));
  if (Math.random() < 0.02) await admPurgar(env).catch(() => 0);
  return linhas.length;
}
async function admPurgar(env, forcar) {
  const db = admDb(env); if (!db) return { eventos: 0, tentativas: 0 }; await admInit(env); const { cfg } = await admCfgLer(db), lim = new Date(Date.now() - cfg.retencao_dias * 864e5).toISOString();
  const a = await db.prepare('DELETE FROM eventos WHERE ts<?').bind(lim).run(), b = await db.prepare('DELETE FROM adm_tentativas WHERE ts<?').bind(new Date(Date.now() - 90 * 864e5).toISOString()).run();
  await db.prepare('DELETE FROM uso_dia WHERE dia<?').bind(new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)).run();
  await db.prepare('DELETE FROM adm_audit WHERE ts<?').bind(new Date(Date.now() - 365 * 864e5).toISOString()).run();
  await db.prepare('DELETE FROM sugestoes WHERE em<?').bind(new Date(Date.now() - 180 * 864e5).toISOString()).run();
  await db.prepare('INSERT INTO adm_cfg(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor').bind('ultima_purga', JSON.stringify(new Date().toISOString())).run();
  return { eventos: a.meta?.changes ?? 0, tentativas: b.meta?.changes ?? 0 };
}
/* POST /api/ev  {eventos:[{id,func,fase,resultado,corr,dur,ts,meta}]}  — qualquer executivo autenticado; só grava eventos próprios */
/* Observação de CSP (Report-Only): só contadores por diretiva+origem do recurso; sem URL completa, sem conteúdo, sem usuário. */
async function admCsp(req, env, au) {
  if (!au.user || req.method !== 'POST') return new Response(null, { status: 204 });
  const db = admDb(env); if (!db) return new Response(null, { status: 204 });
  const now = Date.now(), rr = ADM_MEM.rate.get('csp:' + au.user) || { t: now, n: 0 }; if (now - rr.t > 60000) { rr.t = now; rr.n = 0; } rr.n++; ADM_MEM.rate.set('csp:' + au.user, rr);
  if (rr.n > 30) return new Response(null, { status: 204 });
  try {
    const raw = await req.text(); if (raw.length > 4096) return new Response(null, { status: 204 });
    const j = JSON.parse(raw), r = j['csp-report'] || (Array.isArray(j) ? (j[0] || {}).body : j.body) || {};
    const dir = String(r['violated-directive'] || r.effectiveDirective || r['effective-directive'] || '').split(' ')[0].replace(/[^a-z-]/gi, '').slice(0, 40);
    let alvo = String(r['blocked-uri'] || r.blockedURL || r.blockedUri || '').slice(0, 300); try { const u = new URL(alvo); alvo = u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : u.protocol; } catch { alvo = alvo.replace(/[^a-z:\-]/gi, '').slice(0, 30) || 'inline'; }
    if (!dir) return new Response(null, { status: 204 });
    await admInit(env);
    const n = (await db.prepare('SELECT COUNT(*) c FROM csp_obs').first())?.c || 0; if (n >= 200 && !(await db.prepare('SELECT 1 x FROM csp_obs WHERE chave=?').bind(dir + '|' + alvo).first())) return new Response(null, { status: 204 });
    await db.prepare('INSERT INTO csp_obs(chave,diretiva,alvo,n,ultimo) VALUES(?,?,?,1,?) ON CONFLICT(chave) DO UPDATE SET n=n+1, ultimo=excluded.ultimo').bind(dir + '|' + alvo, dir, alvo, new Date().toISOString()).run();
  } catch { /* observação é melhor esforço */ }
  return new Response(null, { status: 204 });
}
async function admIngestar(req, env, au) {
  if (!au.user) return J({ ok: false, erro: { codigo: 'nao_autorizado', mensagem: 'Eventos exigem identidade.' } }, 401);
  if (req.method !== 'POST') return J({ ok: false, erro: { codigo: 'metodo', mensagem: 'Use POST.' } }, 405);
  const now = Date.now(), k = au.user, rr = ADM_MEM.rate.get(k) || { t: now, n: 0 }; if (now - rr.t > 60000) { rr.t = now; rr.n = 0; } rr.n++; ADM_MEM.rate.set(k, rr); if (ADM_MEM.rate.size > 500) ADM_MEM.rate.clear();
  if (rr.n > 60) return J({ ok: false, erro: { codigo: 'limite', mensagem: 'Muitos envios de eventos.' } }, 429);
  try {
    const raw = await req.text(); if (raw.length > 30000) return J({ ok: false, erro: { codigo: 'muito_grande', mensagem: 'Lote de eventos acima de 30 KB.' } }, 413);
    let q; try { q = JSON.parse(raw); } catch { return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'JSON inválido.' } }, 400); }
    const lista = Array.isArray(q?.eventos) ? q.eventos.slice(0, 25) : [], agora = new Date().toISOString(), linhas = lista.map(e => admEvento(e, au.user, 'c', agora)).filter(Boolean);
    await admGravar(env, linhas); return J({ ok: true, aceitos: linhas.length, descartados: lista.length - linhas.length });
  } catch (e) { await admFalha(env); return J({ ok: false, erro: { codigo: 'coleta_indisponivel', mensagem: 'Coleta de eventos indisponível (a operação principal não é afetada).' } }, 503); }
}
/* acesso: um evento por janela de sessão (recarregar a página não duplica) + cadastro do usuário identificado */
async function admAcesso(env, au) {
  if (!admEhJwt(au)) return; /* APP_TOKEN legado ou identidade não verificada: não cadastra usuário */
  try {
    const db = admDb(env); if (!db) return; await admInit(env); const { cfg } = await admCfgLer(db), agora = new Date().toISOString();
    await db.prepare('INSERT INTO usuarios(email,sub,nome,primeiro_acesso,ultimo_acesso,acessos) VALUES(?,?,?,?,?,1) ON CONFLICT(email) DO UPDATE SET ultimo_acesso=excluded.ultimo_acesso, sub=COALESCE(usuarios.sub, excluded.sub), acessos=usuarios.acessos+1').bind(au.user, au.sub, nomeDeEmail(au.user), agora, agora).run();
    const u = await db.prepare("SELECT MAX(ts) t FROM eventos WHERE usuario=? AND func='acesso'").bind(au.user).first();
    if (!u?.t || Date.parse(agora) - Date.parse(u.t) > cfg.sessao_min * 60000) await admGravar(env, [{ id: 'ac_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24), ts: agora, usuario: au.user, func: 'acesso', fase: 'concluida', resultado: 'ok', corr: null, dur_ms: null, origem: 's', meta: null }]);
  } catch { await admFalha(env); }
}
/* eventos medidos no servidor (não dependem do navegador) */
const ADM_ROTAS = { '/api/ia': 'pesquisa_ic', '/api/ia/teste': 'integracao_teste', '/api/status': 'integracao_teste', '/api/cnpj': 'cnpj_consulta', '/api/importar': 'solucao_importar', '/api/ocr': 'ocr_leitura' };
async function admMedir(env, ctx, au, path, req, t0, resp) {
  try {
    let func = ADM_ROTAS[path]; if (!func || !au.user) return;
    const meta = {}; let res = 'ok', cod = null;
    if (path === '/api/ia') { try { const q = await req.clone().json(); const tp = String(q?.tipo || ''); if (tp === 'regulatorio' || tp === 'marcos') func = 'radar_regulatorio'; if (ADM_ENUM.tipo.includes(tp)) meta.tipo = tp; if (/^[a-z0-9_]{1,20}$/.test(String(q?.provedor || ''))) meta.prov = q.provedor; } catch { /* sem metadados */ } }
    if (path === '/api/importar') meta.via = 'link'; if (path === '/api/ia/teste') meta.tipo = 'teste'; if (path === '/api/status') meta.tipo = 'status';
    let j = null; try { j = await resp.clone().json(); } catch { /* corpo não JSON */ }
    if (resp.status >= 500 && !j) { res = 'erro'; cod = 'http_' + resp.status; } else if (j && j.ok === false) { res = 'erro'; cod = String(j.erro?.codigo || (Array.isArray(j.resultados) ? j.resultados.find(r => r && r.erro)?.erro?.codigo : '') || 'erro').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40); } else if (!j) { res = 'erro'; cod = 'resposta_invalida'; } else if (j.daCache) meta.cache = 1;
    if (cod) meta.codigo = cod;
    const l = admEvento({ id: 'sv_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24), func, fase: res === 'ok' ? 'concluida' : 'erro', resultado: res, dur: Date.now() - t0, meta }, au.user, 's', new Date().toISOString());
    if (l) { const p = admGravar(env, [l]).catch(() => admFalha(env)); if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p; }
  } catch { await admFalha(env); }
}

/* ---- cálculo (puro, testável) ---- */
const admDia = iso => String(iso).slice(0, 10);
function admSemana(iso) { const d = new Date(admDia(iso) + 'T00:00:00Z'), w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); }
function admPerc(a, p) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]; }
function admCalc({ users = [], roster = [], events = [], cfg = ADM_CFG0, agora, de, ate, func = '', anteriores = {}, cobertura = null, filas = null }) {
  const nowT = Date.parse(agora || new Date().toISOString()), tDe = Date.parse(de), tAte = Date.parse(ate), principais = new Set((cfg.principais || ADM_PRINCIPAIS).filter(f => ADM_FUNCS[f]));
  const jan = Math.max(Date.parse(cobertura || de), tAte - cfg.inatividade_dias * 864e5);
  const isUtil = e => ADM_FUNCS[e.func]?.util && e.fase === 'concluida' && (e.resultado === 'ok' || e.resultado === 'parcial');
  const prev = new Map(roster.map(r => [r.email, r])), usr = new Map(users.map(u => [u.email, u])), todos = new Set([...prev.keys(), ...usr.keys()]);
  const porU = new Map(); events.forEach(e => { if (!porU.has(e.usuario)) porU.set(e.usuario, []); porU.get(e.usuario).push(e); });
  const linhas = [...todos].sort().map(email => {
    const u = usr.get(email), r = prev.get(email), ev = porU.get(email) || [], ut = ev.filter(isUtil), t = e => Date.parse(e.ts);
    const utP = ut.filter(e => t(e) >= tDe && t(e) <= tAte && (!func || e.func === func)), acP = ev.filter(e => e.func === 'acesso' && t(e) >= tDe && t(e) <= tAte);
    const ultUtil = ut.reduce((m, e) => (!m || e.ts > m ? e.ts : m), null), recJan = ut.filter(e => t(e) >= jan && t(e) <= tAte);
    const recursosTotal = [...new Set(ut.filter(e => principais.has(e.func)).map(e => e.func))].sort(), recursos = [...new Set(utP.map(e => e.func))].sort();
    let sit; if (!u) sit = 'nunca_acessou'; else if (!ut.some(e => principais.has(e.func))) sit = 'sem_recursos_principais'; else sit = recJan.length ? 'ativo' : 'sem_atividade_recente';
    const ant = anteriores[email] || null;
    return { email, nome: (u && u.nome) || (r && r.nome) || nomeDeEmail(email), previsto: !!r, identificado: !!u, importou_carteira: ut.some(e => e.func === 'import_carteira'), primeiro_acesso: u ? u.primeiro_acesso : null, ultimo_acesso: u ? u.ultimo_acesso : null, ultima_atividade_util: ultUtil, situacao: sit, recursos_utilizados: recursos, recursos_principais_cobertura: recursosTotal, acessos_periodo: acP.length, atividades_periodo: utP.length, evidencia_anterior: ant && cobertura && ant.primeira < cobertura ? { gravacoes: ant.n, primeira: ant.primeira, ultima: ant.ultima } : null };
  });
  const cnt = s => linhas.filter(l => l.situacao === s).length, prevL = linhas.filter(l => l.previsto);
  const kpis = { previstos: prevL.length, identificados: linhas.filter(l => l.identificado).length, primeiro_acesso_previstos: prevL.filter(l => l.identificado).length, fora_da_lista: linhas.filter(l => l.identificado && !l.previsto).length, ativos_periodo: linhas.filter(l => l.atividades_periodo > 0).length, com_acesso_periodo: linhas.filter(l => l.acessos_periodo > 0 || l.atividades_periodo > 0).length, sem_atividade_recente: cnt('sem_atividade_recente'), nunca_acessaram: cnt('nunca_acessou'), acessaram_sem_recursos_principais: cnt('sem_recursos_principais') };
  /* série: diária (≤31 dias) ou semanal */
  const dias = Math.max(1, Math.round((tAte - tDe) / 864e5)), bk = dias <= 31 ? admDia : admSemana, B = new Map();
  const slot = k => { if (!B.has(k)) B.set(k, { t: k, acessaram: new Set(), ativos: new Set(), novos: new Set() }); return B.get(k); };
  for (let d = tDe; d <= tAte; d += 864e5) slot(bk(new Date(d).toISOString()));
  slot(bk(new Date(tAte).toISOString()));
  events.forEach(e => { const t = Date.parse(e.ts); if (t < tDe || t > tAte) return; if (e.func === 'acesso' || isUtil(e)) slot(bk(e.ts)).acessaram.add(e.usuario); if (isUtil(e)) slot(bk(e.ts)).ativos.add(e.usuario); });
  users.forEach(u => { const t = Date.parse(u.primeiro_acesso); if (t >= tDe && t <= tAte) slot(bk(u.primeiro_acesso)).novos.add(u.email); });
  let acum = users.filter(u => Date.parse(u.primeiro_acesso) < tDe).length; const serie = [...B.values()].sort((a, b) => a.t.localeCompare(b.t)).map(b => { acum += b.novos.size; return { t: b.t, acessaram: b.acessaram.size, ativos: b.ativos.size, novos: b.novos.size, acumulado_identificados: acum }; });
  /* recursos e saúde */
  const ev = events.filter(e => { const t = Date.parse(e.ts); return t >= tDe && t <= tAte && (!func || e.func === func); });
  const F = {}; ev.forEach(e => { const f = F[e.func] ||= { func: e.func, rot: ADM_FUNCS[e.func]?.rot || e.func, iniciadas: 0, ok: 0, parcial: 0, erro: 0, usuarios: new Set(), durs: [], cod: {} }; if (e.fase === 'iniciada') f.iniciadas++; else if (e.fase === 'erro') f.erro++; else if (e.resultado === 'parcial') f.parcial++; else f.ok++; if (e.fase !== 'iniciada') f.usuarios.add(e.usuario); if (e.fase === 'concluida' && e.dur_ms != null) f.durs.push(e.dur_ms); let m = {}; try { m = e.meta ? JSON.parse(e.meta) : {}; } catch { m = {}; } if (e.fase === 'erro' && m.codigo) f.cod[m.codigo] = (f.cod[m.codigo] || 0) + 1; });
  const recursos = Object.values(F).map(f => ({ func: f.func, rot: f.rot, principal: principais.has(f.func), usuarios: f.usuarios.size, concluidas: f.ok + f.parcial, ok: f.ok, parcial: f.parcial, erros: f.erro, iniciadas: f.iniciadas, taxa_erro: f.ok + f.parcial + f.erro ? +(f.erro / (f.ok + f.parcial + f.erro)).toFixed(3) : null, dur_p50_ms: admPerc(f.durs, 50), dur_p95_ms: admPerc(f.durs, 95), dur_n: f.durs.length, erros_por_codigo: f.cod })).sort((a, b) => b.concluidas - a.concluidas);
  const recorrentes = []; recursos.forEach(r => Object.entries(r.erros_por_codigo).forEach(([c, n]) => { if (n >= 3) recorrentes.push({ func: r.func, rot: r.rot, codigo: c, n }); })); recorrentes.sort((a, b) => b.n - a.n);
  const finais = new Set(events.filter(e => e.fase !== 'iniciada' && e.corr).map(e => e.usuario + '|' + e.func + '|' + e.corr));
  const semConclusao = events.filter(e => e.fase === 'iniciada' && e.corr && Date.parse(e.ts) < nowT - 10 * 60000 && Date.parse(e.ts) > nowT - 864e5 && !finais.has(e.usuario + '|' + e.func + '|' + e.corr)); const sc = {}; semConclusao.forEach(e => { sc[e.func] = (sc[e.func] || 0) + 1; });
  const indisp = []; Object.values(F).forEach(f => { if (ADM_FUNCS[f.func]?.org === 's' || ADM_FUNCS[f.func]?.org === 'sc') { const ult = events.filter(e => e.func === f.func && e.origem === 's' && Date.parse(e.ts) > nowT - 864e5 && e.fase !== 'iniciada').sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 3); if (ult.length === 3 && ult.every(e => e.fase === 'erro')) indisp.push({ func: f.func, rot: f.rot, desde: ult[2].ts }); } });
  const limites = []; recursos.forEach(r => Object.entries(r.erros_por_codigo).forEach(([c, n]) => { if (/cota|limite|quota|rate|429/.test(c)) limites.push({ func: r.func, rot: r.rot, codigo: c, n }); }));
  const falhasCli = events.filter(e => e.func === 'coleta_falha').reduce((a, e) => { try { return a + (JSON.parse(e.meta || '{}').n || 1); } catch { return a + 1; } }, 0);
  const ultEv = events.reduce((m, e) => (!m || e.ts > m ? e.ts : m), null);
  return { periodo: { de, ate, dias }, func, cobertura_inicio: cobertura, criterios: { inatividade_dias: cfg.inatividade_dias, sessao_min: cfg.sessao_min, retencao_dias: cfg.retencao_dias, principais: [...principais], util: Object.keys(ADM_FUNCS).filter(f => ADM_FUNCS[f].util) }, kpis, usuarios: linhas, serie, recursos, saude: { recorrentes, sem_conclusao: sc, integracoes_indisponiveis: indisp, limites_provedor: limites, filas: filas, coleta: { ultimo_evento: ultEv, eventos_no_periodo: ev.length, falhas_relatadas_pelos_navegadores: falhasCli } } };
}
/* ---- endpoints /api/adm/* ---- */
const admData = (v, pad) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : pad; };
async function admResumo(env, url) {
  const db = admDb(env); await admInit(env); const { cfg, cobertura, falhasServidor, ultimaPurga } = await admCfgLer(db), agora = new Date().toISOString();
  const dias = Math.min(Math.max(+url.searchParams.get('dias') || 30, 1), 365);
  const ate = admData(url.searchParams.get('ate'), agora), de = admData(url.searchParams.get('de'), new Date(Date.parse(ate) - dias * 864e5).toISOString()), func = ADM_FUNCS[url.searchParams.get('func')] ? url.searchParams.get('func') : '';
  const ini = new Date(Math.min(Date.parse(de), Date.parse(ate) - cfg.inatividade_dias * 864e5, Date.parse(cobertura || de))).toISOString();
  const users = (await db.prepare('SELECT email,nome,primeiro_acesso,ultimo_acesso,acessos FROM usuarios ORDER BY email').all()).results || [];
  const roster = (await db.prepare('SELECT email,nome,incluido_em,origem FROM adm_roster ORDER BY email').all()).results || [];
  const events = (await db.prepare('SELECT id,ts,usuario,func,fase,resultado,corr,dur_ms,origem,meta FROM eventos WHERE ts>=? AND ts<=? ORDER BY ts LIMIT 50000').bind(ini, ate).all()).results || [];
  /* metadados de gravações anteriores à coleta (apenas contagem e datas; sem ler conteúdo) */
  const ant = {}; try { const r = await db.prepare("SELECT owner, COUNT(*) n, MIN(updated_at) p, MAX(updated_at) u FROM docs WHERE parent LIKE 'data/users/%' GROUP BY owner").all(); (r.results || []).forEach(x => { ant[String(x.owner).toLowerCase()] = { n: x.n, primeira: x.p, ultima: x.u }; }); } catch { /* sem metadados */ }
  let filas = null; try { const r = await db.prepare("SELECT json_extract(data,'$.estado') e, COUNT(*) n FROM docs WHERE parent LIKE 'data/users/%/carteira/ocr' GROUP BY e").all(); filas = { ocr: Object.fromEntries((r.results || []).map(x => [String(x.e || 'sem_estado'), x.n])) }; } catch { filas = null; }
  const out = admCalc({ users, roster, events, cfg, agora, de, ate, func, anteriores: ant, cobertura, filas });
  out.coleta_servidor = { falhas_servidor: falhasServidor?.n || ADM_MEM.falhas || 0, ultima_falha: falhasServidor?.ultima || ADM_MEM.ultimaFalha || null, ultima_purga: ultimaPurga };
  out.roster = roster; out.config = cfg; out.funcs = Object.fromEntries(Object.entries(ADM_FUNCS).map(([k, v]) => [k, { rot: v.rot, util: !!v.util, org: v.org }]));
  try { out.limites_backend = await (await handleLimites(env)).json(); } catch { out.limites_backend = null; }
  out.tentativas_negadas = { ultimas_24h: (await db.prepare('SELECT COUNT(*) c FROM adm_tentativas WHERE ts>?').bind(new Date(Date.now() - 864e5).toISOString()).first())?.c || 0, ultimas: ((await db.prepare('SELECT ts,usuario,motivo,rota FROM adm_tentativas ORDER BY id DESC LIMIT 10').all()).results || []) };
  try { out.csp = ((await db.prepare('SELECT diretiva,alvo,n,ultimo FROM csp_obs ORDER BY n DESC LIMIT 30').all()).results || []); } catch { out.csp = []; }
  out.geradoEm = agora; return out;
}
const SUG_AREAS = ['geral', 'lembrete', 'importacao', 'oportunidades', 'briefing', 'retornos', 'outro'];
const SUG_DADOS = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|R\$\s*\d|\b\d{1,3}(\.\d{3})+,\d{2}\b/;
/* POST /api/sug {area,texto} — qualquer executivo autenticado; texto livre curto, sem dados de cliente */
async function admSugerir(req, env, au) {
  const db = admDb(env); if (!db || !au.user) return J({ ok: false, erro: { codigo: 'sem_banco', mensagem: 'Indisponível no momento.' } }, 503);
  let q; try { q = await req.json(); } catch { return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'JSON inválido.' } }, 400); }
  const area = SUG_AREAS.includes(q && q.area) ? q.area : null, texto = typeof (q && q.texto) === 'string' ? q.texto.replace(/\s+/g, ' ').trim() : '';
  if (!area) return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'Escolha a área da sugestão.' } }, 400);
  if (texto.length < 10 || texto.length > 1000) return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'Descreva a sugestão em 10 a 1000 caracteres.' } }, 400);
  if (SUG_DADOS.test(texto)) return J({ ok: false, erro: { codigo: 'dados_sensiveis', mensagem: 'Não inclua CNPJ nem valores: descreva a ideia sem dados de clientes.' } }, 400);
  await admInit(env);
  const n = await db.prepare('SELECT COUNT(*) n FROM sugestoes WHERE email=? AND em>=?').bind(au.user, new Date(Date.now() - 864e5).toISOString()).first();
  if (n && n.n >= 5) return J({ ok: false, erro: { codigo: 'limite', mensagem: 'Limite de 5 sugestões por dia. Tente amanhã.' } }, 429);
  await db.prepare('INSERT INTO sugestoes(id,email,em,area,texto,lida) VALUES(?,?,?,?,?,0)').bind(crypto.randomUUID(), au.user, new Date().toISOString(), area, texto).run();
  return J({ ok: true });
}
async function admSugestoes(req, env, url) {
  const db = admDb(env); await admInit(env);
  if (req.method === 'POST') { let q; try { q = await req.json(); } catch { return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'JSON inválido.' } }, 400); } if (typeof (q && q.id) !== 'string' || q.id.length > 60) return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'id inválido.' } }, 400); await db.prepare('UPDATE sugestoes SET lida=? WHERE id=?').bind(q.lida === false ? 0 : 1, q.id).run(); return J({ ok: true }); }
  const r = await db.prepare('SELECT id,email,em,area,texto,lida FROM sugestoes ORDER BY lida ASC, em DESC LIMIT 100').all(), nl = await db.prepare('SELECT COUNT(*) n FROM sugestoes WHERE lida=0').first();
  return J({ ok: true, itens: r.results || [], nao_lidas: nl ? nl.n : 0 });
}
async function admRoster(req, env, au) {
  const db = admDb(env); await admInit(env); let q; try { q = await req.json(); } catch { return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'JSON inválido.' } }, 400); }
  const dom = '@' + DOMAIN_OK(env), agora = new Date().toISOString(); const lim = (await db.prepare('SELECT COUNT(*) c FROM adm_roster').first())?.c || 0;
  if (q.op === 'remove') { const e = String(q.email || '').toLowerCase(); await db.prepare('DELETE FROM adm_roster WHERE email=?').bind(e).run();
    /* tudo=true: remove também o registro de acesso (a pessoa some da lista; se entrar de novo, reaparece como "fora da lista"). Não bloqueia o login nem toca na carteira dela. */
    if (q.tudo === true) await db.prepare('DELETE FROM usuarios WHERE email=?').bind(e).run(); return J({ ok: true }); }
  if (q.op === 'edit') {
    const e = String(q.email || '').trim().toLowerCase(), nome = String(q.nome || '').trim().slice(0, 80), novo = String(q.novo_email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'E-mail inválido.' } }, 400);
    const acessou = !!(await db.prepare('SELECT 1 x FROM usuarios WHERE email=?').bind(e).first()), naLista = !!(await db.prepare('SELECT 1 x FROM adm_roster WHERE email=?').bind(e).first());
    if (!acessou && !naLista) return J({ ok: false, erro: { codigo: 'nao_encontrado', mensagem: 'Pessoa não encontrada.' } }, 404);
    if (novo && novo !== e) {
      if (acessou) return J({ ok: false, erro: { codigo: 'email_fixo', mensagem: 'O e-mail de quem já acessou vem do login corporativo e não pode ser alterado.' } }, 400);
      if (!EMAIL_RE.test(novo) || !novo.endsWith(dom)) return J({ ok: false, erro: { codigo: 'dominio', mensagem: 'Use um e-mail ' + dom + '.' } }, 400);
      if (await db.prepare('SELECT 1 x FROM adm_roster WHERE email=?').bind(novo).first()) return J({ ok: false, erro: { codigo: 'duplicado', mensagem: 'Já existe alguém com esse e-mail na lista.' } }, 400);
      await db.prepare('UPDATE adm_roster SET email=?, nome=? WHERE email=?').bind(novo, nome, e).run(); return J({ ok: true, email: novo });
    }
    if (naLista) await db.prepare('UPDATE adm_roster SET nome=? WHERE email=?').bind(nome, e).run();
    if (acessou && nome) await db.prepare('UPDATE usuarios SET nome=? WHERE email=?').bind(nome, e).run();
    return J({ ok: true, email: e });
  }
  if (q.op !== 'add' && q.op !== 'import') return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'Operação inválida.' } }, 400);
  const itens = (Array.isArray(q.itens) ? q.itens : []).slice(0, 300), bons = [], ruins = [];
  itens.forEach(x => { const e = String(x?.email || '').trim().toLowerCase(); if (EMAIL_RE.test(e) && e.endsWith(dom)) bons.push({ email: e, nome: String(x?.nome || '').trim().slice(0, 80) }); else ruins.push(String(x?.email || '').slice(0, 60)); });
  if (lim + bons.length > 600) return J({ ok: false, erro: { codigo: 'limite', mensagem: 'Lista acima de 600 pessoas.' } }, 400);
  if (bons.length) await db.batch(bons.map(b => db.prepare('INSERT INTO adm_roster(email,nome,incluido_em,origem) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET nome=CASE WHEN excluded.nome<>\'\' THEN excluded.nome ELSE adm_roster.nome END').bind(b.email, b.nome, agora, q.op === 'import' ? 'importada' : 'manual')));
  return J({ ok: true, incluidos: bons.length, recusados: ruins });
}
async function admConfig(req, env) {
  const db = admDb(env); await admInit(env); let q; try { q = await req.json(); } catch { return J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: 'JSON inválido.' } }, 400); }
  const { cfg } = await admCfgLer(db), n = { ...cfg }, intv = (v, a, b) => Number.isFinite(+v) && +v >= a && +v <= b ? Math.round(+v) : null;
  if ('inatividade_dias' in q) { const v = intv(q.inatividade_dias, 1, 365); if (v == null) return J({ ok: false, erro: { codigo: 'valor_invalido', mensagem: 'Inatividade: 1 a 365 dias.' } }, 400); n.inatividade_dias = v; }
  if ('sessao_min' in q) { const v = intv(q.sessao_min, 5, 240); if (v == null) return J({ ok: false, erro: { codigo: 'valor_invalido', mensagem: 'Sessão: 5 a 240 minutos.' } }, 400); n.sessao_min = v; }
  if ('retencao_dias' in q) { const v = intv(q.retencao_dias, 30, 730); if (v == null) return J({ ok: false, erro: { codigo: 'valor_invalido', mensagem: 'Retenção: 30 a 730 dias.' } }, 400); n.retencao_dias = v; }
  if ('principais' in q) { const p = (Array.isArray(q.principais) ? q.principais : []).filter(f => ADM_FUNCS[f] && ADM_FUNCS[f].util); if (!p.length) return J({ ok: false, erro: { codigo: 'valor_invalido', mensagem: 'Escolha ao menos um recurso principal.' } }, 400); n.principais = p; }
  await db.prepare('INSERT INTO adm_cfg(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor').bind('cfg', JSON.stringify(n)).run(); return J({ ok: true, config: n });
}
/* ===== Catálogo de soluções — fontes oficiais, descoberta em lotes e fila de revisão (somente administrador) =====
   Nada é publicado sozinho: a descoberta só registra endereço, título e estado. O conteúdo recuperado é tratado como dado
   (texto sem marcação, truncado), nunca como instrução. Credenciais ficam em segredos do Worker e não são devolvidas. */
const CAT_FONTES = [['tdn', 'TDN — documentação oficial', 'https://tdn.totvs.com/pages/viewpage.action?pageId=398756186'], ['enxoval', 'Enxoval de vendas', 'https://enxoval.totvs.com/']];
const CAT_CFG = { lote: 5, maxProf: 4, maxPaginas: 1500, maxFilhos: 250, pausaMs: 350, robotsTtlMs: 864e5 };
const CAT_EST = ['pendente', 'lida', 'candidata', 'irrelevante', 'inacessivel', 'importada'], CAT_REV = ['lida', 'candidata', 'irrelevante', 'importada'];
const CAT_MEM = { robots: new Map(), rate: new Map() };
const catTxt = (t, n) => String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const catPausa = ms => new Promise(r => setTimeout(r, ms));
async function catHash(t) { const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))); let s = ''; for (let i = 0; i < 12; i++) s += b[i].toString(16).padStart(2, '0'); return s; }
async function catSeed(db) { await db.batch(CAT_FONTES.map(f => db.prepare("INSERT OR IGNORE INTO cat_fontes(id,nome,url,estado) VALUES(?,?,?,'nao_testada')").bind(f[0], f[1], f[2]))); }
/* robots.txt: grupo "*"; a regra mais longa vence (Allow ganha o empate). Sem arquivo (404) = liberado. Falha de rede = não segue. */
function catRobotsParse(txt) {
  const reg = []; let ativo = false, visto = false;
  for (const l0 of String(txt).split(/\r?\n/)) { const l = l0.replace(/#.*/, '').trim(), m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(l); if (!m) continue; const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (visto) { ativo = false; visto = false; } if (v === '*') ativo = true; } else if (k === 'allow' || k === 'disallow') { visto = true; if (ativo && v) reg.push([k === 'allow', v]); } }
  return reg.slice(0, 400);
}
function catRobotsOk(reg, u) {
  let x; try { x = new URL(u); } catch { return false; } const alvo = x.pathname + x.search; let melhor = null;
  for (const [perm, pad] of reg) { let re; try { re = new RegExp('^' + pad.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')); } catch { continue; } if (re.test(alvo) && (!melhor || pad.length > melhor[1].length || (pad.length === melhor[1].length && perm))) melhor = [perm, pad]; }
  return melhor ? melhor[0] : true;
}
async function catRobots(host, env, ctx) {
  const c = CAT_MEM.robots.get(host); if (c && Date.now() - c.em < CAT_CFG.robotsTtlMs) return c;
  const r = await lkFetch('https://' + host + '/robots.txt', env, ctx, 200000); let o;
  if (r.erro) o = r.erro.codigo === 'nao_encontrado' ? { ok: true, reg: [], em: Date.now() } : r.erro.codigo === 'autenticacao_necessaria' ? { ok: true, reg: [], em: Date.now(), nota: 'robots.txt atrás de login' } : { ok: false, erro: r.erro.mensagem, em: 0 };
  else o = { ok: true, reg: /html/.test(r.ct) ? [] : catRobotsParse(new TextDecoder().decode(r.bytes)), em: Date.now() };
  if (o.ok) CAT_MEM.robots.set(host, o); return o;
}
/* lê uma página: título, impressão digital do texto e links internos (mesmo host). TDN: tenta também a lista de páginas-filhas do Confluence. */
async function catLer(url, env, ctx, rb) {
  const r = await lkFetch(url, env, ctx, LKCFG.maxHtml); if (r.erro) return { erro: r.erro, autenticado: !!r.autenticado };
  if (!/html/.test(r.ct)) return { erro: lkErr('formato_nao_suportado', 'Não é uma página HTML.'), autenticado: r.autenticado };
  const html = decodeHtml(r.bytes, r.ct); if (isLogin(html, r.final)) return { erro: lkErr('autenticacao_necessaria', 'A página exige login.'), autenticado: r.autenticado };
  const reg = lkRegion(html), fin = new URL(r.final), texto = stripTags(reg.html), links = [], vis = new Set();
  const add = (u, t) => { let x; try { x = new URL(u, r.final); } catch { return; } if (x.protocol !== 'https:' || x.hostname !== fin.hostname) return; x.hash = ''; if (LK_SKIP.test(x.href) || LK_DOC.test(x.href)) return; if (!catRobotsOk(rb, x.href)) return; const k = lkKey(x.href); if (vis.has(k) || k === lkKey(r.final)) return; vis.add(k); if (links.length < CAT_CFG.maxFilhos) links.push({ u: x.href, t: catTxt(t, 160), k }); };
  const pid = TDN_HOST.test(fin.hostname) ? (fin.searchParams.get('pageId') || (/[?&"']pageId=(\d+)/.exec(html) || [])[1] || (/<meta[^>]+name=["']ajs-page-id["'][^>]+content=["'](\d+)/i.exec(html) || [])[1]) : null; let viaApi = false;
  if (pid && /^\d+$/.test(pid)) { const api = 'https://' + fin.hostname + '/rest/api/content/' + pid + '/child/page?limit=200';
    if (catRobotsOk(rb, api)) { const a = await lkFetch(api, env, ctx, 600000); if (!a.erro && /json/.test(a.ct)) { try { const j = JSON.parse(new TextDecoder().decode(a.bytes)); for (const it of (Array.isArray(j.results) ? j.results : [])) if (it && /^\d+$/.test(String(it.id))) add('/pages/viewpage.action?pageId=' + it.id, it.title); viaApi = true; } catch { /* resposta inesperada: segue só com os links da página */ } } } }
  for (const l of lkLinks(reg.html, r.final)) add(l.u, l.t);
  return { final: r.final, titulo: catTxt(reg.titulo, 200), hash: await catHash(texto.slice(0, 200000)), chars: texto.length, links, viaApi, autenticado: r.autenticado };
}
async function catFonte(db, id) { return db.prepare('SELECT * FROM cat_fontes WHERE id=?').bind(String(id || '')).first(); }
async function catLog(db, fonte, op, o) { await db.prepare('INSERT INTO cat_exec(ts,fonte,op,lidas,novas,erros,detalhe) VALUES(?,?,?,?,?,?,?)').bind(new Date().toISOString(), fonte, op, o.lidas || 0, o.novas || 0, o.erros || 0, catTxt(o.detalhe, 300)).run(); await db.prepare('DELETE FROM cat_exec WHERE id NOT IN (SELECT id FROM cat_exec ORDER BY id DESC LIMIT 200)').run(); }
async function catTestar(db, env, f) {
  const ctx = { sub: 0 }, agora = new Date().toISOString(), host = new URL(f.url).hostname, rb = await catRobots(host, env, ctx);
  let estado, erro = null, res = null;
  if (!rb.ok) { estado = 'indisponivel'; erro = 'robots.txt: ' + rb.erro; }
  else if (!catRobotsOk(rb.reg, f.url)) { estado = 'bloqueada_robots'; erro = 'O robots.txt da fonte não permite a leitura automática deste endereço.'; }
  else { res = await catLer(f.url, env, ctx, rb.reg); if (res.erro) { estado = res.erro.codigo === 'autenticacao_necessaria' ? 'autenticacao_necessaria' : res.erro.codigo === 'nao_encontrado' ? 'nao_encontrada' : 'indisponivel'; erro = res.erro.mensagem; } else estado = 'ok'; }
  await db.prepare('UPDATE cat_fontes SET estado=?, erro=?, autenticado=?, testada_em=? WHERE id=?').bind(estado, erro, res && res.autenticado ? 1 : 0, agora, f.id).run();
  if (estado === 'ok') await db.prepare("INSERT OR IGNORE INTO cat_paginas(chave,url,fonte,pai,titulo,prof,estado) VALUES(?,?,?,NULL,?,0,'pendente')").bind(lkKey(f.url), f.url, f.id, res.titulo).run();
  await catLog(db, f.id, 'testar', { lidas: estado === 'ok' ? 1 : 0, erros: estado === 'ok' ? 0 : 1, detalhe: estado === 'ok' ? `ok; ${res.links.length} link(s) internos${res.viaApi ? '; páginas-filhas via API' : ''}` : estado + ': ' + erro });
  return { estado, erro, titulo: res && !res.erro ? res.titulo : '', links: res && !res.erro ? res.links.length : 0, via_api: !!(res && res.viaApi), autenticado: !!(res && res.autenticado), credencial_configurada: lkHasAuth(host, env) };
}
async function catDescobrir(db, env, f, n) {
  const ctx = { sub: 0 }, host = new URL(f.url).hostname, rb = await catRobots(host, env, ctx); if (!rb.ok) return { parou: 'robots.txt indisponível: ' + rb.erro, lidas: 0, novas: 0, erros: 0 };
  const lote = Math.max(1, Math.min(CAT_CFG.lote, n | 0 || CAT_CFG.lote)), fila = (await db.prepare("SELECT chave,url,prof FROM cat_paginas WHERE fonte=? AND estado='pendente' AND prof<=? ORDER BY prof, rowid LIMIT ?").bind(f.id, CAT_CFG.maxProf, lote).all()).results || [];
  let total = (await db.prepare('SELECT COUNT(*) n FROM cat_paginas WHERE fonte=?').bind(f.id).first()).n, lidas = 0, novas = 0, erros = 0, parou = '';
  for (const p of fila) {
    if (lidas + erros) await catPausa(CAT_CFG.pausaMs); const agora = new Date().toISOString();
    if (!catRobotsOk(rb.reg, p.url)) { await db.prepare("UPDATE cat_paginas SET estado='inacessivel', erro=?, vista_em=? WHERE chave=?").bind('bloqueada pelo robots.txt', agora, p.chave).run(); erros++; continue; }
    const r = await catLer(p.url, env, ctx, rb.reg);
    if (r.erro) { erros++; await db.prepare("UPDATE cat_paginas SET estado='inacessivel', erro=?, vista_em=? WHERE chave=?").bind(catTxt(r.erro.codigo + ': ' + r.erro.mensagem, 200), agora, p.chave).run(); if (r.erro.codigo === 'autenticacao_necessaria' && p.prof === 0) { parou = 'A fonte exige login.'; await db.prepare("UPDATE cat_fontes SET estado='autenticacao_necessaria', erro=? WHERE id=?").bind(r.erro.mensagem, f.id).run(); break; } continue; }
    lidas++; const st = [];
    if (p.prof < CAT_CFG.maxProf) for (const l of r.links) { if (total + st.length >= CAT_CFG.maxPaginas) { parou = `Limite de ${CAT_CFG.maxPaginas} páginas por fonte atingido.`; break; } st.push(db.prepare("INSERT OR IGNORE INTO cat_paginas(chave,url,fonte,pai,titulo,prof,estado) VALUES(?,?,?,?,?,?,'pendente')").bind(l.k, l.u, f.id, p.chave, l.t, p.prof + 1)); }
    st.push(db.prepare("UPDATE cat_paginas SET estado='lida', erro=NULL, titulo=?, hash=?, filhos=?, vista_em=?, alterada_em=? WHERE chave=?").bind(r.titulo || null, r.hash, r.links.length, agora, agora, p.chave));
    const out = await db.batch(st); for (let i = 0; i < out.length - 1; i++) novas += out[i]?.meta?.changes || 0; total += st.length - 1;
  }
  await db.prepare('UPDATE cat_fontes SET ultima_sinc=? WHERE id=?').bind(new Date().toISOString(), f.id).run();
  const rest = (await db.prepare("SELECT COUNT(*) n FROM cat_paginas WHERE fonte=? AND estado='pendente' AND prof<=?").bind(f.id, CAT_CFG.maxProf).first()).n;
  await catLog(db, f.id, 'descobrir', { lidas, novas, erros, detalhe: parou || `${rest} página(s) ainda por ler` });
  return { lidas, novas, erros, restantes: rest, parou };
}
/* relê páginas já revisadas (candidata/importada), das mais antigas para as mais novas, e sinaliza as que mudaram na fonte */
async function catReler(db, env, f, n) {
  const ctx = { sub: 0 }, rb = await catRobots(new URL(f.url).hostname, env, ctx); if (!rb.ok) return { parou: 'robots.txt indisponível: ' + rb.erro, relidas: 0, alteradas: 0, erros: 0 };
  const fila = (await db.prepare("SELECT chave,url,hash FROM cat_paginas WHERE fonte=? AND estado IN ('candidata','importada') ORDER BY vista_em, rowid LIMIT ?").bind(f.id, Math.max(1, Math.min(CAT_CFG.lote, n | 0 || CAT_CFG.lote))).all()).results || [];
  let relidas = 0, alteradas = 0, erros = 0;
  for (const p of fila) {
    if (relidas + erros) await catPausa(CAT_CFG.pausaMs); const agora = new Date().toISOString(), r = catRobotsOk(rb.reg, p.url) ? await catLer(p.url, env, ctx, rb.reg) : { erro: lkErr('bloqueada_robots', 'bloqueada pelo robots.txt') };
    if (r.erro) { erros++; await db.prepare('UPDATE cat_paginas SET erro=?, vista_em=? WHERE chave=?').bind(catTxt('releitura — ' + r.erro.codigo + ': ' + r.erro.mensagem, 200), agora, p.chave).run(); continue; }
    relidas++; const mudou = !!p.hash && p.hash !== r.hash; if (mudou) alteradas++;
    await db.prepare('UPDATE cat_paginas SET erro=NULL, titulo=COALESCE(?,titulo), hash=?, filhos=?, vista_em=?, alterada_em=CASE WHEN ? THEN ? ELSE alterada_em END WHERE chave=?').bind(r.titulo || null, r.hash, r.links.length, agora, mudou ? 1 : 0, agora, p.chave).run();
  }
  await catLog(db, f.id, 'reler', { lidas: relidas, novas: alteradas, erros, detalhe: `${alteradas} página(s) alterada(s) na fonte` });
  return { relidas, alteradas, erros, parou: '' };
}
async function catMapa(db) { return { paginas: (await db.prepare("SELECT chave,url,fonte,titulo,estado FROM cat_paginas WHERE vista_em IS NOT NULL AND estado<>'inacessivel' ORDER BY fonte, prof, rowid LIMIT 3000").all()).results || [] }; }
/* leitura agendada (opcional, desligada por padrão): 1 lote por disparo do agendador, só em fonte já testada com sucesso */
async function catAuto(env, releitura) {
  const db = admDb(env); if (!db) return null; await admInit(env);
  const on = await db.prepare("SELECT valor FROM adm_cfg WHERE chave='cat_auto'").first(); if (!on || on.valor !== '1') return null;
  const f = await db.prepare("SELECT f.* FROM cat_fontes f WHERE f.estado='ok' AND EXISTS (SELECT 1 FROM cat_paginas p WHERE p.fonte=f.id AND p.estado='pendente' AND p.prof<=?) ORDER BY COALESCE(f.ultima_sinc,'') LIMIT 1").bind(CAT_CFG.maxProf).first();
  if (f) { const r = await catDescobrir(db, env, f); await catLog(db, f.id, 'auto', { lidas: r.lidas, novas: r.novas, erros: r.erros, detalhe: 'leitura agendada' + (r.parou ? ' — ' + r.parou : '') }); return { fonte: f.id, ...r }; }
  if (!releitura) return null;
  const g = await db.prepare("SELECT f.* FROM cat_fontes f WHERE f.estado='ok' AND EXISTS (SELECT 1 FROM cat_paginas p WHERE p.fonte=f.id AND p.estado IN ('candidata','importada')) ORDER BY COALESCE(f.ultima_sinc,'') LIMIT 1").first();
  if (!g) return null; const r = await catReler(db, env, g); await db.prepare('UPDATE cat_fontes SET ultima_sinc=? WHERE id=?').bind(new Date().toISOString(), g.id).run(); return { fonte: g.id, ...r };
}
async function catEstado(db, q) {
  const fontes = (await db.prepare('SELECT * FROM cat_fontes ORDER BY id').all()).results || [], cont = {};
  for (const r of ((await db.prepare("SELECT fonte, estado e, COUNT(*) n FROM cat_paginas GROUP BY fonte, estado").all()).results || [])) (cont[r.fonte] = cont[r.fonte] || {})[r.e] = r.n;
  const w = [], b = []; if (q.fonte) { w.push('fonte=?'); b.push(String(q.fonte)); } if (CAT_EST.includes(q.estado)) { w.push('estado=?'); b.push(q.estado); } const t = catTxt(q.q, 60); if (t) { w.push("(titulo LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\')"); const k = '%' + t.replace(/[\\%_]/g, '\\$&') + '%'; b.push(k, k); }
  if (q.mudou === true) w.push("alterada_em IS NOT NULL AND revisada_em IS NOT NULL AND alterada_em > revisada_em");
  const wh = w.length ? ' WHERE ' + w.join(' AND ') : '', pag = Math.max(0, q.pag | 0), tot = (await db.prepare('SELECT COUNT(*) n FROM cat_paginas' + wh).bind(...b).first()).n;
  const paginas = (await db.prepare('SELECT chave,url,fonte,pai,titulo,prof,estado,erro,filhos,vista_em,alterada_em,revisada_em FROM cat_paginas' + wh + ' ORDER BY fonte, prof, rowid LIMIT 100 OFFSET ?').bind(...b, pag * 100).all()).results || [];
  /* trilha: títulos dos ancestrais (raiz → pai), no máximo maxProf níveis */
  const anc = new Map(); let falta = [...new Set(paginas.map(p => p.pai).filter(Boolean))];
  for (let i = 0; i <= CAT_CFG.maxProf && falta.length; i++) { const lote = falta.slice(0, 90), rs = (await db.prepare('SELECT chave,pai,titulo FROM cat_paginas WHERE chave IN (' + lote.map(() => '?').join(',') + ')').bind(...lote).all()).results || []; for (const r of rs) anc.set(r.chave, r); falta = [...new Set(rs.map(r => r.pai).filter(k => k && !anc.has(k)))]; }
  for (const p of paginas) { const t = []; let k = p.pai, n = 0; while (k && anc.has(k) && n++ <= CAT_CFG.maxProf) { t.unshift(anc.get(k).titulo || ''); k = anc.get(k).pai; } p.trilha = t; p.mudou = !!(p.alterada_em && p.revisada_em && p.alterada_em > p.revisada_em); delete p.pai; }
  const mud = {}; for (const r of ((await db.prepare('SELECT fonte, COUNT(*) n FROM cat_paginas WHERE alterada_em IS NOT NULL AND revisada_em IS NOT NULL AND alterada_em > revisada_em GROUP BY fonte').all()).results || [])) mud[r.fonte] = r.n;
  const exec = (await db.prepare('SELECT ts,fonte,op,lidas,novas,erros,detalhe FROM cat_exec ORDER BY id DESC LIMIT 12').all()).results || [];
  const au = await db.prepare("SELECT valor FROM adm_cfg WHERE chave='cat_auto'").first();
  return { auto: !!au && au.valor === '1', fontes: fontes.map(f => ({ ...f, autenticado: !!f.autenticado, contagem: cont[f.id] || {}, alteradas: mud[f.id] || 0 })), paginas, total: tot, pag, exec, limites: CAT_CFG };
}
async function admCatalogo(req, env) {
  const db = admDb(env); await admInit(env); await catSeed(db); let q; try { q = await req.json(); } catch { q = {}; } const op = String(q.op || 'estado');
  const inval = m => J({ ok: false, erro: { codigo: 'requisicao_invalida', mensagem: m } }, 400);
  if (op === 'estado') return J({ ok: true, ...(await catEstado(db, q)) });
  if (op === 'mapa') return J({ ok: true, ...(await catMapa(db)) });
  if (op === 'auto') { const v = q.ligar === true ? '1' : '0'; await db.prepare('INSERT INTO adm_cfg(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor').bind('cat_auto', v).run(); return J({ ok: true, auto: v === '1' }); }
  if (op === 'testar' || op === 'descobrir' || op === 'limpar' || op === 'reler') {
    const f = await catFonte(db, q.fonte); if (!f) return inval('Fonte desconhecida.');
    if (op === 'limpar') { if (q.confirmar !== f.id) return inval('Confirmação ausente.'); const r = await db.prepare('DELETE FROM cat_paginas WHERE fonte=?').bind(f.id).run(); await catLog(db, f.id, 'limpar', { detalhe: (r.meta?.changes || 0) + ' página(s) removida(s) da fila' }); return J({ ok: true, removidas: r.meta?.changes || 0 }); }
    if ((op === 'descobrir' || op === 'reler') && f.estado !== 'ok') return inval('Teste a conexão da fonte antes de descobrir páginas (estado atual: ' + f.estado + ').');
    const k = 'cat:' + f.id, u = CAT_MEM.rate.get(k) || 0; if (Date.now() - u < 2500) return J({ ok: false, erro: { codigo: 'muitas_requisicoes', mensagem: 'Aguarde alguns segundos entre as leituras da mesma fonte.' } }, 429); CAT_MEM.rate.set(k, Date.now());
    if (op === 'testar') return J({ ok: true, teste: await catTestar(db, env, f) });
    if (op === 'reler') return J({ ok: true, releitura: await catReler(db, env, f, q.n) });
    return J({ ok: true, lote: await catDescobrir(db, env, f, q.n) });
  }
  if (op === 'revisar') {
    const ch = (Array.isArray(q.chaves) ? q.chaves : []).map(x => String(x)).filter(x => x.length <= 400).slice(0, 100); if (!ch.length || !CAT_REV.includes(q.estado)) return inval('Informe as páginas e um estado válido.');
    const agora = new Date().toISOString(), out = await db.batch(ch.map(c => db.prepare('UPDATE cat_paginas SET estado=?, revisada_em=? WHERE chave=? AND vista_em IS NOT NULL').bind(q.estado, agora, c)));
    return J({ ok: true, alteradas: out.reduce((a, r) => a + (r?.meta?.changes || 0), 0) });
  }
  return inval('Operação desconhecida.');
}
/* ===== Cotas diárias por usuário, gravadas no banco (valem para todas as instâncias; a contagem é atômica) =====
   Só para rotas que geram custo ou tráfego externo. O limite por minuto em memória continua como primeira barreira. */
const COTA_DIA = { '/api/ia': 400, '/api/ia/teste': 60, '/api/ocr': 200, '/api/importar': 200, '/api/cnpj': 400 };
const COTA_ROT = { '/api/ia': 'Pesquisa e análise com IA', '/api/ia/teste': 'Teste de provedor de IA', '/api/ocr': 'Leitura de imagem (OCR)', '/api/importar': 'Importação por link', '/api/cnpj': 'Consulta de CNPJ' };
function cotaMax(env, rota) { let o = null; try { o = env.COTAS_DIA ? JSON.parse(env.COTAS_DIA) : null; } catch { o = null; } const v = o && Number.isInteger(o[rota]) && o[rota] > 0 ? o[rota] : COTA_DIA[rota]; return v || 0; }
async function cotaDia(env, user, rota) {
  const max = cotaMax(env, rota), db = admDb(env); if (!max || !user || !db) return null;
  try { await admInit(env); const r = await db.prepare('INSERT INTO uso_dia(dia,usuario,rota,n) VALUES(?,?,?,1) ON CONFLICT(dia,usuario,rota) DO UPDATE SET n=n+1 RETURNING n').bind(new Date().toISOString().slice(0, 10), user, rota).first(); return r && r.n > max ? { n: r.n, max } : null; }
  catch { return null; } /* falha do contador não bloqueia o uso legítimo */
}
async function usoProprio(env, au) {
  const db = admDb(env), hoje = new Date().toISOString().slice(0, 10), m = {}; if (db && au.user) { try { await admInit(env); for (const r of ((await db.prepare('SELECT rota, n FROM uso_dia WHERE dia=? AND usuario=?').bind(hoje, au.user).all()).results || [])) m[r.rota] = r.n; } catch { /* sem banco */ } }
  return J({ ok: true, dia: hoje, persistente: !!db, itens: Object.keys(COTA_DIA).map(r => ({ rota: r, rot: COTA_ROT[r], usado: m[r] || 0, limite: cotaMax(env, r) })) });
}
/* ===== Integrações e Inteligência (painel): estado real de cada serviço, pela última execução registrada. Nenhum segredo é devolvido. ===== */
const INT_AUTH = ['chave_invalida', 'sem_permissao', 'autenticacao_necessaria', 'nao_autorizado', 'chave_ausente', 'sem_creditos'], INT_IND = ['indisponivel', 'tempo_esgotado', 'tempo_esgotado_pagina', 'limite_de_uso', 'limite_local'];
function intEstado(configurado, ult) {
  if (!configurado) return 'nao_configurado'; if (!ult) return 'nao_testado'; if (ult.resultado === 'ok' || ult.resultado === 'parcial') return 'conectado';
  let cod = ''; try { cod = String(JSON.parse(ult.meta || '{}').codigo || ''); } catch { cod = ''; }
  return INT_AUTH.includes(cod) ? 'falha_autenticacao' : INT_IND.includes(cod) || /^http_5/.test(cod) ? 'indisponivel' : 'intervencao';
}
async function admInteg(env) {
  const db = admDb(env); await admInit(env); await catSeed(db);
  const ult = async (func, cond = '') => db.prepare(`SELECT ts, resultado, meta FROM eventos WHERE func=? AND fase<>'iniciada' ${cond} ORDER BY ts DESC LIMIT 1`).bind(func).first();
  const cod = u => { try { return String(JSON.parse(u?.meta || '{}').codigo || ''); } catch { return ''; } };
  const it = (id, nome, configurado, u, obs) => ({ id, nome, estado: intEstado(configurado, u), ultima: u ? u.ts : null, codigo: u && u.resultado !== 'ok' ? cod(u) : '', obs });
  const [uIa, uTeste, uOcr, uCnpj, uImp] = await Promise.all([ult('pesquisa_ic'), ult('integracao_teste', "AND meta LIKE '%\"tipo\":\"teste\"%'"), ult('ocr_leitura'), ult('cnpj_consulta'), ult('solucao_importar', "AND meta LIKE '%\"via\":\"link\"%'")]);
  const srvIa = !!env.GEMINI_API_KEY, tdnCred = !!(env.TDN_AUTH_HEADER || env.TDN_COOKIE);
  const itens = [
    it('ia', 'IA — pesquisa e análise', true, uIa || uTeste, 'Cada executivo usa a própria chave, guardada no navegador dele.' + (srvIa ? ' Há também uma chave Gemini configurada no servidor.' : ' Nenhuma chave de IA no servidor.')),
    it('ocr', 'OCR por IA (leitura de imagem)', true, uOcr, 'Opcional; usa a chave Gemini do executivo e só roda com autorização por documento.'),
    it('cnpj', 'Consulta de CNPJ', true, uCnpj, 'Provedores públicos de terceiros; não é API oficial da Receita Federal.'),
    it('importar', 'Importação por link (TDN e páginas TOTVS)', true, uImp, tdnCred ? 'Credencial do TDN configurada no servidor.' : 'Sem credencial do TDN: páginas que exigem login não são lidas.')
  ];
  const mapF = { ok: 'conectado', nao_testada: 'nao_testado', autenticacao_necessaria: 'falha_autenticacao', indisponivel: 'indisponivel', nao_encontrada: 'intervencao', bloqueada_robots: 'intervencao' };
  for (const f of ((await db.prepare('SELECT id,nome,estado,erro,testada_em,ultima_sinc FROM cat_fontes ORDER BY id').all()).results || [])) itens.push({ id: 'fonte_' + f.id, nome: 'Catálogo — ' + f.nome, estado: mapF[f.estado] || 'intervencao', ultima: f.testada_em || null, codigo: f.estado === 'ok' ? '' : f.estado, obs: (f.erro ? f.erro + ' ' : '') + (f.ultima_sinc ? 'Última leitura: ' + f.ultima_sinc.slice(0, 10) + '.' : 'Nenhuma leitura ainda.') });
  const auto = await db.prepare("SELECT valor FROM adm_cfg WHERE chave='cat_auto'").first(), uAuto = await db.prepare("SELECT ts, erros FROM cat_exec WHERE op='auto' ORDER BY id DESC LIMIT 1").first();
  itens.push({ id: 'agendada', nome: 'Leitura agendada das fontes', estado: !(auto && auto.valor === '1') ? 'nao_configurado' : !uAuto ? 'nao_testado' : 'conectado', ultima: uAuto ? uAuto.ts : null, codigo: '', obs: auto && auto.valor === '1' ? '1 lote por horário agendado, em dias úteis.' : 'Desligada. Ligue no bloco do Catálogo de soluções.' });
  let push = { conf: false, subs: 0, ult: null }; try { push.conf = pushOk(env); const r = await db.prepare('SELECT COUNT(*) n, MAX(ultimo_ok) u FROM push_subs').first(); push.subs = r?.n || 0; push.ult = r?.u || null; } catch { /* tabela ainda não criada */ }
  itens.push({ id: 'push', nome: 'Lembrete diário (notificações)', estado: !push.conf ? 'nao_configurado' : !push.ult ? 'nao_testado' : 'conectado', ultima: push.ult, codigo: '', obs: `${push.subs} aparelho(s) inscrito(s).` });
  itens.push({ id: 'crm', nome: 'CRM / ERP corporativo', estado: 'nao_configurado', ultima: null, codigo: '', obs: 'Planejado. Nenhum conector ativo e nenhuma escrita em sistema corporativo.' });
  const hoje = new Date().toISOString().slice(0, 10), d7 = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const con = (await db.prepare('SELECT rota, SUM(CASE WHEN dia=? THEN n ELSE 0 END) hoje, SUM(n) sete, COUNT(DISTINCT usuario) usuarios, MAX(CASE WHEN dia=? THEN n ELSE 0 END) pico FROM uso_dia WHERE dia>=? GROUP BY rota').bind(hoje, hoje, d7).all()).results || [];
  return { itens, consumo: Object.keys(COTA_DIA).map(r => { const x = con.find(y => y.rota === r) || {}; return { rota: r, rot: COTA_ROT[r], hoje: x.hoje || 0, sete: x.sete || 0, usuarios: x.usuarios || 0, pico_usuario_hoje: x.pico || 0, limite: cotaMax(env, r) }; }), em: new Date().toISOString() };
}
/* Trilha de auditoria das ações administrativas que alteram algo (quem, quando, o quê, resultado). Sem conteúdo de carteira nem segredos. */
const ADM_AUD_SO_LEITURA = { catalogo: ['estado', 'mapa'] };
function admAudDescrever(rota, q) {
  const t = (v, n = 80) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').slice(0, n), r = rota.replace('/api/adm/', '');
  if (r === 'roster') return { acao: 'previstos.' + t(q.op || 'add', 20), detalhe: q.op === 'import' ? `${Array.isArray(q.itens) ? q.itens.length : 0} e-mail(s)` : t(q.email) + (q.novo_email ? ' → ' + t(q.novo_email) : '') + (q.tudo ? ' (inclui registro de acesso)' : '') };
  if (r === 'config') return { acao: 'configuracao.alterar', detalhe: Object.keys(q || {}).map(k => t(k, 30)).slice(0, 8).join(', ') };
  if (r === 'purgar') return { acao: 'retencao.aplicar', detalhe: '' };
  if (r === 'catalogo') { const op = t(q.op || 'estado', 20); if (ADM_AUD_SO_LEITURA.catalogo.includes(op)) return null; return { acao: 'catalogo.' + op, detalhe: [q.fonte && 'fonte ' + t(q.fonte, 20), Array.isArray(q.chaves) && q.chaves.length + ' página(s)', q.estado && '→ ' + t(q.estado, 20), q.ligar != null && (q.ligar === true ? 'ligar' : 'desligar')].filter(Boolean).join(' ') }; }
  if (r === 'sugestoes') return { acao: 'sugestao.marcar_lida', detalhe: '' };
  return { acao: t(r, 40), detalhe: '' };
}
async function admAuditar(env, au, rota, corpo, resp) {
  try { let q = {}; try { q = JSON.parse(corpo || '{}'); } catch { q = {}; } const d = admAudDescrever(rota, q && typeof q === 'object' ? q : {}); if (!d) return;
    const db = admDb(env); await db.prepare('INSERT INTO adm_audit(ts,usuario,acao,detalhe,resultado) VALUES(?,?,?,?,?)').bind(new Date().toISOString(), au.user, d.acao, d.detalhe, resp.status < 400 ? 'ok' : 'recusada_' + resp.status).run();
  } catch { /* a trilha nunca derruba a operação */ }
}
async function admRotaInterna(req, env, au, url) {
  const neg = await admGuard(env, au, url.pathname); if (neg) return neg; if (!admDb(env)) return J({ ok: false, erro: { codigo: 'sem_banco', mensagem: 'D1 não configurado.' } }, 503);
  try {
    if (url.pathname === '/api/adm/resumo' && req.method === 'GET') return J({ ok: true, ...(await admResumo(env, url)) });
    if (url.pathname === '/api/adm/lembrete' && req.method === 'GET') return J({ ok: true, ...(await pushAdocao(env)) });
    if (url.pathname === '/api/adm/sugestoes' && /^(GET|POST)$/.test(req.method)) return admSugestoes(req, env, url);
    if (url.pathname === '/api/adm/roster' && req.method === 'POST') return admRoster(req, env, au);
    if (url.pathname === '/api/adm/config' && req.method === 'POST') return admConfig(req, env);
    if (url.pathname === '/api/adm/catalogo' && req.method === 'POST') return admCatalogo(req, env);
    if (url.pathname === '/api/adm/purgar' && req.method === 'POST') return J({ ok: true, ...(await admPurgar(env, true)) });
    return J({ ok: false, erro: { codigo: 'nao_encontrado', mensagem: 'Rota administrativa inexistente.' } }, 404);
  } catch (e) { return J({ ok: false, erro: { codigo: 'erro_interno', mensagem: 'Falha ao consultar os dados administrativos.' } }, 500); }
}
export { admSugerir, admCalc, admEvento, admMetaLimpa, ADM_FUNCS, catRobotsParse, catRobotsOk, admCatalogo, catAuto };

async function admRota(req, env, au, url) {
  const neg = await admGuard(env, au, url.pathname); if (neg) return neg;
  if (url.pathname === '/api/adm/integracoes' && req.method === 'GET') { if (!admDb(env)) return J({ ok: false, erro: { codigo: 'sem_banco', mensagem: 'D1 não configurado.' } }, 503); try { return J({ ok: true, ...(await admInteg(env)) }); } catch (e) { return J({ ok: false, erro: { codigo: 'erro_interno', mensagem: 'Falha ao consultar as integrações.' } }, 500); } }
  if (url.pathname === '/api/adm/auditoria' && req.method === 'GET') { const db = admDb(env); if (!db) return J({ ok: false, erro: { codigo: 'sem_banco', mensagem: 'D1 não configurado.' } }, 503); await admInit(env); return J({ ok: true, itens: (await db.prepare('SELECT ts,usuario,acao,detalhe,resultado FROM adm_audit ORDER BY id DESC LIMIT 60').all()).results || [] }); }
  if (req.method !== 'POST') return admRotaInterna(req, env, au, url);
  const corpo = await req.text(); if (corpo.length > 200000) return J({ ok: false, erro: { codigo: 'muito_grande', mensagem: 'Corpo acima do limite.' } }, 413);
  const resp = await admRotaInterna(new Request(req.url, { method: 'POST', headers: req.headers, body: corpo }), env, au, url);
  if (admDb(env)) await admAuditar(env, au, url.pathname, corpo, resp);
  return resp;
}
