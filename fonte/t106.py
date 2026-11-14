# Rodada A do prompt mestre: cotas persistentes, Integrações e Inteligência no painel, DOCX completo, simulador (ponderada/ARR), sinais com memória
from t40_lib import *
import json, uuid, urllib.request, urllib.error
B='http://localhost:8790'
def http(method,path,body=None,headers=None):
    rq=urllib.request.Request(B+path,data=(json.dumps(body).encode() if body is not None else None),method=method,headers={'content-type':'application/json',**(headers or {})})
    try:
        with urllib.request.urlopen(rq,timeout=20) as r: return r.status,r.read().decode()
    except urllib.error.HTTPError as e: return e.code,e.read().decode()
J=lambda t: json.loads(t) if t and t[0] in '{[' else {}
run=uuid.uuid4().hex[:6]; U='ra%s@totvs.com.br'%run; hu={'x-test-user':U,'x-test-sub':'ra'+run}; hadm={'x-test-user':'renan.oscar@totvs.com.br','x-test-sub':'sub-renan-001'}
# 1) cotas persistentes
u0=J(http('GET','/api/uso',headers=hu)[1])
ck('consumo próprio: começa zerado, com limites por operação e contagem no banco', u0.get('ok') and u0.get('persistente')==True and all(x['usado']==0 and x['limite']>0 for x in u0['itens']) and len(u0['itens'])==5, u0)
ped={'versao':1,'pedidoId':'t','tipo':'ia_teste','provedor':'gemini','modelo':'x','buscaWeb':False}
cods=[http('POST','/api/ia/teste',ped,hu)[0] for _ in range(63)]
ck('cota diária: 60 testes de provedor passam, do 61º em diante 429', all(c!=429 for c in cods[:60]) and cods[60:]==[429,429,429], cods[57:])
s,t=http('POST','/api/ia/teste',ped,hu); ck('resposta de cota explica o limite e que não adianta repetir', J(t).get('erro',{}).get('codigo')=='cota_diaria' and '60 por dia' in J(t)['erro']['mensagem'] and J(t)['erro'].get('repetir')==False, t[:160])
ck('a cota de um usuário não afeta outro', http('POST','/api/ia/teste',ped,{'x-test-user':'rb%s@totvs.com.br'%run,'x-test-sub':'rb'+run})[0]!=429)
u1={x['rota']:x for x in J(http('GET','/api/uso',headers=hu)[1])['itens']}
ck('consumo próprio reflete o uso gravado', u1['/api/ia/teste']['usado']>=61 and u1['/api/cnpj']['usado']==0, u1['/api/ia/teste'])
ck('outras operações do mesmo usuário continuam liberadas', http('POST','/api/cnpj',{'cnpj':'00000000000000'},hu)[0]!=429)
ck('consumo exige identidade', http('GET','/api/uso')[0]==401)
# 2) Integrações e Inteligência (painel)
ck('usuário comum não vê o estado das integrações', http('GET','/api/adm/integracoes',headers=hu)[0]==403)
s,t=http('GET','/api/adm/integracoes',headers=hadm); g=J(t); I={x['id']:x for x in g.get('itens',[])}
EST={'nao_configurado','nao_testado','conectado','falha_autenticacao','indisponivel','intervencao'}
ck('painel: 9 integrações com um dos 6 estados previstos', s==200 and len(I)>=9 and all(x['estado'] in EST for x in I.values()), [(k,v['estado']) for k,v in I.items()])
ck('CRM/ERP aparece como não configurado; nada é dado como conectado sem execução real', I['crm']['estado']=='nao_configurado' and all(x['ultima'] for x in I.values() if x['estado']=='conectado'))
ck('fonte do catálogo reflete o teste real de conexão', I['fonte_enxoval']['estado'] in ('nao_testado','indisponivel','falha_autenticacao','intervencao') and I['fonte_tdn']['estado'] in EST)
ck('nenhum segredo na resposta', not any(k in t for k in ['AIza','sk-','JSESSIONID','Bearer ','VAPID_PRIVATE']) and 'chave Gemini' in t)
C={x['rota']:x for x in g['consumo']}
ck('consumo consolidado por operação, com pico por usuário e limite', C['/api/ia/teste']['hoje']>=61 and C['/api/ia/teste']['pico_usuario_hoje']>=61 and C['/api/ia/teste']['limite']==60 and C['/api/ia/teste']['usuarios']>=2, C['/api/ia/teste'])
def open_s(email,sub):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':email,'x-test-sub':sub})
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda x: errs.append(str(x))); pg.route('**/*',route); pg.goto(B+'/'); pg.wait_for_timeout(3500)
    return pg,errs
