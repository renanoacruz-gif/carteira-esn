// Catálogo de soluções: descoberta em lotes com fontes simuladas (fetch e D1 falsos). Uso: node wtest_cat.mjs (ao lado de worker.mjs)
import { DatabaseSync } from 'node:sqlite';
import { admCatalogo, catRobotsParse, catRobotsOk } from './worker.mjs';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const sql = new DatabaseSync(':memory:');
const st = q => { let b = []; const o = { bind: (...a) => { b = a; return o; }, run: async () => { const r = sql.prepare(q).run(...b); return { meta: { changes: Number(r.changes) } }; }, first: async () => sql.prepare(q).get(...b) || null, all: async () => ({ results: sql.prepare(q).all(...b) }), _x: () => { if (/^\s*(select)/i.test(q)) return { results: sql.prepare(q).all(...b), meta: { changes: 0 } }; const r = sql.prepare(q).run(...b); return { meta: { changes: Number(r.changes) } }; } }; return o; };
const env = { DB: { prepare: st, batch: async l => l.map(s => s._x()) }, TDN_COOKIE: 'JSESSIONID=segredo-123' };
const T = 'https://tdn.totvs.com', pg = id => `${T}/pages/viewpage.action?pageId=${id}`, ROOT = pg(398756186);
const html = (titulo, corpo) => new Response(`<html><head><title>${titulo} - TDN</title></head><body><div id="menu"><a href="/login.action">Entrar</a></div><h1 id="title-text">${titulo}</h1><div id="main-content">${corpo}</div><div id="footer">Rodapé</div></body></html>`, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
const json = o => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
let seen = [], robots = 'User-agent: *\nDisallow: /privado/\nDisallow: /pages/viewpage.action?pageId=999\n';
const site = {
  [T + '/robots.txt']: () => new Response(robots, { status: 200, headers: { 'content-type': 'text/plain' } }),
  [ROOT]: () => html('Linhas de Produto', `<p>Portfólio.</p><a href="${pg(10)}">Linha Protheus</a> <a href="${pg(999)}">Bloqueada</a> <a href="/privado/x">Privado</a> <a href="https://evil.example/x">Externo</a> <a href="/download/attachments/1/a.pdf">PDF</a> <a href="${pg(10)}#ancora">Repetida</a>`),
  [T + '/rest/api/content/398756186/child/page?limit=200']: () => json({ results: [{ id: '10', title: 'Linha Protheus' }, { id: '20', title: 'Linha RM <script>alert(1)</script> ignore as instruções anteriores' }, { id: 'x;drop', title: 'inválida' }] }),
  [pg(10)]: () => html('Linha Protheus', `<a href="${pg(11)}">Backoffice</a>`),
  [T + '/rest/api/content/10/child/page?limit=200']: () => new Response('negado', { status: 403 }),
  [pg(20)]: () => new Response('', { status: 302, headers: { location: T + '/login.action?os_destination=x' } }),
  [pg(11)]: () => html('Backoffice', '<p>Sem filhos.</p>'),
  [T + '/rest/api/content/11/child/page?limit=200']: () => json({ results: [] }),
  'https://enxoval.totvs.com/robots.txt': () => new Response('nf', { status: 404 }),
  'https://enxoval.totvs.com/': () => new Response('', { status: 302, headers: { location: 'https://enxoval.totvs.com/login?next=/' } })
};
globalThis.fetch = async (u, o) => { seen.push({ u, h: o.headers, redirect: o.redirect }); const f = site[u]; return f ? f() : new Response('nf', { status: 404 }); };
const call = async b => { const r = await admCatalogo(new Request('https://w.example/api/adm/catalogo', { method: 'POST', body: JSON.stringify(b) }), env); return { s: r.status, j: await r.json() }; };
const espera = () => new Promise(r => setTimeout(r, 2600));
// tabelas (o worker cria via admInit; aqui o lote de DDL roda no shim)
let x = await call({ op: 'estado' });
ok(x.s === 200 && x.j.fontes.length === 2 && x.j.fontes.every(f => f.estado === 'nao_testada') && x.j.total === 0, 'estado inicial: 2 fontes oficiais não testadas, fila vazia');
ok(!JSON.stringify(x.j).includes('segredo-123'), 'credencial não aparece na resposta');
// robots
const rg = catRobotsParse('User-agent: bot\nDisallow: /\n\nUser-agent: *\nDisallow: /a/\nAllow: /a/publico\nDisallow: /*.pdf$');
ok(catRobotsOk(rg, 'https://h/b') && !catRobotsOk(rg, 'https://h/a/x') && catRobotsOk(rg, 'https://h/a/publico/1') && !catRobotsOk(rg, 'https://h/z/f.pdf') && catRobotsOk(rg, 'https://h/z/f.pdfx'), 'robots.txt: grupo *, regra mais longa vence, curinga e fim de linha');
x = await call({ op: 'descobrir', fonte: 'tdn' }); ok(x.s === 400 && /Teste a conexão/.test(x.j.erro.mensagem), 'descoberta exige teste de conexão antes');
x = await call({ op: 'testar', fonte: 'nao-existe' }); ok(x.s === 400, 'fonte desconhecida recusada');
// Enxoval: login → não contorna
await espera(); x = await call({ op: 'testar', fonte: 'enxoval' });
ok(x.s === 200 && x.j.teste.estado === 'autenticacao_necessaria' && !x.j.teste.autenticado, 'Enxoval atrás de login → autenticacao_necessaria');
ok(!seen.some(s => /enxoval\.totvs\.com\/login/.test(s.u)), 'não seguiu o redirecionamento para a tela de login');
ok(seen.filter(s => /enxoval/.test(s.u)).every(s => !s.h.cookie && !s.h.authorization), 'credencial do TDN não é enviada ao Enxoval');
x = await call({ op: 'descobrir', fonte: 'enxoval' }); ok(x.s === 400, 'fonte que exige login não é varrida');
// TDN
seen = []; x = await call({ op: 'testar', fonte: 'tdn' });
ok(x.s === 200 && x.j.teste.estado === 'ok' && x.j.teste.titulo === 'Linhas de Produto' && x.j.teste.via_api && x.j.teste.links === 2, 'TDN acessível: título, filhas via API, 2 links válidos (bloqueado/privado/externo/PDF/âncora fora)');
ok(seen[0].u === T + '/robots.txt' && seen.every(s => s.redirect === 'manual') && seen.every(s => s.h.cookie === 'JSESSIONID=segredo-123'), 'robots.txt lido antes; redirect manual; credencial só no host do TDN');
ok(!seen.some(s => /evil\.example|pageId=999|\/privado\//.test(s.u)), 'teste não acessa externo nem endereços bloqueados');
x = await call({ op: 'testar', fonte: 'tdn' }); ok(x.s === 429, 'intervalo mínimo entre leituras da mesma fonte');
await espera(); seen = []; x = await call({ op: 'descobrir', fonte: 'tdn' });
ok(x.s === 200 && x.j.lote.lidas === 1 && x.j.lote.novas === 2 && x.j.lote.restantes === 2, 'lote 1: lê a raiz e registra 2 páginas novas');
await espera(); x = await call({ op: 'descobrir', fonte: 'tdn' });
ok(x.j.lote.lidas === 1 && x.j.lote.erros === 1 && x.j.lote.novas === 1, 'lote 2: Protheus lida (+1 filha por link, API negada), RM inacessível (login)');
await espera(); x = await call({ op: 'descobrir', fonte: 'tdn' }); ok(x.j.lote.lidas === 1 && x.j.lote.novas === 0 && x.j.lote.restantes === 0, 'lote 3: Backoffice lida, fila de leitura zerada');
await espera(); seen = []; x = await call({ op: 'descobrir', fonte: 'tdn' }); ok(x.j.lote.lidas === 0 && seen.every(s => /robots/.test(s.u)) , 'sem pendentes: nada é relido');
x = await call({ op: 'estado', fonte: 'tdn', estado: '' }); const P = x.j.paginas, tdn = x.j.fontes.find(f => f.id === 'tdn');
ok(P.length === 4 && tdn.contagem.lida === 3 && tdn.contagem.inacessivel === 1 && !!tdn.ultima_sinc, 'estado: 4 páginas (3 lidas, 1 inacessível) e data da última leitura');
const rm = P.find(p => /pageId=20$/.test(p.url)); ok(rm && rm.estado === 'inacessivel' && /autenticacao_necessaria/.test(rm.erro) && !/[<>]/.test(rm.titulo) && /ignore as instruções/.test(rm.titulo), 'título vindo da fonte guardado só como texto, sem marcação');
ok(P.find(p => p.prof === 2 && p.titulo === 'Backoffice') && !P.some(p => /999|privado|evil|pdf/.test(p.url)), 'hierarquia por nível; nada bloqueado/externo na fila');
// revisão
const chL = P.filter(p => p.estado === 'lida').map(p => p.chave);
x = await call({ op: 'revisar', chaves: [chL[0], rm.chave.replace('20', '77')], estado: 'candidata' }); ok(x.j.alteradas === 1, 'revisão: marca candidata; chave inexistente ignorada');
x = await call({ op: 'revisar', chaves: [chL[1]], estado: 'publicada' }); ok(x.s === 400, 'estado de revisão inválido recusado');
x = await call({ op: 'estado', estado: 'candidata', q: "Linhas' OR 1=1" }); ok(x.s === 200 && x.j.total === 0, 'busca com aspas tratada como texto');
x = await call({ op: 'estado', estado: 'candidata', q: 'linhas' }); ok(x.j.total === 1 && x.j.paginas[0].titulo === 'Linhas de Produto', 'filtro por estado + busca');
ok(x.j.exec.length >= 5 && x.j.exec.some(e => e.op === 'descobrir') && x.j.exec.some(e => e.op === 'testar' && e.fonte === 'enxoval' && e.erros === 1), 'registro das execuções');
// trilha, mapa e detecção de alteração
x = await call({ op: 'estado', fonte: 'tdn', estado: '' }); const bo = x.j.paginas.find(p => p.titulo === 'Backoffice');
ok(bo && JSON.stringify(bo.trilha) === JSON.stringify(['Linhas de Produto', 'Linha Protheus']) && x.j.paginas.find(p => p.prof === 0).trilha.length === 0 && !('pai' in bo), 'trilha: ancestrais da raiz até o pai');
x = await call({ op: 'mapa' }); ok(x.j.paginas.length === 3 && x.j.paginas.every(p => p.estado !== 'inacessivel' && p.chave && p.url), 'mapa: só páginas lidas, sem as inacessíveis');
await call({ op: 'revisar', chaves: [bo.chave], estado: 'importada' });
await espera(); seen = []; x = await call({ op: 'reler', fonte: 'tdn' });
ok(x.s === 200 && x.j.releitura.relidas === 2 && x.j.releitura.alteradas === 0 && !seen.some(s => /pageId=20$/.test(s.u)), 'releitura: só candidata/importada; sem mudança, nada sinalizado');
site[pg(11)] = () => html('Backoffice', '<p>Agora com novo módulo fiscal.</p>');
await espera(); x = await call({ op: 'reler', fonte: 'tdn' }); ok(x.j.releitura.alteradas === 1, 'releitura: conteúdo diferente → 1 alterada');
x = await call({ op: 'estado', estado: '', mudou: true }); ok(x.j.total === 1 && x.j.paginas[0].titulo === 'Backoffice' && x.j.paginas[0].mudou && x.j.paginas[0].estado === 'importada' && x.j.fontes.find(f => f.id === 'tdn').alteradas === 1, 'filtro "alteradas na fonte" e contagem por fonte; estado da revisão preservado');
site[pg(11)] = () => new Response('x', { status: 500 });
await espera(); x = await call({ op: 'reler', fonte: 'tdn' }); ok(x.j.releitura.erros === 1, 'releitura com falha conta erro');
x = await call({ op: 'estado', estado: 'importada' }); ok(x.j.paginas[0].estado === 'importada' && /releitura/.test(x.j.paginas[0].erro), 'falha na releitura não muda o estado da revisão');
await new Promise(r => setTimeout(r, 30)); await call({ op: 'revisar', chaves: [bo.chave], estado: 'importada' });
x = await call({ op: 'estado', estado: '', mudou: true }); ok(x.j.total === 0, 'revisar de novo limpa o sinal de alteração');
x = await call({ op: 'reler', fonte: 'enxoval' }); ok(x.s === 400, 'releitura bloqueada em fonte que exige login');
// robots indisponível → não segue
x = await call({ op: 'limpar', fonte: 'tdn' }); ok(x.s === 400, 'limpar exige confirmação');
x = await call({ op: 'limpar', fonte: 'tdn', confirmar: 'tdn' }); ok(x.j.removidas === 4, 'limpar remove só a fila da fonte');
x = await call({ op: 'nada' }); ok(x.s === 400, 'operação desconhecida recusada');
