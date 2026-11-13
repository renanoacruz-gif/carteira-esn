# Catálogo de soluções no Painel Administrador: fontes, teste de conexão, fila de revisão e envio para a importação
from t40_lib import *
import uuid, json
def open_s(email,sub):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':email,'x-test-sub':sub})
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.route('**/*',route); pg.goto('http://localhost:8790/'); pg.wait_for_timeout(3500)
    return pg,errs
run=uuid.uuid4().hex[:6]
U,eu=open_s('exec%s@totvs.com.br'%run,'sub-'+run)
r=ev(U,"fetch('/api/adm/catalogo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'estado'})}).then(r=>r.status)")
ck('não-admin: rota do catálogo negada (403)', r==403, r)
r=ev(U,"fetch('/api/adm/catalogo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'testar',fonte:'tdn'})}).then(r=>r.status)")
ck('não-admin: não consegue disparar leitura de fonte', r==403, r)
A,ea=open_s('renan.oscar@totvs.com.br','sub-renan-001')
ev(A,"UI.view='adm';render();0"); A.wait_for_timeout(2500)
tx=lambda: ev(A,"document.querySelector('#adm-cat')?.innerText||''")
ck('painel mostra o bloco do catálogo com as 2 fontes oficiais', 'Catálogo de soluções' in tx() and 'TDN' in tx() and 'Enxoval de vendas' in tx(), tx()[:200])
ck('aviso de governança visível', 'Nada entra na Base de Soluções sozinho' in tx() and 'robots.txt' in tx() and 'não é contornada' in tx())
ck('um único painel (bloco dentro do Painel Administrador)', ev(A,"document.querySelectorAll('#adm-cat').length")==1 and ev(A,"NAV.filter(x=>/cat/i.test(x[0])).length")==0)
ck('ler lote desabilitado antes do teste de conexão', ev(A,"[...document.querySelectorAll('[data-a=admCatDesc]')].every(b=>b.disabled)"))
# teste real pelo servidor local: a rede do ambiente não alcança a fonte → erro reportado, nada inventado
A.click('[data-a=admCatTestar][data-f=enxoval]'); A.wait_for_timeout(9000)
c=ev(A,"JSON.stringify(ADMV.cat.fontes.find(f=>f.id==='enxoval'))"); cj=json.loads(c)
ck('teste de conexão grava estado real (não ok) e data', cj['estado'] in ('indisponivel','autenticacao_necessaria','nao_encontrada','bloqueada_robots') and cj['testada_em'], c[:200])
ck('fonte inacessível: nenhuma página criada, leitura continua bloqueada', sum(cj['contagem'].values())==0 and ev(A,"document.querySelector('[data-a=admCatDesc][data-f=enxoval]').disabled"))
ck('execução registrada', ev(A,"ADMV.cat.exec.some(x=>x.op==='testar'&&x.fonte==='enxoval'&&x.erros===1)"))
# interface com fila simulada (resposta do servidor substituída)
FIX={'ok':True,'fontes':[{'id':'enxoval','nome':'Enxoval de vendas','url':'https://enxoval.totvs.com/','estado':'autenticacao_necessaria','erro':'A página redireciona para login.','autenticado':False,'testada_em':'2026-11-13T12:00:00Z','ultima_sinc':None,'contagem':{}},{'id':'tdn','nome':'TDN — documentação oficial','url':'https://tdn.totvs.com/pages/viewpage.action?pageId=398756186','estado':'ok','erro':None,'autenticado':True,'testada_em':'2026-11-13T12:00:00Z','ultima_sinc':'2026-11-13T12:05:00Z','contagem':{'pendente':6,'lida':3,'candidata':1,'inacessivel':1}}],
 'paginas':[{'chave':'k%d'%i,'url':'https://tdn.totvs.com/pages/viewpage.action?pageId=%d'%(100+i),'fonte':'tdn','titulo':t,'prof':1,'estado':e,'erro':er,'filhos':f,'vista_em':v} for i,(t,e,er,f,v) in enumerate([('Linha Protheus','lida',None,12,'2026-11-13T12:05:00Z'),('Linha RM <img src=x onerror=window.__xss=1>','lida',None,4,'2026-11-13T12:05:00Z'),('Linha Datasul','lida',None,7,'2026-11-13T12:05:00Z'),('TOTVS Fluig','candidata',None,2,'2026-11-13T12:05:00Z'),('Área restrita','inacessivel','autenticacao_necessaria: A página exige login.',None,'2026-11-13T12:05:00Z'),('Ainda não lida','pendente',None,None,None)])],
 'total':6,'pag':0,'exec':[{'ts':'2026-11-13T12:05:00Z','fonte':'tdn','op':'descobrir','lidas':4,'novas':9,'erros':1,'detalhe':'6 página(s) ainda por ler'}],'limites':{'lote':5,'maxProf':4,'maxPaginas':1500}}
