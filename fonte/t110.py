# Motor de aderência cliente × solução sobre o Catálogo Enxoval; recomendações e vínculo na ficha do cliente
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
post('/api/adm/enxoval',{'op':'pesos','pesos':{'processos':25,'dor':20,'tecnologica':20,'setorial':15,'estrategico':10,'viabilidade':10}})
run=uuid.uuid4().hex[:6]; hu={'x-test-user':'ad%s@totvs.com.br'%run,'x-test-sub':'ad'+run}
ck('executivo comum não altera os pesos do motor', post('/api/adm/enxoval',{'op':'pesos','pesos':{'processos':100,'dor':0,'tecnologica':0,'setorial':0,'estrategico':0,'viabilidade':0}},hu)[0] in (401,403))
ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers=hu); P=ctx.new_page(); errs=[]; P.on('pageerror',lambda e: errs.append(str(e))); P.route('**/*',route); P.on('dialog',lambda d: d.accept()); P.goto(B+'/'); P.wait_for_timeout(3500)
CLI="""(k,nome,seg,prod)=>{S.clients[k]={key:k,name:nome,cnpj:'11222333000181',city:'Curitiba',uf:'PR',productsRaw:prod,seg:seg,segment:seg,fichas:[],docs:[],mgmt:{},act:{},opps:[],src:{row:1}};runAnalysis(S.clients[k]);return 0}"""
ev(P,"async()=>{("+CLI+")('m1','Metalúrgica Boa Vista Ltda','Manufatura','Protheus; Manutenção de Ativos');("+CLI+")('z1','Empresa Sem Dados','','');await enxCarregar(true);for(let i=0;i<50&&!ENX.idx;i++)await new Promise(r=>setTimeout(r,200));return ENX.idx.length}")
R=json.loads(ev(P,"""()=>{const c=S.clients.m1,all=adCliente(c),g=id=>all.find(x=>x.p.id===id),f=x=>x&&({cls:x.cls,ad:x.ad,cob:x.cob,conf:x.conf,blk:!!x.bloqueio,d:Object.fromEntries(x.dims.map(d=>[d.k,d.nota])),m:Object.fromEntries(x.dims.map(d=>[d.k,d.motivo])),pq:x.porque});const cnt={};all.forEach(x=>cnt[x.cls]=(cnt[x.cls]||0)+1);
 return JSON.stringify({n:all.length,cnt,mp:f(g('totvs-manufatura-linha-protheus')),md:f(g('totvs-manufatura-linha-datasul')),ma:f(g('totvs-manutencao-de-ativos-linha-protheus')),ho:f(g('totvs-hotelaria-pos')),seg1:(all.find(x=>x.cls==='investigar'&&x.dims.find(d=>d.k==='setorial').nota===100&&(x.dims.find(d=>d.k==='processos').nota??0)<60)||{}).porque||'',inat:all.some(x=>x.p.nivel==='inativo'),top:all.sort(adRank).slice(0,3).map(x=>x.p.nome),soSeg:all.filter(x=>(x.cls==='alta'||x.cls==='condicional')&&(x.d=Object.fromEntries(x.dims.map(d=>[d.k,d.nota])),(x.d.processos??0)<60&&(x.d.dor??0)<60)).length})}"""))
