# /sobre: toda subrequisição das páginas públicas deve estar sob /sobre/ (o Bypass do Access cobre só /sobre e /sobre/*). Requer servidor em :8790.
from playwright.sync_api import sync_playwright
import urllib.request
F=[]
def ck(n,c,x=''): print('PASS' if c else 'FAIL',n,x if not c else ''); (not c) and F.append(n)
paginas=['/sobre/','/sobre/termos-de-uso/','/sobre/politica-de-uso/','/sobre/privacidade/','/sobre/lgpd/']
with sync_playwright() as p:
    b=p.chromium.launch()
    for pg_url in paginas:
        pg=b.new_page(); reqs=[]; falhas=[]; pg.on('request',lambda r: reqs.append(r.url)); pg.on('requestfailed',lambda r: falhas.append(r.url)); pg.on('console',lambda m: falhas.append(m.text) if m.type=='error' else None)
        pg.goto('http://localhost:8790'+pg_url); pg.wait_for_timeout(800)
        fora=[u for u in reqs if not u.startswith('data:') and not u.startswith('http://localhost:8790/sobre/')]
        ck('%s: tudo sob /sobre/'%pg_url, not fora, fora)
        ck('%s: sem erros de rede/console'%pg_url, not falhas, falhas)
        ok=pg.evaluate("document.fonts.load('700 16px \"Space Grotesk\"').then(l=>l.length>0)"); ck('%s: Space Grotesk carregada'%pg_url, ok)
        pg.close()
    b.close()
for w in (500,600,700):
    r=urllib.request.urlopen('http://localhost:8790/sobre/fonts/space-grotesk-latin-%d-normal.woff2'%w); ck('fonte %d servida com cache imutável'%w, r.status==200 and 'immutable' in r.headers.get('cache-control',''))
print('FALHAS:',F) if F else print('TUDO OK')
