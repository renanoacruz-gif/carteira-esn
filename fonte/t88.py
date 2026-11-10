# t88 — rodada 34: landing imersiva (/sobre) e sistema de movimento do app
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
U = 'http://localhost:8790/sobre/'
def page(w, h, **kw):
    ctx = b.new_context(viewport={'width': w, 'height': h}, **kw); pg = ctx.new_page(); er = []
    pg.on('pageerror', lambda e: er.append(str(e))); pg.on('console', lambda m: er.append(m.text) if m.type == 'error' else None)
    pg.goto(U); pg.wait_for_timeout(900); return pg, er
D, er = page(1440, 900)
ck('5 etapas e 5 painéis na narrativa', ev(D, "document.querySelectorAll('.stp').length") == 5 and ev(D, "document.querySelectorAll('.pane').length") == 5)
ck('hero começa em perspectiva (3D)', 'matrix3d' in ev(D, "getComputedStyle(document.getElementById('rig')).transform"))
ck('barra superior transparente no topo', not ev(D, "document.getElementById('topo').classList.contains('solid')"))
D.evaluate("window.scrollTo(0, document.getElementById('hero').offsetHeight)"); D.wait_for_timeout(500)
ck('hero fica de frente ao rolar (--hp = 1)', float(ev(D, "getComputedStyle(document.getElementById('hero')).getPropertyValue('--hp')")) == 1)
ck('barra superior sólida após rolar', ev(D, "document.getElementById('topo').classList.contains('solid')"))
ck('indicador de progresso avança', float(ev(D, "getComputedStyle(document.documentElement).getPropertyValue('--sp')")) > 0)
for i in (2, 4):
    D.evaluate("i=>document.querySelector('.stp[data-i=\"'+i+'\"]').scrollIntoView({block:'center'})", i); D.wait_for_timeout(900)
    ck('etapa %d ativa o painel correspondente' % (i + 1), ev(D, "[...document.querySelectorAll('.pane')].findIndex(p=>p.classList.contains('on'))") == i and ev(D, "document.querySelectorAll('.pane.on').length") == 1)
ck('link ativo da navegação = Como funciona', ev(D, "document.querySelector('.nav a.on')?.getAttribute('href')") == '#como')
D.evaluate("document.getElementById('funcoes').scrollIntoView()"); D.wait_for_timeout(900)
ck('cartões revelados ao entrar na tela', ev(D, "document.querySelectorAll('#funcoes .card.in').length") >= 3)
ck('sem rolagem horizontal em 1440', not ev(D, "document.documentElement.scrollWidth>innerWidth"))
ck('imagens com alt (exceto decorativas ocultas)', ev(D, "[...document.images].every(i=>i.alt||i.closest('[aria-hidden]'))"))
ck('landing sem erros', not er, er)
M, er2 = page(390, 844)
ck('celular: sem rolagem horizontal', not ev(M, "document.documentElement.scrollWidth>innerWidth"))
ck('celular: painel fixo oculto e visual dentro de cada etapa', ev(M, "getComputedStyle(document.querySelector('.sticky')).display") == 'none' and ev(M, "getComputedStyle(document.querySelector('.stp .sv')).display") != 'none')
ck('celular sem erros', not er2, er2)
R, er3 = page(1440, 900, reduced_motion='reduce')
ck('movimento reduzido: hero sem 3D e conteúdo visível', ev(R, "getComputedStyle(document.getElementById('rig')).transform") == 'none' and ev(R, "getComputedStyle(document.querySelector('#funcoes .card')).opacity") == '1')
# app: movimento
A, errs = open_h('qa.t88.%d@totvs.com.br' % time.time()); A.wait_for_timeout(400)
ev(A, "UI.view='oport'; render(); 0"); A.wait_for_timeout(300)
ck('sob automação o app não anima (valores lidos de imediato)', not ev(A, "document.getElementById('app').classList.contains('mo-in')"))
ev(A, "window.__MOTION_FORCE__=true; UI.view='conta'; render(); 0"); A.wait_for_timeout(120)
ck('com movimento ligado, a troca de tela aplica a entrada', ev(A, "document.getElementById('app').classList.contains('mo-in')"))
ev(A, "(()=>{const a=document.getElementById('app'); a.innerHTML='<div class=\"kpi\"><div class=\"v\">R$ 1.284.530,50</div></div><div class=\"kpi\"><div class=\"v\">42%</div></div><div class=\"kpi\"><div class=\"v\">12 de 30</div></div>'; UI.view='geral'; return 0})()"); A.wait_for_timeout(1100)
ck('contagem termina no texto original exato', ev(A, "[...document.querySelectorAll('.kpi .v')].map(e=>e.textContent)") == ['R$ 1.284.530,50', '42%', '12 de 30'], ev(A, "[...document.querySelectorAll('.kpi .v')].map(e=>e.textContent)"))
ck('app sem erros de página', not errs, errs)
print('FALHAS', F); p.stop()
