import json, urllib.request, urllib.error, uuid, base64
B='http://localhost:8790'; F=[]
def ck(n,c,x=''): print('PASS' if c else 'FAIL',n,(x if not c else '')); (not c) and F.append(n)
def raw(path,data=None,user=None,sub=None,method=None,extra=None):
    h={'content-type':'application/json'}
    if user: h['x-test-user']=user
    if sub: h['x-test-sub']=sub
    if extra: h.update(extra)
    req=urllib.request.Request(B+path,data=data,headers=h,method=method or ('POST' if data is not None else 'GET'))
    try: r=urllib.request.urlopen(req,timeout=25); return r.status,r.read(),dict(r.headers)
    except urllib.error.HTTPError as e: return e.code,e.read(),dict(e.headers)
def call(path,body=None,user=None,sub=None,method=None,extra=None):
    s,b,h=raw(path,json.dumps(body).encode() if body is not None else None,user,sub,method,extra)
    try: return s,json.loads(b or b'{}')
    except Exception: return s,{'_raw':b[:200].decode('utf8','replace')}
db=lambda u,body: call('/api/db',body,user=u,sub='sub-'+u)
run=uuid.uuid4().hex[:6]; A='aa%s@totvs.com.br'%run; Bm='bb%s@totvs.com.br'%run
pa='data/users/%s/carteira/clientes/c1'%A
# --- IDOR por troca de identificador
s,j=db(A,{'op':'set','path':pa,'data':{'nome':'Cliente A'}}); ck('A grava a própria carteira',s==200 and j.get('ok'),(s,j))
for op in ['get','list','delete']:
    pth=pa if op!='list' else 'data/users/%s/carteira/clientes'%A
    s,j=db(Bm,{'op':op,'path':pth}); ck('IDOR %s: B negado'%op,s==403,(s,j))
s,j=db(Bm,{'op':'set','path':pa,'data':{'nome':'hack'}}); ck('IDOR set: B negado',s==403,(s,j))
s,j=db(Bm,{'op':'get','path':'data/users/%s/carteira/clientes/c1'%A.upper()}); ck('IDOR caixa alta no e-mail de A: B negado',s==403,(s,j))
s,j=db(A,{'op':'get','path':pa}); ck('dado de A intacto',j.get('data',{}).get('nome')=='Cliente A',j)
s,j=db(A,{'op':'get','path':'data/users/%s/carteira/clientes/c1'%A.upper()}); ck('A com caixa alta no próprio e-mail (normalização)',s==200,(s,j))
for p in ['data/users','data/users/','data','data/users/%s'%A.split('@')[0],'data/users/../users/%s/x'%A,'data/users/%2e%2e/x','docs','adm_conta/x','eventos/x','usuarios/x','csp_obs/x','data/users/%s/..'%Bm,'catalogo/../data/users/%s/carteira/x'%A]:
    s,j=db(Bm,{'op':'get','path':p}); ck('caminho proibido/inválido negado: '+p,s in(400,403) and not j.get('ok'),(s,j))
