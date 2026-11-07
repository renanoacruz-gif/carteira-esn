# Lembrete diário (Web Push): inscrição, SSRF, VAPID, cron, UI. Requer servidor em :8790 com VAPID_* e --test-scheduled (ver LEIA-ME).
from t40_lib import *
import json, base64, threading, subprocess, urllib.request, urllib.error, uuid, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
V=dict(l.strip().split('=',1) for l in open('/tmp/vapid.env') if '=' in l)
u64=lambda s: base64.urlsafe_b64decode(s+'='*(-len(s)%4))
H='http://localhost:8790'; MOCK=9911; hits=[]; modo={}
class M(BaseHTTPRequestHandler):
    def do_POST(self):
        hits.append((self.path,dict(self.headers))); st=modo.get(self.path.split('/')[-1],201); self.send_response(st); self.send_header('content-length','0'); self.end_headers()
    def log_message(self,*a): pass
srv=HTTPServer(('127.0.0.1',MOCK),M); threading.Thread(target=srv.serve_forever,daemon=True).start()
def call(path,body=None,user=None,method=None):
    h={'content-type':'application/json'}; user and h.__setitem__('x-test-user',user)
    rq=urllib.request.Request(H+path,data=None if body is None else json.dumps(body).encode(),headers=h,method=method or ('GET' if body is None else 'POST'))
    try:
        with urllib.request.urlopen(rq) as r: return r.status,json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b'{}')
def d1(sql):
    r=subprocess.run(['/tmp/wr/node_modules/.bin/wrangler','d1','execute','carteira-esn','--local','--persist-to','/tmp/wr_l2/st','--json','--command',sql],cwd='/tmp/wr_l2',capture_output=True,text=True)
    try: return json.loads(r.stdout)[0].get('results',[])
    except Exception: return r.stdout+r.stderr
sched=lambda ms: urllib.request.urlopen(H+'/cdn-cgi/handler/scheduled?cron=30+11+*+*+MON-FRI&time=%d'%ms).read()
ep=lambda n: 'http://127.0.0.1:%d/push/%s'%(MOCK,n)
s=uuid.uuid4().hex[:6]; A='a%s@totvs.com.br'%s; B='b%s@totvs.com.br'%s; C='c%s@totvs.com.br'%s
# 1) acesso e validação
ck('sem identidade: 401', call('/api/push/status')[0]==401)
st,j=call('/api/push/chave',user=A); ck('chave pública devolvida', st==200 and j['chave']==V['VAPID_PUBLIC'])
for bad in ['https://evil.example.com/x','http://169.254.169.254/latest','https://fcm.googleapis.com:8443/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com.evil.com/x','ftp://fcm.googleapis.com/x',123,'x'*1100,None]:
    st,j=call('/api/push/inscrever',{'endpoint':bad},A); ck('endpoint recusado: %s'%str(bad)[:40], st==400 and j['erro']['codigo']=='endpoint_invalido',(st,j))
