"""Lote 2 (desempenho): leituras paralelas na abertura + gravações com concorrência limitada. Servidor local :8790, dados fictícios."""
from t40_lib import *
import re
EM = lambda s: f'{s}@totvs.com.br'

def mkpage(email, abort_pat=None, abort_nth=None):
    """abort_pat: regex sobre o corpo da requisição /api/db. abort_nth=None -> aborta sempre; n -> aborta só a n-ésima que casar."""
    ctx = b.new_context(viewport={'width': 1400, 'height': 900}, extra_http_headers={'x-test-user': email})
    pg = ctx.new_page(); st = {'errs': [], 'live': 0, 'max': 0, 'maxset': 0, 'liveset': 0, 'ops': [], 'sets': [], 'cnt': 0}
    pg.on('pageerror', lambda e: st['errs'].append(str(e)))
    def on_req(r):
        if '/api/db' not in r.url: return
        try: j = json.loads(r.post_data or '{}')
        except Exception: j = {}
        r._j = j
        st['live'] += 1; st['max'] = max(st['max'], st['live']); st['ops'].append((j.get('op'), j.get('path')))
        if j.get('op') == 'set': st['liveset'] += 1; st['maxset'] = max(st['maxset'], st['liveset']); st['sets'].append(j.get('path'))
    def on_end(r):
        if '/api/db' not in r.url: return
        try: j = json.loads(r.post_data or '{}')
        except Exception: j = {}
        st['live'] -= 1
        if j.get('op') == 'set': st['liveset'] -= 1
    pg.on('request', on_req); pg.on('requestfinished', on_end); pg.on('requestfailed', on_end)
    def rt(r):
        if abort_pat and '/api/db' in r.request.url and re.search(abort_pat, r.request.post_data or ''):
            st['cnt'] += 1
            if abort_nth is None or st['cnt'] == abort_nth: r.abort(); return
        route(r)
    pg.route('**/*', rt); pg.goto('http://localhost:8790/')
    return pg, st

def ready(pg, t=30000):
    pg.wait_for_function("UI.persist && !String(UI.persist).startsWith('memória (sem')", timeout=t)
def idle(pg, t=60000):
    pg.wait_for_function("dirtyC.size===0 && delC.size===0 && !saving && !dirtyMeta && Object.values(GCOL).every(g=>!g.d.size&&!g.x.size)", timeout=t)
    pg.wait_for_timeout(700)
def mk(pg, n, pre='c', start=0):
    pg.evaluate("""([n,pre,s])=>{for(let i=s;i<s+n;i++){const k=pre+'_'+i;S.clients[k]={key:k,code:k,name:'Cliente '+k,cnpj:'',seg:'Teste',mrr:100+i,productsRaw:'',docs:[],fichas:[]};runAnalysis(S.clients[k],'');touchC(k);}}""", [n, pre, start])
def dblist(pg, path):
    docs, after = [], ''
    while True:
        r = api(pg, {'op': 'list', 'path': path, 'limit': 200, 'after': after})
        docs += r.get('docs', [])
        if not r.get('mais'): break
        after = r.get('depois')
    return docs

# ---------- 1. semear usuário A: 230 clientes (>1 página de 200), marcos, pesquisas, inbox, ocrimg ----------
A = EM('p60a')
pg, st = mkpage(A); ready(pg)
mk(pg, 230, 'ca')
pg.evaluate("""()=>{
 for(let i=0;i<7;i++){const id='mc'+i;S.marcos.push({id,at:'2026-0'+(i+1)+'-01',t:'m'+i});touchG('marcos',id);}
 for(let i=0;i<4;i++){const id='ps'+i;S.pesq.push({id,at:'2026-0'+(i+1)+'-15T10:00:00Z',q:'p'+i});touchPes(id);}
 for(let i=0;i<3;i++){const id='ib'+i;S.inbox.push({id,t:'i'+i});touchI(id);}
 S.ocrimg.push({id:'oc9_0',ocrId:'oc9',i:0,n:2,b64:'AAAA'},{id:'oc9_1',ocrId:'oc9',i:1,n:2,b64:'BBBB'});touchG('ocrimg','oc9_0');touchG('ocrimg','oc9_1');
 S.ocr.push({id:'oc9',at:'2026-01-01T00:00:00Z',nome:'x'});touchG('ocr','oc9');
}""")
idle(pg, 120000)
ck('semente: 230 clientes persistidos (paginação)', len(dblist(pg, f'data/users/{A}/carteira/clientes')) == 230, len(dblist(pg, f'data/users/{A}/carteira/clientes')))
ck('semente: concorrência de gravação ≤ 5', st['maxset'] <= 5, st['maxset'])
ck('semente: gravação paralela de fato (>1 em voo)', st['maxset'] > 1, st['maxset'])
dup = {p: st['sets'].count(p) for p in set(st['sets'])}
cli_sets = [p for p in st['sets'] if '/clientes/' in p]
ck('semente: cada cliente gravado 1 vez (sem duplicata)', len(cli_sets) == len(set(cli_sets)) == 230, (len(cli_sets), len(set(cli_sets))))
ck('semente: todas as gravações no prefixo do próprio usuário', all(p.startswith(f'data/users/{A}/') or p.startswith('catalogo') for p in st['sets']), [p for p in st['sets'] if not p.startswith(f'data/users/{A}/')][:3])
ck('semente: status final salvo', ev(pg, "String(UI.persist).startsWith('salvo')"), ev(pg, 'UI.persist'))
ck('semente: sem erro de página', not st['errs'], st['errs'][:2])
pg.context.close()

