# t86 — rodada 32: natureza do item de ficha pelo produto (código ligado > produto da Base > texto); lista "a identificar"
from t40_lib import *
import uuid, openpyxl
fx = '/tmp/ficha_t86.xlsx'
wb = openpyxl.Workbook(); ws = wb.active; ws.append(['FICHA_FATURAMENTO'])
ws.append(['CLIEN_FATU','NOME_CLIEN','CONTRATO','PROPOSTA','COND_PAGTO','PRODUTO','DESCPRO','QUANT','UN','VAL_UNIT','VAL_TOTAL','COMPET','VAL_LIQD'])
L = [('1111001000-6','SMS FULL TOTVS TRAD',100.0),('7P11001018','ID FLUIG 1 AO 50',200.0),('AUT.01.001110','TOTVS INTELIGENCIA TRIBUTARIA',300.0),('ZZ990001','PRODUTO DESCONHECIDO XPTO',400.0)]
for cod, nome, v in L: ws.append(['T00001','CLIENTE TESTE','CONT01','575843','VCTO DIA 05',cod,nome,1,'UN',v,v,'10/2026',v])
wb.save(fx)
pg, errs = open_h('t86%s@totvs.com.br' % uuid.uuid4().hex[:8]); ev(pg, "window.confirm=()=>true;0")
ev(pg, "fnSolCob('tit','');0"); pg.wait_for_timeout(300)  # a Base de Soluções é compartilhada: parte do padrão do tipo, mesmo que uma execução anterior tenha alterado
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart', D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]'); pg.wait_for_timeout(2500)
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-fic', fx); pg.wait_for_timeout(2500)
its = lambda: {i['cod']: i for i in ev(pg, "S.clients['c_T00001'].fichas[0].items.map(i=>({cod:i.cod,nome:i.nome,kind:i.kind,mode:i.kindMode,sol:i.solId||''}))")}
I = its(); print(I)
ck('itens ganham código e nome do produto', all(I.get(c, {}).get('nome') == n for c, n, _ in L), I)
ck('SMS: recorrente pela regra de texto', I['1111001000-6']['kind'] == 'recorrente')
ck('ID Fluig: recorrente herdado do produto Fluig', I['7P11001018']['kind'] == 'recorrente' and I['7P11001018']['mode'] == 'produto' and I['7P11001018']['sol'] == 'fluig', I['7P11001018'])
ck('Inteligência Tributária: produto, não imposto', I['AUT.01.001110']['kind'] == 'recorrente' and I['AUT.01.001110']['sol'] == 'tit', I['AUT.01.001110'])
ck('desconhecido fica não classificado', I['ZZ990001']['kind'] == 'outro')
m0 = ev(pg, "mrrOf(S.clients['c_T00001']).v"); ck('MRR soma só os identificados (600)', abs(m0 - 600) < .01, m0)
ck('lista a identificar traz só o desconhecido', ev(pg, "fnPend().map(p=>p.cod)") == ['ZZ990001'])
ev(pg, "UI.solFeed=false;UI.view='solucoes';render();0"); pg.wait_for_timeout(300)
ck('cartão "Itens de ficha a identificar" visível', 'Itens de ficha a identificar' in ev(pg, "document.getElementById('app').innerText"))
pg.click('[data-a=fnSave][data-id=ZZ990001]'); pg.wait_for_timeout(600)
ck('salvar sem modelo de cobrança é recusado', ev(pg, "!(S.meta.codMap||{})['ZZ990001']"))
pg.select_option('[data-fn-cob="ZZ990001"]', 'avulso'); pg.click('[data-a=fnSave][data-id=ZZ990001]'); pg.wait_for_timeout(400)
I = its(); ck('código ligado: natureza avulso, via código', I['ZZ990001']['kind'] == 'avulso' and I['ZZ990001']['mode'] == 'codigo', I['ZZ990001'])
ck('lista a identificar esvazia', ev(pg, "fnPend().length") == 0)
ev(pg, "(()=>{const it=S.clients['c_T00001'].fichas[0].items.find(i=>i.cod==='7P11001018'); it.kind='avulso'; it.kindMode='manual'; reanalyze(['c_T00001']); return 0})()")
ck('classificação manual prevalece', its()['7P11001018']['kind'] == 'avulso')
ev(pg, "fnSolCob('tit','avulso');0"); pg.wait_for_timeout(300)
ck('modelo de cobrança do produto muda a natureza do item', its()['AUT.01.001110']['kind'] == 'avulso', its()['AUT.01.001110'])
ev(pg, "fnDel('ZZ990001');0"); pg.wait_for_timeout(300)
ck('remover a ligação devolve o item à lista', ev(pg, "fnPend().map(p=>p.cod)") == ['ZZ990001'])
ck('ficha em texto (sem código) segue pelas regras de texto', ev(pg, "fnIdent({desc:'Mensalidade de suporte'}).kind") == 'recorrente' and ev(pg, "fnIdent({desc:'ISS retido'}).kind") == 'imposto')
ev(pg, "fnSolCob('tit','');0"); pg.wait_for_timeout(600)  # devolve o modelo de cobrança ao padrão para não contaminar a base compartilhada
ck('modelo de cobrança volta ao padrão do tipo ao final', ev(pg, "solCobranca(S.solutions.find(s=>s.id==='tit'))") == 'recorrente')
ck('sem erros de página', not errs, errs)
print('FALHAS', F); p.stop()
