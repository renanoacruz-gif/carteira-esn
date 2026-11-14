# Rodada C do prompt mestre: OCR local no navegador (sem envio), radar regulatório agendado e busca dedicada por contrato
from t40_lib import *
import json, base64, uuid, urllib.request, urllib.error
B='http://localhost:8790'
def http(method,path,body=None,headers=None):
    rq=urllib.request.Request(B+path,data=(json.dumps(body).encode() if body is not None else None),method=method,headers={'content-type':'application/json',**(headers or {})})
    try:
        with urllib.request.urlopen(rq,timeout=30) as r: return r.status,r.read().decode('utf-8','replace'),dict(r.headers)
    except urllib.error.HTTPError as e: return e.code,e.read().decode(),dict(e.headers)
J=lambda t: json.loads(t) if t and t[0] in '{[' else {}
run=uuid.uuid4().hex[:6]; hu={'x-test-user':'rc%s@totvs.com.br'%run,'x-test-sub':'rc'+run}; hadm={'x-test-user':'renan.oscar@totvs.com.br','x-test-sub':'sub-renan-001'}
# 1) servidor: CSP, arquivos do leitor, radar e busca
s,t,h=http('GET','/',headers=hu); csp=h.get('content-security-policy') or h.get('Content-Security-Policy') or ''
ck("CSP aplicada libera só compilação de WebAssembly ('wasm-unsafe-eval'); eval de JavaScript segue bloqueado", "'wasm-unsafe-eval'" in csp and "'unsafe-eval'" not in csp.replace("'wasm-unsafe-eval'",''), csp[:160])
for f in ['tesseract.min.js','worker.min.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-lstm.wasm.js','lang/por.traineddata.gz']:
    s,_,hh=http('GET','/vendor/tess/'+f,headers=hu); ck('leitor local servido pela própria ferramenta: '+f, s==200 and 'immutable' in (hh.get('cache-control') or hh.get('Cache-Control') or ''), s)
s,t,_=http('GET','/api/regfontes',headers=hu); ck('executivo consulta as fontes do radar (lista, sem dados internos)', s==200 and isinstance(J(t).get('fontes'),list) and 'hash' not in t, t[:120])
s,t,_=http('POST','/api/adm/regfontes',{'op':'estado'},hu); ck('cadastro de fontes do radar é só do administrador', s in (401,403), s)
s,t,_=http('POST','/api/adm/regfontes',{'op':'adicionar','nome':'Fonte ruim','url':'https://evil.example/x'},hadm); ck('administrador não consegue cadastrar domínio fora da lista oficial', s==400, t[:120])
s,t,_=http('POST','/api/busca',{'q':'Empresa Teste Curitiba'},hu); ck('busca dedicada sem provedor: 503 provedor_nao_configurado, sem resultados', s==503 and J(t).get('erro',{}).get('codigo')=='provedor_nao_configurado' and 'resultados' not in J(t), t[:160])
u=J(http('GET','/api/uso',headers=hu)[1]); ck('consumo próprio informa que não há provedor de busca e conta a tentativa', u.get('busca') is None and any(x['rota']=='/api/busca' and x['usado']==1 and x['limite']==100 for x in u['itens']), u)
g=J(http('GET','/api/adm/integracoes',headers=hadm)[1]); it={x['id']:x for x in g.get('itens',[])}
ck('Integrações: busca dedicada "Não configurado" (nunca conectada sem execução real)', it.get('busca',{}).get('estado')=='nao_configurado' and 'não homologados' in it['busca']['obs'], it.get('busca'))
ck('Integrações: radar regulatório aparece com estado real', it.get('radar_reg',{}).get('estado') in ('nao_configurado','nao_testado','conectado','intervencao'), it.get('radar_reg'))
# 2) OCR local no navegador
P,errs=open_h(hu['x-test-user']); csps=[]; reqs=[]
P.on('console',lambda m: csps.append(m.text) if 'Content Security Policy' in m.text else None)
P.on('request',lambda r: reqs.append(r.url.split('8790')[-1].split('?')[0]))
def up(nome,mime):
    b=base64.b64encode(open(D+nome,'rb').read()).decode()
    return ev(P,"""async()=>{const bin=atob('%s'),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);await ocrPrep([new File([u],'%s',{type:'%s'})]);return S.ocr[0].id}"""%(b,nome,mime))
