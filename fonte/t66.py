# Rodada 19 — testes de segurança (API). Requer servidor em :8790 (ver LEIA-ME). Nenhum dado real.
import json, re, glob, urllib.request, urllib.error, uuid, socket
H='http://localhost:8790'; F=[]
def ck(n,c,x=''): print('PASS' if c else 'FAIL',n,x if not c else ''); (not c) and F.append(n)
def call(path,body=None,user=None,method=None,hdr=None,host=None):
    h={'content-type':'application/json'}; user and h.__setitem__('x-test-user',user); hdr and h.update(hdr); host and h.__setitem__('Host',host)
    rq=urllib.request.Request(H+path,data=None if body is None else json.dumps(body).encode(),headers=h,method=method or ('GET' if body is None else 'POST'))
    try:
        with urllib.request.urlopen(rq) as r: return r.status,r.read().decode(),dict(r.headers)
    except urllib.error.HTTPError as e: return e.code,e.read().decode(),dict(e.headers)
s=uuid.uuid4().hex[:6]; A='sa%s@totvs.com.br'%s; B='sb%s@totvs.com.br'%s
# 1) visitante anônimo: nenhuma rota /api responde com dados
rotas=[('/api/me','GET'),('/api/limites','GET'),('/api/status','GET'),('/api/db','POST'),('/api/ev','POST'),('/api/csp','POST'),('/api/ia','POST'),('/api/ia/teste','POST'),('/api/cnpj','POST'),('/api/importar','POST'),('/api/planilha','POST'),('/api/ocr','POST'),('/api/pesquisa','POST'),('/api/push/chave','GET'),('/api/push/status','GET'),('/api/push/inscrever','POST'),('/api/push/cancelar','POST'),('/api/push/teste','POST'),('/api/adm/resumo','GET'),('/api/adm/usuarios','GET'),('/api/adm/eventos','GET')]
for p,m in rotas:
    st,b,_=call(p,{} if m=='POST' else None,method=m); ck('anônimo recusado: %s %s'%(m,p), st in (401,403,404,405) and '"ok":true' not in b, (st,b[:80]))
# 2) identidade forjada: domínio errado e cabeçalhos de identidade sem Access
st,b,_=call('/api/me',user='x@gmail.com'); ck('e-mail de outro domínio: 403', st==403, st)
st,b,_=call('/api/me',hdr={'Cf-Access-Authenticated-User-Email':A}); ck('cabeçalho de e-mail do Access sem JWT não autentica', st==401, st)
st,b,_=call('/api/me',hdr={'Cf-Access-Jwt-Assertion':'a.b.c'}); ck('JWT inválido recusado', st==401, st)
fake='eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.'+__import__('base64').urlsafe_b64encode(json.dumps({'email':A,'iss':'https://x','aud':['y'],'exp':9999999999}).encode()).decode().rstrip('=')+'.'
st,b,_=call('/api/me',hdr={'Cf-Access-Jwt-Assertion':fake}); ck('JWT alg=none/forjado recusado', st==401, st)
st,b,_=call('/api/me',user=A,host='carteira-esn.exemplo.com'); ck('x-test-user ignorado fora de localhost (mesmo com ALLOW_TEST_USER)', st==401, (st,b[:60]))
st,b,_=call('/api/me',user=A); ck('x-test-user vale em localhost (testes)', st==200)
# 3) CSRF / origem cruzada
ok=lambda r: r[0]==200
call('/api/push/cancelar',{},A)
ck('POST sem Sec-Fetch-Site/Origin (cliente não-navegador): permitido', ok(call('/api/push/status',user=A)) and call('/api/push/cancelar',{},A)[0]==200)
for sf in ['cross-site','same-site']:
    r=call('/api/push/cancelar',{},A,hdr={'Sec-Fetch-Site':sf}); ck('POST %s bloqueado'%sf, r[0]==403 and 'origem_invalida' in r[1], r[:2])
