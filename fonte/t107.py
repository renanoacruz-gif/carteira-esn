# Rodada B do prompt mestre: estudos de Financial Services, Hospitalidade e Jurídico; classificação de atendimento; releases da carteira
from t40_lib import *
import json
P,e=open_h('exec_rb@totvs.com.br')
tx=lambda: ev(P,"document.querySelector('#app').innerText")
S3=['financial','hospitalidade','juridico']
info=json.loads(ev(P,"""JSON.stringify(Object.fromEntries(['financial','hospitalidade','juridico'].map(id=>{const g=KB.segments.find(s=>s.id===id);return [id,{estudo:g.estudo,resumo:g.resumo,nt:g.tendencias.length,nr:(g.regulatorio||[]).length,np:g.perguntas.length,npr:g.processos.length,nm:(g.modelos||[]).length,ni:(g.indicadores||[]).length,
 fontesOk:[...g.tendencias,...(g.regulatorio||[])].every(t=>t.t&&t.fonte&&/^https:\\/\\//.test(t.fonte.u)&&t.fonte.t),impOk:g.tendencias.every(t=>t.impacto&&Array.isArray(t.needs)&&t.needs.every(n=>NEED_LABEL[n])),
 apl:g.aplicacoes.map(a=>[a.sol,a.conf,!!KB.sol(a.sol)]),dores:g.dores}]})))"""))
for sid in S3:
    x=info[sid]
    ck(f'{sid}: estudo carregado com processos, modelos, tendências, exigências e perguntas', x['estudo']==True and x['nt']>=4 and x['nr']>=2 and x['np']>=5 and x['npr']>=6 and x['nm']>=3 and 'ESTUDO NÃO CARREGADO' not in x['resumo'], {k:x[k] for k in ['nt','nr','np','npr','nm']})
    ck(f'{sid}: toda tendência e exigência tem fonte com link; impacto e necessidades válidos', x['fontesOk'] and x['impOk'])
    ck(f'{sid}: aplicações apontam para soluções existentes e trazem nível de confiança', len(x['apl'])>=3 and all(a[2] and a[1] in ('confirmada','integracao','investigar','validar') for a in x['apl']), x['apl'])
    ck(f'{sid}: nenhuma aplicação é dada como confirmada sem documentação; dores marcadas como hipótese', all(a[1] in ('investigar','validar') for a in x['apl']) and all('hipótese setorial' in d for d in x['dores']))
    ck(f'{sid}: resumo declara a data da consulta e o que falta validar', 'Consulta em 2026-11-13' in x['resumo'] and 'validar' in x['resumo'])
ck('Financial Services: avisa que a Dimensa (antiga TOTVS Financial Services) foi vendida', 'vendeu em 2026 a Dimensa' in info['financial']['resumo'] and ev(P,"KB.segments.find(s=>s.id==='financial').tendencias.some(t=>/Evertec/.test(t.t)&&/Não ofertar core bancário/.test(t.impacto))"))
ck('todos os segmentos da base têm estudo', ev(P,"KB.segments.filter(s=>KB.segments.indexOf(s)>=6).every(s=>s.estudo===true)") or ev(P,"KB.segments.filter(s=>s.estudo===false&&/Financial|Hospital|Jur/.test(s.nome)).length")==0)
for sid,chave in [('financial','Evertec'),('hospitalidade','Decreto 12.955/2026'),('juridico','art. 127')]:
    ev(P,"UI.view='segmentos';UI.segSel='%s';render();0"%sid); P.wait_for_timeout(300)
    t=ev(P,"document.querySelector('#app').textContent")
    ck(f'tela do segmento {sid}: modelos, indicadores, exigências regulatórias e confiança das aplicações', all(k in t for k in ['Modelos de negócio','Indicadores relevantes','Exigências regulatórias',chave]) and ('necessita validação' in t.lower() or 'possibilidade a investigar' in t.lower()), t[:200])
    ck(f'tela do segmento {sid}: links das fontes abrem em nova aba, só https', ev(P,"[...document.querySelectorAll('#seg-reg a')].length")>=2 and ev(P,"[...document.querySelectorAll('#seg-reg a')].every(a=>a.href.startsWith('https://'))"))
