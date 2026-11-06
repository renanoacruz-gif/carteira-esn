from t40_lib import *
import uuid
email='ut%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]')
pg.evaluate("()=>{const base=Object.values(S.clients).find(c=>(c.opps||[]).some(o=>o.ruleId==='reforma'));for(let i=1;i<=6;i++){const c=JSON.parse(JSON.stringify(base));c.key='c_X'+i;c.code='X'+i;c.name='Cliente Sintético '+i;c.act={};c.aval={};c.valid=null;S.clients[c.key]=c;runAnalysis(c,'');}}")
rules=pg.evaluate("()=>{const m={};Object.values(S.clients).forEach(c=>(c.opps||[]).forEach(o=>{(m[o.ruleId]||=[]).push(c.key)}));return Object.entries(m).filter(([r,l])=>l.length>=5).map(([r,l])=>[r,l.slice(0,6)])}")
print([(r,len(l)) for r,l in rules])
R,KS=rules[0]
tab=lambda: ev(pg,"(()=>{const a=utColetar(UI.utilP||0);return {n:a.filter(r=>r.av).length,g:a.length}})()")
ck('sem nenhuma avaliação: 0 avaliadas, geradas>0', tab()['n']==0 and tab()['g']>0)
ev(pg,"UI.view='oport';UI.utilOpen=true;render();0"); pg.wait_for_timeout(300)
t=ev(pg,"document.getElementById('app').innerText").lower()
ck('painel mostra “sem taxas” quando nada foi avaliado', 'nenhuma recomendação avaliada' in t and 'utilidade do motor' in t)
ck('sem avaliações não há proposta nem alteração de pesos', 'nenhuma regra atinge o mínimo' in t)
W0=ev(pg,"JSON.stringify(S.meta.weights)")
J=lambda k,j,nota='': pg.evaluate("a=>jdSet(a.k,a.r,a.j,a.n)",{'k':k,'r':R,'j':j,'n':nota})
# 4 clientes: 1 faz sentido, 3 negativas (descartar, atendida, descartar) -> proposta
J(KS[0],'faz_sentido'); J(KS[1],'descartar','não se aplica'); J(KS[2],'descartar','já tem outro'); J(KS[3],'atendida')
st=ev(pg,"(()=>{const e=utAgr(utColetar(0),r=>[r.regra]).find(e=>e.k==='%s');return {n:e.n,pert:e.pert,desc:e.desc,atend:e.atend,cli:e.cli.size,ger:e.ger}})()"%R)
print(st)
ck('denominador = só avaliadas (n=4), não as geradas', st['n']==4 and st['ger']>=5, st)
ck('contagens: 1 pertinente, 2 descartadas, 1 já atendida', st['pert']==1 and st['desc']==2 and st['atend']==1, st)
pr=ev(pg,"utProps(utColetar(0)).map(e=>e.k)")
ck('3 negativas de 4 em 4 clientes → proposta de ajuste gerada', R in pr, pr)
ev(pg,"render();0"); t=ev(pg,"document.getElementById('app').innerText").lower()
ck('painel exibe n, % e “pertinente não é venda”', 'pertinente não é venda' in t and '4 de ' in t and '%' in t)
ck('proposta aparece pendente e declara que nada foi alterado', 'pendente de revisão' in t and 'nada foi alterado automaticamente' in t)
ck('pesos globais intactos após avaliações (sem auto-ajuste)', ev(pg,"JSON.stringify(S.meta.weights)")==W0)
ck('nenhuma revisão gravada sem ação humana', ev(pg,"!S.meta.motorSug||!S.meta.motorSug['%s']"%R))
pg.evaluate("a=>{document.getElementById('mu_'+a).value='regra revisada: restringir gatilho';utRev(a,'analisada')}",R)
ck('revisão humana grava em S.meta.motorSug', ev(pg,"S.meta.motorSug['%s'].st"%R)=='analisada' and 'restringir' in ev(pg,"S.meta.motorSug['%s'].nota"%R))
ck('pesos continuam intactos após revisar', ev(pg,"JSON.stringify(S.meta.weights)")==W0)
# amostra pequena: regra 2 com 2 avaliações → sem proposta, com rótulo de amostra pequena
if len(rules)>1:
    R2,K2=rules[1]
    for k in K2[:2]: pg.evaluate("a=>jdSet(a.k,a.r,'descartar','x')",{'k':k,'r':R2})
    ck('100% negativo mas n=2 → NÃO propõe ajuste', R2 not in ev(pg,"utProps(utColetar(0)).map(e=>e.k)"))
    ev(pg,"render();0"); t=ev(pg,"document.getElementById('app').innerText").lower(); ck('amostra pequena sinalizada', 'amostra pequena' in t)
# mesma regra, 1 cliente só, n>=4? (não aplicável) — cliente único não gera proposta
# período: envelhece decisões para >90 dias
ev(pg,"Object.values(S.clients).forEach(c=>{Object.values(c.act||{}).forEach(a=>a.at='2025-01-01T00:00:00.000Z');Object.values(c.aval||{}).forEach(a=>a.at='2025-01-01T00:00:00.000Z')});0")
ck('período 90 dias exclui avaliações antigas', ev(pg,"utColetar(90).filter(r=>r.av).length")==0 and ev(pg,"utColetar(0).filter(r=>r.av).length")>=4)
ev(pg,"UI.utilOpen=true;render();0"); pg.click('[data-a=utilP][data-id="90"]'); pg.wait_for_timeout(200)
t=ev(pg,"document.getElementById('app').innerText").lower(); ck('UI do período filtra (últimos 90 dias, 0 avaliadas)', 'últimos 90 dias' in t and 'nenhuma recomendação avaliada neste período' in t)
pg.click('[data-a=utilP][data-id="0"]'); pg.wait_for_timeout(200); print('utilP apos clique 0:',ev(pg,'UI.utilP'))
# necessidades não identificadas: contagem sem taxa
K=KS[0]; pg.evaluate("k=>{const c=S.clients[k];c.valid||={};(c.valid.naoIdent||=[]).push({id:'ni1',t:'Gestão de frota',why:'x',at:new Date().toISOString()});touchC(k);render()}",K)
t=ev(pg,"document.getElementById('app').innerText").lower()
import re; print(re.findall(r'necessidades relevantes.{0,300}',t,re.S)[:1], ev(pg,'UI.utilP'))
ck('necessidade não identificada: contagem sem percentual', '1 registrada(s) em 1 cliente(s)' in t and 'não há denominador confiável' in t)
# por solução e segmento existem
ck('tabelas por solução e segmento presentes', 'por solução' in t and 'por segmento' in t or ('solução' in t and 'segmento' in t))
# persistência
pg.wait_for_timeout(3000); pg.reload(); pg.wait_for_timeout(3500)
ck('revisão persiste após recarregar', ev(pg,"S.meta.motorSug&&S.meta.motorSug['%s']&&S.meta.motorSug['%s'].st"%(R,R))=='analisada')
ck('sem erros de página', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