r=call('/api/push/cancelar',{},A,hdr={'Sec-Fetch-Site':'same-origin','Origin':H}); ck('POST same-origin com Origin igual: permitido', r[0]==200, r[:2])
r=call('/api/push/cancelar',{},A,hdr={'Origin':'https://evil.example'}); ck('POST com Origin de outro site bloqueado', r[0]==403, r[:2])
r=call('/api/push/cancelar',{},A,hdr={'Origin':'null'}); ck('POST com Origin null bloqueado', r[0]==403, r[:2])
r=call('/api/db',{'op':'list','path':'catalogo/x'},A,hdr={'Sec-Fetch-Site':'cross-site'}); ck('/api/db cross-site bloqueado', r[0]==403, r[:2])
r=call('/api/ia',{},A,hdr={'Sec-Fetch-Site':'cross-site'}); ck('/api/ia cross-site bloqueado (consumo de IA)', r[0]==403, r[:2])
r=call('/api/push/status',user=A,hdr={'Sec-Fetch-Site':'cross-site'}); ck('GET de leitura não é bloqueado pelo guarda (resposta não é legível por outro site: sem CORS)', r[0]==200 and 'access-control-allow-origin' not in {k.lower() for k in r[2]})
r=call('/api/me',user=A,hdr={'Origin':'https://evil.example'},method='OPTIONS'); ck('preflight de origem estranha: 403 sem ACAO', r[0]==403 and 'access-control-allow-origin' not in {k.lower() for k in r[2]}, r[:1])
# 4) IDOR / isolamento
r=call('/api/db',{'op':'list','path':'data/users/%s/carteira/clientes'%B},A); ck('A não lê carteira de B', r[0]==403)
r=call('/api/db',{'op':'set','path':'data/users/%s/carteira/clientes/c1'%B,'data':{'id':'c1'}},A); ck('A não grava na carteira de B', r[0]==403)
r=call('/api/db',{'op':'get','path':'data/users/%s/carteira/clientes/c1'%B.upper()},A); ck('troca de caixa do e-mail não burla', r[0]==403)
r=call('/api/db',{'op':'get','path':'data/users/%s/../%s/x'%(A,B)},A); ck('path traversal recusado', r[0] in (400,403))
r=call('/api/db',{'op':'list','path':'adm_conta'},A); ck('tabelas internas inacessíveis', r[0]==403)
call('/api/push/inscrever',{'endpoint':'http://127.0.0.1:9/p/%s'%s},B)
ck('A não vê aparelhos de B', json.loads(call('/api/push/status',user=A)[1])['aparelhos']==0)
# 5) RBAC
for p in ['/api/adm/resumo','/api/adm/usuarios','/api/adm/eventos']:
    r=call(p,user=A); ck('não-admin recusado: %s'%p, r[0] in (401,403,404), r[:2])
# 6) abuso: limite no push
for i in range(70): r=call('/api/push/status',user=B)
ck('limite por usuário nas rotas push (429 após 60/min)', r[0]==429, r[:2])
ck('limite de B não afeta A', call('/api/push/status',user=A)[0]==200)
# 7) entradas maliciosas
for bad in ['{','[]','null','"x"','{"endpoint":{"a":1}}']:
    r=call('/api/push/inscrever',None,A,method='POST'); 
rq=urllib.request.Request(H+'/api/push/inscrever',data=b'{',headers={'x-test-user':A,'content-type':'application/json'},method='POST')
try: urllib.request.urlopen(rq); c=200
except urllib.error.HTTPError as e: c=e.code; bd=e.read().decode()
ck('JSON inválido: 400 sem stack', c==400 and 'at ' not in bd and 'Error' not in bd)
r=call('/api/db',{'op':'set','path':'catalogo/x','data':'x'*10},A); ck('documento inválido recusado', r[0]==400)
# 8) segredos e superfícies públicas
pat=re.compile(r'(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|gsk_[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{30,})')
base='/home/claude/carteira-esn/'; hit=[]
for f in glob.glob(base+'public/**/*',recursive=True)+[base+'src/worker.js',base+'wrangler.toml']:
    try: t=open(f,errors='ignore').read()
    except Exception: continue
    if pat.search(t) and '/vendor/' not in f: hit.append(f)
ck('nenhum segredo conhecido no bundle/public/wrangler.toml', not hit, hit)
import os
vp=open('/tmp/vapid_prod.txt').read() if os.path.exists('/tmp/vapid_prod.txt') else ''; priv=vp.split('VAPID_PRIVATE=')[1].strip() if 'VAPID_PRIVATE=' in vp else None
allp=''.join(open(f,errors='ignore').read() for f in glob.glob(base+'**/*',recursive=True) if re.search(r'\.(js|html|toml|md|py|mjs|json|sql)$',f))
(priv is None) or ck('chave VAPID privada de produção não está no repositório', priv not in allp)
ck('ALLOW_TEST_USER não definido em wrangler.toml', not re.search(r'^\s*ALLOW_TEST_USER\s*=',open(base+'wrangler.toml').read(),re.M))
st,b,h=call('/sobre/'); hl={k.lower():v for k,v in h.items()}
ck('página pública /sobre/ servida', st==200)
ck('cabeçalhos de segurança no estático local', hl.get('x-content-type-options')=='nosniff' and 'frame-ancestors' in hl.get('content-security-policy','') and 'strict-transport-security' in hl, hl)
st,b,h=call('/api/me',user=A); hl={k.lower():v for k,v in h.items()}; ck('API: no-store e nosniff', hl.get('cache-control')=='no-store' and hl.get('x-content-type-options')=='nosniff', hl)
print('FALHAS:',F) if F else print('TUDO OK')