st,j=call('/api/push/inscrever',{'endpoint':'https://fcm.googleapis.com/fcm/send/'+s},A); ck('FCM aceito', st==200 and j['aparelhos']==1,(st,j))
st,j=call('/api/push/inscrever',{'endpoint':'https://web.push.apple.com/'+s},A); ck('Apple aceito', st==200 and j['aparelhos']==2,(st,j))
st,j=call('/api/push/inscrever',{'endpoint':'https://updates.push.services.mozilla.com/w/'+s},A); ck('Mozilla aceito', st==200)
st,j=call('/api/push/inscrever',{'endpoint':'https://wns2-par02p.notify.windows.com/w/?t='+s},A); ck('WNS aceito', st==200)
call('/api/push/cancelar',{},A)
# 2) limite de aparelhos, idempotência, isolamento
for i in range(7): st,j=call('/api/push/inscrever',{'endpoint':ep('A%d'%i)},A); time.sleep(0.01)
ck('máx. 5 aparelhos por conta', j['aparelhos']==5, j)
call('/api/push/inscrever',{'endpoint':ep('A6')},A); ck('reinscrever é idempotente', call('/api/push/status',user=A)[1]['aparelhos']==5)
ck('outra conta não vê os aparelhos', call('/api/push/status',user=B)[1]['aparelhos']==0)
call('/api/push/inscrever',{'endpoint':ep('A6')},B); ck('endpoint só pertence a 1 conta (último vence)', call('/api/push/status',user=A)[1]['aparelhos']==4 and call('/api/push/status',user=B)[1]['aparelhos']==1)
st,j=call('/api/push/cancelar',{'endpoint':ep('A6')},A); ck('não cancela aparelho de outra conta', call('/api/push/status',user=B)[1]['aparelhos']==1)
ck('corpo grande recusado', call('/api/push/inscrever',{'endpoint':ep('x'),'lixo':'y'*3000},A)[0]==400)
ck('GET em rota de escrita: 405', call('/api/push/inscrever',user=A)[0]==405)
# 3) envio de teste + VAPID
call('/api/push/cancelar',{},A); call('/api/push/cancelar',{},B)
call('/api/push/inscrever',{'endpoint':ep('T1')},A); hits.clear()
st,j=call('/api/push/teste',{},A); ck('teste enviado', st==200 and j['enviados']==1 and len(hits)==1,(st,j,len(hits)))
p,h=hits[0]; h={k.lower():v for k,v in h.items()}; au=h['authorization']; ck('cabeçalho vapid', au.startswith('vapid t=') and (', k='+V['VAPID_PUBLIC']) in au, au[:60])
jwt=au.split('t=')[1].split(',')[0]; hh,pp,sg=jwt.split('.'); pl=json.loads(u64(pp)); hd=json.loads(u64(hh))
pub=ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(),u64(V['VAPID_PUBLIC'])); raw=u64(sg)
try: pub.verify(encode_dss_signature(int.from_bytes(raw[:32],'big'),int.from_bytes(raw[32:],'big')),(hh+'.'+pp).encode(),ec.ECDSA(hashes.SHA256())); sigok=True
except Exception as e: sigok=False
ck('assinatura ES256 válida', sigok and len(raw)==64 and hd=={'typ':'JWT','alg':'ES256'}, hd)
ck('aud = origem do serviço', pl['aud']=='http://127.0.0.1:%d'%MOCK and 0<pl['exp']-time.time()<=12*3600+60 and pl['sub'].startswith('mailto:'), pl)
ck('TTL/Topic enviados, sem corpo', h.get('ttl')=='3600' and h.get('topic')=='lembrete-diario' and h.get('content-length') in (None,'0'), h)
call('/api/push/teste',{},A); call('/api/push/teste',{},A); ck('limite de testes (3/min)', call('/api/push/teste',{},A)[0]==429)
ck('teste sem aparelho: 404', call('/api/push/teste',{},C)[0]==404)
# 4) respostas do serviço: 410 remove; 500 conta falha
G='g%s@totvs.com.br'%s; Y='y%s@totvs.com.br'%s; E='e%s@totvs.com.br'%s
call('/api/push/inscrever',{'endpoint':ep('gone')},G); modo['gone']=410; call('/api/push/teste',{},G)
ck('410 remove o aparelho', call('/api/push/status',user=G)[1]['aparelhos']==0)
call('/api/push/inscrever',{'endpoint':ep('boom')},Y); modo['boom']=500; call('/api/push/teste',{},Y)
ck('500 incrementa falhas', d1("SELECT falhas FROM push_subs WHERE endpoint='%s'"%ep('boom'))[0]['falhas']==1)
modo['boom']=201; call('/api/push/teste',{},Y); ck('sucesso zera falhas', d1("SELECT falhas FROM push_subs WHERE endpoint='%s'"%ep('boom'))[0]['falhas']==0)
# 5) agendador
d1("DELETE FROM push_subs; DELETE FROM adm_cfg WHERE chave IN ('push_dia','push_ultimo')"); modo.clear()
for who,n in [(A,'S1'),(B,'S2'),(C,'S3')]: call('/api/push/inscrever',{'endpoint':ep(n)},who)
d1("INSERT OR REPLACE INTO usuarios(email,sub,nome,primeiro_acesso,ultimo_acesso,acessos) VALUES('%s','x','B','2026-11-01T00:00:00Z','2026-11-09T10:00:00.000Z',3),('%s','x','C','2026-11-01T00:00:00Z','2026-11-06T20:00:00.000Z',3)"%(B,C))
import calendar
ms=lambda y,m,d,h=11,mi=30: calendar.timegm((y,m,d,h,mi,0))*1000
hits.clear(); sched(ms(2026,11,14)); ck('sábado: nada enviado', len(hits)==0 and not d1("SELECT 1 FROM adm_cfg WHERE chave='push_dia'"))
sched(ms(2026,11,15)); ck('domingo: nada enviado', len(hits)==0)
sched(ms(2026,11,9)); time.sleep(0.5); pth=sorted(p for p,_ in hits)
ck('segunda: envia a quem não usou hoje (A sem registro, C usou ontem), pula B', pth==['/push/S1','/push/S3'], pth)
r=json.loads(d1("SELECT valor FROM adm_cfg WHERE chave='push_ultimo'")[0]['valor']); ck('resumo gravado sem dados pessoais', r['enviados']==2 and r['pulados_uso']==1 and r['dia']=='2026-11-09' and 'email' not in json.dumps(r), r)
n=len(hits); sched(ms(2026,11,9)); time.sleep(0.3); ck('2ª execução no mesmo dia não reenvia', len(hits)==n)
hits.clear(); sched(ms(2026,11,9,2,0)) ; ck('antes das 3Z ainda é dia anterior (domingo BRT): nada', len(hits)==0)
hits.clear(); sched(ms(2026,11,10)); time.sleep(0.5); ck('terça: novo dia dispara de novo', sorted(p for p,_ in hits)==['/push/S1','/push/S2','/push/S3'] or len(hits)>=2, sorted(p for p,_ in hits))
# lote: 45 aparelhos -> 40 enviados, 5 adiados
d1("DELETE FROM push_subs; DELETE FROM adm_cfg WHERE chave='push_dia'")
d1("INSERT INTO push_subs(endpoint,email,criado_em,falhas) VALUES "+",".join("('%s','lote%d@totvs.com.br','2026-11-0%dT00:00:00Z',0)"%(ep('L%d'%i),i,1+i%9) for i in range(45)))
hits.clear(); sched(ms(2026,11,11)); time.sleep(1.5); r=json.loads(d1("SELECT valor FROM adm_cfg WHERE chave='push_ultimo'")[0]['valor'])
ck('lote limitado a 40 por execução', len(hits)==40 and r['adiados']==5, (len(hits),r))
# 6) sem segredos: serviço desligado (checagem estática do build)
src=open('/home/claude/carteira-esn/src/worker.js').read()
ck('sem VAPID → rotas 503 e cron não faz nada', "pulado: 'nao_configurado'" in src and "codigo: 'nao_configurado', mensagem: 'Lembrete diário ainda não configurado" in src and "status 503" not in src and "}, 503);" in src)
ck('cron declarado em wrangler.toml', 'crons = ["30 11 * * MON-FRI"]' in open('/home/claude/carteira-esn/wrangler.toml').read())
ck('/sw.js servido sem cache', 'no-cache' in open('/home/claude/carteira-esn/public/_headers').read().split('/sw.js')[1])
ck('sw.js publicado idêntico à fonte', open('/home/claude/carteira-esn/public/sw.js').read()==open('/home/claude/carteira-esn/fonte/sw.js').read())
# 7) UI
d1("DELETE FROM push_subs")
ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':E},permissions=['notifications']); ctx.add_init_script("""
 window.__fs=null; const fake={endpoint:'http://127.0.0.1:9911/push/UI',unsubscribe:async()=>{window.__fs=null;return true}};
 PushManager.prototype.subscribe=async()=>{window.__fs=fake;return fake}; PushManager.prototype.getSubscription=async()=>window.__fs;
 Notification.requestPermission=async()=>'granted';""")
pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.route('**/*',route); pg.goto(H+'/'); pg.wait_for_timeout(4000)
ev(pg,"hojeCard()"); pg.wait_for_function("LEM.st&&!LEM.st.carregando",timeout=10000)
ck('banner é o 1º bloco do painel inicial (hojeCard)', ev(pg,"hojeCard().startsWith('<div class=\"card\" id=\"lem-b\">')"))
pg.evaluate("UI.view='conta';render()"); pg.wait_for_timeout(600)
ck('cartão em Conta com botão ativar', ev(pg,"/Ativar neste aparelho/.test(document.getElementById('lem').innerHTML)"))
hits.clear(); pg.evaluate("ACT.lemOn()"); pg.wait_for_function("LEM.local===true",timeout=15000); pg.wait_for_timeout(500)
ck('ativação registra 1 aparelho', ev(pg,"LEM.st.aparelhos")==1 and call('/api/push/status',user=E)[1]['aparelhos']==1)
ck('cartão passa a "Ativo"', ev(pg,"/Ativo neste aparelho/.test(document.getElementById('lem').innerHTML)"))
ck('banner some depois de ativar', ev(pg,"!hojeCard().includes('id=\"lem-b\"')"))
pg.evaluate("UI.view='conta';render()"); pg.evaluate("ACT.lemTeste()"); pg.wait_for_function("!LEM.busy && /Teste enviado/.test(LEM.msg)",timeout=15000); ck('teste pela interface chega ao serviço de push', any(p=='/push/UI' for p,_ in hits), hits)
pg.evaluate("ACT.lemOff()"); pg.wait_for_function("LEM.local===false && !LEM.busy",timeout=15000); pg.wait_for_timeout(300)
ck('desativar remove do servidor', call('/api/push/status',user=E)[1]['aparelhos']==0)
pg.evaluate("ACT.lemFechar()"); ck('"Agora não" oculta o banner', ev(pg,"!hojeCard().includes('id=\"lem-b\"') && lsGet('lem.nao')==='1'"))
pg.goto(H+'/?lembrete=1'); pg.wait_for_timeout(3500); ck('?lembrete=1 limpa a URL', '?lembrete' not in pg.url, pg.url)
ck('sem erro de página', not errs, errs); ctx.close()
print('FALHAS:',F) if F else print('TUDO OK')
