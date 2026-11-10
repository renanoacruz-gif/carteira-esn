# t75 — tempo até o valor (frente C): Visão da Carteira mostra KPIs e "Onde vale aprofundar hoje" na primeira dobra (1440×900, 4 clientes); mapa 3D vem depois.
import sys; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
A, errs = open_h('qa.t75@totvs.com.br')
A.evaluate("UI.view='importar'; render()"); A.wait_for_timeout(300)
A.set_input_files('#f-cart', D + 'carteira.xlsx'); A.wait_for_timeout(500); A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); A.wait_for_timeout(3000)
A.set_viewport_size({'width': 1440, 'height': 900}); ev(A, "UI.view='geral'; render()"); A.evaluate('window.scrollTo(0,0)'); A.wait_for_timeout(1200)
M = ev(A, """()=>{const y=e=>e?Math.round(e.getBoundingClientRect().top+scrollY):null;const h=document.querySelector('#hoje h3');return {vh:innerHeight,kpi:y(document.querySelector('#app .grid.g4')),hoje:y(document.querySelector('#hoje')),rf:y(document.querySelector('#rf3d')),h3:y(h),hj:y(document.querySelector('#rf3d .ck-hoje')),ck:y(document.querySelector('#ck'))}}""")
print(M)
# visual v2: a orbe abre a Visão com o MRR e o destaque do dia; a grade de indicadores vem logo abaixo
ck('palco da orbe começa na primeira dobra', M['rf'] is not None and M['rf'] < M['vh'] * 0.3)
ck('"Onde vale aprofundar hoje" (destaque no palco) dentro da dobra', M['hj'] is not None and M['hj'] < M['vh'])
ck('grade de indicadores logo abaixo do palco e antes dos KPIs', M['ck'] is not None and M['rf'] < M['ck'] < M['kpi'] and M['hoje'] is not None)
ck('Visão com um clique: cliente abre a partir de "Onde vale aprofundar"', ev(A, "!!document.querySelector('#hoje [data-a=open]')"))
A.set_viewport_size({'width': 390, 'height': 844}); ev(A, "render()"); A.evaluate('window.scrollTo(0,0)'); A.wait_for_timeout(800)
ck('mobile: sem cartão 3D (inalterado)', ev(A, "!document.querySelector('#rf3d')"))
ck('sem erros de página', not errs)
print('FAILS', F)
p.stop()
