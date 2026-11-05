import * as W from './w.mjs';
const { admCalc, admEvento, admMetaLimpa } = W; let F=0; const ck=(n,c)=>{console.log(c?'PASS':'FAIL',n); if(!c)F++;};
console.log(Object.keys(W));
const agora='2026-11-10T12:00:00.000Z', cfg={inatividade_dias:14,sessao_min:30,retencao_dias:180,principais:['import_carteira','raiox_gerar']};
const ev=(u,f,fase,res,ts,extra={})=>({id:u+f+ts+fase,ts,usuario:u,func:f,fase,resultado:res,corr:extra.corr||null,dur_ms:extra.dur??null,origem:extra.o||'c',meta:extra.meta?JSON.stringify(extra.meta):null});
const users=[{email:'a@t.com',nome:'A',primeiro_acesso:'2026-11-01T10:00:00Z',ultimo_acesso:'2026-11-09T10:00:00Z'},{email:'b@t.com',nome:'B',primeiro_acesso:'2026-11-01T10:00:00Z',ultimo_acesso:'2026-11-02T10:00:00Z'},{email:'c@t.com',nome:'C',primeiro_acesso:'2026-11-03T10:00:00Z',ultimo_acesso:'2026-11-03T10:00:00Z'}];
const roster=[{email:'a@t.com'},{email:'b@t.com'},{email:'c@t.com'},{email:'d@t.com',nome:'D'}];
const events=[ev('a@t.com','acesso','concluida','ok','2026-11-09T10:00:00Z',{o:'s'}),ev('a@t.com','import_carteira','concluida','ok','2026-11-09T10:05:00Z'),
 ev('b@t.com','raiox_gerar','concluida','ok','2026-10-05T10:05:00Z'), ev('c@t.com','acesso','concluida','ok','2026-11-03T10:00:00Z',{o:'s'}), ev('c@t.com','pesquisa_ic','erro','erro','2026-11-10T10:01:00Z',{o:'s',meta:{codigo:'cota'}}),
 ev('c@t.com','pesquisa_ic','erro','erro','2026-11-10T10:02:00Z',{o:'s',meta:{codigo:'cota'}}),ev('c@t.com','pesquisa_ic','erro','erro','2026-11-10T10:03:00Z',{o:'s',meta:{codigo:'cota'}}),
 ev('a@t.com','ficha_upload','iniciada',null,'2026-11-10T11:00:00Z',{corr:'x1'})];
const r=admCalc({users,roster,events,cfg,agora,de:'2026-10-01T00:00:00Z',ate:agora,func:'',anteriores:{},cobertura:'2026-10-01T00:00:00Z',filas:null});
const s=e=>r.usuarios.find(u=>u.email===e).situacao;
ck('a ativo',s('a@t.com')==='ativo'); ck('b sem atividade recente',s('b@t.com')==='sem_atividade_recente'); ck('c acessou sem principais',s('c@t.com')==='sem_recursos_principais'); ck('d nunca',s('d@t.com')==='nunca_acessou');
ck('kpi previstos 4',r.kpis.previstos===4); ck('kpi nunca 1',r.kpis.nunca_acessaram===1); ck('ativos_periodo 2',r.kpis.ativos_periodo===2);
ck('recorrente cota',r.saude.recorrentes.some(x=>x.codigo==='cota'&&x.n===3)); ck('limite provedor',r.saude.limites_provedor.length===1);
ck('indisponivel pesquisa',r.saude.integracoes_indisponiveis.some(x=>x.func==='pesquisa_ic')); ck('sem conclusao ficha',r.saude.sem_conclusao.ficha_upload===1);
// c: erro não conta como atividade útil
ck('c sem ultima atividade',r.usuarios.find(u=>u.email==='c@t.com').ultima_atividade_util===null);
// admEvento
const A='2026-11-10T12:00:00.000Z';
ck('evento válido',!!admEvento({id:'abc123',func:'import_carteira',fase:'concluida',meta:{n:3,tipo:'carteira'}},'a@t.com','c',A));
ck('func inválida rejeitada',admEvento({id:'abc',func:'x',fase:'concluida'},'a@t.com','c',A)===null);
ck('acesso via cliente rejeitado',admEvento({id:'abc',func:'acesso',fase:'concluida'},'a@t.com','c',A)===null);
ck('id inválido rejeitado',admEvento({id:'a b',func:'import_carteira',fase:'concluida'},'a@t.com','c',A)===null);
const m=admMetaLimpa({n:5,cliente:'ACME LTDA',cnpj:'12345678000190',texto:'segredo',tipo:'carteira',codigo:'Ruim Código',via:'hack'});
ck('meta só permitido',JSON.stringify(m)==='{"n":5,"tipo":"carteira"}');
ck('ts futuro limitado',admEvento({id:'abc',func:'import_carteira',fase:'concluida',ts:'2030-01-01T00:00:00Z'},'a@t.com','c',A).ts===A);
ck('ts antigo >24h limitado',admEvento({id:'abc',func:'import_carteira',fase:'concluida',ts:'2020-01-01T00:00:00Z'},'a@t.com','c',A).ts===A);
console.log('FALHAS',F); process.exit(F?1:0);
