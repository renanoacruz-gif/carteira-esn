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