s,j=db(Bm,{'op':'list','path':'data/users'}); ck('list em data/users negado',s in(400,403),(s,j))
s,j=call('/api/db',{'op':'get','path':pa}); ck('sem identidade: 401',s==401,(s,j))
s,b,h=raw('/api/db',None,user=Bm,sub='x',method='GET'); ck('GET em /api/db: 405',s==405,s)
s,j=db(Bm,{'op':'get','path':pa,'owner':A,'userId':A,'user':A}); ck('owner/userId no corpo ignorados',s==403,(s,j))
# --- catálogo compartilhado
cid='sol%s'%run
reg={'id':cid,'nome':'Sol','cv':1,'criadoPor':'forjado@x','alteradoPor':'forjado@x'}
s,j=db(A,{'op':'set','path':'catalogo/'+cid,'data':reg}); ck('A cria registro de catálogo',s==200,(s,j))
s,j=db(A,{'op':'get','path':'catalogo/'+cid}); ck('criadoPor definido pelo servidor (não pelo cliente)',j.get('data',{}).get('criadoPor')==A and j['data'].get('alteradoPor')==A,j)
s,j=db(A,{'op':'set','path':'catalogo/a/b','data':{'id':'b','cv':1}}); ck('catálogo aninhado negado',s==400,(s,j))
s,j=db(A,{'op':'set','path':'catalogo_conteudo/a/b','data':{'x':1}}); ck('catalogo_conteudo aninhado negado',s==400,(s,j))
s,j=db(A,{'op':'delete','path':'catalogo/a/b'}); ck('delete aninhado negado',s==400,(s,j))
s,j=db(A,{'op':'set','path':'catalogo/'+cid,'data':{**reg,'cv':999999}}); ck('salto absurdo de cv recusado',s==400,(s,j))
s,j=db(A,{'op':'set','path':'catalogo/n%s'%run,'data':{'id':'n%s'%run,'cv':5000}}); ck('cv inicial absurdo recusado',s==400,(s,j))
s,j=db(A,{'op':'set','path':'catalogo/'+cid,'data':{**reg,'cv':'abc'}}); ck('cv não numérico recusado',s==400,(s,j))
s,j=db(Bm,{'op':'set','path':'catalogo/'+cid,'data':{**reg,'cv':2,'nome':'Editado por B'}}); ck('B edita item compartilhado (cv+1)',s==200,(s,j))
s,j=db(A,{'op':'get','path':'catalogo/'+cid}); ck('criadoPor preservado após edição de B',j['data'].get('criadoPor')==A and j['data'].get('alteradoPor')==Bm,j)
s,j=db(Bm,{'op':'delete','path':'catalogo/'+cid}); ck('B não exclui registro criado por A',s==403,(s,j))
s,j=db(A,{'op':'set','path':'catalogo_conteudo/'+cid,'data':{'texto':'conteúdo'}}); ck('A grava conteúdo do catálogo',s==200,(s,j))
s,j=db(Bm,{'op':'delete','path':'catalogo_conteudo/'+cid}); ck('B não exclui conteúdo de solução de A',s==403,(s,j))
s,j=db(Bm,{'op':'get','path':'catalogo_conteudo/'+cid}); ck('conteúdo ainda existe',j.get('exists') is True,j)
s,j=db(A,{'op':'delete','path':'catalogo_conteudo/'+cid}); ck('A (criador) exclui conteúdo',s==200,(s,j))
s,j=db(A,{'op':'delete','path':'catalogo/'+cid}); ck('A exclui o próprio registro',s==200,(s,j))
s,j=db(Bm,{'op':'delete','path':'catalogo_conteudo/orf%s'%run}); ck('conteúdo órfão pode ser limpo',s==200,(s,j))
# --- tamanho de corpo
s,b,h=raw('/api/db',json.dumps({'op':'set','path':pa,'data':{'x':'a'*1600000}}).encode(),user=A,sub='sub-'+A); ck('corpo >1,5MB recusado (413)',s==413,s)
s,b,h=raw('/api/cnpj',json.dumps({'cnpj':'11222333000181','x':'a'*5000}).encode(),user=A,sub='sub-'+A); ck('CNPJ: corpo >4KB recusado (413)',s==413,s)
# --- SSRF / importação por link
def imp(urls): return call('/api/importar',{'tipo':'importar_link','urls':urls},user=A,sub='sub-'+A)
def errc(j): 
    r=(j.get('resultados') or [{}])[0]; return (j.get('erro') or r.get('erro') or {}).get('codigo')
for u,esp in [('https://user:pw@tdn.totvs.com/x','requisicao_invalida'),('https://tdn.totvs.com:8443/x','dominio_nao_permitido'),('http://tdn.totvs.com/x','dominio_nao_permitido'),('https://169.254.169.254/latest/meta-data','dominio_nao_permitido'),('https://totvs.com.evil.com/x','dominio_nao_permitido'),('https://evil.com/?u=totvs.com','dominio_nao_permitido'),('https://127.0.0.1/','dominio_nao_permitido'),('https://[::1]/','dominio_nao_permitido'),('https://localhost/','dominio_nao_permitido'),('https://nottotvs.com/','dominio_nao_permitido'),('file:///etc/passwd','dominio_nao_permitido'),('https://tdn.totvs.com@evil.com/','dominio_nao_permitido'),('https://evil.com#@tdn.totvs.com/','dominio_nao_permitido')]:
    s,j=imp([u]); c=errc(j); ck('SSRF bloqueado: '+u,(s==400 or not j.get('ok')) and c in(esp,'requisicao_invalida','dominio_nao_permitido'),(s,c,str(j)[:160]))
