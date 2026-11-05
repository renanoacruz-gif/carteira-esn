from mu import *
import json, time
D='/home/claude/test/data/'
F=[]
def ck(n,c,x=''): print('PASS' if c else 'FAIL',n,x if not c else ''); (not c) and F.append(n)
p,b=launch()
L='/home/claude/test/node_modules/'
def route(r):
    u=r.request.url
    if 'xlsx.full.min.js' in u: r.fulfill(path=L+'xlsx/dist/xlsx.full.min.js',content_type='text/javascript')
    elif 'pdf.worker.min.js' in u: r.fulfill(path=L+'pdfjs-dist/build/pdf.worker.min.js',content_type='text/javascript')
    elif 'pdf.min.js' in u: r.fulfill(path=L+'pdfjs-dist/build/pdf.min.js',content_type='text/javascript')
    elif 'jspdf' in u: r.fulfill(path=L+'jspdf/dist/jspdf.umd.min.js',content_type='text/javascript')
    elif 'jszip' in u: r.fulfill(path=L+'jszip/dist/jszip.min.js',content_type='text/javascript')
    elif 'fonts.g' in u: r.fulfill(body='',content_type='text/css')
    else: r.continue_()
def open_h(email):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':email})
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.route('**/*',route); pg.goto('http://localhost:8790/'); pg.wait_for_timeout(3500)
    return pg,errs
ev=lambda pg,js: pg.evaluate(js)
api=lambda pg,body: pg.evaluate("async b=>{const r=await fetch('/api/db',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});return await r.json()}",body)