ck('motor avalia os 261 produtos ativos do catálogo (inativos ficam fora)', R['n']==261 and not R['inat'], R['n'])
mp=R['mp']; ck('Manufatura Linha Protheus para indústria em Protheus: alta aderência potencial, com setor, linha e processo', mp['cls']=='alta' and mp['d']['setorial']==100 and mp['d']['tecnologica']==100 and mp['d']['processos']>=60, mp)
ck('três indicadores separados e coerentes: aderência só sobre critérios com informação; cobertura = soma dos pesos conhecidos', mp['cob']==sum({'processos':25,'dor':20,'tecnologica':20,'setorial':15,'estrategico':10,'viabilidade':10}[k] for k,v in mp['d'].items() if v is not None) and mp['conf'] in ('alta','media','baixa') and 0<=mp['ad']<=100, mp)
ck('critério sem dado fica "sem informação" (nulo), não zero', mp['d']['dor'] is None and 'Nenhuma dor' in mp['m']['dor'] and mp['d']['estrategico'] is None)
ck('aderência recalculável à mão: média ponderada das notas conhecidas', mp['ad']==round(sum({'processos':25,'dor':20,'tecnologica':20,'setorial':15,'estrategico':10,'viabilidade':10}[k]*v for k,v in mp['d'].items() if v is not None)/mp['cob']), mp)
md=R['md']; ck('BLOQUEIO: mesma solução na Linha Datasul → não recomendada, mesmo com setor 100', md['cls']=='nao_rec' and md['blk'] and md['d']['setorial']==100 and 'Bloqueio técnico' in md['pq'], md)
ck('produto que o cliente já tem aparece como "Já possui", não como oportunidade nova', R['ma']['cls']=='possui' and 'ampliação de uso' in R['ma']['pq'], R['ma'])
ck('produto de outro segmento não é recomendado', R['ho']['cls'] in ('baixa','insuf','investigar') and R['ho']['d']['setorial']==0, R['ho'])
ck('segmento sozinho nunca vira recomendação forte: nenhuma "alta/condicional" existe sem processo ou dor', R['soSeg']==0 and R['seg1'] and 'Só o segmento' in R['seg1'], (R['soSeg'],R['seg1']))
ck('motor nunca atribui "aderência confirmada" sozinho', 'confirmada' not in R['cnt'], R['cnt'])
Z=json.loads(ev(P,"()=>{const all=adCliente(S.clients.z1),cnt={};all.forEach(x=>cnt[x.cls]=(cnt[x.cls]||0)+1);return JSON.stringify({cnt,rec:all.filter(x=>AD_REC.includes(x.cls)).length})}"))
ck('cliente sem segmento, linha nem dados: tudo "Dados insuficientes", zero recomendação inventada', Z['rec']==0 and set(Z['cnt'])<={'insuf','baixa'} and Z['cnt'].get('insuf',0)>200, Z)
# dor registrada pelo executivo muda a nota e a confiança
D0=json.loads(ev(P,"""()=>{const c=S.clients.m1;const antes=adCliente(c).find(x=>x.p.id==='totvs-wms-linha-protheus');c.gst={oportunidade:'Armazém sem endereçamento: quer WMS para controlar o estoque'};const dep=adCliente(c).find(x=>x.p.id==='totvs-wms-linha-protheus');const f=x=>({cls:x.cls,ad:x.ad,cob:x.cob,conf:x.conf,dor:x.dims.find(d=>d.k==='dor').nota,m:x.dims.find(d=>d.k==='dor').motivo});return JSON.stringify({a:f(antes),d:f(dep)})}"""))
ck('dor anotada por você entra como evidência citada e aumenta cobertura', D0['a']['dor'] is None and D0['d']['dor']>=60 and D0['d']['cob']==D0['a']['cob']+20 and 'Armazém sem endereçamento' in D0['d']['m'], D0)
# ficha do cliente
ev(P,"()=>{S.clients.m1.gst=null;UI.view='cliente';UI.sel='m1';UI.ckey='m1';UI.ctab='raiox';render();return 0}"); P.wait_for_timeout(600)
if not ev(P,"()=>!!document.querySelector('#ad-res')"): ev(P,"()=>{for(const k of ['cur','client','key','cli']){UI[k]='m1'}render();return Object.keys(UI).join(',')}")
P.wait_for_function("()=>!!document.querySelector('#ad-res')",timeout=8000)
tx=ev(P,"()=>document.querySelector('#ad-res').innerText")
ck('ao abrir o cliente, o cartão "Soluções recomendadas" aparece com as mais aderentes', 'Soluções recomendadas' in tx and 'TOTVS Manufatura - Linha Protheus' in tx and 'Aderência' in tx and 'Cobertura' in tx and 'Confiança' in tx, tx[:300])
ck('cartão mostra no máximo 3 recomendações e avisa que não é promessa', ev(P,"()=>document.querySelectorAll('#ad-res .ad-row').length")==3 and 'não promessa de aderência' in tx)
ck('produto bloqueado ou já contratado não aparece entre as recomendadas', 'Datasul' not in tx and 'Manutenção de Ativos - Linha Protheus' not in tx)
P.click('#ad-res [data-a="adVinc"]'); P.wait_for_timeout(400)
v=ev(P,"()=>S.clients.m1.enxVinc"); pid=list(v.keys())[0]
ck('"Vincular ao cliente" grava o vínculo com data, aderência e cobertura do momento', v[pid]['st']=='vinculada' and v[pid]['ad'] is not None and v[pid]['cob']>0 and v[pid]['nome'], v)
ck('vinculada sobe para "Vinculadas por você" no cartão', 'Vinculadas por você (1)' in ev(P,"()=>document.querySelector('#ad-res').innerText"))
ck('vínculo é persistido com o cliente', ev(P,"()=>{const o=freezeClient(S.clients.m1);return !!(o.enxVinc&&Object.keys(o.enxVinc).length===1)}"))
P.click('#ad-res [data-a="ctab"][data-v="portfolio"]'); P.wait_for_function("()=>!!document.querySelector('#ad-tab')",timeout=8000)
tt=ev(P,"()=>document.querySelector('#ad-tab').innerText")
ck('aba Portfólio do cliente: lista completa com filtros pelas 7 classes + "Já possui"', all(k in tt for k in ['Vinculadas a este cliente (1)','Recomendadas','Alta aderência potencial','Aderência condicional','Investigar','Baixa aderência','Não recomendada','Dados insuficientes','Já possui']), tt[:200])
ck('aba mostra os pesos em uso e explica "sem informação"', 'Pesos:' in tt and '25' in tt and 'não como zero' in tt)
ck('Portfólio antigo (soluções da Base) continua abaixo, preservado', ev(P,"()=>/Portfólio TOTVS neste cliente/.test(document.querySelector('main').innerText)"))
det=ev(P,"()=>{const d=document.querySelector('#ad-tab .ad-row details');d.open=true;return d.innerText}")
ck('cada recomendação abre critérios com nota, peso e evidência, e perguntas de descoberta', all(k in det for k in ['Aderência aos processos','Necessidade ou dor comprovada','Aderência tecnológica','peso 25','sem informação','Perguntas de descoberta','Aderência não é probabilidade de fechamento']), det[:300])
ck('perguntas não pressupõem dor', 'Como vocês executam hoje' in det and 'Há etapas manuais ou retrabalho' in det)
P.click('#ad-tab [data-a="adValidar"]'); P.wait_for_timeout(400)
ck('"Confirmar aderência" (decisão sua, com aviso) é o único caminho para "Aderência confirmada"', ev(P,"()=>{const id='%s';return S.clients.m1.enxVinc[id].st==='validada' && adCliente(S.clients.m1).find(x=>x.p.id===id).cls==='confirmada'}"%pid))
P.click('#ad-tab [data-a="adSemana"]'); P.wait_for_timeout(300)
ck('"Levar para a semana" cria a próxima ação do cliente', ev(P,"()=>/^Conversa de descoberta: /.test(S.clients.m1.gst.proximaAcao) && /^\\d{4}-\\d{2}-\\d{2}$/.test(S.clients.m1.gst.dataAcao)"))
P.click('#ad-tab [data-a="adSoltar"]'); P.wait_for_timeout(300); ck('desvincular remove o vínculo', ev(P,"()=>Object.keys(S.clients.m1.enxVinc).length")==0)
P.click('#ad-tab [data-a="adDesc"]'); P.wait_for_timeout(300)
ck('descartar tira o produto das recomendadas e explica por quê', ev(P,"()=>{const id=Object.keys(S.clients.m1.enxVinc)[0],x=adCliente(S.clients.m1).find(y=>y.p.id===id);return x.cls==='nao_rec' && /Você descartou/.test(x.porque)}"))
P.click('#ad-tab [data-a="adCls"][data-v="nao_rec"]'); P.wait_for_timeout(300)
ck('filtro "Não recomendada" mostra bloqueios técnicos com o motivo', 'Bloqueio técnico' in ev(P,"()=>document.querySelector('#ad-tab').innerText"))
P.click('#ad-tab [data-a="adFicha"]'); P.wait_for_function("()=>!!document.querySelector('#enx-ficha')",timeout=10000)
ck('"Ver ficha" abre o produto no Catálogo Enxoval', ev(P,"()=>UI.view==='portfolio' && ptUI().aba==='enx'"))
# pesos configuráveis mudam a conta de forma previsível
ev(P,"()=>{ENX.pesos={processos:0,dor:0,tecnologica:0,setorial:100,estrategico:0,viabilidade:0};return 0}")
ck('pesos do administrador entram no cálculo (só setor: aderência = nota setorial; cobertura = 100)', json.loads(ev(P,"()=>{const x=adCliente(S.clients.m1).find(y=>y.p.id==='totvs-manufatura-linha-protheus');return JSON.stringify([x.ad,x.cob])}"))==[100,100])
ev(P,"()=>{ENX.pesos={processos:50,dor:50,tecnologica:10,setorial:0,estrategico:0,viabilidade:0};return 0}")
ck('pesos inválidos (não somam 100) são ignorados: volta ao padrão', ev(P,"()=>adPesos().processos")==25)
ck('sem erros de página', not errs, errs[:2])
print('RESULT t110:', 'FALHAS '+str(F) if F else 'TUDO OK'); p.stop()