fim="()=>S.ocr[0] && !['lendo','autorizar'].includes(S.ocr[0].estado)"
up('ocl.png','image/png')
ck('autorização de envio oferece a alternativa "Ler neste aparelho"', ev(P,"()=>!!document.querySelector('[data-a=\"ocrAutLocal\"]') && /não envia nada/.test(document.querySelector('[data-a=\"ocrAutLocal\"]').textContent)"))
P.click('[data-a="ocrAutLocal"]'); P.wait_for_function(fim,timeout=120000)
r=ev(P,"()=>({e:S.ocr[0].estado,t:S.ocr[0].texto,m:S.ocr[0].modelo,av:S.ocr[0].avisos.join(' ')})")
ck('imagem lida no navegador, com acentuação', r['e']=='lido' and 'Indústria Açucareira Paraná' in r['t'] and '11.222.333/0001-81' in r['t'] and 'Manutenção' in r['t'], r)
ck('registro identifica a leitura local e avisa que nada foi enviado', 'OCR local' in r['m'] and 'não foi enviada' in r['av'], r)
ck('nenhuma chamada ao OCR por IA nem a servidor externo', '/api/ocr' not in reqs and all(x.startswith('/') for x in reqs if 'tess' in x), [x for x in reqs if 'ocr' in x])
ck('leitor carregado só da própria ferramenta (4 arquivos, sem o núcleo alternativo)', len(set(x for x in reqs if '/vendor/tess/' in x))==4, sorted(set(x for x in reqs if '/vendor/tess/' in x)))
ck('leitura local não marca a integração de OCR por IA como verificada', ev(P,"()=>!intEst().ocr"))
up('ocl.pdf','application/pdf'); P.click('[data-a="ocrAutLocal"]'); P.wait_for_function(fim,timeout=180000)
r=ev(P,"()=>({e:S.ocr[0].estado,t:S.ocr[0].texto})")
ck('PDF escaneado: páginas convertidas e lidas uma a uma', r['e']=='lido' and '--- página 1 ---' in r['t'] and '--- página 2 ---' in r['t'] and 'Vigência de doze meses' in r['t'], r)
up('ocl_vazio.png','image/png'); P.click('[data-a="ocrAutLocal"]'); P.wait_for_function(fim,timeout=120000)
ck('imagem sem texto → "ilegível" (nenhum texto inventado)', ev(P,"()=>S.ocr[0].estado==='ilegivel' && !S.ocr[0].texto.trim()"))
ck('registro ilegível oferece nova tentativa local e o envio por IA continua opcional', ev(P,"()=>{const h=ocrCard(S.ocr[0]);return /data-a=\"ocLocal\"/.test(h)&&/data-a=\"ocPedir\"/.test(h)}"))
ck('cancelar a autorização mantém o arquivo guardado e oferece os dois caminhos', ev(P,"""async()=>{S.ocr[0].estado='autorizar';const h=ocrCard(S.ocr[0]);return /nada foi enviado/.test(h)&&/data-a="ocLocal"/.test(h)&&/data-a="ocPedir"/.test(h)}"""))
ck('uma leitura por vez: segunda chamada é recusada enquanto a primeira roda', ev(P,"""async()=>{OCL.id='x';const a=S.ocr[0].estado;await ocrLocal(S.ocr[0]);const ok=S.ocr[0].estado===a;OCL.id=null;return ok}"""))
ck('sem violação de CSP e sem erro de página durante o OCR local', not csps and not errs, (csps[:2],errs[:2]))
r=ev(P,"()=>new Promise(r=>setTimeout(()=>{let a,b;try{a=String(new Function('return 1')())}catch(e){a='bloqueado'}try{b=String(eval('1'))}catch(e){b='bloqueado'}r(a+'/'+b)},50))")
ck('com a CSP nova, eval e new Function continuam bloqueados na página', r=='bloqueado/bloqueado', r)
# 3) radar regulatório — visão do executivo (fontes simuladas na resposta do servidor)
FONTES=[{'id':'rf_a','nome':'Portal SPED — notícias','orgao':'Receita Federal','url':'https://sped.rfb.gov.br/noticias','estado':'ok','vista_em':'2026-11-13T12:40:00.000Z','mudou_em':'2026-11-12T12:40:00.000Z'},{'id':'rf_b','nome':'eSocial <img src=x onerror=alert(1)>','orgao':'','url':'https://www.gov.br/esocial','estado':'ok','vista_em':'2026-11-13T12:40:00.000Z','mudou_em':None}]
P.route('**/api/regfontes',lambda r: r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'fontes':FONTES})))
ev(P,"()=>{RGF.t=0;UI.view='refs';render();return 0}"); P.wait_for_function("()=>!!document.querySelector('#rgf')",timeout=8000)
tx=ev(P,"()=>document.querySelector('#rgf').innerText")
ck('radar mostra a fonte que mudou, com a data, e deixa claro que só aponta a mudança', '1 fonte(s) com mudança a conferir' in tx and 'Página alterada em 12/11/2026' in tx and 'só aponta que a página mudou' in tx, tx[:300])
ck('nome de fonte com marcação é exibido como texto', ev(P,"()=>!document.querySelector('#rgf img')"))
ck('radar não cria evento sozinho', ev(P,"()=>(S.regs||[]).length")==0)
P.click('[data-a="rgfUsar"]'); P.wait_for_timeout(200)
ck('"Registrar evento desta fonte" abre o formulário com a fonte preenchida (datas ficam com o executivo)', ev(P,"()=>document.querySelector('#rg-novo').open && document.querySelector('#rg_fu').value==='https://sped.rfb.gov.br/noticias' && document.querySelector('#rg_o').value==='Receita Federal' && !document.querySelector('#rg_n').value && !document.querySelector('#rg_pub').value"))
P.click('[data-a="rgfVisto"]'); P.wait_for_timeout(200)
ck('"Já conferi" tira o aviso e fica guardado por usuário', ev(P,"()=>/sem mudança a conferir/.test(document.querySelector('#rgf').innerText) && S.meta.regVisto.rf_a==='2026-11-12T12:40:00.000Z'"))
FONTES[0]['mudou_em']='2026-11-14T12:40:00.000Z'; ev(P,"()=>{RGF.t=0;render();return 0}"); P.wait_for_function("()=>/1 fonte\\(s\\) com mudança/.test(document.querySelector('#rgf').innerText)",timeout=8000)
ck('nova mudança na mesma fonte volta a avisar', True)
FONTES.clear(); ev(P,"()=>{RGF.t=0;render();return 0}"); P.wait_for_function("()=>/Nenhuma fonte oficial/.test(document.querySelector('#rgf').innerText)",timeout=8000)
ck('sem fontes: orienta o registro manual', True)
# 4) busca dedicada — painel do cliente
ev(P,"""()=>{S.clients.b1={key:'b1',name:'Metalúrgica Boa Vista Ltda',cnpj:'11222333000181',city:'Curitiba',uf:'PR',productsRaw:'Protheus',seg:'Manufatura',segment:'Manufatura',fichas:[],docs:[],mgmt:{},act:{},opps:[],src:{row:1}};runAnalysis(S.clients.b1);return 0}""")
ck('sem provedor: painel informa "não configurada" e não oferece busca', ev(P,"()=>{USO.d={ok:true,busca:null,itens:[]};USO.t=Date.now();const h=bdPanel(S.clients.b1);return /não configurada/.test(h)&&!/bdPrep/.test(h)&&/Nada é simulado/.test(h)}"))
env=[]
def fb(r):
    env.append(r.request.post_data); r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'provedor':'Brave Search','consultadoEm':'2026-11-14T10:00:00.000Z','resultados':[{'titulo':'Metalúrgica amplia fábrica <img src=x onerror=alert(1)>','url':'https://jornal.example/a','host':'jornal.example','trecho':'Nova unidade.','data':'2026-10-02'},{'titulo':'Outra notícia','url':'https://site.example/b','host':'site.example','trecho':'','data':None},{'titulo':'Insegura','url':'http://x.example/c','host':'x.example'}]}))
