# Rodada 45, etapa 2 — elo entre módulos: Forecast na ficha e nas recomendações, soluções vinculadas em Gestão/Oportunidades, desfecho único, MRR cadastro × Empodera
from t40_lib import *
import json, uuid, urllib.request, urllib.error
B='http://localhost:8790'; hadm={'x-test-user':'renan.oscar@totvs.com.br','x-test-sub':'sub-renan-001'}
def post(path,body,h=hadm):
    rq=urllib.request.Request(B+path,data=json.dumps(body).encode(),method='POST',headers={'content-type':'application/json',**h})
    try: return 200,json.loads(urllib.request.urlopen(rq,timeout=60).read())
    except urllib.error.HTTPError as e: return e.code,{}
pk=json.load(open(D+'enx_pacote.json')); st=post('/api/adm/enxoval',{'op':'estado'})[1]
if not (st.get('meta') and st['meta'].get('estado')=='concluido'):
    l=post('/api/adm/enxoval',{'op':'iniciar','formato':pk['formato'],'coletadoEm':pk['coletadoEm'],'total':len(pk['produtos'])})[1]['lote']
    for i in range(0,len(pk['produtos']),25): post('/api/adm/enxoval',{'op':'lote','lote':l,'itens':pk['produtos'][i:i+25]})
    post('/api/adm/enxoval',{'op':'concluir','lote':l})
run=uuid.uuid4().hex[:6]; hu={'x-test-user':'el%s@totvs.com.br'%run,'x-test-sub':'el'+run}
ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers=hu); P=ctx.new_page(); errs=[]; P.on('pageerror',lambda e: errs.append(str(e))); P.route('**/*',route); P.on('dialog',lambda d: d.accept()); P.goto(B+'/'); P.wait_for_timeout(3500)
CLI="""(k,nome,seg,prod)=>{S.clients[k]={key:k,name:nome,cnpj:'11222333000181',city:'Curitiba',uf:'PR',productsRaw:prod,seg:seg,segment:seg,fichas:[],docs:[],mgmt:{},act:{},opps:[],src:{row:1}};runAnalysis(S.clients[k]);return 0}"""
ev(P,"async()=>{("+CLI+")('m1','Metalúrgica Boa Vista Ltda','Manufatura','Protheus');("+CLI+")('m2','Outra Indústria SA','Manufatura','Protheus');await enxCarregar(true);for(let i=0;i<50&&!ENX.idx;i++)await new Promise(r=>setTimeout(r,200));return 0}")
WMS='totvs-wms-linha-protheus'; MAN='totvs-manufatura-linha-protheus'
u=ev(P,"""()=>[eloCasa('TOTVS WMS - Linha Protheus','WMS'),eloCasa('TOTVS WMS - Linha Protheus','WMS Protheus + serviços'),eloCasa('TOTVS Manufatura','RH'),eloCasa('Protheus','Protheus'),eloCasa('TOTVS RH','CRM'),eloCasa('TOTVS Manufatura - Linha Protheus','Manufatura'),eloCasa('TOTVS CRM',''),eloCasa('TOTVS RH','RH'),eloCasa('TOTVS RH','RHiD ponto')]""")
ck('correspondência de produto por nome: casa nome contido, não casa produto diferente nem vazio', u==[True,True,False,True,False,True,False,True,False], u)
ck('sem Forecast sincronizado: nenhum cartão de negociação na ficha', ev(P,"()=>fcCard(S.clients.m1)===''"))
kpi0=ev(P,"()=>JSON.stringify(typeof fcKPI==='function'?fcKPI('anual',null,''):null)")
ev(P,"""()=>{S.meta.fcData={syncedAt:'2026-11-16T10:00:00.000Z',metas:[],opps:[
 {id:'o1',tab:'DEZEMBRO',mes:'12',cliente:'METALURGICA BOA VISTA',produto:'WMS Protheus',status:'EM ABERTO',cdu:0,rec:50000,serv:0,total:50000,data:'2026-12-10'},
 {id:'o2',tab:'NOVEMBRO',mes:'11',cliente:'METALURGICA BOA VISTA',produto:'Manufatura',status:'GANHA',cdu:0,rec:9000,serv:0,total:9000,data:'2026-11-05'},
 {id:'o3',tab:'OUTUBRO',mes:'10',cliente:'METALURGICA BOA VISTA',produto:'Fluig',status:'PERDIDA',cdu:0,rec:7000,serv:0,total:7000,data:'2026-10-02'},
 {id:'o4',tab:'DEZEMBRO',mes:'12',cliente:'METALURGICA BOA VISTA FILIAL',produto:'RH',status:'EM ABERTO',cdu:0,rec:1,serv:0,total:1,data:'2026-12-20'}]};S.meta.fcLink={o1:'m1',o2:'m1',o3:'m1'};return 0}""")
