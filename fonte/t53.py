from t40_lib import *
import uuid
email='rl%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]'); pg.wait_for_timeout(1500)
K='c_T00001'
ck('catálogo nasce sem relações (nenhuma inventada)', ev(pg,"S.solutions.every(s=>!(s.complementos||[]).length)"))
ids=pg.evaluate("()=>({pr:S.solutions.find(s=>/protheus/i.test(s.nome)&&s.id==='protheus')?.id, fl:S.solutions.find(s=>s.id==='fluig')?.id, tf:S.solutions.find(s=>s.id==='antecipa')?.id})")
print(ids)
def ficha(items):
    pg.evaluate("""(a)=>{const c=S.clients[a.k]; c.fichas=[{id:'fx'+(window.__n=(window.__n||0)+1),file:'ficha_x.xlsx',comp:'2026-10',state:'vinculado',items:a.i.map((d,j)=>({desc:d,vals:[1000],vi:0,comp:'2026-10',kind:classifyItem(d),loc:'linha '+(j+2)}))}]; reanalyze([a.k]);}""",{'k':K,'i':items})
def opps(): return pg.evaluate("k=>S.clients[k].opps.filter(o=>/^rel_/.test(o.ruleId)).map(o=>({id:o.ruleId,modo:o.modo,orig:o.origemTipo,cl:rxClass(S.clients[k],o).cl,pr:o.problema}))",K)
# a) validações do cadastro
pg.evaluate("(a)=>relAdd(a.pr,{para:a.fl,processo:'',just:''})",ids); 
ck('relação sem processo/fonte é rejeitada', ev(pg,"(S.solutions.find(s=>s.id==='protheus').complementos||[]).length")==0 and ev(pg,"UI.relErr&&UI.relErr.e.length")>=2, ev(pg,"UI.relErr"))
pg.evaluate("(a)=>relAdd(a.pr,{para:a.pr,processo:'x',just:'y'})",ids); ck('não aceita complemento de si mesma', ev(pg,"(S.solutions.find(s=>s.id==='protheus').complementos||[]).length")==0)
# b) cliente com núcleo, relação inexistente → nada
ficha(['Licença Protheus Financeiro']); ck('sem relação cadastrada: nenhuma indicação de complemento', opps()==[], opps())
# c) relação validada pelo executivo
pg.evaluate("(a)=>relAdd(a.pr,{para:a.fl,processo:'Aprovação de pagamentos fora do ERP',condicoes:'Aprovações por e-mail',dependencias:'Projeto de integração',fonteU:'https://tdn.totvs.com/x',fonteT:'TDN teste'})",ids)
r=opps(); ck('relação VALIDADA + núcleo em ficha → 1 indicação investigar', len(r)==1 and r[0]['modo']=='investigacao' and r[0]['cl']=='investigar' and r[0]['orig']==['Complemento de solução'], r)
ck('texto não afirma necessidade nem integração', r and 'não prova necessidade nem integração' in r[0]['pr'], r)
# d) cliente SEM o núcleo documentado → nada
ficha(['Hospedagem Cloud']); ck('sem o núcleo em ficha: sem indicação', opps()==[], opps())
# e) já tem o complemento → nada
ficha(['Licença Protheus Financeiro','Assinatura Fluig Plataforma']); ck('complemento já identificado: sem indicação', opps()==[], opps())
# f) sugestão automática fica pendente e não gera indicação
ficha(['Licença Protheus Financeiro'])
n=pg.evaluate("(a)=>relSugerir(a.pr,[{para:a.tf,processo:'Antecipação de recebíveis'}],'ia')",ids)
st=ev(pg,"S.solutions.find(s=>s.id==='protheus').complementos.map(x=>x.status+':'+x.origem)")
ck('sugestão da IA entra PENDENTE', n==1 and 'pendente:ia' in st, st)
ck('relação pendente não gera indicação (só a validada)', [x['id'] for x in opps()]==['rel_protheus_fluig'], opps())
# g) validar / rejeitar
rid=ev(pg,"S.solutions.find(s=>s.id==='protheus').complementos.find(x=>x.status==='pendente').id")
pg.evaluate("(a)=>relSet('protheus',a.r,'validada')",{'r':rid}); ck('após validar, passa a gerar indicação', len(opps())==2, opps())
pg.evaluate("(a)=>relSet('protheus',a.r,'rejeitada')",{'r':rid}); ck('rejeitada deixa de gerar', len(opps())==1)
# h) duplicidade
n2=pg.evaluate("(a)=>relSugerir(a.pr,[{para:a.fl,processo:'Aprovação de pagamentos fora do ERP'}],'radar')",ids); ck('sugestão duplicada ignorada', n2==0)
# i) UI da solução
ev(pg,"UI.view='solucoes';UI.solSel='protheus';render();0"); pg.wait_for_timeout(300)
t=ev(pg,"document.getElementById('app').innerText")
tl=t.lower(); ck('detalhe da solução mostra a seção Complementos', 'complementos desta solução' in tl and 'condições de aderência' in tl and 'cadastrar relação' in tl)
# j) persistência (recarrega)
pg.wait_for_timeout(3000); pg.reload(); pg.wait_for_timeout(3500)
ck('relações persistem após recarregar', ev(pg,"(S.solutions.find(s=>s.id==='protheus').complementos||[]).length")>=2, ev(pg,"(S.solutions.find(s=>s.id==='protheus').complementos||[]).length"))
ck('sem erros de página', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
