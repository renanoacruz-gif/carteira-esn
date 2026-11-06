from t40_lib import *
import uuid
email='bb%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]'); pg.wait_for_timeout(2500)
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-fic',D+'ficha_T00001_10.txt'); pg.wait_for_timeout(2500)
print('fichas',ev(pg,"S.clients['c_T00001'].fichas.length"))
ev(pg,"UI.sel='c_T00001';UI.view='cliente';UI.ctab='briefing';render();0"); pg.wait_for_timeout(500)
t=ev(pg,"document.getElementById('app').innerText")
ck('ficha texto: aviso sem colunas', 'lida como texto' in t, t[:300])
ck('ficha texto: itens extraídos', ev(pg,"briefModel(S.clients['c_T00001']).n")>0)
with pg.expect_download(timeout=15000) as dl: pg.click('[data-a=briefPdf]')
dl.value.save_as('/tmp/briefing_txt.pdf')
ck('sem erros', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
