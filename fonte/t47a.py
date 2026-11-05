import json, urllib.request, urllib.error, uuid, subprocess, sys
B='http://localhost:8790'; F=[]
def ck(n,c,x=''): print('PASS' if c else 'FAIL',n,(x if not c else '')); (not c) and F.append(n)
def call(path,body=None,user=None,sub=None,method=None,extra=None):
    h={'content-type':'application/json'}
    if user: h['x-test-user']=user
    if sub: h['x-test-sub']=sub
    if extra: h.update(extra)
    req=urllib.request.Request(B+path,data=json.dumps(body).encode() if body is not None else None,headers=h,method=method or ('POST' if body is not None else 'GET'))
    try:
        r=urllib.request.urlopen(req,timeout=20); return r.status,json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try: j=json.loads(e.read() or b'{}')
        except Exception: j={}
        return e.code,j
ADM='renan.oscar@totvs.com.br'; SUB='sub-renan-001'
run=uuid.uuid4().hex[:6]; ana='ana%s@totvs.com.br'%run
# --- acesso ao painel
s,j=call('/api/adm/resumo'); ck('anônimo negado',s in(401,403) and not j.get('ok'),(s,j))
s,j=call('/api/adm/resumo',user=ana,sub='sub-ana'); ck('outro autenticado negado (403)',s==403,(s,j))
s,j=call('/api/adm/resumo',user=ADM); ck('e-mail admin SEM identidade verificada negado',s in(401,403),(s,j))
s,j=call('/api/adm/resumo?email='+ADM,user=ana,sub='sub-ana'); ck('e-mail forjado em URL ignorado',s==403,(s,j))
s,j=call('/api/adm/resumo',user=ana,sub='sub-ana',extra={'x-admin-email':ADM,'x-forwarded-email':ADM}); ck('cabeçalhos forjados ignorados',s==403,(s,j))
for rota,body in [('/api/adm/config',{'inatividade_dias':1}),('/api/adm/roster',{'op':'add','itens':[{'email':'x@totvs.com.br'}]}),('/api/adm/purgar',{})]:
    s,j=call(rota,body,user=ana,sub='sub-ana'); ck('POST direto '+rota+' negado',s==403,(s,j))
