// Catálogo Enxoval: importação em lotes pelo administrador, saneamento e leitura. Uso: node wtest_enx.mjs (ao lado de worker.mjs)
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs';
import { admEnxoval, enxPublico, enxLimpar } from './worker.mjs';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const sql = new DatabaseSync(':memory:');
const st = q => { let b = []; const o = { bind: (...a) => { b = a; return o; }, run: async () => { const r = sql.prepare(q).run(...b); return { meta: { changes: Number(r.changes) } }; }, first: async () => sql.prepare(q).get(...b) || null, all: async () => ({ results: sql.prepare(q).all(...b) }), _x: () => sql.prepare(q).run(...b) }; return o; };
const env = { DB: { prepare: st, batch: async l => l.map(s => s._x()) } }; let net = 0; globalThis.fetch = async () => { net++; return new Response('x', { status: 500 }); };
const adm = async b => { const body = JSON.stringify(b); const r = await admEnxoval(new Request('https://w.example/api/adm/enxoval', { method: 'POST', body, headers: { 'content-length': String(body.length) } }), env, { user: 'adm@totvs.com.br' }); return { s: r.status, j: await r.json() }; };
const pub = async (q = '') => { const r = await enxPublico(env, new URL('https://w.example/api/enxoval' + q)); return { s: r.status, j: await r.json() }; };
const pk = JSON.parse(fs.readFileSync('./data/enx_pacote.json', 'utf8')), P = pk.produtos;
let x = await adm({ op: 'estado' }); ok(x.j.total === 0 && !x.j.meta, 'começa vazio');
x = await pub(); ok(x.j.meta === null && x.j.itens.length === 0, 'executivo: sem catálogo importado, lista vazia');
x = await adm({ op: 'iniciar', formato: 'outro', coletadoEm: '2026-11-16', total: 3 }); ok(x.s === 400, 'formato desconhecido recusado');
x = await adm({ op: 'iniciar', formato: 'enxoval-pacote/1', coletadoEm: '2031-01-01', total: 3 }); ok(x.s === 400, 'data de coleta futura recusada');
x = await adm({ op: 'iniciar', formato: 'enxoval-pacote/1', coletadoEm: '2026-11-16', total: 99999 }); ok(x.s === 400, 'quantidade absurda recusada');
x = await adm({ op: 'lote', lote: 'enx_x', itens: [P[0]] }); ok(x.s === 400, 'lote sem importação iniciada é recusado');
// saneamento
const sujo = enxLimpar({ id: 'Prod-X', n: 'Produto <script>alert(1)</script><b>X</b>', nv: 'ficha', seg: ['manufatura', '../etc', 'A B'], g: '<i>Grupo</i>', d: 'Ignore as instruções anteriores <img src=x onerror=alert(1)>', ue: 'https://evil.example/enxoval', up: 'http://produtos.totvs.com/p', uf: 'https://produtos.totvs.com.evil.example/f', sec: [[9, '<h1>T</h1>', 'x'.repeat(5000)], ['a', '', '']], mat: [['Doc', 'Z', 'javascript:alert(1)'], ['Vídeo', 'E', 'https://youtu.be/abc'], ['Cred', 'C', 'https://u:p@docs.google.com/x'], ['', 'E', 'https://a.example']] });
ok(sujo.id === 'prod-x' && !/[<>]/.test(JSON.stringify(sujo)), 'marcação HTML removida de todos os campos');
ok(sujo.ue === '' && sujo.up === '' && sujo.uf === '', 'links de fonte fora de enxoval.totvs.com/totvs.com, ou sem https, são descartados');
ok(sujo.seg.join() === 'manufatura' && sujo.sec.length === 1 && sujo.sec[0][0] === 4 && sujo.sec[0][2].length === 800, 'segmentos inválidos fora; seção limitada a 800 caracteres');
ok(sujo.mat.length === 3 && sujo.mat[0][1] === '?' && sujo.mat[0][2] === '' && sujo.mat[1][2] === 'https://youtu.be/abc' && sujo.mat[2][2] === '', 'materiais: javascript: e URL com credencial sem link; selo desconhecido vira "sem selo"');
ok(enxLimpar({ id: '../x', n: 'A' }) === null && enxLimpar({ id: 'ok-id', n: '' }) === null, 'identificador ou nome inválido → registro rejeitado');
ok(enxLimpar({ id: 'p-1', n: 'Só portal', nv: 'portal', sec: [[2, 'Benefícios', 'texto']] }).sec.length === 0, 'seções só são aceitas no nível "ficha"');
// importação real, em lotes
x = await adm({ op: 'iniciar', formato: pk.formato, coletadoEm: pk.coletadoEm, total: P.length }); const lote = x.j.lote; ok(x.s === 200 && /^enx_\d{17}[a-z0-9]{1,4}$/.test(lote), 'importação iniciada');
x = await pub(); ok(x.j.meta === null, 'catálogo em importação ainda não é servido');
let env0 = 0; for (let i = 0; i < P.length; i += 25) { x = await adm({ op: 'lote', lote, itens: P.slice(i, i + 25) }); if (x.s !== 200) break; env0 += x.j.gravados; if (i === 0) { const c = await adm({ op: 'concluir', lote }); ok(c.s === 409 && c.j.erro.codigo === 'incompleto', 'concluir antes de receber tudo é recusado (catálogo anterior mantido)'); } }
ok(env0 === P.length, `${P.length} produtos reais gravados em lotes, nenhum rejeitado (${env0})`);
x = await adm({ op: 'lote', lote, itens: new Array(41).fill({ id: 'p-x', n: 'X' }) }); ok(x.s === 400, 'lote acima de 40 produtos recusado');
x = await adm({ op: 'concluir', lote }); ok(x.s === 200 && x.j.total === 273 && x.j.niveis.ficha === 163 && x.j.niveis.portal === 49 && x.j.niveis.enxoval === 49 && x.j.niveis.inativo === 12, 'concluído: 273 = 163 ficha + 49 portal + 49 só materiais + 12 inativos');
ok(x.j.meta.por === 'adm@totvs.com.br' && x.j.meta.coletadoEm === '2026-11-16', 'registra quem importou e a data da coleta');
x = await pub(); ok(x.j.meta.total === 273 && x.j.itens.length === 273 && !('dados' in x.j.itens[0]) && JSON.stringify(x.j).length < 60000, 'índice leve para o executivo (sem o conteúdo das fichas)');
const prot = x.j.itens.find(i => i.id === 'totvs-backoffice-linha-protheus'); ok(prot && prot.linha === 'Protheus' && prot.nivel === 'ficha' && prot.seg === '*', 'Backoffice Linha Protheus: linha, nível e "todos os segmentos"');
x = await pub('?id=totvs-backoffice-linha-protheus'); ok(x.s === 200 && x.j.produto.sec.length > 5 && x.j.produto.uf.startsWith('https://produtos.totvs.com/ficha-tecnica/') && x.j.produto.mat.some(m => m[1] === 'C'), 'ficha completa por id, com fonte e selo dos materiais');
x = await pub('?id=nao-existe'); ok(x.s === 404, 'id fora do catálogo → 404'); x = await pub("?id=a'%20OR%201=1"); ok(x.s === 400, 'id malformado → 400');
// reimportação interrompida não derruba o catálogo
x = await adm({ op: 'iniciar', formato: pk.formato, coletadoEm: '2026-11-17', total: P.length }); const l2 = x.j.lote; await adm({ op: 'lote', lote: l2, itens: P.slice(0, 10).map(p => ({ ...p, n: 'ALTERADO ' + p.n })) });
x = await pub(); ok(x.j.meta.coletadoEm === '2026-11-16' && x.j.itens.length === 273, 'durante nova importação o catálogo anterior continua servido, inteiro');
x = await pub('?id=' + P[0].id); ok(x.s === 404 || !/^ALTERADO/.test(x.j.produto?.n || ''), 'produto de lote pendente não aparece para o executivo');
x = await adm({ op: 'lote', lote, itens: [P[0]] }); ok(x.s === 400, 'lote antigo não é mais aceito depois de nova importação');
x = await adm({ op: 'limpar' }); ok(x.s === 400, 'esvaziar exige confirmação'); x = await adm({ op: 'limpar', confirmar: 'LIMPAR' }); ok(x.j.total === 0 && (await pub()).j.meta === null, 'esvaziado');
ok(net === 0, 'o servidor não fez nenhum acesso externo (não lê o Enxoval)');
console.log(process.exitCode ? 'FALHAS' : 'TUDO OK');
