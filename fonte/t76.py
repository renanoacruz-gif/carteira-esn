# t76 — adoção: tempo e ações até o primeiro valor (usuário novo → importa a carteira → abre uma oportunidade). Orçamento de produto: < 5 min; aqui, ações ≤ 5 e tempo técnico < 20 s.
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
A, errs = open_h('qa.t76.%d@totvs.com.br' % int(time.time()))
acoes = 0; t0 = time.time()
ck('usuário novo cai direto na importação', ev(A, "UI.view") == 'importar')
A.set_input_files('#f-cart', D + 'carteira.xlsx'); acoes += 1
A.wait_for_selector('[data-a=impPrev]', timeout=10000); A.click('[data-a=impPrev]'); acoes += 1
A.wait_for_selector('[data-a=impGo]', timeout=10000); A.click('[data-a=impGo]'); acoes += 1
A.wait_for_function("(UI.view!=='importar')||(typeof clients==='function'&&clients().length>0&&UI.view==='geral')", timeout=20000)
t_imp = time.time() - t0
ev(A, "if(UI.view!=='geral'){UI.view='geral';render()}"); A.wait_for_selector('#hoje', timeout=10000)
ck('após importar: clientes carregados', ev(A, "clients().length") == 4)
tem = ev(A, "!!document.querySelector('#hoje [data-a=open]')")
ck('"Onde vale aprofundar hoje" já lista cliente clicável', tem)
if tem: A.click('#hoje [data-a=open]'); acoes += 1
else: A.evaluate("UI.view='oport'; render()")
A.wait_for_function("document.querySelector('#app')&&/oportunidade|Oportunidade/.test(document.querySelector('#app').innerText)", timeout=10000)
t_val = time.time() - t0
ck('ficha do cliente mostra oportunidade', ev(A, "/oportunidade/i.test(document.querySelector('#app').innerText)"))
print(f'AÇÕES={acoes} t_importar={t_imp:.1f}s t_primeiro_valor={t_val:.1f}s')
ck(f'ações até o primeiro valor ≤ 4 (medido {acoes})', acoes <= 4)
ck(f'tempo técnico até o primeiro valor < 20 s (medido {t_val:.1f}s)', t_val < 20)
ck('sem erros de página', not errs)
A.set_viewport_size({'width': 390, 'height': 844}); ev(A, "UI.view='geral'; render()"); A.evaluate('window.scrollTo(0,0)'); A.wait_for_timeout(800)
mob = ev(A, "(()=>{const e=document.querySelector('#hoje');return e?Math.round(e.getBoundingClientRect().top+scrollY):null})()")
print(f'INFO mobile 390x844: "Onde vale aprofundar hoje" a {mob}px do topo = {mob/844:.1f} telas de rolagem (achado, sem asserção)')
print('FAILS', F)
p.stop()