P.route('**/api/busca',fb)
ev(P,"()=>{USO.d={ok:true,busca:'Brave Search',itens:[]};USO.t=Date.now();BD_ACT.bdPrep({dataset:{k:'b1'}});return 0}")
h=ev(P,"()=>bdPanel(S.clients.b1)")
ck('com provedor: prévia mostra o que será enviado (razão social e cidade) e o que não será', 'Metalúrgica Boa Vista Ltda Curitiba' in h and 'CNPJ' in h and 'Autorizar e buscar' in h and '11222333' not in h, h[:300])
ck('nada é enviado antes da autorização', not env)
ev(P,"()=>BD_ACT.bdBuscar({dataset:{k:'b1'}})"); P.wait_for_function("()=>UI.bd&&UI.bd.res",timeout=8000)
ck('pedido leva só a consulta (sem CNPJ, sem valores)', len(env)==1 and json.loads(env[0])=={'q':'Metalúrgica Boa Vista Ltda Curitiba','n':6}, env)
h=ev(P,"()=>bdPanel(S.clients.b1)")
ck('resultados aparecem como indícios, com fonte e data; URL http é descartada; marcação vira texto', ev(P,"()=>UI.bd.res.length")==2 and 'São indícios' in h and 'jornal.example' in h and 'sem data informada pelo provedor' in h and '<img' not in h, h[:200])
ev(P,"()=>BD_ACT.bdGuardar({dataset:{k:'b1',i:'0'}})")
sg=ev(P,"()=>S.clients.b1.sugFatos[0]")
ck('guardar vira sugestão PENDENTE com identidade ambígua (não vira fato)', sg['estado']=='pendente' and sg['identidadeIA']=='ambigua' and sg['url']=='https://jornal.example/a' and sg['data']=='2026-10-02' and ev(P,"()=>(S.clients.b1.fatos||[]).length")==0, sg)
ev(P,"()=>{BD_ACT.bdGuardar({dataset:{k:'b1',i:'0'}});return 0}"); ck('mesma fonte não é guardada duas vezes', ev(P,"()=>S.clients.b1.sugFatos.length")==1)
ev(P,"()=>{S.clients.b1.sgRej=[normUrl('https://site.example/b')];BD_ACT.bdGuardar({dataset:{k:'b1',i:'1'}});return 0}"); ck('fonte já rejeitada pelo executivo não volta', ev(P,"()=>S.clients.b1.sugFatos.length")==1)
P.unroute('**/api/busca'); P.route('**/api/busca',lambda r: r.fulfill(status=503,content_type='application/json',body=json.dumps({'ok':False,'erro':{'codigo':'provedor_nao_configurado','mensagem':'Nenhum provedor de busca dedicada está configurado no servidor.'}})))
ev(P,"()=>BD_ACT.bdBuscar({dataset:{k:'b1'}})"); P.wait_for_function("()=>UI.bd&&UI.bd.err",timeout=8000)
ck('falha do provedor aparece como erro, sem resultados antigos nem inventados', ev(P,"()=>/Nenhum provedor/.test(UI.bd.err)&&!UI.bd.res"))
# 5) painel do administrador
ctxA=b.new_context(viewport={'width':1400,'height':900},extra_http_headers=hadm); A=ctxA.new_page(); ea=[]; A.on('pageerror',lambda e: ea.append(str(e))); A.route('**/*',route); A.goto(B+'/'); A.wait_for_timeout(3500)
ev(A,"()=>{UI.view='adm';render();return 0}"); A.wait_for_function("()=>!!document.querySelector('#adm-reg')",timeout=15000)
ta=ev(A,"()=>document.querySelector('#adm-reg').innerText")
ck('painel: cartão do radar regulatório no mesmo Painel Administrador, explicando o limite', 'só registra que o texto mudou' in ta and 'Cadastrar e verificar' in ta, ta[:200])
ck('painel: Integrações lista busca dedicada e radar', ev(A,"()=>/Busca dedicada/.test(document.querySelector('#adm-integ').innerText)&&/Radar regulatório/.test(document.querySelector('#adm-integ').innerText)"))
ev(A,"()=>{document.querySelector('#rf_n').value='Teste';document.querySelector('#rf_u').value='https://evil.example/x';return 0}"); A.click('[data-a="admRegAdd"]'); A.wait_for_timeout(1500)
ck('painel: domínio não oficial é recusado e nada é cadastrado', ev(A,"()=>!(ADMV.reg.fontes||[]).some(f=>/evil/.test(f.url))"))
aud=J(http('GET','/api/adm/auditoria',headers=hadm)[1]); ck('tentativa de cadastro fica na trilha de auditoria', 'radar_regulatorio.adicionar' in json.dumps(aud), json.dumps(aud)[:200])
ck('sem erros de página', not errs and not ea, (errs[:2],ea[:2]))
print('RESULT t108:', 'FALHAS '+str(F) if F else 'TUDO OK', '|', 'verificações' ); p.stop()
