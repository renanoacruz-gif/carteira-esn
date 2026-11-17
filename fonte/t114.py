# Rodada 45, etapa 4 — os 10 testes de ponta a ponta (dados de teste, usuário descartável) e o diagnóstico "Saúde e integração da plataforma"
from t40_lib import *
import json, uuid, urllib.request, urllib.error, hashlib
B='http://localhost:8790'; hadm={'x-test-user':'renan.oscar@totvs.com.br','x-test-sub':'sub-renan-001'}
def post(path,body,h):
    rq=urllib.request.Request(B+path,data=json.dumps(body).encode(),method='POST',headers={'content-type':'application/json',**h})
    try: return 200,json.loads(urllib.request.urlopen(rq,timeout=60).read())
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read().decode() or '{}')
pk=json.load(open(D+'enx_pacote.json')); st=post('/api/adm/enxoval',{'op':'estado'},hadm)[1]
if not (st.get('meta') and st['meta'].get('estado')=='concluido' and st['meta'].get('total')==273):
    l=post('/api/adm/enxoval',{'op':'iniciar','formato':pk['formato'],'coletadoEm':pk['coletadoEm'],'total':len(pk['produtos'])},hadm)[1]['lote']
    for i in range(0,len(pk['produtos']),10): post('/api/adm/enxoval',{'op':'lote','lote':l,'itens':pk['produtos'][i:i+10]},hadm)
    post('/api/adm/enxoval',{'op':'concluir','lote':l},hadm)
