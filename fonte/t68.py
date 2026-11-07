# Lembrete: adoção no painel admin + aviso com número agregado. Requer servidor em :8790 (VAPID_*, --test-scheduled, ALLOW_TEST_USER=1).
from t40_lib import *
import json, threading, subprocess, urllib.request, urllib.error, uuid, time, datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
H='http://localhost:8790'; MOCK=9912; hits=[]
class M(BaseHTTPRequestHandler):
    def do_POST(self):
        hits.append(self.path); self.send_response(201); self.send_header('content-length','0'); self.end_headers()
    def log_message(self,*a): pass
srv=HTTPServer(('127.0.0.1',MOCK),M); threading.Thread(target=srv.serve_forever,daemon=True).start()
ADM='renan.oscar@totvs.com.br'; ASUB='sub-renan-001'
def call(path,body=None,user=None,sub=None,method=None):
    h={'content-type':'application/json'}
    if user: h['x-test-user']=user
    if sub: h['x-test-sub']=sub
    rq=urllib.request.Request(H+path,data=None if body is None else json.dumps(body).encode(),headers=h,method=method or ('GET' if body is None else 'POST'))
    try:
        with urllib.request.urlopen(rq) as r: return r.status,json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try: return e.code,json.loads(e.read() or b'{}')
        except Exception: return e.code,{}
def d1(sql):
    r=subprocess.run(['/tmp/wr/node_modules/.bin/wrangler','d1','execute','carteira-esn','--local','--persist-to','/tmp/wr_l2/st','--json','--command',sql],cwd='/tmp/wr_l2',capture_output=True,text=True)
    try: return json.loads(r.stdout)[0].get('results',[])
    except Exception: return r.stdout+r.stderr
def sched(ms,cron='0+12+*+*+MON-FRI'): return urllib.request.urlopen(H+'/cdn-cgi/handler/scheduled?cron=%s&time=%d'%(cron,ms)).read()
ep=lambda n: 'http://127.0.0.1:%d/push/%s'%(MOCK,n)
adm=lambda: call('/api/adm/lembrete',user=ADM,sub=ASUB)
s=uuid.uuid4().hex[:6]; A='a%s@totvs.com.br'%s; B='b%s@totvs.com.br'%s
# --- resumo agregado (item 2)
ck('resumo sem identidade: 401', call('/api/push/resumo')[0]==401)
ck('resumo GET vazio', call('/api/push/resumo',user=A)[1].get('n') is None)
st,j=call('/api/push/resumo',{'n':3},A); ck('sem aparelho inscrito: nada é guardado', st==200 and j.get('ignorado') is True and call('/api/push/resumo',user=A)[1].get('n') is None,(st,j))
call('/api/push/inscrever',{'endpoint':ep('a1')},A); call('/api/push/inscrever',{'endpoint':ep('a2')},A)
st,j=call('/api/push/resumo',{'n':3},A); st2,g=call('/api/push/resumo',user=A)
ck('resumo gravado e lido', st==200 and g.get('n')==3 and isinstance(g.get('em'),str),(st,j,g))
for bad in [-1,1000,1.5,'3',None,'x',True,[1],{'a':1}]:
    st,j=call('/api/push/resumo',{'n':bad},A); ck('n inválido recusado: %r'%(bad,), st==400 and j['erro']['codigo']=='requisicao_invalida',(st,j))