s,j=call('/api/me',user=ana,sub='sub-ana'); ck('/api/me de outro: painel=false',s==200 and j.get('painel') is False,j)
s,j=call('/api/me',user=ADM); ck('/api/me sem sub: painel=false',j.get('painel') is False,j)
s,j=call('/api/me',user=ADM,sub=SUB); ck('/api/me admin verificado: painel=true',j.get('painel') is True,j)
s,j=call('/api/adm/resumo',user=ADM,sub='sub-outro'); ck('mesmo e-mail com identificador (sub) diferente negado',s==403,(s,j))
s,j=call('/api/adm/resumo',user=ADM,sub=SUB); ck('admin verificado: 200',s==200 and j.get('ok'),(s,str(j)[:200]))
R=j
ck('cobertura_inicio definida',bool(R.get('cobertura_inicio')),R.get('cobertura_inicio'))
ck('tentativas negadas registradas (sem corpo/IP)',R['tentativas_negadas']['ultimas_24h']>=5 and all(set(t.keys())<={'ts','usuario','motivo','rota'} for t in R['tentativas_negadas']['ultimas']),R['tentativas_negadas'])
# --- ingestão
e1={'id':'t'+run+'a','func':'import_carteira','fase':'concluida','resultado':'ok','dur':1200,'meta':{'n':12,'tipo':'carteira','cliente':'ACME SA','cnpj':'11222333000181','texto':'segredo'}}
s,j0=call('/api/adm/resumo?dias=7',user=ADM,sub=SUB); n0=next((r['concluidas'] for r in j0['recursos'] if r['func']=='import_carteira'),0)
s,j=call('/api/ev',{'eventos':[e1,e1,{'id':'bad id','func':'x','fase':'concluida'},{'id':'t'+run+'b','func':'raiox_gerar','fase':'iniciada','corr':'c'+run},{'id':'t'+run+'c','func':'raiox_gerar','fase':'concluida','resultado':'ok','corr':'c'+run,'dur':800,'meta':{'modo':'manual'}}]},user=ana,sub='sub-ana')
ck('ingestão aceita válidos e descarta inválidos',s==200 and j.get('aceitos')==4 and j.get('descartados')==1,(s,j))
s,j=call('/api/ev',{'eventos':[e1]},user=ana,sub='sub-ana'); 
s,j=call('/api/ev',{'eventos':[{'id':'t'+run+'x','func':'acesso','fase':'concluida'}]},user=ana,sub='sub-ana'); ck('acesso via cliente não é aceito (só servidor)',j.get('aceitos')==0,j)
s,j=call('/api/ev',{'eventos':[e1]}); ck('ingestão anônima negada',s in(401,403),(s,j))
s,j=call('/api/ev',{'eventos':[e1]},user='x@gmail.com',sub='s'); ck('domínio fora negado',s in(401,403),(s,j))
s,j=call('/api/adm/resumo?dias=7',user=ADM,sub=SUB); R=j
ck('duplicata não duplica (1 concluída de import_carteira)',next(r for r in R['recursos'] if r['func']=='import_carteira')['concluidas']-n0==1,[ (r['func'],r['concluidas']) for r in R['recursos']])
ck('meta sensível não aparece na resposta',not any(w in json.dumps(R) for w in ['ACME','11222333000181','segredo']))
u=next((x for x in R['usuarios'] if x['email']==ana),None); ck('usuário ana identificado',bool(u) and u['identificado'],R['usuarios'][:3])
ck('ana ativa (import concluído em recurso principal)',u and u['situacao']=='ativo',u)
ck('recurso utilizado listado',u and 'import_carteira' in u['recursos_utilizados'] and 'raiox_gerar' in u['recursos_utilizados'],u)
# filtro por recurso
s,j=call('/api/adm/resumo?dias=7&func=raiox_gerar',user=ADM,sub=SUB); ck('filtro por recurso',all(r['func']=='raiox_gerar' for r in j['recursos'] if r['func']!='acesso') and j['func']=='raiox_gerar',j['recursos'])
# --- eventos de servidor (cnpj, ia teste) medidos
s,j=call('/api/cnpj',{'cnpj':'11222333000181','provedores':['brasilapi']},user=ana,sub='sub-ana')
s,j=call('/api/adm/resumo?dias=7',user=ADM,sub=SUB); R=j
ck('consulta CNPJ medida no servidor (sem o CNPJ)',any(r['func']=='cnpj_consulta' for r in R['recursos']) and '11222333000181' not in json.dumps(R),[r['func'] for r in R['recursos']])
# --- roster / config
s,j=call('/api/adm/roster',{'op':'add','itens':[{'email':'dora%s@totvs.com.br'%run,'nome':'Dora'},{'email':'fora@gmail.com'}]},user=ADM,sub=SUB); ck('roster aceita domínio e recusa outro',j.get('incluidos')==1 and len(j.get('recusados',[]))==1,j)
s,j=call('/api/adm/resumo?dias=7',user=ADM,sub=SUB); d=next(x for x in j['usuarios'] if x['email']=='dora%s@totvs.com.br'%run); ck('previsto sem acesso = nunca_acessou',d['situacao']=='nunca_acessou' and d['previsto'] and not d['identificado'],d)
ck('KPI nunca acessaram >=1',j['kpis']['nunca_acessaram']>=1)
s,j=call('/api/adm/config',{'inatividade_dias':0},user=ADM,sub=SUB); ck('config inválida recusada',s==400,(s,j))
s,j=call('/api/adm/config',{'inatividade_dias':7,'principais':['import_carteira']},user=ADM,sub=SUB); ck('config válida salva',s==200 and j['config']['inatividade_dias']==7,j)
s,j=call('/api/adm/resumo?dias=7',user=ADM,sub=SUB); ck('critério refletido no cálculo',j['criterios']['inatividade_dias']==7 and j['criterios']['principais']==['import_carteira'],j['criterios'])
call('/api/adm/config',{'inatividade_dias':14,'principais':['import_carteira','ficha_upload','raiox_gerar','diag_abrir','recomendacao_leitura','pesquisa_ic']},user=ADM,sub=SUB)
# --- carteira privada: admin não lê dados de outra pessoa pela API de dados
call('/api/db',{'op':'set','path':'data/users/%s/clientes/c1'%ana,'data':{'nome':'Cliente Secreto'}},user=ana,sub='sub-ana')
s,j=call('/api/db',{'op':'get','path':'data/users/%s/clientes/c1'%ana},user=ADM,sub=SUB); ck('admin não lê carteira alheia via /api/db',not j.get('ok') or not j.get('exists'),(s,j))
s,j=call('/api/adm/resumo?dias=30',user=ADM,sub=SUB); ck('painel não expõe nomes de clientes',  'Cliente Secreto' not in json.dumps(j))
# --- API do app segue funcionando para outros
s,j=call('/api/db',{'op':'get','path':'data/users/%s/carteira'%ana},user=ana,sub='sub-ana'); ck('app de outros segue funcionando',s==200,(s,j))
print('FALHAS',F); sys.exit(1 if F else 0)
