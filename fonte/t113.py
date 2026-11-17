# Rodada 45, etapa 3 — catálogo reimportado pede revisão dos vínculos; nomes alternativos e marcação manual para "já possui"
from t40_lib import *
import json, uuid, copy, urllib.request, urllib.error
B='http://localhost:8790'; hadm={'x-test-user':'renan.oscar@totvs.com.br','x-test-sub':'sub-renan-001'}
def post(path,body,h=hadm):
    rq=urllib.request.Request(B+path,data=json.dumps(body).encode(),method='POST',headers={'content-type':'application/json',**h})
    try: return 200,json.loads(urllib.request.urlopen(rq,timeout=60).read())
    except urllib.error.HTTPError as e: return e.code,{}
pk=json.load(open(D+'enx_pacote.json'))
def importar(prods):
    l=post('/api/adm/enxoval',{'op':'iniciar','formato':pk['formato'],'coletadoEm':pk['coletadoEm'],'total':len(prods)})[1]['lote']
    for i in range(0,len(prods),10): post('/api/adm/enxoval',{'op':'lote','lote':l,'itens':prods[i:i+10]})
    return post('/api/adm/enxoval',{'op':'concluir','lote':l})
importar(pk['produtos'])
run=uuid.uuid4().hex[:6]; U='rv%s@totvs.com.br'%run; hu={'x-test-user':U,'x-test-sub':'rv'+run}
ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers=hu); P=ctx.new_page(); errs=[]; P.on('pageerror',lambda e: errs.append(str(e))); P.route('**/*',route); P.on('dialog',lambda d: d.accept()); P.goto(B+'/'); P.wait_for_timeout(3500)
CLI="""(k,nome,seg,prod)=>{S.clients[k]={key:k,name:nome,cnpj:'11222333000181',city:'Curitiba',uf:'PR',productsRaw:prod,seg:seg,segment:seg,fichas:[],docs:[],mgmt:{},act:{},opps:[],src:{row:1}};runAnalysis(S.clients[k]);return 0}"""
carregar="async()=>{await enxCarregar(true);for(let i=0;i<50&&!ENX.idx;i++)await new Promise(r=>setTimeout(r,200));return ENX.meta.importadoEm}"
ev(P,"()=>{("+CLI+")('m1','Metalúrgica Boa Vista Ltda','Manufatura','Protheus');("+CLI+")('m2','Outra Indústria SA','Manufatura','Protheus');("+CLI+")('m3','Terceira Indústria SA','Manufatura','Protheus; Gestão de Armazém Avançada');return 0}")
v1=ev(P,carregar)
WMS='totvs-wms-linha-protheus'; MAN='totvs-manufatura-linha-protheus'
ativos=[q for q in pk['produtos'] if q.get('nv')!='inativo' and q['id'] not in (WMS,MAN)]; X=ativos[5]['id']; Y=ativos[9]['id']
for i in (WMS,MAN,X,Y): ev(P,"()=>{adMarcar('m1','%s','vinculada');return 0}"%i)
ck('vínculo guarda a versão do catálogo em que foi feito', ev(P,"()=>S.clients.m1.enxVinc['%s'].cat"%WMS)==v1 and bool(v1))
ck('com o mesmo catálogo, nenhum vínculo pede revisão', ev(P,"()=>eloRevN(S.clients.m1)")==0 and ev(P,"()=>eloRevAlerta(S.clients.m1)")=='')
# administrador reimporta com mudanças: WMS renomeado, X removido, Y inativado, MAN igual
novo=copy.deepcopy(pk['produtos']); novo=[q for q in novo if q['id']!=X]
for q in novo:
    if q['id']==WMS: q['n']='TOTVS Gestão de Armazéns WMS - Linha Protheus'
    if q['id']==Y: q['nv']='inativo'
