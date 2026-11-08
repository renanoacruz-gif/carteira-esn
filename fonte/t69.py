# Onda 1: lote >40, continuação, feriados, pausa, turnos, vigia, deep link, onboarding, convite, textos. Requer servidor em :8790 (VAPID_*, --test-scheduled, ALLOW_TEST_USER=1).
from t40_lib import *
import json, threading, subprocess, urllib.request, urllib.error, uuid, time, datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
H='http://localhost:8790'; MOCK=9913; hits=[]
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
s=uuid.uuid4().hex[:6]
def limpa():
    d1("DELETE FROM push_subs"); d1("DELETE FROM push_enviados"); d1("DELETE FROM push_pausa"); d1("DELETE FROM push_pref"); d1("DELETE FROM push_envios"); d1("DELETE FROM adm_cfg WHERE chave LIKE 'push_%'"); d1("UPDATE usuarios SET ultimo_acesso=NULL")
ms=lambda y,m,d,h,mi=0: int(datetime.datetime(y,m,d,h,mi,tzinfo=datetime.timezone.utc).timestamp()*1000)
CONT='10,20+12,17+*+*+MON-FRI'
# --- G2: mais de 40 aparelhos por turno
limpa(); U=['u%s_%02d@totvs.com.br'%(s,i) for i in range(19)]; n=0
for i,u in enumerate(U):
    for k in range(5): call('/api/push/inscrever',{'endpoint':ep('G%02d_%d'%(i,k))},u); n+=1
ck('95 aparelhos inscritos (19 contas x 5)', d1("SELECT COUNT(*) c FROM push_subs")[0]['c']==95)
t=ms(2026,11,11,12); hits.clear()
sched(t); time.sleep(3)
r=d1("SELECT * FROM push_envios WHERE dia='2026-11-11'"); ck('1ª execução: 40 enviados, 55 adiados', len(r)==1 and r[0]['enviados']==40 and r[0]['adiados']==55,r)
sched(t+10*60000,CONT); time.sleep(3)
r=d1("SELECT * FROM push_envios WHERE dia='2026-11-11'"); ck('continuação :10 envia mais 40 e acumula', r[0]['enviados']==80 and r[0]['adiados']==15,r)
sched(t+20*60000,CONT); time.sleep(3)
r=d1("SELECT * FROM push_envios WHERE dia='2026-11-11'"); ck('continuação :20 termina (95, nenhum adiado)', r[0]['enviados']==95 and r[0]['adiados']==0 and r[0]['falhas']==0,r)
ck('cada aparelho recebeu exatamente 1 aviso', len(hits)==95 and len(set(hits))==95,(len(hits),len(set(hits))))
sched(t+30*60000,CONT); time.sleep(1.5); ck('sem pendência: nova continuação não reenvia', len(hits)==95)
ck('uma linha por turno (sem duplicar)', d1("SELECT COUNT(*) c FROM push_envios WHERE dia='2026-11-11'")[0]['c']==1)
# turno da tarde do mesmo dia é independente
hits.clear(); sched(ms(2026,11,11,17)); time.sleep(3); ck('tarde: novo lote independente da manhã', len(hits)==40,len(hits))
# --- continuação respeita quem abriu o app depois do 1º lote
limpa(); U2=['v%s_%d@totvs.com.br'%(s,i) for i in range(10)]
for i,u in enumerate(U2):
    for k in range(5): call('/api/push/inscrever',{'endpoint':ep('H%d_%d'%(i,k))},u)
