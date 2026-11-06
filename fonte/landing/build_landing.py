# Gera public/sobre/index.html (página pública /sobre). Independente do build do app.
import hashlib, os
here = os.path.dirname(os.path.abspath(__file__))
fonte = os.path.dirname(here)
root = os.path.dirname(fonte)
UR = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
ff = ''
for w in (500, 600, 700):
    f = f'space-grotesk-latin-{w}-normal.woff2'
    v = hashlib.sha1(open(f'{fonte}/fonts/{f}', 'rb').read()).hexdigest()[:10]  # mesma URL do app = mesmo cache
    ff += f"@font-face{{font-family:'Space Grotesk';font-style:normal;font-display:swap;font-weight:{w};src:url(/fonts/{f}?v={v}) format('woff2');unicode-range:{UR}}}"
logo = 'data:image/png;base64,' + open(f'{fonte}/logo_w.b64').read().strip()
h = open(f'{here}/index.tpl.html').read().replace('{{FONTS}}', ff).replace('{{LOGO_W}}', logo)
os.makedirs(f'{root}/public/sobre', exist_ok=True)
open(f'{root}/public/sobre/index.html', 'w').write(h)
print(len(h))


# ---- páginas legais (/sobre/<slug>/) ----
import sys; sys.path.insert(0, here)
from legal_content import PAGES, ORDEM, DATA, VERSAO
lt = open(f'{here}/legal.tpl.html').read()
navl = ''.join(f'<a href="/sobre/{k}/">{PAGES[k]["curto"]}</a>' for k in ORDEM)
for k in ORDEM:
    pg = PAGES[k]
    toc = ''.join(f'<li><a href="#s{i}">{t}</a></li>' for i, (t, _) in enumerate(pg['secoes'], 1))
    sec = ''.join(f'<section id="s{i}"><h2><i>{i}</i>{t}</h2>{b}</section>' for i, (t, b) in enumerate(pg['secoes'], 1))
    out = ''.join(f'<a class="mc" href="/sobre/{o}/"><b>{PAGES[o]["titulo"]}</b><span>{PAGES[o]["resumo"]}</span></a>' for o in ORDEM if o != k)
    h = (lt.replace('{{FONTS}}', ff).replace('{{LOGO_W}}', logo).replace('{{TITULO}}', pg['titulo']).replace('{{RESUMO}}', pg['resumo'])
         .replace('{{VERSAO}}', VERSAO).replace('{{DATA}}', DATA).replace('{{TOC}}', toc).replace('{{SECOES}}', sec)
         .replace('{{OUTROS}}', out).replace('{{NAVLINKS}}', navl))
    os.makedirs(f'{root}/public/sobre/{k}', exist_ok=True)
    open(f'{root}/public/sobre/{k}/index.html', 'w').write(h)
    print(k, len(h))