A,ea=open_s('renan.oscar@totvs.com.br','sub-renan-001')
ev(A,"UI.view='adm';render();0"); A.wait_for_timeout(3500)
ix=ev(A,"document.querySelector('#adm-integ')?.innerText||''")
ck('seção "Integrações e Inteligência" dentro do Painel Administrador', 'Integrações e Inteligência' in ix and 'CRM / ERP corporativo' in ix and 'Não configurado' in ix and 'Consumo e cotas' in ix and 'no limite' in ix, ix[:200])
ck('continua um único painel', ev(A,"document.querySelectorAll('#adm-integ').length")==1 and ev(A,"NAV.filter(x=>x[0]==='adm').length")==1)
# 3) telas do executivo
P,e=open_s(U,'ra'+run)
ev(P,"UI.view='integra';render();0"); P.wait_for_timeout(1500)
uc=ev(P,"document.querySelector('#uso-card')?.innerText||''")
ck('Integrações mostra "Seu consumo hoje" com o limite atingido', 'Seu consumo hoje' in uc and 'limite atingido' in uc and 'Teste de provedor de IA' in uc, uc[:160])
# DOCX
r=ev(P,"""(async()=>{ await vend('jszip'); const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
 const p=(t,st,num)=>`<w:p>${st||num?`<w:pPr>${st?`<w:pStyle w:val="${st}"/>`:''}${num?'<w:numPr><w:ilvl w:val="0"/></w:numPr>':''}</w:pPr>`:''}<w:r><w:t>${t}</w:t></w:r></w:p>`;
 const tc=t=>`<w:tc>${p(t)}</w:tc>`, tr=(...c)=>`<w:tr>${c.map(tc).join('')}</w:tr>`;
 const doc=`<?xml version="1.0"?><w:document ${W}><w:body>${p('Proposta Comercial','Ttulo1')}${p('Escopo','Heading2')}${p('Texto corrido do escopo.')}${p('Primeiro item',null,1)}${p('Segundo item',null,1)}<w:tbl>${tr('Produto','Usuários','Valor')}${tr('Protheus Fiscal','25','R$ 1.500,00')}</w:tbl><w:p><w:r><w:drawing/></w:r></w:p></w:body></w:document>`;
 const z=new JSZip(); z.file('word/document.xml',doc); z.file('word/header1.xml',`<w:hdr ${W}>${p('ACME LTDA — Confidencial')}</w:hdr>`); z.file('word/header2.xml',`<w:hdr ${W}>${p('ACME LTDA — Confidencial')}</w:hdr>`); z.file('word/footer1.xml',`<w:ftr ${W}>${p('Página 1 — CNPJ 00.000.000/0001-00')}</w:ftr>`); z.file('word/footnotes.xml','<x/>');
 const buf=await z.generateAsync({type:'arraybuffer'}); const ls=await readDocx(buf);
 return JSON.stringify({ls:ls.map(x=>({t:x.text,l:x.loc,n:x.nivel||0,li:!!x.lista,c:x.cells||null,p:x.parte||''})),lim:ls.limites,res:ls.resumo}) })()"""); dj=json.loads(r); L=dj['ls']
