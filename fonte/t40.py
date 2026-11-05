from mu import *
import json, time
D='/home/claude/test/data/'
F=[]
def ck(n,c,x=''): print('PASS' if c else 'FAIL',n,x if not c else ''); (not c) and F.append(n)
p,b=launch()
L='/home/claude/test/node_modules/'
def route(r):
    u=r.request.url
    if 'xlsx.full.min.js' in u: r.fulfill(path=L+'xlsx/dist/xlsx.full.min.js',content_type='text/javascript')
    elif 'pdf.worker.min.js' in u: r.fulfill(path=L+'pdfjs-dist/build/pdf.worker.min.js',content_type='text/javascript')
    elif 'pdf.min.js' in u: r.fulfill(path=L+'pdfjs-dist/build/pdf.min.js',content_type='text/javascript')
    elif 'jspdf' in u: r.fulfill(path=L+'jspdf/dist/jspdf.umd.min.js',content_type='text/javascript')
    elif 'jszip' in u: r.fulfill(path=L+'jszip/dist/jszip.min.js',content_type='text/javascript')
    elif 'fonts.g' in u: r.fulfill(body='',content_type='text/css')
    else: r.continue_()
def open_h(email):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':email})
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.route('**/*',route); pg.goto('http://localhost:8790/'); pg.wait_for_timeout(3500)
    return pg,errs
ev=lambda pg,js: pg.evaluate(js)
api=lambda pg,body: pg.evaluate("async b=>{const r=await fetch('/api/db',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});return await r.json()}",body)
A,ea=open_h('ana@totvs.com.br'); 
ck('modo hospedado ativo', ev(A,"!!window.__HOSTED__ && ME.ok && ME.id==='ana@totvs.com.br'"), ev(A,"JSON.stringify([ME,UI.persist])"))
ck('nome derivado do e-mail', ev(A,"ME.nome")=='Ana', ev(A,"ME.nome"))
ck('persistência no servidor', 'salvo' in ev(A,"UI.persist"), ev(A,"UI.persist"))
ck('sem erros de página no carregamento', not ea, str(ea[:2]))
ck('catálogo base carregado', ev(A,"S.solutions.length")>5, ev(A,"S.solutions.length"))
ck('provedor "página" removido', ev(A,"!AI_PROV.pagina && !AI_PROV_IDS.includes('pagina')"))
# aguarda semente do catálogo chegar ao servidor
A.wait_for_timeout(6000)
cat=api(A,{'op':'list','path':'catalogo','limit':500})
ns=ev(A,"S.solutions.filter(r=>!r._priv).length")
ck('catálogo base gravado no servidor', cat['ok'] and len(cat['docs'])==ns and ns>5, f"{len(cat.get('docs',[]))} vs {ns}")
ck('base inicial marcada como tal', all(d['data'].get('criadoPor')=='base inicial' for d in cat['docs']), str({d['data'].get('criadoPor') for d in cat['docs']}))
# integrações: cartão de chaves
A.evaluate("UI.view='integra'; render()"); A.wait_for_timeout(300)
try:
    A.evaluate("UI.view='integracoes'; render()")
except Exception: pass
txt=ev(A,"document.getElementById('app').innerText")
if 'Minhas chaves de IA' not in txt:
    for v in ['ia','ia2','ai','aiconf','integ','config']:
        ev(A,f"UI.view='{v}'; render()"); txt=ev(A,"document.getElementById('app').innerText")
        if 'Minhas chaves de IA' in txt: print('view',v); break