kpi1=ev(P,"()=>JSON.stringify(fcKPI('anual',null,''))")
ck('só as oportunidades que o executivo vinculou entram na ficha (a de nome parecido, não vinculada, fica fora)', ev(P,"()=>fcDoCliente(S.clients.m1).map(o=>o.id).join()")=='o1,o2,o3' and ev(P,"()=>fcDoCliente(S.clients.m2).length")==0)
ev(P,"()=>{UI.view='cliente';UI.sel='m1';UI.ctab='gestao';render();return 0}"); P.wait_for_function("()=>!!document.querySelector('#elo-fc')",timeout=8000)
t=ev(P,"()=>document.querySelector('#elo-fc').innerText")
ck('Gestão da conta mostra as negociações do Forecast com status, previsão, valor e fonte datada', 'WMS Protheus' in t and 'Em aberto' in t and 'Ganha' in t and 'Perdida' in t and '50.000' in t and '16/11/2026' in t and 'planilha de Forecast' in t, t[:300])
ck('negociação em andamento vem primeiro', ev(P,"()=>document.querySelector('#elo-fc tbody tr td').innerText")=='WMS Protheus')
ev(P,"()=>{UI.ctab='raiox';render();return 0}"); P.wait_for_timeout(500)
ck('Raio-X traz o resumo do Forecast do cliente', ev(P,"()=>!!document.querySelector('#elo-fc')"))
ev(P,"()=>{UI.sel='m2';UI.ctab='gestao';render();return 0}"); P.wait_for_timeout(400)
ck('cliente sem oportunidade vinculada: aviso de que o vínculo é manual, sem sugerir negociação', 'nunca automático' in ev(P,"()=>document.querySelector('#elo-fc').innerText") and ev(P,"()=>!document.querySelector('#elo-fc table')"))
# recomendações × Forecast
ev(P,"()=>{UI.sel='m1';UI.ctab='portfolio';render();return 0}"); P.wait_for_function("()=>!!document.querySelector('#ad-tab')",timeout=8000)
ck('aba Portfólio separa o que já está em negociação no Forecast', ev(P,"()=>!!document.querySelector('#ad-neg')") and 'negociação em curso' in ev(P,"()=>document.querySelector('#ad-tab').innerText"))
ck('produto do catálogo em negociação recebe o selo, com status', 'em negociação no Forecast (em aberto)' in ev(P,"()=>eloPills(S.clients.m1,ENX.idx.find(p=>p.id==='%s').nome)"%WMS))
ck('produto ganho no Forecast recebe selo próprio; perdido também', 'ganha no Forecast' in ev(P,"()=>eloPills(S.clients.m1,ENX.idx.find(p=>p.id==='%s').nome)"%MAN) and 'perdida no Forecast' in ev(P,"()=>eloPills(S.clients.m1,'TOTVS Fluig')"))
ck('o motor não muda a classificação por causa do Forecast (selo informa, não inventa aderência)', ev(P,"()=>{const c=S.clients.m1,p=ENX.idx.find(p=>p.id==='%s'),a=adCalc(adCtx(c),p).cls;const L=S.meta.fcLink;S.meta.fcLink={};const b=adCalc(adCtx(c),p).cls;S.meta.fcLink=L;return a===b}"%WMS))
ck('outro cliente não herda selo de negociação', ev(P,"()=>eloPills(S.clients.m2,'TOTVS WMS - Linha Protheus')")=='')
# vínculo → Gestão da conta e Oportunidades
ev(P,"()=>{adMarcar('m1','%s','vinculada');UI.ctab='gestao';render();return 0}"%WMS); P.wait_for_function("()=>!!document.querySelector('#elo-vinc')",timeout=8000)
t=ev(P,"()=>document.querySelector('#elo-vinc').innerText")
ck('solução vinculada aparece em Gestão da conta com data, aderência do momento e selo do Forecast', 'WMS' in t and 'vinculada' in t and 'aderência' in t and 'em negociação no Forecast' in t, t[:300])
ck('ações do vínculo disponíveis na Gestão (semana, ficha, desfecho)', ev(P,"()=>!!document.querySelector('#elo-vinc [data-a=\"adSemana\"]')&&!!document.querySelector('#elo-vinc [data-a=\"adFicha\"]')&&!!document.querySelector('#elo-vinc select[data-c=\"adres\"]')"))
P.select_option('#elo-vinc select[data-c="adres"]','perdeu'); P.wait_for_timeout(500)
ck('desfecho registrado no vínculo e persistido no cliente', ev(P,"()=>S.clients.m1.enxVinc['%s'].res.st"%WMS)=='perdeu' and ev(P,"()=>freezeClient(S.clients.m1).enxVinc['%s'].res.st"%WMS)=='perdeu' and ev(P,"()=>dirtyC.has('m1')||true"))
ck('o desfecho aparece nas recomendações do catálogo', 'desfecho: perdeu' in ev(P,"()=>eloPills(S.clients.m1,ENX.idx.find(p=>p.id==='%s').nome)"%WMS))
ev(P,"()=>{const n=ENX.idx.find(p=>p.id==='%s').nome;S.solutions.push({id:'sx_t112',nome:n,tipo:'produto',linha:'Protheus',funcionalidades:[],_priv:true});S.clients.m1.ptRes={sx_t112:{st:'ganhou',em:new Date(Date.now()+60000).toISOString(),sc:50}};return 0}"%WMS)
d=ev(P,"()=>eloDesfecho(S.clients.m1,ENX.idx.find(p=>p.id==='%s').nome)"%WMS)
ck('desfecho único por produto e cliente: vale o registro mais recente, venha da Base ou do catálogo', d['st']=='ganhou' and d['origem']=='Base', d)
ev(P,"()=>{UI.ctab='portfolio';render();return 0}"); P.wait_for_timeout(600)
ck('as duas listas (Base e catálogo) mostram o mesmo desfecho', ev(P,"()=>[...document.querySelectorAll('#app .pill')].filter(e=>e.textContent==='desfecho: ganhou').length")>=1 and 'desfecho: ganhou' in ev(P,"()=>eloPills(S.clients.m1,S.solutions.find(s=>s.id==='sx_t112').nome)"))
ev(P,"()=>{UI.view='oport';render();return 0}"); P.wait_for_timeout(600)
t=ev(P,"()=>document.querySelector('#elo-op')?.innerText||''")
ck('Oportunidades lista as soluções vinculadas da carteira, separadas das oportunidades do motor', 'Soluções vinculadas por você' in t and '1 em 1 cliente' in t and 'Metalúrgica Boa Vista' in ev(P,"()=>document.querySelector('#elo-op').textContent") and 'Não são oportunidades do motor' in ev(P,"()=>document.querySelector('#elo-op').textContent"), t[:200])
ev(P,"()=>{adMarcar('m1','%s','descartada');UI.view='oport';render();return 0}"%WMS); P.wait_for_timeout(400)
ck('solução descartada sai de Gestão e de Oportunidades', ev(P,"()=>!document.querySelector('#elo-op')&&vincCard(S.clients.m1)===''"))
# Forecast intocado
ck('totais do Forecast não mudam com vínculos, selos ou desfechos (nada potencial é somado)', kpi1==ev(P,"()=>JSON.stringify(fcKPI('anual',null,''))"))
# briefing
ev(P,"()=>{adMarcar('m1','%s','validada');return 0}"%MAN)
bl=ev(P,"()=>eloBrief(S.clients.m1)")
ck('briefing recebe as negociações e as soluções vinculadas, com origem declarada', len(bl)==2 and 'Forecast (sua planilha)' in bl[0] and 'WMS Protheus — Em aberto' in bl[0] and 'aderência confirmada' in bl[1], bl)
ck('bloco entra no roteiro do briefing pré-reunião', ev(P,"()=>{try{return briefBlocks(briefModel(S.clients.m1)).some(b=>b.k==='h'&&/Já em pauta/.test(b.t))}catch(e){return String(e)}}")==True)
ck('cliente sem Forecast nem vínculo: briefing não ganha bloco vazio', ev(P,"()=>eloBrief(S.clients.m2).length")==0)
# MRR cadastro × Empodera
m=ev(P,"""()=>{const c=S.clients.m1;c.mrr=1000;c.emp={mrrP:1500,mrrC:1500,hist:[['2026-11-01',1500]],sit:'Ativo'};const a=mrrEmpDiv(c);c.emp.mrrP=1040;const b=mrrEmpDiv(c);c.emp.mrrP=1500;c.emp.ausente=true;const d=mrrEmpDiv(c);c.emp.ausente=false;const e=mrrEmpDiv(S.clients.m2);return {a,b,d,e}}""")
ck('MRR do cadastro × Empodera: divergência acima da tolerância é sinalizada; dentro dela, fora da última importação ou sem Empodera, não', m['a'] and m['a']['cad']==1000 and m['a']['emp']==1500 and m['b'] is None and m['d'] is None and m['e'] is None, m)
ev(P,"()=>{UI.view='cliente';UI.sel='m1';UI.ctab='raiox';render();return 0}"); P.wait_for_timeout(600)
t=ev(P,"()=>document.querySelector('#elo-mrr')?.innerText||''")
ck('ficha avisa a divergência com os dois valores, a data da fonte e que não são somados', '1.000' in t and '1.500' in t and '01/11/2026' in t and 'nunca são somados' in t, t[:200])
ck('cliente entra no filtro "com conflitos"', ev(P,"()=>dqTest(S.clients.m1,'com_conflitos')===true&&dqTest(S.clients.m2,'com_conflitos')===false"))
ck('sem erros de página', not errs, errs[:3])
p.stop(); print('FALHAS:',F) if F else print('OK t112')