sent=[]
def cat(rt):
    q=json.loads(rt.request.post_data or '{}'); sent.append(q)
    if q.get('op')=='revisar': rt.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'alteradas':len(q['chaves'])}))
    elif q.get('op')=='descobrir': rt.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'lote':{'lidas':5,'novas':7,'erros':0,'restantes':8,'parou':''}}))
    else: rt.fulfill(status=200,content_type='application/json',body=json.dumps(FIX))
A.route('**/api/adm/catalogo',cat)
ev(A,"ADMV.catF.estado='';admCatLoad();0"); A.wait_for_timeout(900)
ck('estados das fontes: Exige login / Acessível com credencial', 'Exige login' in tx() and 'Acessível' in tx() and 'com credencial' in tx())
ck('cobertura por fonte com contagens e % revisado', '11 descoberta(s)' in tx() and '6 por ler' in tx() and '3 aguardam revisão' in tx() and 'revisadas: 9%' in tx(), tx()[300:700])
ck('fila lista as 6 páginas com estado e erro', ev(A,"document.querySelectorAll('#adm-cat [data-c=admCatSel]').length")==6 and 'Lida — aguarda revisão' in tx() and 'A página exige login' in tx())
ck('título vindo da fonte é exibido como texto (sem executar)', ev(A,"window.__xss")!=1 and ev(A,"document.querySelectorAll('#adm-cat img').length")==0 and 'onerror' in tx())
ck('links externos da fila abrem com noopener', ev(A,"[...document.querySelectorAll('#adm-cat td a')].every(a=>a.rel.includes('noopener')&&a.href.startsWith('https://tdn.totvs.com/'))"))
ck('página ainda não lida não pode ser revisada', ev(A,"document.querySelector('[data-c=admCatSel][data-k=k5]').disabled"))
ck('ações de revisão desabilitadas sem seleção', ev(A,"[...document.querySelectorAll('[data-a=admCatRev]')].every(b=>b.disabled)") and ev(A,"document.querySelector('[data-a=admCatImportar]').disabled"))
ck('ler lote: habilitado no TDN, bloqueado no Enxoval', ev(A,"!document.querySelector('[data-a=admCatDesc][data-f=tdn]').disabled && document.querySelector('[data-a=admCatDesc][data-f=enxoval]').disabled"))
A.click('[data-a=admCatDesc][data-f=tdn]'); A.wait_for_timeout(800)
ck('ler lote envia a operação certa', any(s.get('op')=='descobrir' and s.get('fonte')=='tdn' for s in sent))
A.click('[data-c=admCatSel][data-k=k0]'); A.wait_for_timeout(200); A.click('[data-c=admCatSel][data-k=k2]'); A.wait_for_timeout(300)
ck('seleção habilita revisão e envio (até 3)', '2 selecionada(s)' in tx() and ev(A,"!document.querySelector('[data-a=admCatImportar]').disabled"))
A.click('[data-a=admCatRev][data-e=candidata]'); A.wait_for_timeout(800)
rv=[s for s in sent if s.get('op')=='revisar']
ck('revisão envia chaves e estado; seleção é limpa', len(rv)==1 and rv[0]['chaves']==['k0','k2'] and rv[0]['estado']=='candidata' and ev(A,"Object.values(ADMV.catSel).filter(Boolean).length")==0, rv)
A.click('[data-a=admCatSelTodas]'); A.wait_for_timeout(300)
ck('selecionar todas ignora a não lida; mais de 3 bloqueia o envio', '5 selecionada(s)' in tx() and ev(A,"document.querySelector('[data-a=admCatImportar]').disabled"))
ev(A,"ADMV.catSel={k0:true,k3:true};render();0"); A.wait_for_timeout(300); A.click('[data-a=admCatImportar]'); A.wait_for_timeout(700)
ck('abrir na importação: leva os links para "Importar por link" sem importar sozinho', ev(A,"UI.view")=='solucoes' and ev(A,"UI.lkUrls")=='https://tdn.totvs.com/pages/viewpage.action?pageId=100\nhttps://tdn.totvs.com/pages/viewpage.action?pageId=103' and ev(A,"document.querySelector('[data-i=lkurls]').value.includes('pageId=103')") and not any(s.get('op')=='importar' for s in sent))
ev(A,"UI.view='adm';render();0"); A.wait_for_timeout(500)
A.select_option('#adm-cat [data-c=admCatEst]','candidata'); A.wait_for_timeout(600)
A.fill('#adm-cat-q','fluig'); A.click('[data-a=admCatBuscar]'); A.wait_for_timeout(600)
ck('filtro e busca vão ao servidor', sent[-1].get('op')=='estado' and sent[-1].get('estado')=='candidata' and sent[-1].get('q')=='fluig' and sent[-1].get('pag')==0, sent[-1])
ck('demais blocos do painel preservados', all(x in ev(A,"document.querySelector('#app').innerText") for x in ['Lista de previstos e convites','Privacidade e retenção']))
ck('sem erro de script', not ea and not eu, (ea+eu)[:2])
print('FALHAS:',len(F)); [print(' -',x) for x in F]; p.stop()
