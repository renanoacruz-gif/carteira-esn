from t40_lib import *
import uuid, subprocess, urllib.request, urllib.error
B='http://localhost:8790'; ADM='renan.oscar@totvs.com.br'; SUB='sub-renan-001'
def call(path,body=None,user=None,sub=None):
    h={'content-type':'application/json'}
    if user: h['x-test-user']=user
    if sub: h['x-test-sub']=sub
    req=urllib.request.Request(B+path,data=json.dumps(body).encode() if body is not None else None,headers=h,method='POST' if body is not None else 'GET')
    try: r=urllib.request.urlopen(req,timeout=20); return r.status,json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code,{}
def d1(sql):
    o=subprocess.run(['/tmp/wr/node_modules/.bin/wrangler','d1','execute','carteira-esn','--local','--persist-to','/tmp/wr_l2/st','--json','--command',sql],cwd='/tmp/wr_l2',capture_output=True,text=True,timeout=60).stdout
    return json.loads(o)[0]['results']
run=uuid.uuid4().hex[:8]; email='rum%s@totvs.com.br'%run
def abrir(em,block=False):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':em})
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.route('**/*',route)
    if block: pg.route('**/api/ev',lambda r: r.abort())
    pg.goto('http://localhost:8790/'); pg.wait_for_timeout(5500); return ctx,pg,errs
ctx,pg,errs=abrir(email)
rows=d1("SELECT func,fase,resultado,dur_ms,meta FROM eventos WHERE usuario='%s' AND func='desempenho_abertura'"%email)
ck('1 evento por abertura', len(rows)==1, rows)
r=rows[0] if rows else {}
m=json.loads(r.get('meta') or '{}')
ck('concluida/ok com duração da fase de dados', r.get('fase')=='concluida' and r.get('resultado')=='ok' and isinstance(r.get('dur_ms'),int) and r['dur_ms']>=0, r)
ck('meta só com tempos e contagem (sem texto/URL/nome)', set(m)<= {'fcp_ms','lcp_ms','pronto_ms','cls_m','clientes'} and all(isinstance(v,int) for v in m.values()), m)
ck('fcp/pronto plausíveis (>0 e pronto>=fcp)', m.get('fcp_ms',0)>0 and m.get('pronto_ms',0)>=m.get('fcp_ms',0), m)
ck('sem erro de página', not errs, errs)
ctx.close()
ctx,pg,errs=abrir(email)
rows=d1("SELECT id FROM eventos WHERE usuario='%s' AND func='desempenho_abertura'"%email)
ck('2ª abertura = 2º evento (ids distintos)', len(rows)==2 and len({x['id'] for x in rows})==2, rows)
ck('evento emitido uma vez por abertura (não repete ao navegar)', pg.evaluate("(()=>{const n=TEL.q.length;UI.view='clientes';render();UI.view='geral';render();return telAbertura.feito===1})()") is True)
ctx.close()
# coleta quebrada não afeta o uso
em2='rum2%s@totvs.com.br'%run; ctx,pg,errs=abrir(em2,block=True)
ck('/api/ev indisponível: app abre, sem erro de página', not errs and pg.evaluate("document.querySelector('#app').children.length>0"), errs)
ck('/api/ev indisponível: nada gravado', len(d1("SELECT 1 FROM eventos WHERE usuario='%s' AND func='desempenho_abertura'"%em2))==0)
ctx.close()
# sanitização no servidor
em3='rum3%s@totvs.com.br'%run
ev1={'id':'p%sa'%run,'func':'desempenho_abertura','fase':'concluida','resultado':'ok','dur':900,'meta':{'fcp_ms':120,'lcp_ms':'texto','pronto_ms':-5,'cls_m':3,'clientes':300,'url':'https://x.com/segredo','nome':'ACME'}}
s,j=call('/api/ev',{'eventos':[ev1]},user=em3,sub='s3'); ck('servidor aceita o evento',s==200 and j.get('aceitos')==1,(s,j))
m=json.loads((d1("SELECT meta FROM eventos WHERE id='p%sa'"%run) or [{'meta':'{}'}])[0]['meta'] or '{}')
ck('servidor descarta texto, negativo, url e nome', m=={'fcp_ms':120,'cls_m':3,'clientes':300}, m)
s,j=call('/api/ev',{'eventos':[dict(ev1,id='p%sb'%run,func='desempenho_qualquer')]},user=em3,sub='s3'); ck('func desconhecida rejeitada',j.get('aceitos')==0,j)
s,j=call('/api/ev',{'eventos':[ev1]}); ck('anônimo negado',s in(401,403),(s,j))
# painel admin lista o recurso, fora de "uso útil"
s,j=call('/api/adm/resumo?dias=7',user=ADM,sub=SUB)
rec=[x for x in j.get('recursos',[]) if x['func']=='desempenho_abertura']
ck('painel lista Desempenho da abertura', s==200 and len(rec)==1 and rec[0].get('concluidas',0)>=3, (s,rec))
u=next((x for x in j.get('usuarios',[]) if x['email']==email),None)
ck('não conta como recurso utilizado nem torna o usuário "ativo"', not u or 'desempenho_abertura' not in u.get('recursos_utilizados',[]), u)
print('FAILS',F)
