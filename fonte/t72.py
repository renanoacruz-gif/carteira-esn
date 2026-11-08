# Design refresh (fase 3): paleta Ctrl+K, atalhos "?", glossário, navegação interna, botão de topo, impressão. Requer servidor em :8790 (ALLOW_TEST_USER=1).
from t40_lib import *
H='http://localhost:8790'; ADM='renan.oscar@totvs.com.br'; ASUB='sub-renan-001'
def abre(w=1440,h=900):
    ctx=b.new_context(viewport={'width':w,'height':h},extra_http_headers={'x-test-user':ADM,'x-test-sub':ASUB}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.goto(H+'/'); pg.wait_for_timeout(3500); return ctx,pg,errs
ctx,pg,errs=abre()
key=pg.evaluate("Object.keys(S.clients)[0]"); nome=pg.evaluate("S.clients['%s'].name"%key)
# ---- paleta
ck('paleta fechada no início', pg.locator('#rf-q').count()==0)
pg.keyboard.press('Control+k'); pg.wait_for_timeout(200)
ck('Ctrl+K abre a paleta com foco no campo', pg.locator('.rf-pal').count()==1 and pg.evaluate("document.activeElement.id")=='rf-q')
ck('lista as telas do menu', pg.locator('#rf-list [data-a=nav]').count()>=5)
pg.keyboard.press('Escape'); pg.wait_for_timeout(150); ck('Esc fecha a paleta', pg.locator('.rf-layer').count()==0 and not pg.evaluate("document.body.classList.contains('mdl')"))
pg.keyboard.press('Control+k'); pg.keyboard.type('pend'); pg.wait_for_timeout(200)
ck('filtra por texto', pg.locator('#rf-list [data-a=nav]').count()>=1 and all('pend' in t.lower() for t in pg.locator('#rf-list [data-a=nav]').all_inner_texts()))
pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
ck('Enter navega e fecha', pg.evaluate("UI.view")=='pend' and pg.locator('.rf-layer').count()==0)
pg.keyboard.press('Control+k'); pg.keyboard.type(nome[:6]); pg.wait_for_timeout(200)
ck('busca cliente na paleta', pg.locator('#rf-list [data-a=gsOpen]').count()>=1)
pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowUp'); pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
ck('abre a ficha do cliente', pg.evaluate("UI.view")=='cliente' and pg.evaluate("UI.sel")==key, pg.evaluate("[UI.view,UI.sel]"))
pg.keyboard.press('Control+k'); pg.wait_for_timeout(150); pg.keyboard.press('Control+k'); pg.wait_for_timeout(150)
ck('Ctrl+K alterna (abre e fecha)', pg.locator('.rf-layer').count()==0)
pg.keyboard.press('Control+k'); pg.keyboard.type('zzzzxx'); pg.wait_for_timeout(150); ck('sem resultado mostra aviso', pg.locator('.rf-empty').count()==1)
pg.mouse.click(5,5); pg.wait_for_timeout(150); ck('clique no fundo fecha', pg.locator('.rf-layer').count()==0)
# ---- atalhos e glossário
pg.evaluate("document.activeElement.blur()"); pg.keyboard.press('?'); pg.wait_for_timeout(200)
ck('? abre atalhos', pg.locator('.rf-keys').count()==1 and 'Ctrl/⌘ + K' in pg.inner_text('.rf-keys'))
pg.click('.rf-keys [data-rf=gloss]'); pg.wait_for_timeout(150)
tx=pg.inner_text('.rf-gloss'); ck('glossário com MRR, Score e rótulos', 'MRR' in tx and 'Score' in tx and 'Hipótese' in tx and pg.locator('.rf-keys').count()==0)
pg.click('.rf-gloss [data-rf=x]'); pg.wait_for_timeout(150); ck('fechar encerra e libera a rolagem', pg.locator('.rf-layer').count()==0 and not pg.evaluate("document.body.classList.contains('mdl')"))
pg.evaluate("UI.view='clientes'; render()"); pg.wait_for_timeout(500); pg.click('#fq'); pg.keyboard.type('?'); pg.wait_for_timeout(200)
ck('? dentro de campo de texto não abre atalhos', pg.locator('.rf-layer').count()==0 and pg.input_value('#fq')=='?')
pg.fill('#fq',''); pg.keyboard.press('Escape')
ck('atalho "/" continua focando a busca', (pg.evaluate("document.activeElement.blur()") or True) and (pg.keyboard.press('/') or True) and pg.evaluate("document.activeElement.id")=='gq')
# ---- topo + navegação interna em tela longa
pg.evaluate("UI.view='oport'; render(); window.scrollTo(0,0)"); pg.wait_for_timeout(900)
ck('botão de topo oculto no início', pg.locator('#rf-top').is_hidden())
pg.evaluate("window.scrollTo(0,1500)"); pg.wait_for_timeout(400)
ck('botão de topo aparece ao rolar e mostra progresso', pg.locator('#rf-top').is_visible() and int(pg.evaluate("getComputedStyle(document.getElementById('rf-top')).getPropertyValue('--p')") or 0)>0)
ck('nav interna com ≥4 itens em tela longa', pg.locator('#rf-toc button').count()>=4 or pg.evaluate("document.documentElement.scrollHeight")<900*2.2, pg.locator('#rf-toc button').count())
if pg.locator('#rf-toc button').count()>=4:
    ck('um item ativo (aria-current)', pg.locator('#rf-toc button[aria-current=location]').count()==1)
    pg.locator('#rf-toc button').nth(2).click(); pg.wait_for_timeout(1200)
    ck('clicar no item rola até a seção', pg.evaluate("scrollY")>200)
pg.click('#rf-top'); pg.wait_for_timeout(1200); ck('botão de topo volta ao início', pg.evaluate("scrollY")<20)
# ---- não interfere com modal de confirmação do app nem com telas curtas
pg.evaluate("UI.view='pend'; render(); window.scrollTo(0,0)"); pg.wait_for_timeout(500)
ck('tela curta: sem navegação interna', pg.locator('#rf-toc').is_hidden() or pg.locator('#rf-toc button').count()<4)
# ---- celular
ctx2,pg2,errs2=abre(390,844)
pg2.keyboard.press('Control+k'); pg2.wait_for_timeout(200); ck('mobile: paleta abre e cabe na tela', pg2.locator('.rf-pal .rf-box').bounding_box()['width']<=390 and pg2.evaluate("document.documentElement.scrollWidth")==390)
pg2.keyboard.press('Escape'); pg2.evaluate("UI.view='oport'; render(); window.scrollTo(0,0)"); pg2.wait_for_timeout(800)
ck('mobile: sem navegação interna lateral', pg2.locator('#rf-toc').is_hidden())
pg2.evaluate("window.scrollTo(0,2000)"); pg2.wait_for_timeout(300); bx=pg2.locator('#rf-top').bounding_box()
ck('mobile: botão de topo visível, ≥44px e dentro da tela', bx and bx['width']>=44 and bx['x']+bx['width']<=390, bx)
# ---- impressão
pg.emulate_media(media='print'); pg.evaluate("UI.view='geral'; render()"); pg.wait_for_timeout(400)
ck('impressão esconde menu, topo e camadas', all(pg.evaluate("(s)=>{const e=document.querySelector(s);return !e||getComputedStyle(e).display==='none'}",s) for s in ['.sb','.top','#rf-top','#rf-toc']))
pg.emulate_media(media='screen')
ck('sem erros de página', not errs and not errs2, (errs+errs2)[:2])
print('FALHAS' if F else 'TUDO OK', F)
