/* ===== Lembrete diário (Web Push SEM conteúdo) =====
   Cron 11:30 UTC (08:30 em Brasília, UTC-3, sem horário de verão) de segunda a sexta. Envia um push vazio a cada aparelho inscrito;
   o service worker mostra o texto fixo. Pula quem já abriu o sistema no dia (usuarios.ultimo_acesso).
   Guarda só: e-mail, endpoint do aparelho, datas e contagem de falhas. Nada de conteúdo de carteira.
   Ativo só com os segredos VAPID_PUBLIC e VAPID_PRIVATE (sem eles as rotas respondem 503 e o cron não faz nada). */
const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)$/;
const PUSH_MAX_APARELHOS = 5, PUSH_LOTE = 40, PUSH_FALHAS_MAX = 5;
const PUSH_MEM = { init: null, key: null, rate: new Map() };
const PUSH_DDL = ['CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, email TEXT NOT NULL, criado_em TEXT NOT NULL, ultimo_ok TEXT, falhas INTEGER NOT NULL DEFAULT 0)', 'CREATE INDEX IF NOT EXISTS push_subs_email ON push_subs(email)'];
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
function pushEndpointOk(ep, env) {
  try {
    if (typeof ep !== 'string' || ep.length > 1000) return false;
    const u = new URL(ep);
    if (env.ALLOW_TEST_USER === '1' && u.hostname === '127.0.0.1' && u.protocol === 'http:') return true; /* SOMENTE testes locais */
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
async function pushRegistrarResultado(db, endpoint, st) {
  if (st >= 200 && st < 300) { await db.prepare('UPDATE push_subs SET ultimo_ok=?, falhas=0 WHERE endpoint=?').bind(new Date().toISOString(), endpoint).run(); return 'ok'; }
  if (st === 404 || st === 410) { await db.prepare('DELETE FROM push_subs WHERE endpoint=?').bind(endpoint).run(); return 'removido'; }
  await db.prepare('UPDATE push_subs SET falhas=falhas+1 WHERE endpoint=?').bind(endpoint).run();
  await db.prepare('DELETE FROM push_subs WHERE endpoint=? AND falhas>=?').bind(endpoint, PUSH_FALHAS_MAX).run();
  return 'falha';
}
async function pushLote(env, db, lista) {
  const out = { ok: 0, removido: 0, falha: 0, auth: 0 }; let i = 0;
  const w = async () => { while (i < lista.length) { const ep = lista[i++], st = await pushEnviar(env, ep); if (st === 401 || st === 403) { out.auth++; continue; } out[await pushRegistrarResultado(db, ep, st)]++; } };
  await Promise.all(Array.from({ length: Math.min(5, lista.length) }, w)); return out;
}
const pushCorpo = async (req, max = 2000) => { const t = await req.text(); if (t.length > max) return null; try { return JSON.parse(t || '{}'); } catch { return null; } };
const pushErro = (codigo, mensagem, status) => J({ ok: false, erro: { codigo, mensagem } }, status);
async function pushRota(req, env, au, url) {
  if (!au.user) return pushErro('nao_autorizado', 'Lembretes exigem identidade.', 401);
  const p = url.pathname, m = req.method;
  if (!pushOk(env)) return pushErro('nao_configurado', 'Lembrete diário ainda não configurado pelo administrador.', 503);
  if (p === '/api/push/chave' && m === 'GET') return J({ ok: true, chave: env.VAPID_PUBLIC });
  const db = await pushInit(env); if (!db) return pushErro('indisponivel', 'Banco indisponível.', 503);
  if (p === '/api/push/status' && m === 'GET') {
    const r = await db.prepare('SELECT COUNT(*) n FROM push_subs WHERE email=?').bind(au.user).first();
    return J({ ok: true, aparelhos: r?.n || 0, horario: '08:30', dias: 'seg-sex' });
  }
  if (m !== 'POST') return pushErro('metodo', 'Use POST.', 405);
  const q = await pushCorpo(req); if (q === null) return pushErro('requisicao_invalida', 'Corpo inválido.', 400);
  if (p === '/api/push/inscrever') {
    if (!pushEndpointOk(q.endpoint, env)) return pushErro('endpoint_invalido', 'Endereço de notificação não aceito.', 400);
    const agora = new Date().toISOString();
    await db.prepare('INSERT INTO push_subs(endpoint,email,criado_em,falhas) VALUES(?,?,?,0) ON CONFLICT(endpoint) DO UPDATE SET email=excluded.email, falhas=0').bind(q.endpoint, au.user, agora).run();
    await db.prepare('DELETE FROM push_subs WHERE email=? AND endpoint NOT IN (SELECT endpoint FROM push_subs WHERE email=? ORDER BY criado_em DESC LIMIT ?)').bind(au.user, au.user, PUSH_MAX_APARELHOS).run();
    const r = await db.prepare('SELECT COUNT(*) n FROM push_subs WHERE email=?').bind(au.user).first();
    return J({ ok: true, aparelhos: r?.n || 0 });
  }
  if (p === '/api/push/cancelar') {
    if (q.endpoint) await db.prepare('DELETE FROM push_subs WHERE endpoint=? AND email=?').bind(String(q.endpoint).slice(0, 1000), au.user).run();
    else await db.prepare('DELETE FROM push_subs WHERE email=?').bind(au.user).run();
    const r = await db.prepare('SELECT COUNT(*) n FROM push_subs WHERE email=?').bind(au.user).first();
    return J({ ok: true, aparelhos: r?.n || 0 });
  }
  if (p === '/api/push/teste') {
    const now = Date.now(), rr = PUSH_MEM.rate.get(au.user) || { t: now, n: 0 }; if (now - rr.t > 60000) { rr.t = now; rr.n = 0; } rr.n++; PUSH_MEM.rate.set(au.user, rr); if (PUSH_MEM.rate.size > 300) PUSH_MEM.rate.clear();
    if (rr.n > 3) return pushErro('limite', 'Aguarde um minuto para enviar outro teste.', 429);
    const eps = ((await db.prepare('SELECT endpoint FROM push_subs WHERE email=?').bind(au.user).all()).results || []).map(x => x.endpoint);
    if (!eps.length) return pushErro('sem_aparelho', 'Nenhum aparelho inscrito. Ative o lembrete primeiro.', 404);
    const r = await pushLote(env, db, eps); return J({ ok: true, enviados: r.ok, removidos: r.removido, falhas: r.falha + r.auth, config_invalida: r.auth > 0 });
  }
  return pushErro('nao_encontrado', 'Rota inexistente.', 404);
}
/* Disparo diário. quando = horário agendado (ms). Devolve um resumo sem dados pessoais. */
async function pushAgendado(env, quando) {
  if (!pushOk(env)) return { pulado: 'nao_configurado' };
  const db = await pushInit(env); if (!db) return { pulado: 'sem_banco' };
  const brt = new Date((quando || Date.now()) - 3 * 3600 * 1000), dow = brt.getUTCDay();
  if (dow === 0 || dow === 6) return { pulado: 'fim_de_semana' };
  const dia = brt.toISOString().slice(0, 10);
  const claim = await db.prepare("INSERT INTO adm_cfg(chave,valor) VALUES('push_dia',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor WHERE adm_cfg.valor<>excluded.valor").bind(JSON.stringify(dia)).run();
  if (!claim.meta || !claim.meta.changes) return { pulado: 'ja_enviado' };
  const ini = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 3)).toISOString(); /* 00:00 em Brasília */
  const subs = (await db.prepare('SELECT s.endpoint, u.ultimo_acesso ua FROM push_subs s LEFT JOIN usuarios u ON u.email=s.email ORDER BY s.criado_em').all()).results || [];
  const alvo = subs.filter(s => !(s.ua && s.ua >= ini)), pulados = subs.length - alvo.length, lote = alvo.slice(0, PUSH_LOTE), adiados = alvo.length - lote.length;
  const r = await pushLote(env, db, lote.map(s => s.endpoint));
  const res = { dia, aparelhos: subs.length, enviados: r.ok, pulados_uso: pulados, removidos: r.removido, falhas: r.falha + r.auth, config_invalida: r.auth > 0, adiados };
  await db.prepare("INSERT INTO adm_cfg(chave,valor) VALUES('push_ultimo',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(JSON.stringify({ ...res, ts: new Date().toISOString() })).run();
  return res;
}
