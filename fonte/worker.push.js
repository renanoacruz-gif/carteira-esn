/* ===== Lembrete diário (Web Push SEM conteúdo) =====
   Crons 12:00 e 17:00 UTC (09:00 e 14:00 em Brasília, UTC-3, sem horário de verão) de segunda a sexta. Envia um push vazio a cada aparelho inscrito;
   o service worker mostra o texto fixo. Pula quem já abriu o sistema no dia (usuarios.ultimo_acesso).
   Guarda só: e-mail, endpoint do aparelho, datas e contagem de falhas. Nada de conteúdo de carteira.
   Ativo só com os segredos VAPID_PUBLIC e VAPID_PRIVATE (sem eles as rotas respondem 503 e o cron não faz nada). */
const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)$/;
const PUSH_MAX_APARELHOS = 5, PUSH_LOTE = 40, PUSH_FALHAS_MAX = 5;
const PUSH_MEM = { init: null, key: null, rate: new Map() };
const PUSH_DDL = ['CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, email TEXT NOT NULL, criado_em TEXT NOT NULL, ultimo_ok TEXT, falhas INTEGER NOT NULL DEFAULT 0)', 'CREATE INDEX IF NOT EXISTS push_subs_email ON push_subs(email)', 'CREATE TABLE IF NOT EXISTS push_envios (dia TEXT NOT NULL, turno TEXT NOT NULL, aparelhos INTEGER NOT NULL DEFAULT 0, enviados INTEGER NOT NULL DEFAULT 0, pulados_uso INTEGER NOT NULL DEFAULT 0, removidos INTEGER NOT NULL DEFAULT 0, falhas INTEGER NOT NULL DEFAULT 0, adiados INTEGER NOT NULL DEFAULT 0, config_invalida INTEGER NOT NULL DEFAULT 0, ts TEXT NOT NULL, PRIMARY KEY(dia,turno))', 'CREATE TABLE IF NOT EXISTS push_resumo (email TEXT PRIMARY KEY, n INTEGER NOT NULL, em TEXT NOT NULL)', 'CREATE TABLE IF NOT EXISTS push_enviados (chave TEXT NOT NULL, endpoint TEXT NOT NULL, PRIMARY KEY(chave,endpoint))', 'CREATE TABLE IF NOT EXISTS push_pausa (email TEXT PRIMARY KEY, ate TEXT NOT NULL)', 'CREATE TABLE IF NOT EXISTS push_pref (email TEXT PRIMARY KEY, manha INTEGER NOT NULL DEFAULT 1, tarde INTEGER NOT NULL DEFAULT 1)'];
const pushB64u = b => { const a = new Uint8Array(b); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const pushUnb64u = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const pushOk = env => !!(env && env.VAPID_PUBLIC && env.VAPID_PRIVATE);
async function pushInit(env) {
  const db = admDb(env); if (!db) return null;
  await admInit(env);
  if (!PUSH_MEM.init) PUSH_MEM.init = db.batch(PUSH_DDL.map(s => db.prepare(s))).catch(e => { PUSH_MEM.init = null; throw e; });
  await PUSH_MEM.init; return db;
}
/* SSRF: o Worker só envia a serviços de push conhecidos, por https, sem porta nem credenciais */
function pushEndpointOk(ep, local) {
  try {
    if (typeof ep !== 'string' || ep.length > 1000) return false;
    const u = new URL(ep);
    if (local && u.hostname === '127.0.0.1' && u.protocol === 'http:') return true; /* SOMENTE testes locais (servidor em localhost) */
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && PUSH_HOSTS.test(u.hostname);
  } catch { return false; }
}
async function pushChaveAssinatura(env) {
  const id = env.VAPID_PUBLIC + '|' + env.VAPID_PRIVATE; if (PUSH_MEM.key && PUSH_MEM.key.id === id) return PUSH_MEM.key.k;
  const pub = pushUnb64u(env.VAPID_PUBLIC); if (pub.length !== 65 || pub[0] !== 4) throw new Error('vapid_publica_invalida');
  const k = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pushB64u(pub.slice(1, 33)), y: pushB64u(pub.slice(33, 65)), d: env.VAPID_PRIVATE, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  PUSH_MEM.key = { id, k }; return k;
}
async function pushJwt(env, aud) {
  const enc = new TextEncoder(), k = await pushChaveAssinatura(env);
  const sub = env.VAPID_SUBJECT || ('mailto:' + String(env.ADMIN_EMAILS || '').split(',')[0].trim());
  const h = pushB64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), p = pushB64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })));
  return h + '.' + p + '.' + pushB64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(h + '.' + p)));
}
/* devolve o status HTTP do serviço de push (0 = falha de rede/tempo) */
async function pushEnviar(env, endpoint) {
  try {
    const jwt = await pushJwt(env, new URL(endpoint).origin);
    const r = await fetch(endpoint, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { TTL: '3600', Urgency: 'normal', Topic: 'lembrete-diario', Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}` } });
    try { await r.arrayBuffer(); } catch { /* ok */ }
    return r.status;
  } catch { return 0; }
}
/* Feriados nacionais + Carnaval (seg/ter) e Corpus Christi (pontos facultativos). Estaduais e municipais não entram: use "Pausar". */
function pushFeriado(ymd) {
  const y = +ymd.slice(0, 4), a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1, pas = Date.UTC(y, mes - 1, dia);
  const mv = n => new Date(pas + n * 86400000).toISOString().slice(5, 10);
  return ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25', mv(-48), mv(-47), mv(-2), mv(60)].includes(ymd.slice(5));
}
/* Envia e grava o resultado em poucas consultas ao D1 (o plano Free limita as consultas por execução): nunca uma por aparelho. */
async function pushLote(env, db, lista) {
  const out = { ok: 0, removido: 0, falha: 0, auth: 0, tentados: [] }; let i = 0; const oks = [], gone = [], bad = [];
  const w = async () => { while (i < lista.length) { const ep = lista[i++], st = await pushEnviar(env, ep); out.tentados.push(ep); if (st === 401 || st === 403) { out.auth++; continue; } if (st >= 200 && st < 300) { out.ok++; oks.push(ep); } else if (st === 404 || st === 410) { out.removido++; gone.push(ep); } else { out.falha++; bad.push(ep); } } };
  await Promise.all(Array.from({ length: Math.min(5, lista.length) }, w));
  const q = l => l.map(() => '?').join(',');
  if (oks.length) await db.prepare(`UPDATE push_subs SET ultimo_ok=?, falhas=0 WHERE endpoint IN (${q(oks)})`).bind(new Date().toISOString(), ...oks).run();
  if (gone.length) await db.prepare(`DELETE FROM push_subs WHERE endpoint IN (${q(gone)})`).bind(...gone).run();
  if (bad.length) { await db.prepare(`UPDATE push_subs SET falhas=falhas+1 WHERE endpoint IN (${q(bad)})`).bind(...bad).run(); await db.prepare(`DELETE FROM push_subs WHERE falhas>=? AND endpoint IN (${q(bad)})`).bind(PUSH_FALHAS_MAX, ...bad).run(); }
  return out;
}
function pushLimite(user, balde, max) {
  const now = Date.now(), k = balde + '|' + user, rr = PUSH_MEM.rate.get(k) || { t: now, n: 0 }; if (now - rr.t > 60000) { rr.t = now; rr.n = 0; } rr.n++; PUSH_MEM.rate.set(k, rr); if (PUSH_MEM.rate.size > 500) PUSH_MEM.rate.clear();
  return rr.n > max;
}
const pushCorpo = async (req, max = 2000) => { const t = await req.text(); if (t.length > max) return null; try { return JSON.parse(t || '{}'); } catch { return null; } };
const pushErro = (codigo, mensagem, status) => J({ ok: false, erro: { codigo, mensagem } }, status);
async function pushRota(req, env, au, url) {
  if (!au.user) return pushErro('nao_autorizado', 'Lembretes exigem identidade.', 401);
  const p = url.pathname, m = req.method;
  if (!pushOk(env)) return pushErro('nao_configurado', 'Lembrete diário ainda não configurado pelo administrador.', 503);
  if (p === '/api/push/chave' && m === 'GET') return J({ ok: true, chave: env.VAPID_PUBLIC });
  if (pushLimite(au.user, 'geral', 60)) return pushErro('limite', 'Muitos pedidos. Aguarde um minuto.', 429);
  const db = await pushInit(env); if (!db) return pushErro('indisponivel', 'Banco indisponível.', 503);
  if (p === '/api/push/status' && m === 'GET') {
    const r = await db.prepare('SELECT COUNT(*) n FROM push_subs WHERE email=?').bind(au.user).first();
    const pa = await db.prepare('SELECT ate FROM push_pausa WHERE email=?').bind(au.user).first(), pf = await db.prepare('SELECT manha, tarde FROM push_pref WHERE email=?').bind(au.user).first();
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    return J({ ok: true, aparelhos: r?.n || 0, horarios: ['09:00', '14:00'], dias: 'seg-sex', pausa_ate: pa && pa.ate >= hoje ? pa.ate : null, manha: pf ? !!pf.manha : true, tarde: pf ? !!pf.tarde : true });
  }
  if (p === '/api/push/resumo' && m === 'GET') { /* só o número agregado calculado no navegador do próprio usuário */
    const r = await db.prepare('SELECT n, em FROM push_resumo WHERE email=?').bind(au.user).first();
    const out = { ok: true, n: r ? r.n : null, em: r ? r.em : null };
    if (au.user === String(env.PAINEL_ADMIN_EMAIL || 'renan.oscar@totvs.com.br').toLowerCase()) { /* só um sinal: o detalhe fica no painel */
      const al = await db.prepare("SELECT valor FROM adm_cfg WHERE chave='push_alerta'").first(); let v = null; try { v = al && JSON.parse(al.valor); } catch { /* ignora */ }
      if (v && v.ts && Date.now() - Date.parse(v.ts) < 3 * 3600000) out.alerta = true;
    }
    return J(out);
  }
  if (m !== 'POST') return pushErro('metodo', 'Use POST.', 405);
  const q = await pushCorpo(req); if (q === null) return pushErro('requisicao_invalida', 'Corpo inválido.', 400);
  if (p === '/api/push/inscrever') {
    if (!pushEndpointOk(q.endpoint, testeLocal(req, env))) return pushErro('endpoint_invalido', 'Endereço de notificação não aceito.', 400);
    const agora = new Date().toISOString();
    await db.prepare('INSERT INTO push_subs(endpoint,email,criado_em,falhas) VALUES(?,?,?,0) ON CONFLICT(endpoint) DO UPDATE SET email=excluded.email, falhas=0').bind(q.endpoint, au.user, agora).run();
    await db.prepare('DELETE FROM push_subs WHERE email=? AND endpoint NOT IN (SELECT endpoint FROM push_subs WHERE email=? ORDER BY criado_em DESC LIMIT ?)').bind(au.user, au.user, PUSH_MAX_APARELHOS).run();
    const r = await db.prepare('SELECT COUNT(*) n FROM push_subs WHERE email=?').bind(au.user).first();
    return J({ ok: true, aparelhos: r?.n || 0 });
  }
  if (p === '/api/push/resumo') {
    const n = q.n; if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 999) return pushErro('requisicao_invalida', 'n deve ser um inteiro entre 0 e 999.', 400);
    const t = await db.prepare('SELECT COUNT(*) n FROM push_subs WHERE email=?').bind(au.user).first();
    if (!t || !t.n) return J({ ok: true, ignorado: true }); /* sem aparelho inscrito não guarda nada */
    await db.prepare('INSERT INTO push_resumo(email,n,em) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET n=excluded.n, em=excluded.em').bind(au.user, n, new Date().toISOString()).run();
    return J({ ok: true });
  }
  if (p === '/api/push/pausar') {
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    if (q.ate === null || q.ate === undefined || q.ate === '') { await db.prepare('DELETE FROM push_pausa WHERE email=?').bind(au.user).run(); return J({ ok: true, pausa_ate: null }); }
    if (typeof q.ate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(q.ate) || isNaN(Date.parse(q.ate)) || q.ate < hoje || Date.parse(q.ate) - Date.parse(hoje) > 90 * 86400000) return pushErro('requisicao_invalida', 'Informe uma data de hoje até 90 dias à frente (AAAA-MM-DD).', 400);
    await db.prepare('INSERT INTO push_pausa(email,ate) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET ate=excluded.ate').bind(au.user, q.ate).run(); return J({ ok: true, pausa_ate: q.ate });
  }
  if (p === '/api/push/pref') {
    if (typeof q.manha !== 'boolean' || typeof q.tarde !== 'boolean') return pushErro('requisicao_invalida', 'manha e tarde devem ser verdadeiro ou falso.', 400);
    await db.prepare('INSERT INTO push_pref(email,manha,tarde) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET manha=excluded.manha, tarde=excluded.tarde').bind(au.user, q.manha ? 1 : 0, q.tarde ? 1 : 0).run(); return J({ ok: true, manha: q.manha, tarde: q.tarde });
  }
  if (p === '/api/push/cancelar') {
    if (q.endpoint) await db.prepare('DELETE FROM push_subs WHERE endpoint=? AND email=?').bind(String(q.endpoint).slice(0, 1000), au.user).run();
    else await db.prepare('DELETE FROM push_subs WHERE email=?').bind(au.user).run();
    const r = await db.prepare('SELECT COUNT(*) n FROM push_subs WHERE email=?').bind(au.user).first();
    if (!r || !r.n) { await db.prepare('DELETE FROM push_resumo WHERE email=?').bind(au.user).run(); await db.prepare('DELETE FROM push_pausa WHERE email=?').bind(au.user).run(); await db.prepare('DELETE FROM push_pref WHERE email=?').bind(au.user).run(); }
    return J({ ok: true, aparelhos: r?.n || 0 });
  }
  if (p === '/api/push/teste') {
    if (pushLimite(au.user, 'teste', 3)) return pushErro('limite', 'Aguarde um minuto para enviar outro teste.', 429);
    const eps = ((await db.prepare('SELECT endpoint FROM push_subs WHERE email=?').bind(au.user).all()).results || []).map(x => x.endpoint);
    if (!eps.length) return pushErro('sem_aparelho', 'Nenhum aparelho inscrito. Ative o lembrete primeiro.', 404);
    const r = await pushLote(env, db, eps); return J({ ok: true, enviados: r.ok, removidos: r.removido, falhas: r.falha + r.auth, config_invalida: r.auth > 0 });
  }
  return pushErro('nao_encontrado', 'Rota inexistente.', 404);
}
/* Disparo do turno. quando = horário agendado (ms). Roda às 09:00/14:00 e continua às :10 e :20 se sobrar aparelho (limite de envios por execução). */
async function pushAgendado(env, quando) {
  if (!pushOk(env)) return { pulado: 'nao_configurado' };
  const db = await pushInit(env); if (!db) return { pulado: 'sem_banco' };
  const brt = new Date((quando || Date.now()) - 3 * 3600 * 1000), dow = brt.getUTCDay();
  if (dow === 0 || dow === 6) return { pulado: 'fim_de_semana' };
  const dia = brt.toISOString().slice(0, 10), turno = brt.getUTCHours() < 12 ? 'manha' : 'tarde';
  if (pushFeriado(dia)) return { pulado: 'feriado', dia, turno };
  const claim = await db.prepare('INSERT INTO adm_cfg(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor WHERE adm_cfg.valor<>excluded.valor').bind('push_dia_' + turno, JSON.stringify(dia)).run();
  const primeira = !!(claim.meta && claim.meta.changes), chave = dia + ':' + turno;
  /* manhã: pula quem abriu o sistema desde 00:00 de Brasília; tarde: pula quem abriu desde 12:00 de Brasília */
  const ini = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), turno === 'manha' ? 3 : 15)).toISOString();
  const subs = (await db.prepare('SELECT s.endpoint, u.ultimo_acesso ua, pa.ate pausa, pf.manha pm, pf.tarde pt, (SELECT 1 FROM push_enviados e WHERE e.chave=? AND e.endpoint=s.endpoint) env FROM push_subs s LEFT JOIN usuarios u ON u.email=s.email LEFT JOIN push_pausa pa ON pa.email=s.email LEFT JOIN push_pref pf ON pf.email=s.email ORDER BY s.criado_em').bind(chave).all()).results || [];
  const dispensa = s => (s.ua && s.ua >= ini) || (s.pausa && s.pausa >= dia) || (turno === 'manha' ? s.pm === 0 : s.pt === 0);
  const pend = subs.filter(s => !s.env), alvo = pend.filter(s => !dispensa(s)), pulados = pend.length - alvo.length, lote = alvo.slice(0, PUSH_LOTE), adiados = alvo.length - lote.length;
  if (!primeira && !lote.length) return { pulado: 'ja_enviado', turno };
  if (primeira) await db.prepare('DELETE FROM push_enviados WHERE chave<>?').bind(chave).run();
  const r = lote.length ? await pushLote(env, db, lote.map(s => s.endpoint)) : { ok: 0, removido: 0, falha: 0, auth: 0, tentados: [] };
  if (r.tentados.length) await db.prepare(`INSERT OR IGNORE INTO push_enviados(chave,endpoint) VALUES ${r.tentados.map(() => '(?,?)').join(',')}`).bind(...r.tentados.flatMap(e => [chave, e])).run();
  const res = { dia, turno, aparelhos: subs.length, enviados: r.ok, pulados_uso: pulados, removidos: r.removido, falhas: r.falha + r.auth, config_invalida: r.auth > 0, adiados, continuacao: !primeira };
  const ts = new Date().toISOString();
  await db.prepare('INSERT INTO push_envios(dia,turno,aparelhos,enviados,pulados_uso,removidos,falhas,adiados,config_invalida,ts) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(dia,turno) DO UPDATE SET aparelhos=MAX(aparelhos,excluded.aparelhos), enviados=enviados+excluded.enviados, pulados_uso=MAX(pulados_uso,excluded.pulados_uso), removidos=removidos+excluded.removidos, falhas=falhas+excluded.falhas, adiados=excluded.adiados, config_invalida=MAX(config_invalida,excluded.config_invalida), ts=excluded.ts').bind(dia, turno, res.aparelhos, res.enviados, res.pulados_uso, res.removidos, res.falhas, res.adiados, res.config_invalida ? 1 : 0, ts).run();
  if (primeira) await db.prepare('DELETE FROM push_envios WHERE dia < ?').bind(new Date((quando || Date.now()) - 93 * 86400000).toISOString().slice(0, 10)).run();
  await db.prepare('DELETE FROM push_resumo WHERE email NOT IN (SELECT email FROM push_subs)').run(); /* aparelho removido pelo envio: não deixa número órfão */
  await db.prepare("INSERT INTO adm_cfg(chave,valor) VALUES('push_ultimo',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(JSON.stringify({ ...res, ts })).run();
  return res;
}
/* Vigia (09:40 e 14:40): se o turno não rodou, foi recusado ou falhou muito, avisa o administrador por push (texto fixo; detalhe no painel). */
async function pushVigia(env, quando) {
  if (!pushOk(env)) return { pulado: 'nao_configurado' };
  const db = await pushInit(env); if (!db) return { pulado: 'sem_banco' };
  const adm = String(env.PAINEL_ADMIN_EMAIL || 'renan.oscar@totvs.com.br').toLowerCase(), dia = new Date((quando || Date.now()) - 3 * 3600000).toISOString().slice(0, 10);
  const al = ((await pushAdocao(env, quando)).alertas || []).filter(a => ['turno_nao_executou', 'config_invalida', 'falhas_altas'].includes(a.codigo));
  if (!al.length) { await db.prepare("DELETE FROM adm_cfg WHERE chave='push_alerta'").run(); return { pulado: 'sem_alerta' }; }
  const sig = dia + ':' + al.map(a => a.codigo).join(',');
  const c = await db.prepare("INSERT INTO adm_cfg(chave,valor) VALUES('push_alerta_env',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor WHERE adm_cfg.valor<>excluded.valor").bind(sig).run();
  if (!(c.meta && c.meta.changes)) return { pulado: 'ja_avisado' };
  await db.prepare("INSERT INTO adm_cfg(chave,valor) VALUES('push_alerta',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(JSON.stringify({ ts: new Date().toISOString(), n: al.length })).run();
  const eps = ((await db.prepare('SELECT endpoint FROM push_subs WHERE email=?').bind(adm).all()).results || []).map(x => x.endpoint);
  const r = eps.length ? await pushLote(env, db, eps) : { ok: 0 };
  return { alertas: al.length, enviados: r.ok };
}
/* Adoção do lembrete para o painel administrativo: só contagens e alertas, sem e-mails nem endpoints. */
async function pushAdocao(env, quando) {
  const cfg = pushOk(env), db = await pushInit(env); if (!db) return { configurado: cfg, indisponivel: true, alertas: [{ codigo: 'sem_banco', texto: 'Banco indisponível: não foi possível consultar os lembretes.' }] };
  const agora = quando || Date.now(), brt = new Date(agora - 3 * 3600 * 1000), hoje = brt.toISOString().slice(0, 10), min = brt.getUTCHours() * 60 + brt.getUTCMinutes(), dow = brt.getUTCDay();
  const um = async (sql, ...a) => (await db.prepare(sql).bind(...a).first()) || {};
  const ap = await um('SELECT COUNT(*) n, COUNT(DISTINCT email) u, SUM(CASE WHEN falhas>0 THEN 1 ELSE 0 END) c FROM push_subs');
  const resumos = await um('SELECT COUNT(*) n FROM push_resumo WHERE em >= ?', new Date(agora - 5 * 86400000).toISOString());
  const dia0 = d => new Date(agora - 3 * 3600000 - d * 86400000).toISOString().slice(0, 10);
  const hist = ((await db.prepare('SELECT dia,turno,aparelhos,enviados,pulados_uso,removidos,falhas,adiados,config_invalida,ts FROM push_envios WHERE dia >= ? ORDER BY dia DESC, turno ASC').bind(dia0(17)).all()).results || []);
  const s7 = hist.filter(x => x.dia >= dia0(6)).reduce((a, x) => { a.enviados += x.enviados; a.pulados_uso += x.pulados_uso; a.falhas += x.falhas; a.removidos += x.removidos; a.turnos++; return a; }, { enviados: 0, pulados_uso: 0, falhas: 0, removidos: 0, turnos: 0 });
  const alertas = [], tem = (d, t) => hist.some(x => x.dia === d && x.turno === t);
  if (!cfg && ap.n > 0) alertas.push({ codigo: 'vapid_ausente', texto: 'Chaves VAPID ausentes no Worker: há ' + ap.n + ' aparelho(s) inscrito(s), mas nenhum lembrete é enviado.' });
  if (dow >= 1 && dow <= 5 && ap.n > 0 && !pushFeriado(hoje)) {
    if (min >= 9 * 60 + 30 && !tem(hoje, 'manha')) alertas.push({ codigo: 'turno_nao_executou', texto: 'O turno das 09:00 de hoje não foi registrado.' });
    if (min >= 14 * 60 + 30 && !tem(hoje, 'tarde')) alertas.push({ codigo: 'turno_nao_executou', texto: 'O turno das 14:00 de hoje não foi registrado.' });
  }
  const ult = hist.slice().sort((a, b) => (b.ts > a.ts ? 1 : -1))[0];
  if (ult && ult.config_invalida) alertas.push({ codigo: 'config_invalida', texto: 'O último turno (' + ult.dia + ', ' + (ult.turno === 'manha' ? '09:00' : '14:00') + ') foi recusado pelo serviço de push: confira as chaves VAPID.' });
  const hj = hist.find(x => x.dia === hoje && x.adiados > 0); if (hj && min >= 9 * 60 + 30 && !pushFeriado(hoje)) alertas.push({ codigo: 'aparelhos_pendentes', texto: hj.adiados + ' aparelho(s) ainda não receberam o turno de hoje (limite de envios por execução).' });
  const rec = hist.slice().sort((a, b) => (b.ts > a.ts ? 1 : -1)).slice(0, 3), tent = rec.reduce((a, x) => a + x.enviados + x.falhas, 0), fal = rec.reduce((a, x) => a + x.falhas, 0);
  if (tent >= 3 && fal / tent >= 0.5) alertas.push({ codigo: 'falhas_altas', texto: 'Falhas em ' + fal + ' de ' + tent + ' envios nos últimos turnos.' });
  return { configurado: cfg, aparelhos: ap.n || 0, usuarios: ap.u || 0, aparelhos_com_falha: ap.c || 0, com_resumo_recente: resumos.n || 0, ultimos_7_dias: s7, historico: hist.slice(0, 28), alertas };
}