ck('n inválido não altera o valor', call('/api/push/resumo',user=A)[1].get('n')==3)
st,j=call('/api/push/resumo',{'n':0},A); ck('n=0 aceito', st==200 and call('/api/push/resumo',user=A)[1].get('n')==0)
call('/api/push/resumo',{'n':5},A)
ck('outra conta não lê o resumo', call('/api/push/resumo',user=B)[1].get('n') is None)
st,j=call('/api/push/resumo',{'n':2,'email':B,'user':B},A); ck('e-mail no corpo é ignorado (grava só na própria conta)', call('/api/push/resumo',user=B)[1].get('n') is None and call('/api/push/resumo',user=A)[1].get('n')==2)
r=d1("SELECT * FROM push_resumo WHERE email='%s'"%A); ck('tabela guarda só e-mail, inteiro e data', isinstance(r,list) and len(r)==1 and set(r[0].keys())=={'email','n','em'},r)
call('/api/push/cancelar',{'endpoint':ep('a1')},A); ck('cancelar 1 de 2 aparelhos mantém o resumo', call('/api/push/resumo',user=A)[1].get('n')==2)
call('/api/push/cancelar',{},A); ck('cancelar todos apaga o resumo', call('/api/push/resumo',user=A)[1].get('n') is None and d1("SELECT COUNT(*) c FROM push_resumo WHERE email='%s'"%A)[0]['c']==0)
# --- registro por turno (item 1)
U=['t%s%d@totvs.com.br'%(s,i) for i in range(3)]
for i,u in enumerate(U): call('/api/push/inscrever',{'endpoint':ep('T%d'%i)},u)
call('/api/push/inscrever',{'endpoint':'http://127.0.0.1:%d/push/404'%MOCK},U[0]) if False else None
d1("DELETE FROM push_subs WHERE email NOT LIKE 't%s%%'"%s); d1("DELETE FROM adm_cfg WHERE chave LIKE 'push_dia%'"); d1("DELETE FROM push_envios")
t0=int(datetime.datetime(2026,11,4,12,0,tzinfo=datetime.timezone.utc).timestamp()*1000)  # qua 09:00 BRT
d1("UPDATE usuarios SET ultimo_acesso=NULL")
d1("INSERT OR REPLACE INTO push_resumo VALUES('orfao%s@totvs.com.br',2,'2026-11-01T00:00:00Z')"%s)
sched(t0); time.sleep(1.5)
r=d1("SELECT * FROM push_envios WHERE dia='2026-11-04'")
ck('turno da manhã registrado', len(r)==1 and r[0]['turno']=='manha' and r[0]['enviados']>=3 and r[0]['falhas']==0 and r[0]['aparelhos']>=3,r)
sched(t0); time.sleep(1)
ck('número de quem não tem mais aparelho é apagado no turno', d1("SELECT COUNT(*) c FROM push_resumo WHERE email LIKE 'orfao%'")[0]['c']==0)
ck('repetir o turno não duplica nem reenvia', d1("SELECT COUNT(*) c FROM push_envios WHERE dia='2026-11-04' AND turno='manha'")[0]['c']==1)
sched(int(t0+5*3600*1000),'0+17+*+*+MON-FRI'); time.sleep(1.5)
r=d1("SELECT turno FROM push_envios WHERE dia='2026-11-04' ORDER BY turno"); ck('turno da tarde registrado separadamente', [x['turno'] for x in r]==['manha','tarde'],r)
d1("INSERT OR REPLACE INTO push_envios(dia,turno,aparelhos,enviados,pulados_uso,removidos,falhas,adiados,config_invalida,ts) VALUES('2025-01-02','manha',1,1,0,0,0,0,0,'2025-01-02T12:00:00Z')")
sched(int(t0+86400000)); time.sleep(1.5)  # qui 09:00 → roda a retenção
ck('retenção apaga turnos com mais de ~90 dias', d1("SELECT COUNT(*) c FROM push_envios WHERE dia='2025-01-02'")[0]['c']==0 and d1("SELECT COUNT(*) c FROM push_envios WHERE dia='2026-11-05'")[0]['c']==1)
# --- rota do painel (acesso)
st,j=call('/api/adm/lembrete'); ck('painel lembretes: anônimo negado', st in (401,403) and not j.get('ok'),(st,j))
st,j=call('/api/adm/lembrete',user=A,sub='sub-'+A); ck('painel lembretes: outro usuário 403', st==403,(st,j))
st,j=call('/api/adm/lembrete',user=ADM); ck('painel lembretes: e-mail admin sem identidade verificada negado', st in (401,403),(st,j))
st,j=call('/api/adm/lembrete',{},ADM,ASUB,method='POST'); ck('painel lembretes: POST não existe', st in (404,405) and not j.get('ok'),(st,j))
st,j=adm(); ck('painel lembretes: admin lê', st==200 and j.get('ok') and j.get('configurado') is True,(st,j))
ck('painel: contagens coerentes', j['aparelhos']>=3 and j['usuarios']>=3 and j['ultimos_7_dias']['enviados']>=3 and len(j['historico'])>=3,j)
txt=json.dumps(j); ck('painel não expõe e-mail nem endereço de aparelho', '@totvs' not in txt and 'http' not in txt and '/push/' not in txt,txt[:300])
# --- alertas
now=datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(hours=3); mins=now.hour*60+now.minute; wk=now.weekday()<5; hoje=now.strftime('%Y-%m-%d')
d1("DELETE FROM push_envios"); st,j=adm(); cods=[a['codigo'] for a in j['alertas']]
esperaM=wk and mins>=9*60+30; esperaT=wk and mins>=14*60+30
ck('alerta de turno não executado segue o relógio (hoje, sem registros)', cods.count('turno_nao_executou')==(int(esperaM)+int(esperaT)),(cods,mins,wk))
d1("INSERT INTO push_envios VALUES('%s','manha',3,3,0,0,0,0,0,'%s')"%(hoje,now.isoformat()+'Z')); d1("INSERT INTO push_envios VALUES('%s','tarde',3,3,0,0,0,0,0,'%s')"%(hoje,now.isoformat()+'Z'))
st,j=adm(); ck('com os dois turnos de hoje registrados não há alerta de turno', 'turno_nao_executou' not in [a['codigo'] for a in j['alertas']],j['alertas'])
d1("DELETE FROM push_envios"); d1("INSERT INTO push_envios VALUES('2026-11-03','manha',2,0,0,0,2,0,1,'2026-11-03T12:00:05Z')")
st,j=adm(); cods=[a['codigo'] for a in j['alertas']]; ck('alerta de configuração recusada (VAPID inválido)', 'config_invalida' in cods,cods)
ck('falhas altas (2 de 2) abaixo do mínimo de 3 tentativas: sem alerta', 'falhas_altas' not in cods,cods)
d1("INSERT INTO push_envios VALUES('2026-11-03','tarde',3,1,0,0,2,0,0,'2026-11-03T17:00:05Z')")
st,j=adm(); cods=[a['codigo'] for a in j['alertas']]; ck('alerta de falhas altas (4 de 5)', 'falhas_altas' in cods,cods)
d1("INSERT INTO push_envios VALUES('2026-11-04','manha',3,3,0,0,0,0,0,'2026-11-04T12:00:05Z')"); d1("INSERT INTO push_envios VALUES('2026-11-04','tarde',3,3,0,0,0,0,0,'2026-11-04T17:00:05Z')"); d1("INSERT INTO push_envios VALUES('2026-11-05','manha',3,3,0,0,0,0,0,'2026-11-05T12:00:05Z')")
st,j=adm(); cods=[a['codigo'] for a in j['alertas']]; ck('o alerta some quando os últimos turnos voltam ao normal', 'config_invalida' not in cods and 'falhas_altas' not in cods,cods)
d1("DELETE FROM push_envios")
# --- UI (painel + relato do número)
if True:
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':ADM,'x-test-sub':ASUB}); pg=ctx.new_page(); errs=[]; reqs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('request',lambda r: reqs.append((r.method,r.post_data)) if r.url.endswith('/api/push/resumo') else None)
    d1("INSERT INTO push_envios VALUES('2026-11-05','manha',3,2,1,0,0,0,0,'2026-11-05T12:00:05Z')")
    pg.goto(H+'/'); pg.wait_for_timeout(1500)
    pg.evaluate("UI.view='adm'; render()"); pg.wait_for_selector('#adm-lem',timeout=15000)
    t=pg.inner_text('#adm-lem'); ck('painel mostra o card de lembretes', 'Lembretes (push)' in t and 'Aparelhos ativos' in t and 'chaves configuradas' in t,t[:200])
    ck('card mostra enviados e dispensados', 'Enviados (7 dias)' in t and 'Dispensados' in t)
    ck('histórico por turno listado', pg.locator('#adm-lem tbody tr').count()>=1)
    ck('sem erros de página no painel', not errs,errs)
    pg.evaluate("LEM.local=false; S.clients={k:{name:'X',key:'k',opps:[]}}; hojeItens();"); pg.wait_for_timeout(3500)
    ck('sem aparelho ativo neste navegador: não envia número', not reqs,reqs)
    pg.evaluate("LEM.local=true; hojeItens();"); pg.wait_for_timeout(3500)
    ck('com aparelho ativo: envia só {n:inteiro}', len(reqs)==1 and reqs[0][0]=='POST' and json.loads(reqs[0][1])=={'n':0},reqs)
    pg.evaluate("hojeItens();"); pg.wait_for_timeout(3200)
    ck('mesmo número em <3 h: não repete', len(reqs)==1,reqs)
    pg.evaluate("S.clients={}; hojeItens();"); pg.wait_for_timeout(3200)
    ck('carteira vazia/não carregada: não sobrescreve com zero', len(reqs)==1,reqs)
    pg.evaluate("LEMR.n=4; lemReportar();"); pg.wait_for_timeout(3500)
    ck('número novo é enviado', len(reqs)==2 and json.loads(reqs[1][1])=={'n':4},reqs)
    ctx.close()
d1("DELETE FROM push_envios"); d1("DELETE FROM adm_cfg WHERE chave LIKE 'push_dia%'")
rsw=subprocess.run(['node','/home/claude/carteira-esn/fonte/t68_sw.mjs','/home/claude/carteira-esn/public/sw.js'],capture_output=True,text=True); print(rsw.stdout.strip()); ck('texto do aviso no service worker (sandbox)', rsw.returncode==0, rsw.stdout[-300:]+rsw.stderr[-200:])
print('FALHAS:',F) if F else print('TUDO OK')