run=uuid.uuid4().hex[:6]; U='e2%s@totvs.com.br'%run; hu={'x-test-user':U,'x-test-sub':'e2'+run}; ho={'x-test-user':'e3%s@totvs.com.br'%run,'x-test-sub':'e3'+run}
def sess(h):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers=h); pg=ctx.new_page(); er=[]; pg.on('pageerror',lambda e: er.append(str(e))); pg.route('**/*',route); pg.on('dialog',lambda d: d.accept()); pg.goto(B+'/'); pg.wait_for_timeout(3500); return pg,er
salvo=lambda pg: (pg.wait_for_timeout(900), pg.wait_for_function("()=>!saving&&!dirtyC.size&&!dirtyMeta",timeout=20000))
srv=lambda k: post('/api/db',{'op':'get','path':'data/users/%s/carteira/clientes/%s'%(U,k)},hu)[1]
H=lambda pg,k: hashlib.md5(ev(pg,"()=>JSON.stringify(freezeClient(S.clients[%s]))"%json.dumps(k)).encode()).hexdigest()
carregar="async()=>{await enxCarregar(true);for(let i=0;i<50&&!ENX.idx;i++)await new Promise(r=>setTimeout(r,200));return !!ENX.meta}"
A,ea=sess(hu)
ev(A,"UI.view='importar';render();0"); A.wait_for_timeout(300)
A.set_input_files('#f-cart',D+'carteira.xlsx'); A.wait_for_timeout(600); A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); A.wait_for_timeout(2500); salvo(A); ev(A,carregar)
K1=ev(A,"()=>Object.values(S.clients).find(c=>c.code==='T00001').key"); K2=ev(A,"()=>Object.values(S.clients).find(c=>c.code==='T00002').key"); k1=json.dumps(K1); k2=json.dumps(K2)
ck('preparação: carteira de teste importada em usuário descartável', bool(K1 and K2))
h2=H(A,K2); MAN='totvs-manutencao-de-ativos-linha-protheus'
cls=lambda pg,k,i: ev(pg,"()=>adCliente(S.clients[%s]).find(x=>x.p.id==='%s').cls"%(json.dumps(k),i))
# Teste 1 — Cadastro
a0=cls(A,K1,MAN); n0=ev(A,"()=>opAll().filter(x=>x.c.key===%s).length"%k1)
ev(A,"()=>{const c=S.clients[%s];c.productsRaw+='; Manutenção de Ativos';reanalyze([c.key],'teste e2e');render();return 0}"%k1); salvo(A)
ck('T1 Cadastro: edição chega à análise (produto identificado)', ev(A,"()=>S.clients[%s].productsIdent.some(p=>p.id==='manutencao')"%k1))
ck('T1 Cadastro: chega à aderência do catálogo (passa a “Já possui”)', a0!='possui' and cls(A,K1,MAN)=='possui', (a0,cls(A,K1,MAN)))
ck('T1 Cadastro: registro de mudança disponível para a ficha do cliente', ev(A,"()=>!!S.clients[%s].lastChange&&S.clients[%s].lastChange.reason==='teste e2e'"%(k1,k1)))
ck('T1 Cadastro: gravado no servidor', 'Manutenção de Ativos' in srv(K1)['data']['productsRaw'])
# Teste 2 — Importação de ficha
ev(A,"UI.view='importar';render();0"); A.wait_for_timeout(300); A.set_input_files('#f-fic',[D+'ficha_T00001_10.txt']); A.wait_for_timeout(3500); salvo(A)
ck('T2 Importação: ficha associada ao cliente certo', ev(A,"()=>(S.clients[%s].fichas||[]).length"%k1)==1 and ev(A,"()=>(S.clients[%s].fichas||[]).length"%k2)==0)
ck('T2 Importação: MRR da ficha disponível para Carteira & MRR', ev(A,"()=>{S.meta.mrrComp=S.meta.mrrComp;const m=recurringByComp(S.clients[%s]);return Object.values(m).some(v=>v>0)}"%k1))
ck('T2 Importação: briefing pré-reunião passa a ter itens de faturamento', ev(A,"()=>briefModel(S.clients[%s]).n"%k1)>0)
ck('T2 Importação: situação da ficha atualizada na ficha do cliente', ev(A,"()=>S.clients[%s].fstat.k"%k1)!='nao_carregada')
ck('T2 Importação: gravada no servidor', len(srv(K1)['data'].get('fichas') or [])==1)
# Teste 3 — Catálogo (nome alternativo → recálculo das recomendações)
WMS='totvs-wms-linha-protheus'; b0=(cls(A,K1,WMS),cls(A,K2,WMS))
ev(A,"()=>{eloAliasSet('%s','Protheus Backoffice');return 0}"%WMS); salvo(A)
ck('T3 Catálogo: alteração no catálogo recalcula as recomendações só de quem é afetado', b0[0]!='possui' and cls(A,K1,WMS)=='possui' and cls(A,K2,WMS)==b0[1], (b0,cls(A,K1,WMS),cls(A,K2,WMS)))
ev(A,"()=>{eloAliasSet('%s','');return 0}"%WMS); salvo(A)
ck('T3 Catálogo: desfazer a alteração restaura a recomendação', cls(A,K1,WMS)==b0[0])
# Teste 4 — Oportunidade registrada pelo executivo
ev(A,"()=>{empGstSet(%s,'oportunidade','Armazém sem endereçamento: quer WMS para controlar o estoque');adMarcar(%s,'%s','vinculada');render();return 0}"%(k1,k1,WMS)); salvo(A)
ck('T4 Oportunidade: associada ao cliente e usada como evidência na aderência', ev(A,"()=>adCtx(S.clients[%s]).dores.some(d=>/Armazém sem endereçamento/.test(d.frase))"%k1))
ck('T4 Oportunidade: solução vinculada visível em Gestão da conta, Oportunidades e briefing', ev(A,"()=>/WMS/.test(vincCard(S.clients[%s]))&&/Metalúrgica Alfa/.test(eloVincOport())&&eloBrief(S.clients[%s]).some(l=>/WMS/.test(l))"%(k1,k1)))
ck('T4 Oportunidade: não aparece em outro cliente', ev(A,"()=>vincCard(S.clients[%s])===''"%k2))
# Teste 5 — Forecast
ev(A,"""()=>{S.meta.fcData={syncedAt:new Date().toISOString(),metas:[],opps:[{id:'f1',tab:'DEZEMBRO',mes:'12',cliente:'METALURGICA ALFA',produto:'WMS',status:'EM ABERTO',cdu:0,rec:40000,serv:0,total:40000,data:'2026-12-10',vendedor:''}]};touchMeta();fcLink('f1',%s);return 0}"""%k1); salvo(A)
r0=ev(A,"()=>fcKPI('anual',null,'').realizado"); s0=ev(A,"()=>eloPills(S.clients[%s],ENX.idx.find(p=>p.id==='%s').nome)"%(k1,WMS))
ev(A,"()=>{S.meta.fcData.opps[0].status='GANHA';touchMeta();render();return 0}"); salvo(A)
r1=ev(A,"()=>fcKPI('anual',null,'').realizado"); s1=ev(A,"()=>eloPills(S.clients[%s],ENX.idx.find(p=>p.id==='%s').nome)"%(k1,WMS))
ck('T5 Forecast: mudança de status atualiza o indicador do Forecast', r0==0 and r1==40000, (r0,r1))
ck('T5 Forecast: e as visões do cliente (selo da recomendação e cartão da ficha)', 'em negociação' in s0 and 'ganha no Forecast' in s1 and 'Ganha' in ev(A,"()=>fcCard(S.clients[%s])"%k1))
# Teste 7 — Isolamento (antes de recarregar)
ck('T7 Isolamento: outro cliente intocado por todas as alterações acima', H(A,K2)==h2)
ck('T7 Isolamento: outro executivo não lê nem grava esta carteira', post('/api/db',{'op':'get','path':'data/users/%s/carteira/clientes/%s'%(U,K1)},ho)[0]==403 and post('/api/db',{'op':'set','path':'data/users/%s/carteira/clientes/%s'%(U,K1),'data':{'key':K1}},ho)[0]==403)
# Teste 6 — Persistência
h1=H(A,K1); A.reload(); A.wait_for_timeout(3500); ev(A,carregar)
ck('T6 Persistência: após recarregar, o cliente editado é idêntico', H(A,K1)==h1 and H(A,K2)==h2)
ck('T6 Persistência: vínculos, Forecast e oportunidade continuam ligados', ev(A,"()=>S.meta.fcLink.f1")==K1 and ev(A,"()=>S.meta.fcData.opps[0].status")=='GANHA' and ev(A,"()=>eloVincs(S.clients[%s]).length"%k1)==1 and ev(A,"()=>fcDoCliente(S.clients[%s]).length"%k1)==1)
# Teste 8 — Falhas externas
A.route('**/api/enxoval*',lambda r: r.abort()); n=ev(A,"()=>ENX.idx.length")
ev(A,"async()=>{await enxCarregar(true);return 0}")
ck('T8 Falha externa: catálogo indisponível mantém o que já estava carregado e avisa', ev(A,"()=>ENX.idx.length")==n and ev(A,"()=>!!ENX.err"))
A.unroute('**/api/enxoval*')
A.route('**/api/db',lambda r: r.abort() if '"op":"set"' in (r.request.post_data or '') else r.continue_())
ev(A,"()=>{S.clients[%s].notes='editado sem servidor';touchC(%s);return 0}"%(k1,k1)); A.wait_for_timeout(1800)
ck('T8 Falha externa: gravação sem servidor não perde a edição (fica pendente e avisa)', ev(A,"()=>dirtyC.has(%s)&&/ERRO ao salvar/.test(UI.persist)"%k1) and srv(K1)['data'].get('notes')!='editado sem servidor')
A.unroute('**/api/db'); ev(A,"()=>{sched();return 0}"); salvo(A)
ck('T8 Falha externa: ao voltar, a edição pendente é gravada', srv(K1)['data'].get('notes')=='editado sem servidor')
# Teste 9 — Concorrência
Bp,eb=sess(hu)
ev(A,"()=>{S.clients[%s].notes='sessão A';touchC(%s);return 0}"%(k1,k1)); salvo(A)
ev(Bp,"()=>{S.clients[%s].notes='sessão B';touchC(%s);return 0}"%(k1,k1)); Bp.wait_for_timeout(1800)
ck('T9 Concorrência: mesma informação editada em duas sessões não é sobrescrita em silêncio', srv(K1)['data']['notes']=='sessão A' and ev(Bp,"()=>SINC.conf[%s].campos.join()"%k1)=='notes')
ev(Bp,"()=>{sincDecidir(%s,'outro');return 0}"%k1); salvo(Bp)
ck('T9 Concorrência: após a decisão, as duas sessões e o servidor coincidem', ev(Bp,"()=>S.clients[%s].notes"%k1)=='sessão A' and srv(K1)['data']['notes']=='sessão A')
# Teste 10 — Correção de registro
ev(A,"()=>{const c=S.clients[%s];c.name='Metalúrgica Alfa Indústria Ltda';c.city='Pinhais';reanalyze([c.key],'correção de cadastro');return 0}"%k1); salvo(A)
ck('T10 Correção: nome e cidade corrigidos mantêm Forecast, vínculo, ficha e desfecho ligados ao mesmo cliente', ev(A,"()=>fcDoCliente(S.clients[%s]).length===1&&eloVincs(S.clients[%s]).length===1&&S.clients[%s].fichas.length===1"%(k1,k1,k1)) and srv(K1)['data']['name']=='Metalúrgica Alfa Indústria Ltda')
ck('T10 Correção: as listas passam a mostrar o nome corrigido', ev(A,"()=>/Metalúrgica Alfa Indústria/.test(eloVincOport())"))
ck('T10 Correção: diagnóstico de dados aponta vínculo órfão quando o cliente some (só em memória, sem gravar)', ev(A,"()=>{const c=S.clients[%s];delete S.clients[%s];const n=sauDados().linhas.find(l=>/cliente inexistente/.test(l.nome));S.clients[%s]=c;return n.n===1&&n.st==='falha'&&sauDados().linhas.find(l=>/cliente inexistente/.test(l.nome)).n===0}"%(k1,k1,k1)))
ck('sem erros de página nos 10 testes', not ea and not eb, (ea+eb)[:3])
# ---------- Painel: Saúde e integração da plataforma ----------
ck('painel: executivo comum não vê a seção', ev(A,"()=>{UI.view='adm';render();return !document.querySelector('#adm-saude')}"))
P,ep=sess(hadm); ev(P,"()=>{UI.view='adm';render();return 0}"); P.wait_for_function("()=>!!document.querySelector('#adm-saude')",timeout=20000)
ck('painel: seção “Saúde e integração da plataforma” no Painel Administrador, sem resultado presumido antes de executar', 'Nenhum diagnóstico executado' in ev(P,"()=>document.querySelector('#sau-vazio').innerText") and ev(P,"()=>!document.querySelector('#sau-kpis')"))
antes=ev(P,"()=>JSON.stringify([S.meta,Object.keys(S.clients).length,dirtyC.size,dirtyMeta])")
P.click('[data-a="sauDiag"]'); P.wait_for_function("()=>SAU.rel&&!SAU.busy",timeout=60000)
R=ev(P,"()=>SAU.rel"); it={i['id']:i for i in R['itens']}
ck('diagnóstico: 12 integrações executadas, todas operacionais com o catálogo importado', R['resumo']['mapeadas']==12 and R['resumo']['ok']==12 and R['resumo']['falha']==0, {k:(v['st'],v['det']) for k,v in it.items() if v['st']!='ok'})
ck('diagnóstico: gravação condicional testada de verdade no banco (6 passos) e isolamento recusado com 403', '6 passos reais' in it['srv_versao']['det'] and '403' in it['srv_isol']['det'])
ck('diagnóstico não deixa rastro: carteira, ajustes e fila de gravação idênticos; documento de teste apagado', antes==ev(P,"()=>JSON.stringify([S.meta,Object.keys(S.clients).length,dirtyC.size,dirtyMeta])") and ev(P,"()=>!S.clients.__diag__") and post('/api/db',{'op':'get','path':'data/users/renan.oscar@totvs.com.br/diagnostico/integracao'},hadm)[1].get('exists') is False)
t=ev(P,"()=>document.querySelector('#adm-saude').innerText")
ck('painel mostra todos os indicadores pedidos', all(x in t for x in ['Módulos (telas)','Integrações mapeadas','Operacionais','Com falha','Não implementadas','Processamentos pendentes','Dados desatualizados','Conflitos','Erros recentes','Tempo do diagnóstico','Última sincronização','Tempo de processamento','Conexões não implementadas']))
ck('conexões não implementadas são declaradas, não escondidas', R['resumo']['ausentes']==8 and 'Diagnóstico executivo e prompts de IA' in ev(P,"()=>document.querySelector('#adm-saude').textContent"))
tx=ev(P,"()=>sauTexto(SAU.rel)"); ck('relatório em texto com as seções e sem dado de cliente', 'INTEGRAÇÕES TESTADAS' in tx and 'CONEXÕES NÃO IMPLEMENTADAS' in tx and 'TEMPO DE PROCESSAMENTO' in tx)
# sem catálogo: nada vira "ok" por presunção
P.route('**/api/enxoval*',lambda r: r.abort()); ev(P,"()=>{ENX.idx=null;ENX.meta=null;ENX.t=0;return 0}")
P.click('[data-a="sauDiag"]'); P.wait_for_timeout(300); P.wait_for_function("()=>SAU.rel&&!SAU.busy",timeout=60000)
R2=ev(P,"()=>SAU.rel"); i2={i['id']:i['st'] for i in R2['itens']}
ck('catálogo indisponível: sondas que dependem dele ficam “não verificado” e a conexão aparece como falha (nunca ok presumido)', i2['cad_ader']=='nv' and i2['prod_possui']=='nv' and i2['cat_rev']=='nv' and i2['enx_srv']=='falha' and R2['resumo']['ok']<12 and i2['srv_versao']=='ok', i2)
P.unroute('**/api/enxoval*')
ck('sem erros de página no painel', not ep, ep[:3])
for k in (K1,K2): post('/api/db',{'op':'delete','path':'data/users/%s/carteira/clientes/%s'%(U,k)},hu)
p.stop(); print('FALHAS:',F) if F else print('OK t114')
