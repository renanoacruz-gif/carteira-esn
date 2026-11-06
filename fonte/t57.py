from t40_lib import *
import uuid
email='dr%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]')
R=lambda js,a=None: pg.evaluate(js,a)
K='c_T00001'; SUF=uuid.uuid4().hex[:5]
# solução de teste com conteúdo distintivo
R("""s=>{const r=newSol({nome:'Solução Quarentena '+s,tipo:'produto',funcionalidades:[{t:'Rastreabilidade de lotes com quarentena automatica e bloqueio de expedicao'}],dores:[{t:'Lotes reprovados seguem para expedicao sem bloqueio nem rastreio'}],prerequisitos:[{t:'Módulo de Estoque e Custos em versão atual'}],fontes:[{t:'Doc teste',u:'https://tdn.totvs.com/x',d:'2026-01-01'}]});S.solutions.push(r);window.__sid=r.id;return r.id}""",SUF)
sid=R("window.__sid")
ck('frase curta não busca', R("dorBuscar('lotes').motivo")=='curta' and R("dorBuscar('lotes').grupos.length")==0)
r=R("dorBuscar('xyzkw qwrtp jhgfd')"); ck('sem sustentação: nenhum resultado forçado', r['grupos']==[] and r['fracos']==[], r)
r=R("dorBuscar('lotes reprovados seguem para expedicao sem bloqueio')"); g=r['grupos']
ck('frase com trecho encontra a solução e ela é a 1ª', g and g[0]['sid']==sid, [x['sid'] for x in g][:3])
# UI: busca pelo painel
ev(pg,"UI.view='solucoes';render();0"); pg.wait_for_timeout(300)
R("a=>{UI.dor={};document.getElementById('dor-q').value=a;dorExec()}","lotes reprovados seguem para expedicao sem bloqueio"); pg.wait_for_timeout(300)
t=R("document.getElementById('app').innerText").lower()
ck('cartão mostra Trecho que sustenta / Explicação / Requisitos / Pergunta de confirmação', all(x in t for x in ['trecho que sustenta','explicação','requisitos','pergunta de confirmação']))
ck('explicação declara que não confirma a dor', 'não confirma que o cliente tenha essa dor' in t)
ck('requisitos trazem o pré-requisito cadastrado', 'módulo de estoque e custos' in t)
R("a=>{UI.dor.q='xyzkw qwrtp jhgfd';document.getElementById('dor-q').value=UI.dor.q;dorExec()}"); pg.wait_for_timeout(200)
t=R("document.getElementById('app').innerText").lower(); ck('UI sem resultado diz que não há sugestão forçada', 'nenhuma solução da base tem trecho que sustente' in t and 'não há sugestão forçada' in t)
# salvar sem cliente
R("a=>{UI.dor={q:a,k:'',res:dorBuscar(a)};render()}","lotes reprovados seguem para expedicao sem bloqueio"); R("a=>dorSalvar(a)",sid)
ck('salvar sem cliente é recusado', R("!(S.clients['%s'].dorHip||[]).length"%K))
opp=lambda: R("k=>{const o=S.clients[k].opps.find(o=>o.ruleId==='dor_%s');return o&&{modo:o.modo,orig:o.origemTipo,cl:rxClass(S.clients[k],o).cl,pr:o.problema,ev:o.evInd.map(e=>e.cls),nome:o.nome}}"%sid,K)
R("a=>{UI.dor.k=a;render()}",K); pg.wait_for_timeout(200); R("document.getElementById('dor-c').value='%s';0"%K); R("a=>dorSalvar(a)",sid)
o=opp(); ck('hipótese salva cria oportunidade de INVESTIGAÇÃO (nunca prioridade)', o and o['modo']=='investigacao' and o['cl']=='investigar', o)
ck('origem “Hipótese do executivo” e evidência HIPÓTESE + FATO(Base)', o and o['orig']==['Hipótese do executivo'] and 'HIPÓTESE' in o['ev'] and 'FATO' in o['ev'], o)
ck('texto não afirma necessidade confirmada', o and 'Nada nos documentos do cliente confirma' in o['pr'])
R("a=>dorSalvar(a)",sid); ck('hipótese idêntica não duplica', R("S.clients['%s'].dorHip.length"%K)==1 and R("S.clients['%s'].opps.filter(o=>o.ruleId==='dor_%s').length"%(K,sid))==1)
# cobertura: solução já presente em outra oportunidade
cov=R("k=>{const o=S.clients[k].opps.find(o=>o.ruleId!=='dor_%s'&&o.sols&&o.sols.length);return {r:o.ruleId,s:o.sols[0].id,sc:o.score,n:o.evInd.length}}"%sid,K)
txt=R("(a)=>semIdx().chunks.find(ch=>ch.sid===a&&ch.tk.size>=3).t",cov['s'])
g=R("a=>dorBuscar(a).grupos.map(x=>x.sid)",txt); ck('busca encontra a solução já coberta por oportunidade', cov['s'] in g, (cov,g))
R("a=>{UI.dor={q:a.q,k:a.k,res:dorBuscar(a.q)};render();document.getElementById('dor-c').value=a.k;dorSalvar(a.s)}",{'q':txt,'k':K,'s':cov['s']})
after=R("k=>{const o=S.clients[k].opps.find(o=>o.ruleId==='%s');return {sc:o.score,n:o.evInd.length,cls:o.evInd.slice(-1)[0].cls,link:o.dorLink,orig:o.origemTipo}}"%cov['r'],K)
ck('solução já coberta: NÃO cria oportunidade duplicada', R("S.clients['%s'].opps.filter(o=>o.ruleId==='dor_%s').length"%(K,cov['s']))==0)
ck('hipótese anexada como evidência HIPÓTESE à oportunidade existente, sem mudar o score', after['n']>cov['n'] and after['cls']=='HIPÓTESE' and after['sc']==cov['sc'] and after['link']==1 and 'Hipótese do executivo' in after['orig'], (cov,after))
ck('mensagem informa vínculo sem duplicar', 'nenhuma oportunidade duplicada' in R("UI.dor.msg").lower())
# remoção
hid=R("S.clients['%s'].dorHip.find(h=>h.solId==='%s').id"%(K,sid)); R("a=>dorDel(a.k,a.i)",{'k':K,'i':hid}); ck('remover hipótese remove a oportunidade', opp() is None)
# persistência: hipótese sobrevive; solução de teste é só local → hipótese dormente sem erro
R("a=>{UI.dor={q:'lotes reprovados seguem para expedicao sem bloqueio',k:a,res:null};document.getElementById('app');0}",K)
n_h=R("S.clients['%s'].dorHip.length"%K); pg.wait_for_timeout(3000); pg.reload(); pg.wait_for_timeout(3500)
ck('hipóteses persistem após recarregar', R("(S.clients['%s'].dorHip||[]).length"%K)==n_h and n_h>=1)
ck('hipótese de solução inexistente fica dormente (sem oportunidade e sem erro)', R("!S.clients['%s'].opps.some(o=>o.ruleId==='dor_%s')"%(K,sid)) and not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
