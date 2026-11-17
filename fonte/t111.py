# Rodada 45 — integridade da carteira privada entre sessões: gravação condicional no servidor, mescla por campo e decisão em conflito real
from t40_lib import *
import json, uuid, urllib.request, urllib.error
B='http://localhost:8790'
def http(method,path,body=None,headers=None):
    rq=urllib.request.Request(B+path,data=(json.dumps(body).encode() if body is not None else None),method=method,headers={'content-type':'application/json',**(headers or {})})
    try:
        with urllib.request.urlopen(rq,timeout=30) as r: return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read().decode() or '{}')
run=uuid.uuid4().hex[:6]; U='sx%s@totvs.com.br'%run; hu={'x-test-user':U,'x-test-sub':'sx'+run}; ho={'x-test-user':'ot%s@totvs.com.br'%run,'x-test-sub':'ot'+run}
db=lambda b,h=hu: http('POST','/api/db',b,h)
base='data/users/%s/carteira/clientes/'%U
# ---------- servidor ----------
s,j=db({'op':'set','path':base+'z1','data':{'key':'z1','n':1}}); at1=j.get('at',''); ck('gravação sem base continua aceita (compatível com telas antigas) e devolve a versão', s==200 and len(at1)>=20, j)
s,j=db({'op':'get','path':base+'z1'}); ck('leitura devolve a versão do documento', s==200 and j['at']==at1, j)
s,j=db({'op':'set','path':base+'z1','data':{'key':'z1','n':2},'base':at1}); at2=j.get('at',''); ck('gravação com a versão correta é aceita e a versão avança', s==200 and at2>at1, j)
s,j=db({'op':'set','path':base+'z1','data':{'key':'z1','n':99},'base':at1}); ck('gravação com versão antiga é recusada (409) e devolve o conteúdo atual', s==409 and j['erro']['codigo']=='conflito' and j['atual']['n']==2 and j['at']==at2, j)
s,j=db({'op':'get','path':base+'z1'}); ck('recusa não altera o documento', j['data']['n']==2 and j['at']==at2)
s,j=db({'op':'set','path':base+'z1','data':{'key':'z1','n':5},'base':''}); ck('"não existia" sobre documento existente é recusado', s==409 and j['atual']['n']==2)
s,j=db({'op':'set','path':base+'z2','data':{'key':'z2'},'base':''}); ck('"não existia" sobre documento novo é aceito', s==200 and j.get('at'))
s,j=db({'op':'set','path':base+'z2','data':{'key':'z2','x':1},'base':''}); ck('segunda criação concorrente do mesmo documento é recusada', s==409)
s,j=db({'op':'set','path':base+'z3','data':{'key':'z3'},'base':'2026-01-01T00:00:00.000Z'}); ck('versão informada para documento que já não existe é recusada (excluído em outra sessão)', s==409 and j['atual'] is None and j['at']=='', j)
s,j=db({'op':'set','path':base+'z1','data':{'key':'z1'},'base':'x'*41}); ck('versão de base malformada é recusada', s==400)
s,j=db({'op':'set','path':base+'z1','data':{'key':'z1','n':7},'base':at2},ho); ck('outro usuário não grava na carteira alheia, com ou sem versão', s==403)
import threading
res=[]; ts=[threading.Thread(target=lambda i=i: res.append(db({'op':'set','path':base+'z1','data':{'key':'z1','n':100+i},'base':at2})[0])) for i in range(6)]
[t.start() for t in ts]; [t.join() for t in ts]
ck('6 gravações simultâneas sobre a mesma versão: exatamente 1 aceita, 5 recusadas', sorted(res)==[200,409,409,409,409,409], res)
for z in ('z1','z2'): db({'op':'delete','path':base+z})
# ---------- duas sessões do mesmo executivo ----------
def sess():
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers=hu); pg=ctx.new_page(); er=[]; pg.on('pageerror',lambda e: er.append(str(e))); pg.route('**/*',route); pg.on('dialog',lambda d: d.accept()); pg.goto(B+'/'); pg.wait_for_timeout(3500); return pg,er
CLI="""(k,nome)=>{S.clients[k]={key:k,name:nome,cnpj:'11222333000181',city:'Curitiba',uf:'PR',productsRaw:'Protheus',seg:'manufatura',fichas:[],docs:[],mgmt:{},act:{},opps:[],src:{row:1},notes:'',site:''};runAnalysis(S.clients[k]);touchC(k);return 0}"""
def mk(pg,k,n): pg.evaluate("([k,n])=>("+CLI+")(k,n)",[k,n])
salvo=lambda pg: pg.wait_for_function("()=>!saving&&!dirtyC.size&&!dirtyMeta&&!timer_pend()",timeout=15000)
A,ea=sess(); A.evaluate("()=>{window.timer_pend=()=>false;return 0}")
ck('controle de versão ativo no hospedado', A.evaluate("()=>SINC.on===true"))
mk(A,'K1','Alfa Metal'); mk(A,'K2','Beta Plásticos'); mk(A,'K3','Gama Têxtil'); A.wait_for_timeout(1500); salvo(A)
Bp,eb=sess(); Bp.evaluate("()=>{window.timer_pend=()=>false;return 0}")
ck('segunda sessão carrega os mesmos clientes', Bp.evaluate("()=>['K1','K2','K3'].every(k=>S.clients[k])"))
srv=lambda k: db({'op':'get','path':base+k})[1]['data']
puxar=lambda pg: (pg.evaluate("()=>{document.dispatchEvent(new Event('visibilitychange'));return 0}"), pg.wait_for_timeout(1800))
# 1) alteração chega sozinha quando não há edição local
A.evaluate("()=>{S.clients.K1.notes='nota de A';touchC('K1');return 0}"); A.wait_for_timeout(900); salvo(A)
puxar(Bp)
ck('alteração feita em uma sessão aparece na outra sem recarregar', Bp.evaluate("()=>S.clients.K1.notes")=='nota de A')
ck('a sessão que recebeu não regrava nem cria conflito', Bp.evaluate("()=>!dirtyC.size&&!Object.keys(SINC.conf).length"))
puxar(A); ck('a própria gravação não volta como alteração externa', A.evaluate("()=>S.clients.K1.notes")=='nota de A' and A.evaluate("()=>!dirtyC.size"))
# 2) campos diferentes editados nas duas sessões: união automática, sem perda
A.evaluate("()=>{S.clients.K1.site='https://alfa.example';touchC('K1');return 0}"); A.wait_for_timeout(900); salvo(A)
Bp.evaluate("()=>{S.clients.K1.city='Londrina';touchC('K1');return 0}"); Bp.wait_for_timeout(1500); salvo(Bp)
d=srv('K1'); ck('campos diferentes: o servidor fica com as duas alterações', d['site']=='https://alfa.example' and d['city']=='Londrina' and d['notes']=='nota de A', {k:d.get(k) for k in ('site','city','notes')})
ck('a sessão que gravou por último incorporou o campo da outra', Bp.evaluate("()=>S.clients.K1.site")=='https://alfa.example' and Bp.evaluate("()=>!SINC.conf.K1"))
puxar(A); ck('e a primeira sessão recebe o campo da segunda', A.evaluate("()=>S.clients.K1.city")=='Londrina')
# 3) mesmo campo nas duas sessões: nada é sobrescrito sem decisão
A.evaluate("()=>{S.clients.K1.notes='versão A';S.clients.K1.uf='SC';touchC('K1');return 0}"); A.wait_for_timeout(900); salvo(A)
Bp.evaluate("()=>{S.clients.K1.notes='versão B';touchC('K1');UI.sel='K1';UI.view='cliente';render();return 0}"); Bp.wait_for_timeout(1800)
ck('mesmo campo: o servidor mantém a primeira gravação (nada sobrescrito em silêncio)', srv('K1')['notes']=='versão A')
ck('a segunda sessão mantém o que digitou e registra o conflito só no campo em disputa', Bp.evaluate("()=>S.clients.K1.notes")=='versão B' and Bp.evaluate("()=>SINC.conf.K1.campos.join()")=='notes')
ck('o campo sem disputa (UF) já foi unido', Bp.evaluate("()=>S.clients.K1.uf")=='SC')
t=Bp.evaluate("()=>document.querySelector('#app').innerText")
ck('ficha do cliente avisa, nomeia o campo e oferece as duas saídas', 'alterado em outra sessão' in t and 'Observações' in t and 'Manter a versão desta sessão' in t and 'Usar a versão da outra sessão' in t)
ck('indicador de gravação informa a decisão pendente', 'decisão pendente' in Bp.evaluate("()=>UI.persist"))
Bp.evaluate("()=>{UI.view='geral';render();return 0}"); ck('fora da ficha, uma faixa leva ao cliente em conflito', Bp.evaluate("()=>!!document.querySelector('[data-a=\"sincAbrir\"][data-k=\"K1\"]')"))
Bp.click('[data-a="sincAbrir"][data-k="K1"]'); Bp.click('[data-a="sincMeu"]'); Bp.wait_for_timeout(1500); salvo(Bp)
ck('"manter a versão desta sessão": servidor passa a ter a versão escolhida e o conflito some', srv('K1')['notes']=='versão B' and srv('K1')['uf']=='SC' and Bp.evaluate("()=>!SINC.conf.K1"))
puxar(A); ck('a outra sessão recebe a decisão', A.evaluate("()=>S.clients.K1.notes")=='versão B')
A.evaluate("()=>{S.clients.K1.notes='A de novo';touchC('K1');return 0}"); A.wait_for_timeout(900); salvo(A)
Bp.evaluate("()=>{S.clients.K1.notes='B de novo';touchC('K1');return 0}"); Bp.wait_for_timeout(1800)
Bp.evaluate("()=>{UI.sel='K1';UI.view='cliente';render();return 0}"); Bp.click('[data-a="sincOutro"]'); Bp.wait_for_timeout(1500); salvo(Bp)
ck('"usar a versão da outra sessão": local e servidor ficam com a versão da outra', Bp.evaluate("()=>S.clients.K1.notes")=='A de novo' and srv('K1')['notes']=='A de novo' and Bp.evaluate("()=>!SINC.conf.K1"))
# 4) edição continuada durante o conflito não perde nada
A.evaluate("()=>{S.clients.K3.notes='A3';touchC('K3');return 0}"); A.wait_for_timeout(900); salvo(A)
Bp.evaluate("()=>{S.clients.K3.notes='B3';touchC('K3');return 0}"); Bp.wait_for_timeout(1500)
Bp.evaluate("()=>{S.clients.K3.site='https://gama.example';touchC('K3');return 0}"); Bp.wait_for_timeout(1500)
ck('editar outro campo com conflito pendente mantém o conflito e não grava por cima', srv('K3')['notes']=='A3' and Bp.evaluate("()=>SINC.conf.K3.campos.join()")=='notes' and Bp.evaluate("()=>S.clients.K3.site")=='https://gama.example')
Bp.evaluate("()=>{sincDecidir('K3','meu');return 0}"); Bp.wait_for_timeout(1500); salvo(Bp)
d=srv('K3'); ck('após a decisão, tudo o que foi digitado durante o conflito é gravado', d['notes']=='B3' and d['site']=='https://gama.example', d.get('notes'))
# 5) cliente excluído na outra sessão
A.evaluate("async()=>{delete S.clients.K2;await CL.doc('K2').delete();return 0}")
Bp.evaluate("()=>{S.clients.K2.notes='edição tardia';touchC('K2');return 0}"); Bp.wait_for_timeout(1800)
ck('editar cliente excluído em outra sessão não o recria sozinho', db({'op':'get','path':base+'K2'})[1]['exists'] is False and Bp.evaluate("()=>SINC.conf.K2.excl===true"))
Bp.evaluate("()=>{UI.sel='K2';UI.view='cliente';render();return 0}"); ck('aviso de exclusão com as duas saídas', 'excluído em outra sessão' in Bp.evaluate("()=>document.querySelector('#app').innerText"))
Bp.click('[data-a="sincOutro"]'); Bp.wait_for_timeout(1200)
ck('"remover também aqui": some da sessão e não é regravado', Bp.evaluate("()=>!S.clients.K2&&!dirtyC.has('K2')&&UI.view==='clientes'") and db({'op':'get','path':base+'K2'})[1]['exists'] is False)
# 6) ajustes gerais (documento único)
A.evaluate("()=>{S.meta.fcLink={...(S.meta.fcLink||{}),o1:'K1'};touchMeta();return 0}"); A.wait_for_timeout(900); salvo(A)
Bp.evaluate("()=>{S.meta.fcLink={...(S.meta.fcLink||{}),o2:'K3'};touchMeta();return 0}"); Bp.wait_for_timeout(1800); salvo(Bp)
m=db({'op':'get','path':'data/users/%s/carteira'%U})[1]['data']['meta']
ck('ajustes gerais: vínculos de forecast feitos em sessões diferentes são unidos', m['fcLink']=={'o1':'K1','o2':'K3'}, m.get('fcLink'))
puxar(A); ck('e chegam à outra sessão sem recarregar', A.evaluate("()=>S.meta.fcLink.o2")=='K3')
A.evaluate("()=>{S.meta.fcLink.o1='K3';touchMeta();return 0}"); A.wait_for_timeout(900); salvo(A)
Bp.evaluate("()=>{S.meta.fcLink.o1='K1x';touchMeta();return 0}"); Bp.wait_for_timeout(1800); salvo(Bp)
ck('mesmo ajuste nas duas sessões: vale o da sessão que gravou por último e o fato fica registrado', db({'op':'get','path':'data/users/%s/carteira'%U})[1]['data']['meta']['fcLink']['o1']=='K1x' and Bp.evaluate("()=>UI.log.some(l=>/Ajustes gerais alterados nas duas sessões \\(fcLink\\.o1\\)/.test(l.t))"))
# 7) recarregar: nada divergente
Bp.reload(); Bp.wait_for_timeout(3500)
ck('após recarregar, a sessão reflete exatamente o servidor', Bp.evaluate("()=>S.clients.K1.notes")==srv('K1')['notes'] and Bp.evaluate("()=>S.clients.K3.site")=='https://gama.example' and Bp.evaluate("()=>!S.clients.K2"))
# 8) mescla: unidade
u=A.evaluate("""()=>{const B=sincHashes({a:1,b:2,c:3,d:{x:1,y:1}},true);
 const m=sincMerge({a:1,b:20,c:30,d:{x:5,y:1}},{a:10,b:2,c:31,d:{x:1,y:9}},B,true);
 const s=sincMerge({a:1},{a:2},null); const ig=sincMerge({changes:[1],a:1},{changes:[2],a:1},sincHashes({changes:[],a:1}));
 return {m,s,ig}}""")