# ---------- 2. abertura paralela com os dados do usuário A ----------
pg, st = mkpage(A); ready(pg); pg.wait_for_timeout(1500)
n = ev(pg, 'Object.keys(S.clients).length'); ck('abertura: 230 clientes carregados', n == 230, n)
ck('abertura: marcos/pesquisas/inbox/ocr', ev(pg, '[S.marcos.length,S.pesq.length,S.inbox.length,S.ocr.length]') == [7, 4, 3, 1], ev(pg, '[S.marcos.length,S.pesq.length,S.inbox.length,S.ocr.length]'))
ck('abertura: pesquisas em ordem decrescente (ordem estável)', ev(pg, "S.pesq.map(x=>x.id).join()") == 'ps3,ps2,ps1,ps0', ev(pg, "S.pesq.map(x=>x.id).join()"))
ck('abertura: imagens OCR (ocrimg) remontadas', ev(pg, "ocImgB64('oc9')") == 'AAAABBBB', ev(pg, "ocImgB64('oc9')"))
ck('abertura: concorrência de requisições ≤ 5', st['max'] <= 5, st['max'])
ck('abertura: leituras sobrepostas (>1 em voo)', st['max'] > 1, st['max'])
ck('abertura: nenhuma gravação ao abrir sem alterações', st['sets'] == [] or all('/carteira' == p[-9:] or p.startswith('catalogo') for p in st['sets']), st['sets'][:5])
print('INFO sets ao abrir:', st['sets'][:5], '| leituras:', len([o for o in st['ops'] if o[0] in ('get', 'list')]), '| max em voo:', st['max'])
ck('abertura: status salvo', ev(pg, "String(UI.persist).startsWith('salvo')"), ev(pg, 'UI.persist'))
ck('abertura: sem erro de página', not st['errs'], st['errs'][:2])
pg.context.close()

# ---------- 3. falha parcial na abertura: nada aplicado, modo memória, sem gravar ----------
pg, st = mkpage(A, abort_pat=r'/carteira/inbox'); pg.wait_for_function("String(UI.persist).startsWith('memória (db')", timeout=40000); pg.wait_for_timeout(800)
ck('falha numa leitura: modo memória', ev(pg, "String(UI.persist).startsWith('memória (db')"), ev(pg, 'UI.persist'))
ck('falha numa leitura: estado parcial não aplicado', ev(pg, 'Object.keys(S.clients).length') == 0 and ev(pg, 'META') is None, ev(pg, 'Object.keys(S.clients).length'))
ck('falha numa leitura: sem rejeição solta', not st['errs'], st['errs'][:2])
ck('falha numa leitura: nenhuma gravação disparada', not st['sets'], st['sets'][:3])
pg.context.close()
pg, st = mkpage(A); ready(pg); pg.wait_for_timeout(1000)
ck('após a falha, dados do banco intactos (230)', ev(pg, 'Object.keys(S.clients).length') == 230, ev(pg, 'Object.keys(S.clients).length'))
pg.context.close()

# ---------- 4. solnotas indisponível não impede a abertura ----------
pg, st = mkpage(A, abort_pat=r'/carteira/solnotas'); ready(pg); pg.wait_for_timeout(1500)
ck('solnotas falha: abre normalmente', ev(pg, "String(UI.persist).startsWith('salvo')") and ev(pg, 'Object.keys(S.clients).length') == 230, ev(pg, 'UI.persist'))
ck('solnotas falha: catálogo carregado', ev(pg, 'S.solutions.length') > 0, ev(pg, 'S.solutions.length'))
pg.context.close()

