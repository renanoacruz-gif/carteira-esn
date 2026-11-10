# t80 — bloco de pendências: textos hospedados, rótulo de release por print, paleta sem duplicata, dock e ficha/Plano no celular
import sys, time, re; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t80.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.evaluate("UI.view='importar'; render()"); A.wait_for_timeout(300)
A.set_input_files('#f-cart', D + 'carteira.xlsx'); A.wait_for_timeout(500); A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); A.wait_for_timeout(3000)
# (a) nenhum resto de "artefato" nas telas de Conta/IA/Integrações no modo hospedado
for v in ['conta', 'ia', 'integra']:
    ev(A, "UI.view=%r;render();0" % v); A.wait_for_timeout(500)
    t = ev(A, "document.getElementById('app').innerText")
    ck('hospedado: sem "artefato"/claude.ai em ' + v, not re.search(r'artefato|claude\.ai|Claude desta', t, re.I))
# (c) paleta Ctrl+K sem telas duplicadas
dup = ev(A, "(()=>{const n=[...document.querySelectorAll('#cmdk li, .cmdk li, [data-pal] li')].map(x=>x.textContent.trim());return n.length-new Set(n).size})()")
A.keyboard.press('Control+K'); A.wait_for_timeout(500)
lbl = ev(A, "(()=>{const l=[...document.querySelectorAll('[role=dialog] li,[role=listbox] li,[role=option]')].map(x=>x.textContent.trim().split('\\n')[0]);return l})()")
ck('paleta: sem rótulos duplicados', len(lbl) == len(set(lbl)) and len(lbl) > 0)
A.keyboard.press('Escape')
# celular: dock e ficha do Cliente/Plano sem rolagem horizontal da página
ctx = b.new_context(viewport={'width': 360, 'height': 800}, extra_http_headers={'x-test-user': em})
m = ctx.new_page(); m.route('**/*', route); m.goto('http://localhost:8790/'); m.wait_for_timeout(3000)
clip = ev(m, "[...document.querySelectorAll('#tabbar .tb-i')].filter(e=>e.scrollWidth>e.clientWidth+1).length")
ck('dock 360px: nenhum rótulo cortado', clip == 0)
m.set_viewport_size({'width': 390, 'height': 844})
for t in ['raiox', 'resumo', 'cadastro', 'fichas', 'contratacao', 'validacao', 'reuniao']:
    m.evaluate("UI.sel='c_T00001';UI.view='cliente';UI.ctab=%r;render();0" % t); m.wait_for_timeout(600)
    ck('ficha %s sem rolagem horizontal' % t, ev(m, "document.documentElement.scrollWidth") <= 390)
ck('abas da ficha em linha única rolável', ev(m, "(()=>{const t=document.querySelector('.ctabs');return getComputedStyle(t).flexWrap==='nowrap'&&t.scrollWidth>t.clientWidth})()"))
ck('alertas da ficha recolhidos e expansíveis', ev(m, "document.querySelectorAll('.m-al').length>=1"))
m.locator('.m-al').first.click(); m.wait_for_timeout(200)
ck('alerta expande ao toque', ev(m, "document.querySelector('.m-al').classList.contains('open')"))
m.evaluate("UI.view='plano';render();0"); m.wait_for_timeout(600)
ck('plano sem rolagem horizontal', ev(m, "document.documentElement.scrollWidth") <= 390)
ck('filtros do Plano alinhados em grade', ev(m, "getComputedStyle(document.querySelector('.filters')).display==='grid'"))
ck('sem erros de página', not errs)
print('FAILS', F)
p.stop()
