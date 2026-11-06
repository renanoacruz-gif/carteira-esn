"""Lote 1 (desempenho): bibliotecas pesadas sob demanda. Servidor local :8790, dados fictícios."""
from t40_lib import *
import os
D = '/home/claude/test/data/'
reqs = []
def mkpage(email, abort_first=None):
    ctx = b.new_context(viewport={'width': 1400, 'height': 900}, extra_http_headers={'x-test-user': email}, accept_downloads=True)
    pg = ctx.new_page(); errs = []; cnt = {'n': 0}
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('request', lambda r: reqs.append(r.url))
    def rt(r):
        if abort_first and abort_first in r.request.url and cnt['n'] == 0:
            cnt['n'] += 1; r.abort(); return
        route(r)
    pg.route('**/*', rt); pg.goto('http://localhost:8790/'); pg.wait_for_timeout(2500)
    return pg, errs
# 1 abertura sem bibliotecas
pg, errs = mkpage('p59a@totvs.com.br')
ck('head sem <script src> de bibliotecas', ev(pg, "document.querySelectorAll('head script[src]').length") == 0)
ck('nenhuma biblioteca carregada na abertura', ev(pg, "[typeof XLSX, typeof JSZip, typeof jspdf, typeof pdfjsLib].every(t=>t==='undefined')"))
ck('app renderizou (shell)', ev(pg, "!!document.querySelector('#app') && !document.querySelector('#app .skeleton')"))
ck('bundle hospedado sem worker embutido', ev(pg, "WORKER_SRC==='' && WORKER_TOML===''"))
n0 = len([u for u in reqs if '/vendor/' in u]); ck('abertura sem requisição a /vendor/ (antes do prefetch de 3 s)', n0 == 0, n0)
# 2 carregamento compartilhado
r = pg.evaluate("Promise.all([vend('xlsx'),vend('xlsx'),vend('xlsx')])")
ck('vend(xlsx) x3 resolve true', r == [True, True, True]); ck('XLSX definido', ev(pg, "typeof XLSX")=='object')
ck('xlsx pedido 1 vez', len([u for u in reqs if 'xlsx.full' in u]) == 1, len([u for u in reqs if 'xlsx.full' in u]))
ck('vend de chave inexistente = false', ev(pg, "vend('nada')") is False)
# 3 fluxos
with pg.expect_download() as d: pg.evaluate("downloadTemplate()")
ck('modelo da carteira baixa .xlsx', d.value.suggested_filename.endswith('.xlsx'), d.value.suggested_filename)
pg.evaluate("UI.view='importar'; render()"); pg.wait_for_timeout(400)
pg.set_input_files('#f-cart', D + 'carteira.xlsx'); pg.wait_for_timeout(1500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(800); pg.click('[data-a=impGo]'); pg.wait_for_timeout(2500)
nc = ev(pg, 'clients().length'); ck('importar XLSX (lib sob demanda) cria clientes', nc >= 3, nc)
with pg.expect_download() as d: pg.evaluate("exportXLSX()")
ck('exportar plano .xlsx', d.value.suggested_filename.endswith('.xlsx'), d.value.suggested_filename)
# 4 PDF (jsPDF sob demanda) pelo exportador real
pg2, e2 = mkpage('p59b@totvs.com.br')
pg2.evaluate("UI.view='importar'; render()"); pg2.wait_for_timeout(400)
pg2.set_input_files('#f-cart', D + 'carteira.xlsx'); pg2.wait_for_timeout(1500); pg2.click('[data-a=impPrev]'); pg2.wait_for_timeout(800); pg2.click('[data-a=impGo]'); pg2.wait_for_timeout(2500)
k = ev(pg2, "Object.keys(S.clients)[0]"); ck('jspdf ausente antes de gerar PDF', ev(pg2, "typeof jspdf")=='undefined')
with pg2.expect_download(timeout=20000) as d: pg2.evaluate(f"execExport('{k}')")
ck('PDF executivo gerado (.pdf)', d.value.suggested_filename.endswith('.pdf'), d.value.suggested_filename)
ck('jspdf carregado só depois', ev(pg2, "typeof jspdf")=='object')
# 5 leitores de arquivo
pg3, e3 = mkpage('p59c@totvs.com.br')
def buf(f): return list(open(D + f, 'rb').read())
r = pg3.evaluate("async a=>{const {lines}=await readPdf(new Uint8Array(a).buffer);return lines.length}", buf('ficha_T00001.pdf')); ck('readPdf (pdf.js sob demanda)', r > 0, r)
r = pg3.evaluate("async a=>{try{await readPdf(new Uint8Array(a).buffer);return 'sem erro'}catch(e){return 'erro'}}", buf('quebrado.pdf')); ck('PDF quebrado continua gerando erro', r == 'erro', r)
r = pg3.evaluate("async a=>{const l=await readDocx(new Uint8Array(a).buffer);return l.length}", buf('solucao.docx')); ck('readDocx (jszip sob demanda)', r > 0, r)
r = pg3.evaluate("async a=>{const l=await readPptx(new Uint8Array(a).buffer);return l.length}", buf('enxoval.pptx')); ck('readPptx (jszip sob demanda)', r > 0, r)
# 6 falha de rede no carregamento: false, sem cache de falha, nova tentativa funciona
pg4, e4 = mkpage('p59d@totvs.com.br', abort_first='jszip')
r1 = ev(pg4, "vend('jszip')"); ck('lib bloqueada: vend devolve false', r1 is False, r1)
ck('falha não fica em cache', ev(pg4, "_vp.jszip===undefined"))
r2 = ev(pg4, "vend('jszip')"); ck('nova tentativa carrega', r2 is True, r2)
r = pg4.evaluate("async a=>{try{await readDocx(new Uint8Array(a).buffer);return 'ok'}catch(e){return e.message}}", buf('solucao.docx')); ck('leitor funciona após retry', r == 'ok', r)
pg5, e5 = mkpage('p59e@totvs.com.br', abort_first='xlsx.full')
r = pg5.evaluate("async()=>{try{await readTable({name:'a.xlsx'},new ArrayBuffer(8));return 'sem erro'}catch(e){return e.message}}"); ck('XLSX indisponível: mensagem clara (sem travar)', 'XLSX indisponível' in r, r)
# 7 prefetch em baixa prioridade após a abertura
pg6, e6 = mkpage('p59f@totvs.com.br'); pg6.wait_for_timeout(4000)
ck('prefetch do xlsx criado (link rel=prefetch)', ev(pg6, "!!document.querySelector('link[rel=prefetch][href*=xlsx]')"))
ck('prefetch não executa a lib', ev(pg6, "typeof XLSX")=='undefined')
# 8 rede lenta: o clique recebe retorno (toast) enquanto a lib carrega
import time
pg7, e7 = mkpage('p59g@totvs.com.br')
def lento(r):
    if 'pdf.min.js' in r.request.url: time.sleep(1.4)
    route(r)
pg7.unroute('**/*'); pg7.route('**/*', lento)
ev(pg7, "vend('pdfjs')"); ck('rede lenta: aviso "Carregando recurso" exibido', 'Carregando recurso' in ev(pg7, "document.getElementById('toast').innerText"))
pg8, e8 = mkpage('p59h@totvs.com.br'); ev(pg8, "vend('pdfjs')"); ck('rede rápida: sem aviso desnecessário', 'Carregando recurso' not in ev(pg8, "document.getElementById('toast').innerText"))
allerr = errs + e7 + e8 + e2 + e3 + e4 + e5 + e6; ck('sem erros de página', not allerr, allerr[:3])
print('FALHAS:', F); b.close(); p.stop()
