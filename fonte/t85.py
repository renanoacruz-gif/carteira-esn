# t85 — rodada 29: briefing mostra o NOME do produto (coluna DESCPRO) e o código (PRODUTO) no layout real da ficha TOTVS
from t40_lib import *
import uuid, os, sys, openpyxl
src = os.environ.get('FICHA_REAL')  # opcional: validar com um arquivo real fora do repositório
fx = '/tmp/ficha_t85.xlsx'
wb = openpyxl.Workbook(); ws = wb.active; ws.append(['FICHA_FATURAMENTO'])
ws.append(['CLIEN_FATU','NOME_CLIEN','CONTRATO','PROPOSTA','COND_PAGTO','PRODUTO','DESCPRO','QUANT','UN','VAL_UNIT','VAL_TOTAL','PER_RATEIO','QTD_RATEIO','COMPET','RPS','NF_ELETR','EMISSAO','VENCTO','PARCELA','VAL_LIQD','MENNOTA'])
for cod, nome, q, u in [('1111001000-6','SMS FULL TOTVS TRAD',2,598.12),('1113001022-8','SMS LGT FINANCEIRO TRAD',2,353.78),('AUT.04.000049','TOTVS TRANSMITE 500 NFS',1,208.45)]:
    ws.append(['T00001','CLIENTE TESTE','CONT01','575843','VCTO DIA 05',cod,nome,q,'UN',u,round(q*u,2),100,q,'10/2026','000117216','115084','2026-10-02','2026-11-05','',round(q*u*.9,2),''])
wb.save(fx)
pg, errs = open_h('t85%s@totvs.com.br' % uuid.uuid4().hex[:8])
ev(pg, "window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart', D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]'); pg.wait_for_timeout(2500)
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-fic', src or fx); pg.wait_for_timeout(2500)
if src: ev(pg, "(()=>{const it=S.inbox[0]; if(it){const c=S.clients['c_T00001']; c.fichas.push(it.ficha); S.inbox.shift(); reanalyze(['c_T00001']);} return 0})()")
ck('ficha vinculada ao cliente', ev(pg, "S.clients['c_T00001'].fichas.length") == 1)
rows = ev(pg, "briefModel(S.clients['c_T00001']).rows.map(r=>({d:r.desc,c:r.codp,n:brNm(r),t:r.total}))")
print(rows[:4])
ck('itens lidos', len(rows) >= 3, len(rows))
ck('descrição = nome do produto (não o código)', all(not __import__('re').match(r'^[\dA-Z.]{3,}[\d.-]+$', r['d']) for r in rows), [r['d'] for r in rows][:5])
ck('código do produto preservado à parte', all(r['c'] for r in rows))
ck('rótulo traz nome + código', all(r['d'] in r['n'] and 'cód. ' + r['c'] in r['n'] for r in rows))
if not src: ck('nome esperado', rows and any(r['d'] == 'SMS FULL TOTVS TRAD' and r['c'] == '1111001000-6' for r in rows))
ev(pg, "UI.sel='c_T00001';UI.view='cliente';UI.ctab='briefing';render();0"); pg.wait_for_timeout(500)
t = ev(pg, "document.getElementById('app').innerText")
ck('tela do briefing mostra o nome', (rows[0]['d'] in t) if rows else False)
pg.screenshot(path='/tmp/shots/brief.png', full_page=True)
ck('sem erros de página', not errs, errs)
print('FALHAS', F); p.stop()
