# Fase 4 (3D): mapa da carteira (orbe/barras), alternância 3D, hover/click, reduced-motion, mobile e inclinação dos KPIs. Requer servidor em :8790 (ALLOW_TEST_USER=1).
from t40_lib import *
H='http://localhost:8790'; ADM='renan.oscar@totvs.com.br'; ASUB='sub-renan-001'
HD={'x-test-user':ADM,'x-test-sub':ASUB}
def abre(w=1440,h=900,reduce=False):
    ctx=b.new_context(viewport={'width':w,'height':h},extra_http_headers=HD,reduced_motion='reduce' if reduce else 'no-preference'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: m.type=='error' and 'GPU stall' not in m.text and errs.append(m.text[:160]))
    pg.goto(H+'/'); pg.wait_for_timeout(3800); return ctx,pg,errs
PIX="""()=>{const c=document.querySelector('#rf3d-stage canvas'); if(!c) return -1; const t=document.createElement('canvas'); t.width=c.width; t.height=c.height; const x=t.getContext('2d'); x.drawImage(c,0,0); const d=x.getImageData(0,0,t.width,t.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>20) n++; return n}"""
ctx,pg,errs=abre()
nc=pg.evaluate("clients().length")
ck('cartão 3D depois de "Onde vale aprofundar hoje" (valor primeiro)', pg.locator('#rf3d').count()==1 and pg.evaluate("document.querySelector('#rf3d').previousElementSibling.id==='hoje'"))
ck('KPIs acima do cartão 3D', pg.evaluate("document.querySelector('.grid.g4').getBoundingClientRect().top<document.querySelector('#rf3d').getBoundingClientRect().top"))
ck('WebGL ativo com canvas desenhado', pg.evaluate("!!document.querySelector('#rf3d-stage canvas').getContext('webgl')") and pg.evaluate(PIX)>2000, pg.evaluate(PIX))
tx=pg.inner_text('#rf3d .rf3d-t'); ck('HUD usa os dados reais (nº de clientes)', str(nc) in tx, tx)
ck('HUD mostra MRR da planilha formatado', 'R$' in pg.inner_text('#rf3d .rf3d-s'))
ck('legenda soma o total de clientes', sum(int(x) for x in pg.locator('#rf3d .rf3d-leg b').all_inner_texts())==nc)
ck('sem dados de exemplo: nenhum nó além dos clientes', pg.evaluate("document.querySelectorAll('#rf3d .rf3d-leg li').length")<=4)
ck('texto alternativo para leitor de tela', 'clientes' in pg.inner_text('#rf3d .sr') or pg.locator('#rf3d .sr').count()==1)
# barras
pg.click('[data-r3=bars]'); pg.wait_for_timeout(1800)
ck('alterna para barras (aria-pressed)', pg.get_attribute('[data-r3=bars]','aria-pressed')=='true' and pg.get_attribute('[data-r3=orb]','aria-pressed')=='false')
ck('barras desenhadas e rótulos por segmento', pg.evaluate(PIX)>2000 and pg.locator('#rf3d .rf3d-lb').count()>=1, pg.locator('#rf3d .rf3d-lb').count())
ck('rótulo de valor em R$', any('R$' in t for t in pg.locator('#rf3d .rf3d-lb b').all_inner_texts()))
ck('legenda de prioridade some nas barras', pg.locator('#rf3d .rf3d-leg li').count()==0)
pg.click('[data-r3=orb]'); pg.wait_for_timeout(900); ck('volta ao orbe', pg.locator('#rf3d .rf3d-leg li').count()>=1)
# re-render preserva o cartão e o modo
pg.click('[data-r3=bars]'); pg.wait_for_timeout(300); pg.evaluate("render()"); pg.wait_for_timeout(600)
ck('render() recria o cartão mantendo o modo', pg.locator('#rf3d').count()==1 and pg.get_attribute('[data-r3=bars]','aria-pressed')=='true')
pg.click('[data-r3=orb]'); pg.wait_for_timeout(300)
# desligar 3D (persistente)
pg.click('[data-r3=fx]'); pg.wait_for_timeout(500)
ck('3D desligado: botão e reserva 2D', 'desligado' in pg.inner_text('[data-r3=fx]') and pg.evaluate("!!document.querySelector('#rf3d-stage canvas').getContext('2d')") and pg.evaluate(PIX)>200)
pg.reload(); pg.wait_for_timeout(3800)
ck('preferência persiste após recarregar', 'desligado' in pg.inner_text('[data-r3=fx]'))
pg.click('[data-r3=fx]'); pg.wait_for_timeout(500); ck('religar volta ao WebGL', pg.evaluate("!!document.querySelector('#rf3d-stage canvas').getContext('webgl')"))
# outras telas não recebem o cartão
pg.evaluate("UI.view='clientes'; render()"); pg.wait_for_timeout(500); ck('fora da Visão não há cartão 3D', pg.locator('#rf3d').count()==0)
pg.evaluate("UI.view='geral'; render()"); pg.wait_for_timeout(700); ck('voltando à Visão o cartão reaparece', pg.locator('#rf3d').count()==1 and pg.evaluate(PIX)>2000)
ck('exportação da Visão não inclui o 3D', 'rf3d' not in pg.evaluate("vGeral(true)"))
ctx.close()
# reduced-motion: quadro estático + hover/click determinísticos
ctx,pg,errs2=abre(reduce=True)
p0=pg.evaluate(PIX); pg.wait_for_timeout(700); ck('reduced-motion: desenha e não anima (mesmos pixels)', p0>2000 and pg.evaluate(PIX)==p0, (p0,))
pg.locator('#rf3d-stage').scroll_into_view_if_needed(); pg.evaluate("document.querySelector('#rf3d-stage').scrollIntoView({block:'center'})"); pg.wait_for_timeout(400)
bx=pg.locator('#rf3d-stage').bounding_box(); found=None
for yy in range(int(bx['y'])+30,int(bx['y']+bx['height'])-30,10):
    for xx in range(int(bx['x'])+30,int(bx['x']+bx['width'])-30,10):
        pg.mouse.move(xx,yy)
        if pg.locator('#rf3d-tip').is_visible(): found=(xx,yy); break
    if found: break