# ---------- 5. queda no meio da gravação: fila preservada, sem perda nem duplicata ----------
C = EM('p60c')
pg, st = mkpage(C, abort_pat=r'"op":\s*"set".*/carteira/clientes/', abort_nth=10); ready(pg)
mk(pg, 30, 'cc')
pg.wait_for_function("String(UI.persist).startsWith('ERRO')", timeout=60000)
ck('queda: status de erro exibido', ev(pg, "String(UI.persist).startsWith('ERRO')"), ev(pg, 'UI.persist'))
pend = ev(pg, 'dirtyC.size'); ck('queda: item falho recolocado na fila', pend >= 1, pend)
ev(pg, 'sched()'); idle(pg, 90000)
ck('queda: retentativa grava tudo (30)', len(dblist(pg, f'data/users/{C}/carteira/clientes')) == 30, len(dblist(pg, f'data/users/{C}/carteira/clientes')))
cs = [p for p in st['sets'] if '/clientes/' in p]; cnt = {p: cs.count(p) for p in set(cs)}
ck('queda: só o item abortado foi tentado 2×', sorted(cnt.values()).count(2) == 1 and max(cnt.values()) == 2 and len(cnt) == 30, sorted(cnt.values())[-3:])
ck('queda: status final salvo', ev(pg, "String(UI.persist).startsWith('salvo')"), ev(pg, 'UI.persist'))
pg.context.close()

# ---------- 6. edição durante a gravação + exclusão paralela + coleções genéricas ----------
D_ = EM('p60d')
pg, st = mkpage(D_); ready(pg)
mk(pg, 60, 'cd')
pg.wait_for_function("saving===true", timeout=15000)
pg.evaluate("S.clients.cd_5.name='EDITADO';touchC('cd_5')")
txt = ev(pg, "UI.persist"); idle(pg, 90000)
doc = api(pg, {'op': 'get', 'path': f'data/users/{D_}/carteira/clientes/cd_5'})
nm = (doc.get('data') or {}).get('name')
ck('edição durante a gravação: versão final persistida', nm == 'EDITADO', nm)
print('INFO status durante gravação:', txt)
pg.evaluate("for(let i=0;i<20;i++){const k='cd_'+i;delete S.clients[k];dirtyC.delete(k);delC.add(k);}sched()"); idle(pg, 90000)
n = len(dblist(pg, f'data/users/{D_}/carteira/clientes')); ck('exclusão paralela: 40 restantes', n == 40, n)
pg.evaluate("""()=>{for(let i=0;i<12;i++){const id='mq'+i;S.marcos.push({id,at:'2026-01-01',t:'x'});touchG('marcos',id);}}"""); idle(pg, 60000)
n = len(dblist(pg, f'data/users/{D_}/carteira/marcos')); ck('coleção genérica: 12 marcos gravados', n == 12, n)
pg.evaluate("""()=>{for(let i=0;i<6;i++){const id='mq'+i;S.marcos=S.marcos.filter(x=>x.id!==id);dropG('marcos',id);}}"""); idle(pg, 60000)
n = len(dblist(pg, f'data/users/{D_}/carteira/marcos')); ck('coleção genérica: 6 excluídos em paralelo', n == 6, n)
ck('sem erro de página (6)', not st['errs'], st['errs'][:2])
pg.context.close()

# ---------- 7. isolamento e conflito de catálogo ----------
pgB, _ = mkpage(EM('p60e')); ready(pgB)
r = api(pgB, {'op': 'list', 'path': f'data/users/{A}/carteira/clientes'})
ck('isolamento: outro usuário não lista a carteira de A', not r.get('ok') or not r.get('docs'), str(r)[:120])
r = api(pgB, {'op': 'set', 'path': f'data/users/{A}/carteira/clientes/hack', 'data': {'key': 'hack'}})
ck('isolamento: outro usuário não grava na carteira de A', not r.get('ok'), str(r)[:120])
r1 = api(pgB, {'op': 'set', 'path': 'catalogo/t60s', 'data': {'id': 't60s', 'nome': 'S', 'cv': 1}})
r2 = api(pgB, {'op': 'set', 'path': 'catalogo/t60s', 'data': {'id': 't60s', 'nome': 'S2', 'cv': 2}})
r3 = api(pgB, {'op': 'set', 'path': 'catalogo/t60s', 'data': {'id': 't60s', 'nome': 'S3', 'cv': 2}})
ck('catálogo: cv sequencial aceito, repetido recusado (409)', r1.get('ok') and r2.get('ok') and not r3.get('ok'), (r1.get('ok'), r2.get('ok'), str(r3)[:100]))
r4 = api(pgB, {'op': 'delete', 'path': 'catalogo/t60s'})
ck('limpeza: item de catálogo de teste removido pelo autor', r4.get('ok'), str(r4)[:100])
pgB.context.close()

print('\nFALHAS:', F if F else 'nenhuma')
