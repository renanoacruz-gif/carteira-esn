"""Lote 3 (desempenho): debounce de busca, timeout + retry só em leitura, lazy de imagens, /vendor versionado. Servidor local :8790, dados fictícios."""
from t40_lib import *
import re, urllib.request
EM = lambda s: f'{s}@totvs.com.br'
BASE = 'http://localhost:8790'

def mkpage(email, hook=None, init=None):
    ctx = b.new_context(viewport={'width': 1400, 'height': 900}, extra_http_headers={'x-test-user': email})
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); st = {'errs': [], 'ops': []}
    pg.on('pageerror', lambda e: st['errs'].append(str(e)))
    def rt(r):
        if '/api/db' in r.request.url:
            try: j = json.loads(r.request.post_data or '{}')
            except Exception: j = {}
            st['ops'].append((j.get('op'), j.get('path')))
            if hook and hook(r, j, st): return
        route(r)
    pg.route('**/*', rt); pg.goto(BASE + '/')
    return pg, st
def ready(pg, t=40000): pg.wait_for_function("UI.persist && !String(UI.persist).startsWith('memória (sem')", timeout=t)
def idle(pg, t=60000):
    pg.wait_for_function("dirtyC.size===0 && delC.size===0 && !saving && !dirtyMeta && Object.values(GCOL).every(g=>!g.d.size&&!g.x.size)", timeout=t); pg.wait_for_timeout(500)
def mk(pg, n, pre='c'):
    pg.evaluate("""([n,pre])=>{for(let i=0;i<n;i++){const k=pre+'_'+i;S.clients[k]={key:k,code:k,name:'Cliente '+k,cnpj:'',seg:'Teste',mrr:100+i,productsRaw:'',docs:[],fichas:[]};runAnalysis(S.clients[k],'');touchC(k);}}""", [n, pre])
cnt = lambda st, op, frag: len([o for o in st['ops'] if o[0] == op and frag in (o[1] or '')])

# ---------- 1. debounce ----------
A = EM('p61a'); pg, st = mkpage(A); ready(pg); mk(pg, 120, 'ca'); idle(pg, 120000)
pg.evaluate("UI.view='clientes'; render()"); pg.wait_for_timeout(500)
pg.evaluate("window.__n=0; const o=retbl; retbl=function(){window.__n++; return o.apply(this,arguments)}")
pg.focus('#fq'); pg.keyboard.type('Cliente ca_11', delay=15)
ck('estado atualizado a cada tecla (sem esperar o render)', ev(pg, 'UI.f.q') == 'Cliente ca_11', ev(pg, 'UI.f.q'))
pg.wait_for_timeout(600)
n = ev(pg, 'window.__n'); ck('13 teclas rápidas → ≤ 2 renders da tabela', 1 <= n <= 2, n)
rows = ev(pg, "document.querySelectorAll('#tbl tbody tr').length")
exp = ev(pg, "clients().filter(c=>norm(c.name+' '+c.code).includes(norm('Cliente ca_11'))).length")
ck('tabela filtrada corretamente após o debounce', rows == exp and rows > 0, (rows, exp))
ck('foco mantido no campo de busca', ev(pg, "document.activeElement && document.activeElement.id==='fq'"))
pg.fill('#fq', ''); pg.wait_for_timeout(500)
ck('limpar a busca restaura a lista', ev(pg, "document.querySelectorAll('#tbl tbody tr').length") >= 100, ev(pg, "document.querySelectorAll('#tbl tbody tr').length"))

# busca da Base de Soluções: render completo + cursor preservado
pg.evaluate("UI.view='solucoes'; render()"); pg.wait_for_timeout(500)
pg.evaluate("window.__r=0; const o=render; render=function(){window.__r++; return o.apply(this,arguments)}")
pg.focus('[data-i=solq]'); pg.keyboard.type('abc', delay=15); pg.keyboard.press('ArrowLeft'); pg.keyboard.press('ArrowLeft'); pg.keyboard.type('X', delay=15)
pg.wait_for_timeout(600)
v = ev(pg, "document.querySelector('[data-i=solq]').value"); p_ = ev(pg, "document.querySelector('[data-i=solq]').selectionStart")
ck('solq: texto correto e cursor no meio preservado', v == 'aXbc' and p_ == 2, (v, p_))
n = ev(pg, 'window.__r'); ck('solq: 4 teclas → ≤ 2 renders completos', n <= 2, n)
ck('solq: foco preservado', ev(pg, "document.activeElement && document.activeElement.dataset.i==='solq'"))
pg.evaluate("UI.solQ=''; UI.view='geral'; render()")

# busca global: Enter logo após digitar abre o 1º resultado (flush do debounce)
pg.focus('#gq'); pg.keyboard.type('Cliente ca_7', delay=10); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
ck('busca global: Enter imediato abre o cliente (sem esperar o debounce)', ev(pg, "UI.view==='cliente' && !!UI.sel && S.clients[UI.sel].name.includes('ca_7')"), ev(pg, 'UI.view+"|"+UI.sel'))
ck('debounce: sem erro de página', not st['errs'], st['errs'][:2])
pg.context.close()

# ---------- 2. leitura: 1 nova tentativa; escrita nunca repetida ----------
def abort_first(frag, op, times=1):
    seen = {'n': 0}
    def hook(r, j, st):
        if j.get('op') == op and frag in (j.get('path') or ''):
            seen['n'] += 1
            if seen['n'] <= times: r.abort(); return True
        return False
    return hook
