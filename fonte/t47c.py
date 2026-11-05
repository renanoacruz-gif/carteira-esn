from t40_lib import *
import uuid
D='/home/claude/test/data/'
ctx=b.new_context(viewport={'width':390,'height':800},extra_http_headers={'x-test-user':'renan.oscar@totvs.com.br','x-test-sub':'sub-renan-001'})
pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.route('**/*',route); pg.goto('http://localhost:8790/'); pg.wait_for_timeout(3500)
ev(pg,"UI.view='importar';render();0"); pg.wait_for_timeout(300)
pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(600); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]'); pg.wait_for_timeout(2500)
ck('mobile: menu abre e mostra Administrador', (pg.click('[data-a=sbOpen]'), pg.wait_for_timeout(300), 'Administrador' in ev(pg,"document.querySelector('#nav').innerText"))[2])
pg.click('#nav [data-v=adm]'); pg.wait_for_timeout(2500)
ov=ev(pg,"document.documentElement.scrollWidth-document.documentElement.clientWidth")
ck('mobile: painel sem estouro horizontal da página', ov<=2, ov)
bad=[]
for v in ['geral','clientes','oport','mercado','solucoes','importar','pend','cnpj','integra','conta','ia','dados','criterios','base','adm']:
    ev(pg,"UI.view=%s;UI.sbOpen=false;render();0"%json.dumps(v)); pg.wait_for_timeout(350)
    o=ev(pg,"document.documentElement.scrollWidth-document.documentElement.clientWidth")
    if o>2: bad.append((v,o))
ck('mobile: nenhuma tela com rolagem horizontal da página', not bad, bad)
ck('mobile: sem erros JS', not errs, errs[:3])
print('FALHAS',F)
