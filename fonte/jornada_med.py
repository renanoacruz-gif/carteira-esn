# Medição de jornadas (frente C): posições acima da dobra e cliques até o valor. Uso: python3 jornada_med.py <tag>
from t40_lib import *
import sys, json
tag = sys.argv[1] if len(sys.argv) > 1 else 'x'
A, ea = open_h('qa.jornada@totvs.com.br')
A.evaluate("UI.view='importar'; render()"); A.wait_for_timeout(300)
A.set_input_files('#f-cart', D + 'carteira.xlsx'); A.wait_for_timeout(500); A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); A.wait_for_timeout(3000)
out = {}
JS = """()=>{const q=s=>document.querySelector(s),y=e=>e?Math.round(e.getBoundingClientRect().top+scrollY):null;
 const h3=[...document.querySelectorAll('#app h3')].find(e=>/Onde vale aprofundar/.test(e.textContent));
 const kp=q('#app .kpi');const f=q('#app .filters');
 return {vh:innerHeight,kpi:y(kp),rf3d:y(q('#rf3d')),aprof:y(h3),filtros:y(f),filtrosH:f?Math.round(f.getBoundingClientRect().height):null,firstRow:y(q('#app table tbody tr, #app .cli-row, #app .ccard')),pageH:document.documentElement.scrollHeight}}"""
for W, H in ((1440, 900), (390, 844)):
    A.set_viewport_size({'width': W, 'height': H})
    for v in ('geral', 'clientes'):
        ev(A, f"UI.view='{v}'; render()"); A.evaluate('window.scrollTo(0,0)'); A.wait_for_timeout(1200)
        out[f'{W}_{v}'] = ev(A, JS)
print(tag, json.dumps(out, ensure_ascii=False, indent=1)); json.dump(out, open(f'/tmp/jor_{tag}.json', 'w'))
p.stop()