ck('tela mostra "Minhas chaves de IA" e não pede APP_TOKEN', 'Minhas chaves de IA' in txt and 'APP_TOKEN (só na memória' not in txt)
# salvar/remover chave
A.fill('#hk-openai','sk-teste-0000111122'); A.click('[data-a=hkSalvar][data-p=openai]'); A.wait_for_timeout(300)
ck('chave salva só no localStorage', ev(A,"hkChave('openai')")=='sk-teste-0000111122' and 'sk-teste-0000111122' not in ev(A,"JSON.stringify(S.meta)") and 'sk-teste' not in ev(A,"JSON.stringify(aiCfg())"))
sv=api(A,{'op':'list','path':'data/users/ana@totvs.com.br/carteira'.rsplit('/',1)[0],'limit':50})
ck('chave não foi para o servidor', 'sk-teste' not in json.dumps(sv))
ck('chave inválida recusada', (A.fill('#hk-gemini','curta'), A.click('[data-a=hkSalvar][data-p=gemini]'), ev(A,"hkChave('gemini')")=='')[2])
# cabeçalho enviado à chamada
reqs=[]
A.on('request',lambda r: reqs.append((r.url,dict(r.headers))) if '/api/ia' in r.url else None)
ev(A,"window.__r=null; bkChamar('ia_teste',{versao:2,pedidoId:'p1',provedor:'openai',modelo:'gpt-6-astra',tarefa:'teste',prompt:'Responda apenas com a palavra OK, sem mais nada, por favor.'},'x.json').then(r=>window.__r=r).catch(e=>window.__r={err:e.message,codigo:e.codigo})")
A.wait_for_timeout(8000)
r=ev(A,"window.__r")
ck('chamada de IA vai direto ao Worker com a chave do usuário', reqs and reqs[0][1].get('x-provider')=='openai' and reqs[0][1].get('x-provider-key')=='sk-teste-0000111122', str(reqs[:1])[:200])
ck('resposta do Worker recebida (falha de rede do provedor é esperada aqui)', r and (r.get('resp') or r.get('err')), str(r)[:200])
ev(A,"window.__r=null; bkChamar('ia_teste',{versao:2,pedidoId:'p2',provedor:'anthropic',modelo:'x',tarefa:'teste',prompt:'x'},'x.json').then(r=>window.__r=r).catch(e=>window.__r={err:e.message,codigo:e.codigo})"); A.wait_for_timeout(500)
r=ev(A,"window.__r"); ck('sem chave cadastrada: avisa e não envia', r and r.get('codigo')=='sem_chave', str(r))
# carteira
A.evaluate("UI.view='importar'; render()"); A.wait_for_timeout(300)
A.set_input_files('#f-cart',D+'carteira.xlsx'); A.wait_for_timeout(500); A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); A.wait_for_timeout(3500)
ncl=ev(A,"clients().length"); ck('carteira importada', ncl>=3, ncl)
lst=api(A,{'op':'list','path':'data/users/ana@totvs.com.br/carteira/clientes','limit':200})
ck('clientes gravados no servidor', lst['ok'] and len(lst['docs'])==ncl, f"{len(lst.get('docs',[]))} vs {ncl}")
# Bia
B,eb=open_h('bia@totvs.com.br')
ck('Bia entra com a própria identidade', ev(B,"ME.id")=='bia@totvs.com.br')
ck('Bia não vê clientes da Ana', ev(B,"clients().length")==0)
ck('Bia vê o mesmo catálogo base', ev(B,"S.solutions.filter(r=>!r._priv).length")==ns, ev(B,"S.solutions.filter(r=>!r._priv).length"))
neg=api(B,{'op':'get','path':'data/users/ana@totvs.com.br/carteira'})
ck('servidor nega a Bia o acesso à carteira da Ana', (not neg['ok']) and neg['erro']['codigo']=='proibido', str(neg))
# Ana cria solução nova -> Bia vê com a marca
ev(A,"""(()=>{const r=newSol({nome:'Solução Teste Compartilhada',categoria:'Teste',funcionalidades:[{t:'Função de teste',o:'t',f:'',loc:''}]}); S.solutions.push(r); window.__sid=r.id; touchSol(r.id);})()""")
A.wait_for_timeout(5000)
sid=ev(A,"window.__sid"); g=api(B,{'op':'get','path':'catalogo/'+sid})
ck('solução da Ana está no servidor com autoria', g['exists'] and g['data']['criadoPor']=='ana@totvs.com.br' and g['data']['alteradoPor']=='ana@totvs.com.br', str(g)[:200])
ck('entra como NECESSITA VALIDAÇÃO', 'VALIDA' in str(g['data'].get('status','')).upper(), g['data'].get('status'))
ev(B,"window.__ps=0"); 
B.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); B.wait_for_timeout(2500)
ck('Bia recebe a solução sem recarregar (poll)', ev(B,f"S.solutions.some(r=>r.id==='{sid}')"), '')
ck('autoria legível para Bia', 'Ana' in ev(B,f"who(S.solutions.find(r=>r.id==='{sid}')?.criadoPor)"), ev(B,f"who(S.solutions.find(r=>r.id==='{sid}')?.criadoPor)"))
# recarrega Bia: carregamento limpo
B.reload(); B.wait_for_timeout(3500)
ck('após recarregar, Bia continua vendo a solução', ev(B,f"S.solutions.some(r=>r.id==='{sid}')"))
# Bia edita: cv incrementa; criadoPor permanece
ev(B,f"""(()=>{{const r=S.solutions.find(x=>x.id==='{sid}'); r.categoria='Teste editado por Bia'; touchSol(r.id);}})()""")
B.wait_for_timeout(4000)
g=api(B,{'op':'get','path':'catalogo/'+sid})['data']
ck('edição da Bia: cv sobe, criadoPor da Ana preservado, alteradoPor Bia', g['cv']>=2 and g['criadoPor']=='ana@totvs.com.br' and g['alteradoPor']=='bia@totvs.com.br', str({k:g.get(k) for k in ['cv','criadoPor','alteradoPor','categoria']}))
# conflito simultâneo: Ana edita com base antiga
ev(A,f"""(()=>{{const r=S.solutions.find(x=>x.id==='{sid}'); r.nome='Nome mudado pela Ana'; touchSol(r.id);}})()""")
A.wait_for_timeout(4500)
g=api(A,{'op':'get','path':'catalogo/'+sid})['data']
ck('edição concorrente mesclada sem perder alteração da Bia', g['nome']=='Nome mudado pela Ana' and g['categoria']=='Teste editado por Bia', str({k:g.get(k) for k in ['cv','nome','categoria']}))
ck('sem erro de salvar na Ana', 'ERRO' not in ev(A,"UI.persist"), ev(A,"UI.persist"))
# conteúdo integral compartilhado
ev(A,"window.__sc=null; SCONT.doc(scId('s_x',0)).set({id:scId('s_x',0),solId:'s_x',seq:0,total:1,txt:'conteudo'}).then(()=>window.__sc=1).catch(e=>window.__sc=e.message)"); A.wait_for_timeout(1500)
got=api(B,{'op':'get','path':'catalogo_conteudo/s_x__0'})
ck('conteúdo integral importado fica visível a todos', got['ok'] and got['exists'] and got['data']['txt']=='conteudo', str(got)[:150])
# Bia: excluir solução da Ana é negado
ex=api(B,{'op':'delete','path':'catalogo/'+sid}); ck('Bia não exclui registro criado pela Ana', (not ex['ok']) and ex['erro']['codigo']=='proibido', str(ex)[:120])
ck('sem erros de página (Ana/Bia)', not ea[1:] and not eb, str((ea+eb)[:3]))
p.stop()
print('FAILS',F)