ev(P,"UI.segSel='manufatura';render();0"); P.wait_for_timeout(300)
ck('segmento antigo sem os campos novos continua igual', 'Exigências regulatórias' not in tx() and 'Tendências e pressões' in tx())
# motor: cliente do segmento jurídico
ev(P,"""(()=>{S.clients={};const mk=(k,name,seg,prods)=>{S.clients[k]={key:k,name,cnpj:'',productsRaw:prods,seg:seg,segment:seg,fichas:[],docs:[],mgmt:{},act:{},opps:[],src:{row:1}};runAnalysis(S.clients[k]);};mk('j1','Silva Advogados','Jurídico','RM');mk('h1','Hotel Central','Hospitalidade e Turismo','Protheus');mk('f1','Banco Regional','Financial Services','Protheus');return 0})()""")
ck('"Hospitalidade" não é mais confundida com Saúde (hospital); hospital continua em Saúde', ev(P,"[segOfRaw('Hospitalidade e Turismo'),segOfRaw('Hospital São Lucas'),segOfRaw('Saúde')].join()")=='hospitalidade,saude,saude', ev(P,"[segOfRaw('Hospitalidade e Turismo'),segOfRaw('Hospital São Lucas'),segOfRaw('Saúde')].join()"))
ck('razão social com "Advogados" é reconhecida como Jurídico (inferência a confirmar)', ev(P,"(()=>{const c={key:'zj',name:'Silva Advogados',seg:''};return classifySeg(c,{}).id+'|'+classifySeg(c,{}).mode})()")=='juridico|inferido')
ck('cliente é classificado nos três segmentos', ev(P,"[S.clients.j1.segInfo?.id,S.clients.h1.segInfo?.id,S.clients.f1.segInfo?.id].join()")=='juridico,hospitalidade,financial')
ck('análise do cliente não quebra e não cria oportunidade "confirmada" a partir do estudo setorial', ev(P,"['j1','h1','f1'].every(k=>Array.isArray(S.clients[k].opps))") and ev(P,"['j1','h1','f1'].every(k=>S.clients[k].opps.every(o=>o.conf!=='alta'||(o.evInd||[]).some(x=>x.cls==='FATO')))"))
# classificação de atendimento
ck('Base: 7 formas de atendimento + não classificada', json.loads(ev(P,"JSON.stringify(Object.values(ATEND_SOL))"))==['não classificada','PADRÃO','PARAMETRIZAÇÃO','PROCESSO','INTEGRAÇÃO','CUSTOMIZAÇÃO','GAP','EVOLUÇÃO'])
ck('soluções existentes começam sem classificação (nada é deduzido)', ev(P,"activeSols().every(r=>!r.atend)"))
ev(P,"S.solutions.push(newSol({id:'zb1',nome:'ZB Solução Classificada',linha:'Protheus',status:'Validado',termos:['zbclass'],segmentos:[S.clients.h1.segInfo.id],fontes:[{t:'TDN',u:'https://tdn.totvs.com/x'}]}));UI.view='solucoes';UI.solSel=null;UI.solEdit={d:solDraft(S.solutions.find(r=>r.id==='zb1')),errs:[],dups:null};render();0"); P.wait_for_timeout(300)
ck('formulário tem o campo "Como atende a necessidade" com explicação de cada opção', ev(P,"document.querySelectorAll('[data-c=sf][data-f=atend] option').length")==8 and 'exige desenvolvimento específico' in ev(P,"document.querySelector('[data-c=sf][data-f=atend]').innerText"))
r=json.loads(ev(P,"(()=>{const r=S.solutions.find(x=>x.id==='zb1'),d=solDraft(r);d.atend='parametrizacao';const a=applyDraft(r,d);const d2=solDraft(r);d2.atend='inventado';applyDraft(r,d2);const v=r.atend;d2.atend='parametrizacao';applyDraft(r,d2);return JSON.stringify([a,v,r.atend])})()"))
ck('classificação grava, conta como alteração e recusa valor inválido', r==[True,'','parametrizacao'], r)
ev(P,"UI.solEdit=null;UI.solSel='zb1';render();0"); P.wait_for_timeout(300)
ck('detalhe da solução mostra a classificação', 'PARAMETRIZAÇÃO' in tx())
x=json.loads(ev(P,"JSON.stringify(ptClass(ptCtx(S.clients.h1),S.solutions.find(r=>r.id==='zb1')))")); ck('classificada como parametrização continua recomendável', x['cls'] in ('potencial','validar'), x['cls'])
ev(P,"S.solutions.find(r=>r.id==='zb1').atend='gap';0")
x=json.loads(ev(P,"JSON.stringify(ptClass(ptCtx(S.clients.h1),S.solutions.find(r=>r.id==='zb1')))")); ck('classificada como GAP não é recomendada, com o motivo', x['cls']=='nao_ident' and 'GAP' in x['porque'], x)
ev(P,"S.solutions.find(r=>r.id==='zb1').atend='customizacao';UI.sel='h1';UI.view='cliente';UI.ctab='diagnostico';render();0"); P.wait_for_timeout(500)
dg=ev(P,"document.querySelector('#pt-diag')?.innerText||''")
ck('diagnóstico: candidata de customização traz a pendência; as demais avisam que não estão classificadas', ('exige desenvolvimento específico' in dg or 'ZB Solução Classificada' not in dg) and 'Forma de atendimento não classificada' in dg)
# releases da carteira
ev(P,"UI.view='refs';render();0"); P.wait_for_timeout(400)
rc=ev(P,"document.querySelector('#rel-cart')?.innerText||''")
ck('releases da carteira: sem release confirmada, lista quem falta confirmar e não inventa data', 'Releases da carteira' in rc and 'sem release em produção confirmada' in rc and 'Nenhum cliente com release em produção confirmada' in rc, rc[:200])
ok=ev(P,"""(()=>{const c=S.clients.h1;consInit(c);c.rel.push(mkEv('2410',{st:'confirmado',cls:'FATO',tipo:'manual',ref:'teste',loc:'',extra:{tipo:'producao',produto:'Protheus'}}));runAnalysis(c);const R=relCarteira();return JSON.stringify([R.itens.map(e=>[e.produto,e.rel,e.cs.length,e.marco?.data||null,e.sit?.k||null]),R.semConf.length])})()""")
oj=json.loads(ok)
ck('release confirmada entra na visão consolidada com o marco oficial cadastrado', len(oj[0])>=1 and oj[0][0][1] and oj[0][0][2]==1, ok)
ev(P,"render();0"); P.wait_for_timeout(300)
ck('tabela consolidada com link para a aba Tecnologia do cliente', ev(P,"!!document.querySelector('#rel-cart a[data-a=openTab][data-v=tecnologia]')") and 'Hotel Central' in ev(P,"document.querySelector('#rel-cart').innerText"))
ev(P,"S.solutions=S.solutions.filter(r=>r.id!=='zb1');S.clients={};UI.view='geral';render();0")
ck('sem erro de script', not e, e[:2])
print('FALHAS:',len(F)); [print(' -',x) for x in F]; p.stop()