ck('DOCX: títulos com nível', [x['n'] for x in L if x['n']]==[1,2] and L[0]['t']=='Proposta Comercial' and 'título nível 1' in L[0]['l'], L[:2])
ck('DOCX: listas marcadas', [x['t'] for x in L if x['li']]==['• Primeiro item','• Segundo item'])
tb=[x for x in L if x['c']]
ck('DOCX: tabela completa, linha a linha, com células separadas', len(tb)==2 and tb[1]['c']==['Protheus Fiscal','25','R$ 1.500,00'] and tb[1]['l']=='tabela 1 linha 2', tb)
ck('DOCX: cabeçalho e rodapé lidos, sem repetir o mesmo cabeçalho', [x['t'] for x in L if x['p']=='cabeçalho']==['ACME LTDA — Confidencial'] and [x['t'] for x in L if x['p']=='rodapé']==['Página 1 — CNPJ 00.000.000/0001-00'])
ck('DOCX: limitações declaradas (imagem e notas não lidas)', any('imagem' in x for x in dj['lim']) and any('notas de rodapé' in x for x in dj['lim']) and dj['res']=={'paragrafos':5,'tabelas':1,'titulos':2,'listas':2,'cabecalhos':1,'rodapes':1}, (dj['lim'],dj['res']))
ck('DOCX: texto dos parágrafos preservado como antes (compatibilidade)', L[2]['t']=='Texto corrido do escopo.' and tb[0]['t']=='Produto  Usuários  Valor')
# simulador
ev(P,"""(()=>{S.meta.fcSheet={url:'https://docs.google.com/spreadsheets/d/'+'a'.repeat(30),lastOk:new Date().toISOString(),linhas:4};
 const o=(id,st,cdu,rec,serv)=>({id,tab:'OUTUBRO',mes:'10',cliente:'Cliente '+id,produto:'Produto '+id,status:st,cdu,rec,serv,total:cdu+rec+serv,data:'2026-10-15',vendedor:'V'});
 S.meta.fcData={opps:[o('a','EM ABERTO',10000,2000,0),o('b','EM ABERTO',0,1000,5000),o('c','EM ASSINATURA',20000,3000,0),o('d','GANHA',5000,4000,0),o('e','PERDIDA',9000,0,0)],metas:[],syncedAt:new Date().toISOString()};
 S.meta.fcSim=null;UI.fc={per:'mensal',sel:'10'};UI.view='forecast';render();return 0})()"""); P.wait_for_timeout(400)
calc=lambda: json.loads(ev(P,"JSON.stringify(fcSimCalc(fcKPI('mensal','10','').opps,''))"))
c0=calc(); ck('sem premissas: nada é estimado (ponderada e ARR indisponíveis)', c0['pond'] is None and c0['arrPond'] is None and c0['arrGanho'] is None and c0['base']==41000 and c0['n']==3, c0)
sx=ev(P,"document.querySelector('#fc-sim').innerText")
ck('simulador explica a fórmula e que as probabilidades são premissas', 'valor da oportunidade × probabilidade informada' in ev(P,"document.querySelector('#fc-sim').textContent") and 'premissas suas' in ev(P,"document.querySelector('#fc-sim').textContent"))
ev(P,"document.querySelector('#fc-sim').open=true;UI.fc.simOpen=true;0")
P.fill('[data-c=fcsim][data-f=pAberto]','50'); P.press('[data-c=fcsim][data-f=pAberto]','Tab'); P.wait_for_timeout(300)
c1=calc(); ck('só "Em aberto" com 50%: pondera as 2 em aberto e avisa que 1 ficou fora', c1['pond']==9000 and c1['semProb']==1, c1)
P.fill('[data-c=fcsim][data-f=pAssin]','80'); P.press('[data-c=fcsim][data-f=pAssin]','Tab'); P.wait_for_timeout(300)
c2=calc(); ck('com as duas premissas: 12000×0,5 + 6000×0,5 + 23000×0,8 = 27400', c2['pond']==27400 and c2['semProb']==0, c2)
ck('ARR continua indisponível enquanto não disser se o recorrente é mensal ou anual', c2['arrPond'] is None)
P.select_option('[data-c=fcsim][data-f=recBase]','mensal'); P.wait_for_timeout(300)
c3=calc(); ck('recorrente mensal: ARR ponderado = (2000×0,5 + 1000×0,5 + 3000×0,8)×12 = 46800', c3['arrPond']==46800 and c3['arrGanho']==48000, c3)
P.fill('[data-c=fcsimopp][data-id=a]','100'); P.press('[data-c=fcsimopp][data-id=a]','Tab'); P.wait_for_timeout(300)
c4=calc(); ck('probabilidade própria na linha prevalece sobre a do status', c4['pond']==33400 and c4['proprias']==1, c4)
P.fill('[data-c=fcsim][data-f=pAberto]','150'); P.press('[data-c=fcsim][data-f=pAberto]','Tab'); P.wait_for_timeout(300)
ck('probabilidade fora de 0–100 é recusada', ev(P,"S.meta.fcSim.pAberto")==None and 'número de 0 a 100' in ev(P,"document.querySelector('#toast').innerText"))
ck('simulação não altera os dados importados', ev(P,"S.meta.fcData.opps.find(o=>o.id==='a').total")==12000 and ev(P,"fcKPI('mensal','10','').realizado")==9000)
ck('perdidas e ganhas não têm campo de probabilidade', ev(P,"document.querySelectorAll('[data-c=fcsimopp]').length")==3)
ck('ARR da carteira indisponível sem planilha do Empodera', calc()['arrCart'] is None)
ev(P,"S.clients.q1={key:'q1',name:'Q1',fichas:[],docs:[],mgmt:{},act:{},opps:[],src:{row:1},emp:{cod:'T1',mrrP:1500}};0")
ck('ARR da carteira = MRR pagante × 12', calc()['arrCart']==18000)
P.click('[data-a=fcSimLimpar]'); P.wait_for_timeout(300)
ck('limpar premissas volta ao estado sem estimativa', calc()['pond'] is None and ev(P,"Object.keys(S.meta.fcSim.porOpp).length")==0)
# sinais
ev(P,"""(()=>{S.meta.fcData=null;S.meta.fcSheet=null;const c=S.clients.q1;c.name='Empresa Sinal';c.productsRaw='Protheus';runAnalysis(c);
 c.sugFatos=[{id:'s1',topico:'expansao',texto:'Empresa anuncia nova unidade em Curitiba',fonteNome:'Jornal',url:'https://jornal.example/nova-unidade?utm=1',data:'2026-10-01',verificada:true,identidadeIA:'provavel',evidIdent:'cidade confere',impl:'',at:new Date().toISOString(),estado:'pendente'},{id:'s2',topico:'noticia',texto:'Empresa contrata diretor de TI',fonteNome:'Portal',url:'https://portal.example/diretor',data:'2026-10-02',verificada:true,identidadeIA:'confirmada',evidIdent:'site',impl:'',at:new Date().toISOString(),estado:'pendente'}];
 UI.sel='q1';UI.view='cliente';UI.ctab='raiox';render();return 0})()"""); P.wait_for_timeout(500)
