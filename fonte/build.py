import base64
d='/home/claude/work/app/'
r=lambda f:open(d+f).read()
logo='data:image/png;base64,'+r('logo_w.b64').strip()
logo_s='data:image/png;base64,'+r('logo_s.b64').strip()
import json
extra='const WORKER_SRC = '+json.dumps(r('worker.src.js')).replace('</','<\\/')+';\nconst WORKER_README = '+json.dumps(r('worker.README.md'))+';\nconst WORKER_TOML = '+json.dumps(r('worker.wrangler.toml'))+';\n'
js=extra+'\n'.join(r(f) for f in ['vend.js','kb.js','refpkg.js','ref24.js','core.js','sol.js','cons.js','cad.js','unif.js','store.js','store2.js','consol.js','ai.js','lk.js','tdn.js','prod.js','filt.js','dados.js','lote.js','shell.js','acct.js','integ.js','bk.js','ia2.js','hosted.js','cnpj.js','mercado.js','mkvis.js','solmat.js','pend.js','ocr.js','cliedit.js','pg.js','sem.js','cov.js','val.js','icap.js','sinais.js','raiox.js','ui.js','ui2.js','ui3.js','ui4.js','ui5.js','oport.js','prints.js','pdfx.js','brief.js','sheet.js','fcst.js','orig.js','fsin.js','fnat.js','cmp.js','rel.js','tk.js','util.js','radar.js','dor.js','dt.js','adm.js','lembrete.js','onb.js','onda2.js','onda3.js','refresh.js','oppsol.js','cockpit.js','refresh3d.js','theme.js','clean.js','motion.js','tabbar.js','mobile.js','main.js'])
h=r('index.tpl.html').replace('{{CSS}}',r('style.css')).replace('{{LOGO_W}}',logo).replace('{{LOGO_S}}',logo_s).replace('{{JS}}',js)
open(d+'index.html','w').write(h); print(len(h))

import os
hd='/home/claude/work/hosted/'
os.makedirs(hd+'public',exist_ok=True); os.makedirs(hd+'src',exist_ok=True)
hh=h.replace('<script>\n','<script>window.__HOSTED__=true</script>\n<script>\n',1); assert hh!=h
import shutil, re
import hashlib
V=lambda x: '/vendor/'+x+'?v='+hashlib.sha1(open(d+'vendor/'+x,'rb').read()).hexdigest()[:10]  # URL versionada pelo conteúdo: pode ser imutável
for u,f in [('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','xlsx.full.min.js'),('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js','jszip.min.js'),('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','jspdf.umd.min.js'),('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdf.min.js')]:
    assert u in hh,u; hh=hh.replace(u,V(f))
hh=re.sub(r"const PDF_WORKER_DIRECT='[^']*';\nconst PDF_WORKER=[^\n]*\n","const PDF_WORKER_DIRECT='"+V('pdf.worker.min.js')+"';\nconst PDF_WORKER='"+V('pdf.worker.min.js')+"';\n",hh,count=1); assert "const PDF_WORKER='/vendor/pdf.worker.min.js?v=" in hh
assert 'cdnjs.cloudflare.com' not in hh.split('<body>')[0] and 'cdnjs.cloudflare.com/ajax/libs/xlsx' not in hh
# Lote 4: fonte (IBM Plex Sans) self-hosted só no hospedado (o artefato segue com o Google Fonts); fora do caminho crítico de terceiros
UR="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
FNT={w:'ibm-plex-sans-latin-%d-normal.woff2'%w for w in (400,500,600,700)}
FU=lambda f: '/fonts/'+f+'?v='+hashlib.sha1(open(d+'fonts/'+f,'rb').read()).hexdigest()[:10]
os.makedirs(hd+'public/fonts',exist_ok=True)
for f in FNT.values(): shutil.copy(d+'fonts/'+f,hd+'public/fonts/'+f)
ffcss=''.join("@font-face{font-family:'IBM Plex Sans';font-style:normal;font-display:swap;font-weight:%d;src:url(%s) format('woff2');unicode-range:%s}"%(w,FU(f),UR) for w,f in FNT.items())
gf='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">\n'
assert gf in hh
# sem <link rel=preload>: medido em Slow 4G, o preload de 2 fontes (26 KB) disputa banda com o HTML e atrasa o 1º conteúdo em ~125 ms; font-display:swap basta
hh=hh.replace(gf,'<style>'+ffcss+'</style>\n',1)
assert 'fonts.googleapis.com/css2' not in hh.split('<body>')[0]
# Ícone na tela de início (iPhone/Android): ícones e manifesto ficam em /sobre/ (rota pública no Access, pois o manifesto é buscado sem login)
PWA=('<link rel="manifest" href="/sobre/app.webmanifest" crossorigin="use-credentials">'
 '<link rel="icon" type="image/png" sizes="32x32" href="/sobre/icons/favicon-32.png"><link rel="icon" type="image/png" sizes="48x48" href="/sobre/icons/favicon-48.png">'
 '<link rel="apple-touch-icon" href="/sobre/icons/apple-touch-icon.png">'
 '<meta name="theme-color" content="#002233"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
 '<meta name="apple-mobile-web-app-title" content="Carteira ESN"><meta name="apple-mobile-web-app-status-bar-style" content="default">\n')
assert 0<=hh.find('</head>')<hh.find('<body>'); hh=hh.replace('</head>',PWA+'</head>',1)  # 1ª ocorrência = o <head> real (o JS contém '</head>' em templates de export)
# pacote do backend (worker/README/toml) só existe no artefato; no hospedado o servidor já é o backend: não vai no bundle
hh2=re.sub(r'const WORKER_SRC = ".*";\nconst WORKER_README = ".*";\nconst WORKER_TOML = ".*";\n',"const WORKER_SRC = '', WORKER_README = '', WORKER_TOML = '';\n",hh,count=1); assert hh2!=hh; hh=hh2
os.makedirs(hd+'public/vendor',exist_ok=True)
for f in os.listdir(d+'vendor'):
    if f.endswith('.js'): shutil.copy(d+'vendor/'+f,hd+'public/vendor/'+f)
shutil.copy(d+'_headers',hd+'public/_headers')
open(hd+'public/index.html','w').write(hh)
open(hd+'src/worker.js','w').write(r('worker.src.js').replace('/*__ADM__*/', r('worker.adm.js')).replace('/*__PUSH__*/', r('worker.push.js')))
open(hd+'schema.sql','w').write(r('worker.schema.sql'))