pg, st = mkpage(A, abort_first('/carteira/clientes', 'list', 1)); ready(pg); pg.wait_for_timeout(1500)
ck('leitura: 1 queda de rede → retentativa e abre normal', ev(pg, "String(UI.persist).startsWith('salvo')") and ev(pg, 'Object.keys(S.clients).length') == 120, ev(pg, 'UI.persist'))
ck('leitura: exatamente 2 tentativas da lista', cnt(st, 'list', '/carteira/clientes') == 2, cnt(st, 'list', '/carteira/clientes'))
pg.context.close()
pg, st = mkpage(A, abort_first('/carteira/inbox', 'list', 99)); pg.wait_for_function("String(UI.persist).startsWith('memória (db')", timeout=40000)
ck('leitura: 2 falhas seguidas → modo memória (sem laço)', cnt(st, 'list', '/carteira/inbox') == 2, cnt(st, 'list', '/carteira/inbox'))
ck('leitura falha: nada aplicado', ev(pg, 'Object.keys(S.clients).length') == 0)
pg.context.close()

C = EM('p61c')
pg, st = mkpage(C, abort_first('/clientes/cc_3', 'set', 1)); ready(pg); mk(pg, 12, 'cc')
pg.wait_for_function("String(UI.persist).startsWith('ERRO')", timeout=30000)
ck('escrita: falha NÃO é repetida dentro da mesma chamada (1 tentativa)', cnt(st, 'set', '/clientes/cc_3') == 1, cnt(st, 'set', '/clientes/cc_3'))
ck('escrita: item volta à fila', ev(pg, "dirtyC.has('cc_3')"))
ev(pg, 'sched()'); idle(pg, 60000)
ck('escrita: retentativa posterior grava (total 2 tentativas)', cnt(st, 'set', '/clientes/cc_3') == 2, cnt(st, 'set', '/clientes/cc_3'))
n = len(api(pg, {'op': 'list', 'path': f'data/users/{C}/carteira/clientes', 'limit': 200}).get('docs', [])); ck('escrita: 12 clientes no banco', n == 12, n)
pg.context.close()

# ---------- 3. tempo limite: requisição pendurada não trava a fila ----------
D_ = EM('p61d'); held = []
def hang_set(r, j, st):
    if j.get('op') == 'set' and '/clientes/cd_2' in (j.get('path') or '') and not st.get('free'):
        held.append(r); return True
    return False
pg, st = mkpage(D_, hang_set, init="window.__apiTo={r:1500,w:1500}"); ready(pg); mk(pg, 8, 'cd')
t0 = time.time(); pg.wait_for_function("String(UI.persist).startsWith('ERRO')", timeout=30000); dt = time.time() - t0
ck('escrita pendurada: erro de tempo esgotado em ~1,5 s (não trava)', dt < 8, round(dt, 1))
ck('escrita pendurada: mensagem de tempo esgotado', 'demorou' in ev(pg, 'UI.persist'), ev(pg, 'UI.persist'))
ck('escrita pendurada: fila destravada (saving=false) e item na fila', ev(pg, 'saving') is False and ev(pg, "dirtyC.has('cd_2')"), (ev(pg, 'saving'), ev(pg, "dirtyC.has('cd_2')")))
st['free'] = True; ev(pg, 'sched()'); idle(pg, 60000)
n = len(api(pg, {'op': 'list', 'path': f'data/users/{D_}/carteira/clientes', 'limit': 200}).get('docs', [])); ck('escrita pendurada: após liberar, 8 clientes gravados', n == 8, n)
pg.context.close()
held2 = []
def hang_list(r, j, st):
    if j.get('op') == 'list' and '/carteira/inbox' in (j.get('path') or ''): held2.append(r); return True
    return False
t0 = time.time(); pg, st = mkpage(D_, hang_list, init="window.__apiTo={r:1000,w:1000}"); pg.wait_for_function("String(UI.persist).startsWith('memória (db')", timeout=30000); dt = time.time() - t0
ck('leitura pendurada: 2 tentativas e modo memória em poucos segundos', cnt(st, 'list', '/carteira/inbox') == 2 and dt < 9, (cnt(st, 'list', '/carteira/inbox'), round(dt, 1)))
ck('leitura pendurada: mensagem de tempo esgotado', 'demorou' in ev(pg, 'UI.persist'), ev(pg, 'UI.persist'))
pg.context.close()

# ---------- 4. imagens e cache de /vendor ----------
html = urllib.request.urlopen(urllib.request.Request(BASE + '/', headers={'x-test-user': EM('p61z')})).read().decode()
ck('miniaturas de prints com loading=lazy decoding=async', 'loading="lazy" decoding="async" src="${rec.thumb}"' in html)
ck('imagem original do OCR com loading=lazy', '<img loading="lazy" decoding="async" alt="Original enviado:' in html)
ck('logo do cabeçalho segue eager (sem lazy)', not re.search(r'class="sb-logo"[^>]*loading="lazy"|loading="lazy"[^>]*class="sb-logo"', html))
vs = set(re.findall(r'/vendor/[\w.\-]+\?v=[0-9a-f]{10}', html)); ck('5 URLs de /vendor versionadas por hash', len(vs) >= 5, sorted(vs))
bad = []
for u in sorted(vs):
    r = urllib.request.urlopen(urllib.request.Request(BASE + u, headers={'x-test-user': EM('p61z')}))
    cc = r.headers.get('cache-control', '');
    if r.status != 200 or 'immutable' not in cc or 'max-age=31536000' not in cc: bad.append((u, r.status, cc))
ck('/vendor: 200 + Cache-Control imutável de 1 ano', not bad, bad[:2])
r = urllib.request.urlopen(urllib.request.Request(BASE + '/', headers={'x-test-user': EM('p61z')}))
ck('HTML segue sem cache imutável', 'immutable' not in (r.headers.get('cache-control') or ''), r.headers.get('cache-control'))

print('\nFALHAS:', F if F else 'nenhuma')
