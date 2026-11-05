import base64
d='/home/claude/work/app/'
r=lambda f:open(d+f).read()
logo='data:image/png;base64,'+r('logo_w.b64').strip()
logo_s='data:image/png;base64,'+r('logo_s.b64').strip()
import json
extra='const WORKER_SRC = '+json.dumps(r('worker.src.js')).replace('</','<\\/')+';\nconst WORKER_README = '+json.dumps(r('worker.README.md'))+';\nconst WORKER_TOML = '+json.dumps(r('worker.wrangler.toml'))+';\n'
js=extra+'\n'.join(r(f) for f in ['kb.js','refpkg.js','ref24.js','core.js','sol.js','cons.js','cad.js','unif.js','store.js','store2.js','consol.js','ai.js','lk.js','tdn.js','prod.js','filt.js','dados.js','lote.js','shell.js','acct.js','integ.js','bk.js','ia2.js','hosted.js','cnpj.js','mercado.js','mkvis.js','solmat.js','pend.js','ocr.js','cliedit.js','pg.js','sem.js','cov.js','val.js','icap.js','sinais.js','raiox.js','ui.js','ui2.js','ui3.js','ui4.js','ui5.js','pdfx.js','main.js'])
h=r('index.tpl.html').replace('{{CSS}}',r('style.css')).replace('{{LOGO_W}}',logo).replace('{{LOGO_S}}',logo_s).replace('{{JS}}',js)
open(d+'index.html','w').write(h); print(len(h))

import os
hd='/home/claude/work/hosted/'
os.makedirs(hd+'public',exist_ok=True); os.makedirs(hd+'src',exist_ok=True)
hh=h.replace('<script>\n','<script>window.__HOSTED__=true</script>\n<script>\n',1); assert hh!=h
open(hd+'public/index.html','w').write(hh)
open(hd+'src/worker.js','w').write(r('worker.src.js'))
open(hd+'schema.sql','w').write(r('worker.schema.sql'))