import time; time.sleep(1.1)
r=importar(novo); ck('reimportação concluída pelo administrador', r[0]==200 and r[1].get('total')==len(novo), r[1].get('total'))
v2=ev(P,carregar); ck('executivo recebe a nova versão do catálogo', v2!=v1)
R=ev(P,"()=>Object.fromEntries(eloVincs(S.clients.m1).map(v=>[v.id,eloRev(S.clients.m1,v)]))")
ck('produto renomeado: vínculo pede revisão e informa o novo nome', R[WMS] and any('nome mudou' in m for m in R[WMS]['motivos']) and not R[WMS].get('fora'), R[WMS])
ck('produto removido do catálogo: vínculo sinalizado', R[X] and R[X]['fora'] and 'não está mais no catálogo' in R[X]['motivos'][0], R[X])
ck('produto inativado: vínculo sinalizado', R[Y] and R[Y]['fora'] and 'inativo' in R[Y]['motivos'][0], R[Y])
ck('produto sem mudança material não gera ruído', R[MAN] is None, R[MAN])
ck('nada foi alterado sozinho no cliente', ev(P,"()=>S.clients.m1.enxVinc['%s'].nome"%WMS)!='TOTVS Gestão de Armazéns WMS - Linha Protheus' and ev(P,"()=>Object.keys(S.clients.m1.enxVinc).length")==4)
ev(P,"()=>{UI.view='cliente';UI.sel='m1';UI.ctab='raiox';render();return 0}"); P.wait_for_timeout(600)
ck('ficha do cliente avisa quantos vínculos mudaram e leva à Gestão da conta', '3 solução(ões)' in ev(P,"()=>document.querySelector('#elo-rev')?.innerText||''"))
ev(P,"()=>{UI.ctab='gestao';render();return 0}"); P.wait_for_function("()=>document.querySelectorAll('#elo-vinc [data-rev]').length===3",timeout=8000)
ck('Gestão da conta mostra o motivo em cada vínculo e a ação adequada', ev(P,"()=>document.querySelectorAll('#elo-vinc [data-a=\"eloRevOk\"]').length")==1 and ev(P,"()=>document.querySelectorAll('#elo-vinc [data-rev] [data-a=\"adSoltar\"]').length")==2)
ev(P,"()=>{UI.view='oport';render();return 0}"); P.wait_for_timeout(500)
ck('Oportunidades marca os vínculos a revisar', ev(P,"()=>[...document.querySelectorAll('#elo-op .pill')].filter(e=>/revisar: catálogo mudou/.test(e.textContent)).length")==3)
ev(P,"()=>{UI.view='cliente';UI.sel='m1';UI.ctab='gestao';render();return 0}"); P.wait_for_timeout(400); P.click('#elo-vinc [data-a="eloRevOk"]'); P.wait_for_timeout(500)
ck('"Marcar como revisado": vínculo assume nome e versão atuais e o aviso some', ev(P,"()=>S.clients.m1.enxVinc['%s'].nome"%WMS)=='TOTVS Gestão de Armazéns WMS - Linha Protheus' and ev(P,"()=>S.clients.m1.enxVinc['%s'].cat"%WMS)==v2 and ev(P,"()=>eloRevN(S.clients.m1)")==2)
P.click('#elo-vinc [data-rev="%s"] [data-a="adSoltar"]'%X); P.wait_for_timeout(500)
ck('vínculo de produto removido pode ser desfeito mesmo sem o produto no catálogo', ev(P,"()=>!S.clients.m1.enxVinc['%s']"%X), ev(P,"()=>Object.keys(S.clients.m1.enxVinc)"))
ck('outro cliente, sem vínculos, não recebe aviso', ev(P,"()=>eloRevAlerta(S.clients.m2)")=='')
# nomes alternativos
cls=lambda k,i: ev(P,"()=>{const x=adCliente(S.clients['%s']).find(x=>x.p.id==='%s');return [x.cls,x.porque]}"%(k,i))
a0=cls('m3',WMS); n0=ev(P,"()=>adPossuiN(ENX.idx.find(p=>p.id==='%s'))"%WMS)
ck('sem nome alternativo: item da ficha com nome diferente não é reconhecido', a0[0]!='possui', a0)
s=ev(P,"()=>eloAliasSet('%s','<b>Gestão de Armazém</b>, ab, gestao de armazem; SIGAWMS,'+'x'.repeat(90))"%WMS)
ck('nomes alternativos saneados: sem marcação, sem repetidos, sem nomes curtos, limitados a 60 caracteres', s[0]=='bGestão de Armazém/b' or (len(s)==3 and all('<' not in x for x in s) and len(s[2])==60), s)
ev(P,"()=>{eloAliasSet('%s','Gestão de Armazém, SIGAWMS');return 0}"%WMS)
a1=cls('m3',WMS)
ck('com nome alternativo: cliente passa a "Já possui", com a origem declarada', a1[0]=='possui' and 'nome alternativo que você cadastrou' in a1[1] and 'planilha ou as fichas' in a1[1], a1)
ck('contagem "já possuem" do produto acompanha', ev(P,"()=>adPossuiN(ENX.idx.find(p=>p.id==='%s'))"%WMS)==n0+1)
ck('cliente sem o item continua recebendo a recomendação', cls('m2',WMS)[0]!='possui')
ev(P,"()=>{UI.view='portfolio';ptUI().aba='enx';enxAbrir('%s');return 0}"%WMS); P.wait_for_function("()=>!!document.querySelector('#elo-alias')",timeout=10000)
ck('ficha do produto traz o campo de nomes alternativos preenchido', ev(P,"()=>document.querySelector('#elo_al').value")=='Gestão de Armazém, SIGAWMS')
P.fill('#elo_al',''); P.click('[data-a="eloAliasSalvar"]'); P.wait_for_timeout(500)
ck('remover o nome alternativo desfaz o reconhecimento', cls('m3',WMS)[0]!='possui' and ev(P,"()=>!(S.meta.enxAlias||{})['%s']"%WMS))
P.fill('#elo_al','SIGAWMS'); P.click('[data-a="eloAliasSalvar"]'); P.wait_for_timeout(1500); P.wait_for_function("()=>!saving&&!dirtyMeta",timeout=10000)
rq=urllib.request.Request(B+'/api/db',data=json.dumps({'op':'get','path':'data/users/%s/carteira'%U}).encode(),method='POST',headers={'content-type':'application/json',**hu}); m=json.loads(urllib.request.urlopen(rq).read())['data']['meta']
ck('nomes alternativos gravados na carteira privada do executivo', m.get('enxAlias',{}).get(WMS)==['SIGAWMS'], m.get('enxAlias'))
# marcação manual "cliente já possui"
ev(P,"()=>{UI.view='cliente';UI.sel='m2';UI.ctab='portfolio';adUI().q='wms';render();return 0}"); P.wait_for_function("()=>!!document.querySelector('[data-a=\"adPossui\"][data-id=\"%s\"]')"%WMS,timeout=8000)
P.click('[data-a="adPossui"][data-id="%s"]'%WMS); P.wait_for_timeout(500)
a2=cls('m2',WMS)
ck('"Cliente já possui": sai das recomendações e explica que foi informado pelo executivo', a2[0]=='possui' and 'Você informou' in a2[1] and 'Não há item correspondente' in a2[1], a2)
ck('marcação manual não vira vínculo comercial nem aparece em Gestão/Oportunidades', ev(P,"()=>eloVincs(S.clients.m2).length")==0)
ev(P,"()=>{adUI().cls='possui';render();return 0}"); P.wait_for_timeout(400)
ck('a marcação pode ser desfeita', ev(P,"()=>!!document.querySelector('[data-a=\"adSoltar\"][data-id=\"%s\"]')"%WMS))
P.click('[data-a="adSoltar"][data-id="%s"]'%WMS); P.wait_for_timeout(400); ck('desfeita: volta a ser avaliada pelo motor', cls('m2',WMS)[0]!='possui')
ck('sem erros de página', not errs, errs[:3])
time.sleep(1.1); r=importar(pk['produtos']); ck('catálogo original restaurado para os demais testes', r[1].get('total')==273, r[1].get('total'))
p.stop(); print('FALHAS:',F) if F else print('OK t113')