s,j=imp(['https://user:pw@tdn.totvs.com/x']); ck('userinfo: mensagem orienta alternativa manual','manualmente' in json.dumps(j,ensure_ascii=False),json.dumps(j,ensure_ascii=False)[:200])
# --- OCR: assinatura real
def ocr(mime,b): return call('/api/ocr',{'tipo':'ocr_material','confirmaEnvioProvedor':True,'arquivo':{'mime':mime,'base64':base64.b64encode(b).decode()}},user=A,sub='sub-'+A,extra={'x-provider':'gemini','x-provider-key':'AIzaFAKEKEY1234567890'})
s,j=ocr('application/pdf',b'MZ\x90\x00 exe disfarcado'); ck('OCR: executável com MIME de PDF recusado',s==400 and 'assinatura' in json.dumps(j,ensure_ascii=False),(s,str(j)[:160]))
s,j=ocr('image/png',b'<script>alert(1)</script>'); ck('OCR: HTML com MIME png recusado',s==400,(s,str(j)[:160]))
s,j=ocr('image/jpeg',b'\x89PNG\r\n'); ck('OCR: PNG com MIME jpeg recusado',s==400,(s,str(j)[:160]))
s,j=ocr('application/pdf',b'%PDF-1.4\n%%EOF'); ck('OCR: PDF legítimo passa da validação (falha só no provedor/sem chave)',s!=400 or 'assinatura' not in json.dumps(j,ensure_ascii=False),(s,str(j)[:200]))
s,j=ocr('image/png',b'\x89PNG\r\n\x1a\n'+b'0'*20); ck('OCR: PNG legítimo passa da validação',not (s==400 and 'assinatura' in json.dumps(j,ensure_ascii=False)),(s,str(j)[:200]))
# --- erros e cabeçalhos
s,b,h=raw('/api/db',b'{nao json',user=A,sub='sub-'+A); ck('JSON inválido: 400 sem stack',s==400 and b'at ' not in b and b'.js:' not in b,(s,b[:120]))
s,b,h=raw('/api/rota-inexistente',user=A,sub='sub-'+A,method='GET'); ck('rota inexistente: JSON de erro (sem stack)',s in(404,405) and b'"ok":false' in b and b'.js:' not in b,(s,b[:120]))
s,b,h=raw('/api/me',user=A,sub='sub-'+A,method='GET'); hl={k.lower():v for k,v in h.items()}; ck('API envia nosniff',hl.get('x-content-type-options')=='nosniff',hl)
s,b,h=raw('/',method='GET'); hl={k.lower():v for k,v in h.items()}
ck('página: frame-ancestors none imposto','frame-ancestors \'none\'' in hl.get('content-security-policy',''),hl.get('content-security-policy'))
ck('página: CSP completa só em Report-Only','default-src' in hl.get('content-security-policy-report-only','') and 'default-src' not in hl.get('content-security-policy',''),hl)
ck('página: HSTS/Referrer/Permissions/nosniff',all(k in hl for k in ['strict-transport-security','referrer-policy','permissions-policy','x-content-type-options']),list(hl))
s,b,h=raw('/vendor/pdf.worker.min.js',method='GET'); ck('libs vendorizadas servidas (/vendor)',s==200 and len(b)>500000,s)
s,b,h=raw('/',method='GET'); ck('HTML hospedado sem CDN de scripts',b'cdnjs.cloudflare.com' not in b,'')
# --- relatório CSP (só contadores)
rep={'csp-report':{'violated-directive':'img-src','blocked-uri':'https://exemplo.com/caminho/secreto?token=abc','document-uri':'https://app/#dados'}}
s,b,h=raw('/api/csp',json.dumps(rep).encode(),user=A,sub='sub-'+A); ck('/api/csp aceita relatório (204)',s==204,s)
s,b,h=raw('/api/csp',json.dumps(rep).encode(),user=None); ck('/api/csp sem identidade não grava (401)',s in(401,403),s)
s,j=call('/api/adm/resumo',user='renan.oscar@totvs.com.br',sub='sub-renan-001'); csp=j.get('csp') or []
ck('painel admin mostra CSP agregado (origem sem caminho/query)',any(x['diretiva']=='img-src' and x['alvo']=='https://exemplo.com' for x in csp) and 'secreto' not in json.dumps(csp),(s,csp))
print('FALHAS:',F); raise SystemExit(1 if F else 0)