ck('hover num nó mostra o cartão do cliente', found is not None)
if found:
    tip=pg.inner_text('#rf3d-tip'); names=pg.evaluate("clients().map(c=>c.name)"); ck('cartão cita um cliente real', any(n in tip for n in names), tip[:60])
    pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(900)
    ck('clique abre a ficha do cliente', pg.evaluate("UI.view")=='cliente', pg.evaluate("UI.view"))
ctx.close()
# tilt nos KPIs (ponteiro fino, sem reduced-motion)
ctx,pg,errs3=abre()
pg.locator('.kpi').first.scroll_into_view_if_needed(); pg.wait_for_timeout(300); k=pg.locator('.kpi').first.bounding_box(); pg.mouse.move(k['x']+k['width']*.8,k['y']+k['height']*.2); pg.wait_for_timeout(250)
ck('KPI inclina com o ponteiro', 'tilt' in (pg.locator('.kpi').first.get_attribute('class') or '') and pg.evaluate("getComputedStyle(document.querySelector('.kpi.tilt')).getPropertyValue('--ry')")!='')
pg.mouse.move(5,5); pg.wait_for_timeout(250); ck('KPI volta ao normal ao sair', 'tilt' not in (pg.locator('.kpi').first.get_attribute('class') or ''))
ctx.close()
ctx,pg,errs4=abre(reduce=True); pg.locator('.kpi').first.scroll_into_view_if_needed(); pg.wait_for_timeout(300); k=pg.locator('.kpi').first.bounding_box(); pg.mouse.move(k['x']+30,k['y']+20); pg.wait_for_timeout(250)
ck('reduced-motion: sem inclinação', 'tilt' not in (pg.locator('.kpi').first.get_attribute('class') or '')); ctx.close()
# celular: sem cartão 3D e sem estouro
ctx,pg,errs5=abre(390,844)
ck('celular: cartão 3D não é montado', pg.locator('#rf3d').count()==0 and pg.evaluate("document.documentElement.scrollWidth")==390)
ctx.close()
al=errs+errs2+errs3+errs4+errs5; ck('sem erros de página/console', not al, al[:3])
print('FALHAS' if F else 'TUDO OK', F)