hits.clear(); sched(ms(2026,11,12,12)); time.sleep(3); ck('50 aparelhos: 1º lote 40', len(hits)==40,len(hits))
enviados=set(hits); resto=[u for i,u in enumerate(U2) if not all(ep('H%d_%d'%(i,k)).split('/push/')[1] in {h.split('/push/')[1] for h in hits} for k in range(5))]
d1("INSERT OR IGNORE INTO usuarios(email,primeiro_acesso,ultimo_acesso) VALUES('%s','2026-11-12T12:05:00Z','2026-11-12T12:05:00Z')"%U2[-1]); d1("UPDATE usuarios SET ultimo_acesso='2026-11-12T12:05:00Z' WHERE email='%s'"%U2[-1])
sched(ms(2026,11,12,12,10),CONT); time.sleep(3)
r=d1("SELECT * FROM push_envios WHERE dia='2026-11-12'"); ck('quem abriu o app entre os lotes é dispensado na continuação', r[0]['enviados']+r[0]['pulados_uso']>=50-0 and r[0]['adiados']==0,r)
# --- feriados
limpa(); call('/api/push/inscrever',{'endpoint':ep('F1')},U[0]); hits.clear()
feriados=[(2026,11,20),(2026,2,16),(2026,2,17),(2026,4,3),(2026,6,4),(2026,12,25),(2026,9,7),(2026,4,21),(2026,1,1)]
for y,m,d in feriados: sched(ms(y,m,d,12)); time.sleep(0.4)
ck('nenhum envio em feriado nacional, Carnaval, Sexta Santa e Corpus Christi', len(hits)==0 and d1("SELECT COUNT(*) c FROM push_envios")[0]['c']==0,(len(hits),feriados))
sched(ms(2026,11,18,12)); time.sleep(1.5); ck('dia útil comum (qua 18/11) envia', len(hits)==1,len(hits))
# --- pausa
limpa(); PA='pa%s@totvs.com.br'%s; call('/api/push/inscrever',{'endpoint':ep('P1')},PA); call('/api/push/inscrever',{'endpoint':ep('P2')},U[1])
hoje=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(hours=3)).strftime('%Y-%m-%d')
amanha=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(hours=3)+datetime.timedelta(days=2)).strftime('%Y-%m-%d')
for bad in ['2020-01-01','x','2026-13-45',123,'2099-01-01',[], {}]:
    st,j=call('/api/push/pausar',{'ate':bad},PA); ck('pausa inválida recusada: %s'%str(bad)[:20], st==400,(st,j))
st,j=call('/api/push/pausar',{'ate':'2099-01-01'},PA)
st,j=call('/api/push/pausar',{'ate':amanha},PA); ck('pausa válida gravada', st==200 and j['pausa_ate']==amanha,(st,j))
ck('status mostra a pausa', call('/api/push/status',user=PA)[1]['pausa_ate']==amanha)
ck('pausa não vaza para outra conta', call('/api/push/status',user=U[1])[1]['pausa_ate'] is None)
hits.clear(); sched(ms(2026,11,4,12)); time.sleep(1.5)
ck('pausado não recebe; outro recebe', len(hits)==1 and hits[0].endswith('/P2'),hits)
st,j=call('/api/push/pausar',{'ate':None},PA); ck('retomar apaga a pausa', st==200 and call('/api/push/status',user=PA)[1]['pausa_ate'] is None)
# --- turnos por pessoa
limpa(); PF='pf%s@totvs.com.br'%s; call('/api/push/inscrever',{'endpoint':ep('Q1')},PF); call('/api/push/inscrever',{'endpoint':ep('Q2')},U[2])
for bad in [{'manha':1,'tarde':True},{'manha':True},{'manha':'true','tarde':True},{}]:
    st,j=call('/api/push/pref',bad,PF); ck('pref inválida recusada: %s'%json.dumps(bad), st==400,(st,j))
