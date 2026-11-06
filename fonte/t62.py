"""Lote 4 (desempenho): Space Grotesk self-hosted no build hospedado. Servidor local :8790."""
from t40_lib import *
import re, urllib.request
BASE = 'http://localhost:8790'; H = {'x-test-user': 'p62a@totvs.com.br'}
get = lambda u: urllib.request.urlopen(urllib.request.Request(BASE + u, headers=H))
html = get('/').read().decode(); head = html.split('<body>')[0]
ck('head sem link do Google Fonts', 'fonts.googleapis.com' not in head and 'fonts.gstatic.com' not in head)
ck('3 @font-face locais (500/600/700) com URL versionada', len(re.findall(r"@font-face\{font-family:'Space Grotesk'[^}]*src:url\(/fonts/space-grotesk-latin-(?:500|600|700)-normal\.woff2\?v=[0-9a-f]{10}\)", head)) == 3)
ck('font-display: swap em todas', head.count('font-display:swap') >= 3)
ck('sem preload de fonte (medido: atrasa o 1º conteúdo no celular)', 'rel="preload" as="font"' not in head)
bad = []
for w in (500, 600, 700):
    r = get(f'/fonts/space-grotesk-latin-{w}-normal.woff2'); b_ = r.read()
    if r.status != 200 or 'immutable' not in r.headers.get('cache-control', '') or b_[:4] != b'wOF2' or len(b_) < 5000: bad.append((w, r.status, r.headers.get('cache-control'), b_[:4]))
ck('/fonts: 200, woff2 válido, cache imutável', not bad, bad)
csp = get('/').headers.get('content-security-policy-report-only', ''); ck("CSP: font-src inclui 'self'", re.search(r"font-src [^;]*'self'", csp) is not None, csp[:200])
ck('exportações (htmlDoc) seguem com Google Fonts (arquivos avulsos)', 'fonts.googleapis.com/css2' in html.split('<body>')[1] or 'fonts.googleapis.com/css2' in html)

# navegador: nenhuma requisição a terceiros; fontes carregam do próprio servidor
ctx = b.new_context(viewport={'width': 1400, 'height': 900}, extra_http_headers=H); pg = ctx.new_page(); hosts = set(); fonts = []; errs = []
pg.on('request', lambda r: hosts.add(re.sub(r'^https?://([^/:]+).*', r'\1', r.url)))
pg.on('response', lambda r: fonts.append((r.url.split('?')[0].split('/')[-1], r.status)) if '/fonts/' in r.url else None)
pg.on('pageerror', lambda e: errs.append(str(e)))
pg.goto(BASE + '/'); pg.wait_for_function("UI.persist && !String(UI.persist).startsWith('memória (sem')", timeout=40000); pg.wait_for_timeout(1500)
ck('nenhuma requisição a hosts de terceiros na abertura', hosts <= {'localhost', '127.0.0.1'}, sorted(hosts))
st = pg.evaluate("[...document.fonts].filter(f=>f.family.includes('Space Grotesk')).map(f=>f.weight+':'+f.status)")
ck('fontes 600 e 700 carregadas (as usadas no shell)', any(x.startswith('600') and x.endswith('loaded') for x in st) and any(x.startswith('700') and x.endswith('loaded') for x in st), st)
ck('Space Grotesk aplicada ao título', pg.evaluate("document.fonts.check('700 20px \"Space Grotesk\"')") is True)
ck('respostas de /fonts todas 200', fonts and all(s == 200 for _, s in fonts), fonts)
ck('sem erro de página', not errs, errs[:2])
ctx.close()
# artefato (não hospedado) mantém o Google Fonts
art = urllib.request.urlopen('http://localhost:8765/index.html').read().decode().split('<body>')[0]
ck('build do artefato mantém o link do Google Fonts', 'fonts.googleapis.com/css2?family=Space+Grotesk' in art and '/fonts/' not in art)
print('\nFALHAS:', F if F else 'nenhuma')
