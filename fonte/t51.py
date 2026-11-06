from t40_lib import *
import uuid
email='fs%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]'); pg.wait_for_timeout(1500)
K="c_T00001"
def setf(items_by_comp):
    js="""(arg)=>{const c=S.clients[arg.k]; c.fichas=arg.f.map((x,i)=>({id:'f'+i,file:'ficha_'+x.comp+'.xlsx',comp:x.comp,state:'vinculado',items:x.items.map((it,j)=>({desc:it[0],vals:[it[1]],vi:0,comp:x.comp,kind:classifyItem(it[0]),loc:'linha '+(j+2)}))}));
    analyzeClient(c,S); return c.opps.filter(o=>/^fs_/.test(o.ruleId)).map(o=>({id:o.ruleId,nome:o.nome,modo:o.modo,ev:o.evInd.length,cl:rxClass(c,o).cl,orig:o.origemTipo,cen:(o.cenarios||[]).length,prob:o.problema}))}"""
    return pg.evaluate(js,{'k':K,'f':items_by_comp})
def lac():
    return pg.evaluate("k=>ctxLacunas(S.clients[k]).map(x=>x.falta)",K)
# 1) uma ficha, excedente uma vez
r=setf([{'comp':'2026-10','items':[['Licença Protheus Financeiro',1200],['Excedente de usuários Fluig',300]]}])
ck('ficha única: excedente NÃO vira oportunidade', not [x for x in r if x['id'].startswith('fs_exc')], r)
ck('ficha única: pendência pede mais competências', any('mais competências' in x for x in lac()), lac())
# 2) excedente em 2 competências
r=setf([{'comp':'2026-09','items':[['Licença Protheus Financeiro',1200],['Excedente de usuários Fluig',280]]},{'comp':'2026-10','items':[['Licença Protheus Financeiro',1200],['Excedente de usuários Fluig',300]]}])
e=[x for x in r if x['id'].startswith('fs_exc')]
ck('excedente em 2 competências gera 1 investigação', len(e)==1 and e[0]['modo']=='investigacao', r)
ck('mostra as 2 competências como evidência', e and e[0]['ev']==2, e)
ck('não afirma upgrade: texto ressalva', e and 'não comprova' in e[0]['prob'])
ck('origem = Sinal de faturamento', e and e[0]['orig']==['Sinal de faturamento'], e)
ck('classe = investigar (nunca prioridade)', e and e[0]['cl']=='investigar', e)
ck('cenários presentes', e and e[0]['cen']>=3)
ck('pendência de ficha única some', not any('mais competências' in x for x in lac()), lac())
# 3) cancelado
r=setf([{'comp':'2026-10','items':[['Licença Protheus Financeiro',1200],['Módulo Ponto Eletrônico - CANCELADO',-0.0001+450]]}])
c_=[x for x in r if x['id'].startswith('fs_canc')]
ck('item cancelado gera investigação', len(c_)==1 and c_[0]['modo']=='investigacao', r)
ck('cancelado: não presume recuperação', c_ and 'não comprova' in c_[0]['prob'])
# 4) desconto com e sem data
r=setf([{'comp':'2026-10','items':[['Licença Protheus Financeiro',1200],['Desconto promocional válido até 31/12/2026',-200],['Desconto comercial',-100]]}])
d=[x for x in r if x['id'].startswith('fs_desc')]
ck('só o desconto COM data gera oportunidade', len(d)==1, r)
ck('desconto sem vigência vira pendência', any('Vigência dos descontos' in x for x in lac()), lac())
ev_txt=pg.evaluate("k=>S.clients[k].opps.find(o=>/^fs_desc/.test(o.ruleId)).evInd[0].text",K)
ck('mostra data do documento E data interpretada', '31/12/2026' in ev_txt and 'interpretada' in ev_txt, ev_txt)
r2=pg.evaluate("[fsDatas('Mensalidade renovada em 15/03/2026'), fsDatas('Competência 10/2026 total'), fsDatas('Desconto até 31/02/2026'), fsDatas('Promoção válida até 10/2027')].map(a=>a.map(x=>x.iso+':'+x.tipo.join('+')))")
ck('competência/cobrança não vira data de vigência; data inválida rejeitada; mês/ano aceito com dia ausente', r2[0]==['2026-03-15:renovacao'] and r2[1]==[] and r2[2]==[] and r2[3]==['2027-10-31:desconto+vigencia'], r2)
# 5) variação
r=setf([{'comp':'2026-09','items':[['Licença Protheus Financeiro',1200],['Assinatura Fluig Plataforma',900]]},{'comp':'2026-10','items':[['Licença Protheus Financeiro',1200]]}])
v=[x for x in r if x['id']=='fs_var']
ck('item que saiu entre competências gera variação', len(v)==1 and 'ficha parcial' in v[0]['prob'] , r)
# 6) sem ficha
r=setf([])
ck('cliente sem ficha: nenhuma oportunidade de ficha e nenhuma pendência de ficha', not r and not any('descontos' in x or 'competências' in x for x in lac()), (r,lac()))
# 7) idempotência / ids estáveis
a1=setf([{'comp':'2026-09','items':[['Excedente de usuários Fluig',280]]},{'comp':'2026-10','items':[['Excedente de usuários Fluig',300]]}]); b1=setf([{'comp':'2026-09','items':[['Excedente de usuários Fluig',280]]},{'comp':'2026-10','items':[['Excedente de usuários Fluig',300]]}])
ck('ids estáveis entre reanálises', [x['id'] for x in a1]==[x['id'] for x in b1] and len(a1)==1, (a1,b1))
# 8) UI: cenários + origem no cartão da oportunidade
h=pg.evaluate("k=>{const c=S.clients[k];const o=c.opps.find(o=>/^fs_/.test(o.ruleId));return o?oppCard(c,o):''}",K)
ck('cartão exibe Origem e Cenários a validar', 'Sinal de faturamento' in h and 'Cenários a validar' in h, h[:150])
ck('sem erros de página', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