ck('sugestão tem Confirmar, Arquivar e Rejeitar', ev(P,"['sgConf','sgArq','sgDesc'].every(a=>document.querySelectorAll('[data-a='+a+']').length===2)"))
P.click('[data-a=sgDesc][data-id=s1]'); P.wait_for_timeout(300); P.click('[data-a=sgArq][data-id=s2]'); P.wait_for_timeout(300)
ck('rejeitar guarda a fonte; arquivar não', ev(P,"S.clients.q1.sgRej.length")==1 and ev(P,"S.clients.q1.sugFatos.map(x=>x.estado).join()")=='descartado,arquivado')
ck('memória de rejeição é gravada com o cliente', json.loads(ev(P,"JSON.stringify(freezeClient(S.clients.q1).sgRej)"))==json.loads(ev(P,"JSON.stringify(S.clients.q1.sgRej)")))
rep=json.loads(ev(P,"""(async()=>{S.meta.emPend={pq:{key:'q1'}};await empresaResposta({ok:true,pedidoId:'pq',provedor:'gemini',usouBusca:true,fontes:[{u:'https://jornal.example/nova-unidade'},{u:'https://outro.example/x'}],dados:{itens:[{topico:'expansao',afirmacao:'Texto diferente sobre a mesma nova unidade',fonteUrl:'https://jornal.example/nova-unidade',fonteNome:'Jornal',dataEvento:'2026-10-01',identidade:'provavel'},{topico:'noticia',afirmacao:'Fato novo de outra fonte',fonteUrl:'https://outro.example/x',fonteNome:'Outro',dataEvento:'2026-10-05',identidade:'provavel'}]}});return JSON.stringify(UI.em.rep)})()"""))
ck('nova pesquisa: fonte rejeitada não reaparece (mesmo com outro texto); fonte nova entra', rep.get('rej')==1 and rep['novos']==1 and ev(P,"S.clients.q1.sugFatos.filter(x=>x.estado==='pendente').length")==1, rep)
ev(P,"render();0"); P.wait_for_timeout(300)
ck('lista de rejeitados e arquivados com Restaurar', ev(P,"document.querySelectorAll('#sg-fora [data-a=sgRest]').length")==2)
ev(P,"document.querySelector('#sg-fora').open=true;0"); P.click('#sg-fora [data-a=sgRest][data-id=s1]'); P.wait_for_timeout(300)
ck('restaurar devolve à fila e libera a fonte', ev(P,"S.clients.q1.sugFatos.find(x=>x.id==='s1').estado")=='pendente' and ev(P,"S.clients.q1.sgRej.length")==0)
ev(P,"delete S.clients.q1;S.meta.emPend={};S.meta.fcSim=null;UI.view='geral';render();0")
ck('sem erro de script', not e and not ea, (e+ea)[:2])
print('FALHAS:',len(F)); [print(' -',x) for x in F]; p.stop()
