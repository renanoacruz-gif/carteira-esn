from t40_lib import *
import uuid, datetime
email='dt%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]')
R=lambda js,a=None: pg.evaluate(js,a)
K='c_T00001'; T=datetime.date.today()
f=lambda n: (T+datetime.timedelta(days=n)).strftime('%d/%m/%Y'); iso=lambda n: (T+datetime.timedelta(days=n)).isoformat()
def ficha(items):
    pg.evaluate("""(a)=>{const c=S.clients[a.k]; c.fichas=[{id:'fx'+(window.__n=(window.__n||0)+1),file:'ficha_x.xlsx',comp:'2026-10',state:'vinculado',items:a.i.map((d,j)=>({desc:d,vals:[1000],vi:0,comp:'2026-10',kind:classifyItem(d),loc:'linha '+(j+2)}))}]; reanalyze([a.k]);}""",{'k':K,'i':items})
def conf(i,v,nota='conferido'):
    R("a=>{for(const p of ['dtd_','dtn_']){document.querySelectorAll('#'+p+a.i).forEach(e=>e.remove())};document.body.insertAdjacentHTML('afterbegin','<input id=\"dtd_'+a.i+'\" type=\"text\" value=\"'+a.v+'\"><input id=\"dtn_'+a.i+'\" value=\"'+a.n+'\">');dtConfirmar(a.k,a.i)}",{'k':K,'i':i,'v':v,'n':nota})
lst=lambda: R("k=>(S.clients[k].dtList||[]).map(g=>({kind:g.kind,iso:g.iso,st:g.st,k:g.key,d:g.desc}))",K)
opp=lambda: R("k=>S.clients[k].opps.filter(o=>/^dt_/.test(o.ruleId)).map(o=>({id:o.ruleId,modo:o.modo,cl:rxClass(S.clients[k],o).cl,orig:o.origemTipo,pr:o.problema}))",K)
ficha(['Licença Protheus Financeiro vigência até %s'%f(60),
       'Assinatura Fluig renovação do contrato em %s'%f(100),
       'Competência 10/2026 Licença Protheus Compras',
       'Cobrança com vencimento da fatura em %s boleto'%f(5),
       'Hospedagem Cloud referente a 09/2026',
       'Treinamento sem data'])
L=lst(); kinds=sorted(x['kind'] for x in L)
ck('data com vigência e com renovação são encontradas', kinds==['renovacao','vigencia'], L)
ck('competência de faturamento NÃO vira vigência', not any('Competência 10/2026' in x['d'] or 'referente' in x['d'] for x in L), L)
ck('vencimento de fatura/boleto NÃO vira vigência', not any('boleto' in x['d'] for x in L), L)
ck('sem confirmação: nenhum alerta/oportunidade (só “encontrada”)', all(x['st']=='encontrada' for x in L) and opp()==[], opp())
ck('pendência pede confirmação das datas no Raio-X', R("k=>ctxLacunas(S.clients[k]).some(x=>/Confirmar 2 data/.test(x.falta))",K))
# confirmar
vig=[x for x in L if x['kind']=='vigencia'][0]
ck('data interpretada correta (ISO)', vig['iso']==iso(60), vig)
conf(vig['k'],iso(60),'conferido no contrato')
o=opp(); ck('data confirmada dentro da janela → 1 gatilho (investigação, nunca prioridade)', len(o)==1 and o[0]['modo']=='investigacao' and o[0]['cl']=='investigar' and o[0]['orig']==['Ciclo de vida'], o)
ck('texto não presume renegociação/risco', o and 'não indica, por si só, renegociação' in o[0]['pr'], o)
ck('outra data (renovação) segue sem alerta enquanto não confirmada', len(opp())==1)
# datas inválidas na confirmação
ren=[x for x in lst() if x['kind']=='renovacao'][0]
conf(ren['k'],'2026-02-31')
ck('confirmação com data inexistente é recusada', [x['st'] for x in lst() if x['k']==ren['k']]==['encontrada'])
# data corrigida pelo executivo (fora da janela) → sem alerta
conf(ren['k'],iso(400))
ck('confirmada fora da janela (400 dias) → sem gatilho', len(opp())==1 and R("k=>S.clients[k].dtList.find(g=>g.kind==='renovacao').isoF",K)==iso(400))
# passada
conf(ren['k'],iso(-10))
ck('confirmada já passada → sem oportunidade; pede confirmação da situação', len(opp())==1 and R("k=>ctxLacunas(S.clients[k]).some(x=>/já passada/.test(x.falta))",K))
# ignorar
R("a=>dtMarcar(a.k,a.i,'ignorada')",{'k':K,'i':ren['k']}); ck('“não é vigência” remove a pendência', not R("k=>ctxLacunas(S.clients[k]).some(x=>/Confirmar \\d+ data/.test(x.falta))",K))
# desfazer
R("a=>dtMarcar(a.k,a.i,'encontrada')",{'k':K,'i':vig['k']}); ck('desfazer confirmação remove o gatilho', opp()==[])
# desconto: reaproveita fs_desc existente (sem duplicar)
ficha(['Desconto promocional Fluig válido até %s'%f(20)])
d=[x for x in lst() if x['kind']=='desconto']
ck('desconto com validade é encontrado', len(d)==1, lst())
fsd=R("k=>S.clients[k].opps.filter(o=>/^fs_desc_/.test(o.ruleId)).length",K)
conf(d[0]['k'],iso(20))
ck('desconto confirmado NÃO duplica a oportunidade de desconto (B); anexa evidência', R("k=>S.clients[k].opps.filter(o=>/^dt_/.test(o.ruleId)).length",K)==0 and R("k=>{const o=S.clients[k].opps.find(o=>/^fs_desc_/.test(o.ruleId));return !!o&&o.dtConfirmada&&o.evInd.some(e=>/confirmada por você/.test(e.text))}",K) and fsd==1)
# documento (contrato) com data
R("k=>{const c=S.clients[k];c.cdocs=[{id:'cd1',name:'contrato_x.txt',state:'confirmado',hash:'h1',text:'CLÁUSULA 3. A vigência deste contrato termina em %s. A fatura vence em %s.'}];reanalyze([k])}"%(f(45),f(9)),K)
g=[x for x in lst() if x['kind']=='vigencia' and 'contrato' in x['d'].lower()]; ck('documento: vigência encontrada; vencimento de fatura ignorado', len(g)==1 and g[0]['iso']==iso(45) and not any(x['iso']==iso(9) for x in lst()), lst())
# alertas existentes preservados + painel
R("k=>{const c=S.clients[k];c.contratos=[{id:'ct1',ident:'CT-1',proxRenov:{v:'%s',st:'confirmado'}}];reanalyze([k])}"%iso(30),K)
ck('lembrete contratual estruturado continua funcionando', R("k=>ctReminders(S.clients[k]).some(x=>x.nivel==='alerta')",K))
ev(pg,"UI.view='geral';render();0"); pg.wait_for_timeout(300)
t=R("document.getElementById('app').innerText").lower()
ck('painel mostra Lembretes contratuais e Gatilhos de data', 'lembretes contratuais internos' in t and 'gatilhos de data' in t and 'só data confirmada por você gera alerta' in t)
# persistência
pg.wait_for_timeout(3000); n=R("Object.keys(S.clients['%s'].dtConf||{}).length"%K); pg.reload(); pg.wait_for_timeout(3500)
ck('confirmações persistem após recarregar', R("Object.keys(S.clients['%s'].dtConf||{}).length"%K)==n and n>=2, n)
ck('sem erros de página', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