ck('mescla: só remoto → adota; só local → mantém; ambos → conflito; subitens unidos', u['m']['tomou']==['a','d'] and u['m']['conf']==['c'] and u['m']['val']['a']==10 and u['m']['val']['d']=={'x':5,'y':9} and 'b' not in u['m']['val'], u['m'])
ck('mescla sem base conhecida: toda diferença vira decisão (nunca adota em silêncio)', u['s']['conf']==['a'] and u['s']['tomou']==[])
ck('campos derivados da análise não geram decisão', u['ig']['conf']==[] and u['ig']['tomou']==[])
# 9) custo
ms=A.evaluate("""()=>{const big=[];for(let i=0;i<400;i++){const c=JSON.parse(JSON.stringify(S.clients.K1));c.key='P'+i;c.docs=[{id:'d',text:'x'.repeat(40000)}];big.push(c);}const t=performance.now();big.forEach(c=>sincHashes(freezeClient(c)));return Math.round(performance.now()-t)}""")
ck('base de comparação de 400 clientes (~40 KB cada) em menos de 1,5 s', ms<1500, ms); print('INFO base 400 clientes: %d ms'%ms)
ck('sem erros de página', not ea and not eb, (ea+eb)[:3])
for k in ('K1','K2','K3'): db({'op':'delete','path':base+k})
db({'op':'delete','path':'data/users/%s/carteira'%U})
p.stop(); print('FALHAS:',F) if F else print('OK t111')