st,j=call('/api/push/pref',{'manha':False,'tarde':True},PF); ck('pref gravada', st==200 and call('/api/push/status',user=PF)[1]['manha'] is False)
hits.clear(); sched(ms(2026,11,4,12)); time.sleep(1.5); ck('manhã desligada: só o outro recebe', len(hits)==1 and hits[0].endswith('/Q2'),hits)
hits.clear(); sched(ms(2026,11,4,17)); time.sleep(1.5); ck('tarde ligada: os dois recebem', len(hits)==2,hits)
call('/api/push/cancelar',{},PF); ck('cancelar tudo apaga pausa e preferências', d1("SELECT COUNT(*) c FROM push_pref WHERE email='%s'"%PF)[0]['c']==0)
# --- vigia (G3)
limpa(); call('/api/push/inscrever',{'endpoint':ep('ADM1')},ADM); call('/api/push/inscrever',{'endpoint':ep('X1')},U[3]); hits.clear()
sched(ms(2026,11,12,12,40),'40+12,17+*+*+MON-FRI'); time.sleep(2)
ck('turno não executou: vigia avisa só o admin', len(hits)==1 and hits[0].endswith('/ADM1'),hits)
ck('detalhe fica no painel: alerta marcado', 'push_alerta' in json.dumps(d1("SELECT chave FROM adm_cfg")))
ck('admin vê alerta=true no resumo', call('/api/push/resumo',user=ADM)[1].get('alerta') is True)
ck('outro usuário não recebe o sinal', 'alerta' not in call('/api/push/resumo',user=U[3])[1])
sched(ms(2026,11,12,12,40),'40+12,17+*+*+MON-FRI'); time.sleep(1.5); ck('mesmo alerta no mesmo dia não repete', len(hits)==1,hits)
sched(ms(2026,11,12,12)); time.sleep(1.5); d1("DELETE FROM adm_cfg WHERE chave='push_alerta_env'"); n0=len(hits)
sched(ms(2026,11,12,12,40),'40+12,17+*+*+MON-FRI'); time.sleep(1.5); ck('turno registrado: vigia fica quieto e limpa o alerta', len(hits)==n0 and 'alerta' not in call('/api/push/resumo',user=ADM)[1],(len(hits),n0))
limpa(); call('/api/push/inscrever',{'endpoint':ep('ADM2')},ADM); hits.clear()
sched(ms(2026,11,20,12,40),'40+12,17+*+*+MON-FRI'); time.sleep(1.5); ck('feriado: vigia não alarma turno que não deveria rodar', len(hits)==0,hits)
# --- UI
ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':ADM,'x-test-sub':ASUB}); pg=ctx.new_page(); errs=[]
pg.on('pageerror',lambda e: errs.append(str(e))); ctx.grant_permissions(['clipboard-read','clipboard-write'])
pg.goto(H+'/'); pg.wait_for_timeout(3000)
ck('onboarding aparece na Visão da Carteira', pg.locator('#onb').count()==1 and ' de 4' in pg.inner_text('#onb'), pg.inner_text('body')[:200])
ck('onboarding com carteira vazia: 0 de 4', '0 de 4' in pg.evaluate("(()=>{ const c=S.clients; S.clients={}; const h=onbCard(); S.clients=c; return h })()"))
ck('onboarding não traz exemplos nem dados fictícios', 'Cliente' not in pg.inner_text('#onb'))
pg.click('#onb [data-a=onbFim]'); pg.wait_for_timeout(300); ck('ocultar remove o quadro e lembra a escolha', pg.locator('#onb').count()==0 and pg.evaluate("lsGet('onb.fim')")=='1')
h=pg.evaluate("(()=>{ lsSet('onb.fim','0'); S.clients={k:{name:'X',key:'k'}}; const h=onbCard(); S.clients={}; return h })()")
ck('passo "importar" marcado quando há carteira', '1 de 4' in h and '(feito)' in h,h[:160])
pg.evaluate("document.querySelectorAll('#hoje').forEach(e=>e.remove()); document.body.insertAdjacentHTML('beforeend','<div id=\"hoje\" style=\"margin-top:3000px\">x</div>'); LEM.foco=true; lemIrParaHoje(3)"); pg.wait_for_timeout(1200)
ck('deep link rola até "Onde vale aprofundar hoje" e encerra', pg.evaluate("LEM.foco")==False and pg.evaluate("window.scrollY")>500)
pg.evaluate("LEM.foco=false; UI.view='clientes'; navigator.serviceWorker.dispatchEvent(new MessageEvent('message',{data:{lembrete:1}}))"); pg.wait_for_timeout(500)
ck('mensagem do service worker leva à Visão da Carteira', pg.evaluate("UI.view")=='geral' and pg.evaluate("LEM.foco")==True)
pg.evaluate("LEM.st={cfg:true,aparelhos:1,pausa:null,manha:true,tarde:false}; LEM.sup=true"); h=pg.evaluate("lemCard()")
ck('cartão mostra turnos e pausa', 'Pausar' in h and '9h: ligado' in h and '14h: desligado' in h and 'feriados nacionais' in h,h[:200])
pg.evaluate("LEM.st={cfg:true,aparelhos:1,pausa:'2026-12-01',manha:true,tarde:true}"); h=pg.evaluate("lemCard()"); ck('em pausa: mostra data e botão retomar', 'Em pausa até 01/12/2026' in h and 'lemRetomar' in h)
pg.evaluate("UI.view='adm'; render()"); pg.wait_for_selector('#adm-convite',timeout=15000)
v=pg.input_value('#adm-convite-txt'); ck('convite traz o endereço do app e a página /sobre', 'localhost:8790' in v and '/sobre/' in v and 'Primeiros passos' in v,v[:200])
pg.fill('#adm-convite-txt','Olá teste'); pg.click('[data-a=admCopiarConvite]'); pg.wait_for_timeout(400)
ck('copiar usa o texto editado', pg.evaluate("navigator.clipboard.readText()")=='Olá teste')
ck('textos herdados do artefato ausentes no app', 'Integrações → Minhas chaves' not in pg.content())
ico=pg.evaluate("icapHtml()"); ck('Integrações (hospedado): sem "Claude desta página" nem botão de teste', 'Claude desta página' not in ico and 'pgTestarBtn' not in ico and 'wrangler' not in ico)
ck('sem erro de página', not errs,errs); ctx.close()
rsw=subprocess.run(['node','/home/claude/carteira-esn/fonte/t68_sw.mjs','/home/claude/carteira-esn/public/sw.js'],capture_output=True,text=True); ck('service worker: textos e clique (sandbox)', rsw.returncode==0, rsw.stdout[-300:])
limpa()
print('FALHAS:',F) if F else print('TUDO OK')
