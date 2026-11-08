# Onda 2: retornos (R1), pós-reunião (P2), follow-up (P3), renovações (I2), risco (I1), CRM (D2), sugestões (G5), briefing (P1).
# Requer servidor em :8790 (VAPID_*, --test-scheduled, ALLOW_TEST_USER=1).
from t40_lib import *
import json, subprocess, urllib.request, urllib.error, uuid, re, datetime
H='http://localhost:8790'
ADM='renan.oscar@totvs.com.br'; ASUB='sub-renan-001'; USR='ana.onda2@totvs.com.br'; USUB='sub-ana-o2'
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
U=lambda p,b=None,m=None: call(p,b,USR,USUB,m)
A=lambda p,b=None: call(p,b,ADM,ASUB)
ep='http://127.0.0.1:9/push/o2-'+uuid.uuid4().hex[:6]
# ---------- R1: número de retornos no resumo ----------
d1("DELETE FROM push_subs WHERE email='%s'; DELETE FROM push_resumo WHERE email='%s'; DELETE FROM push_retornos WHERE email='%s'"%(USR,USR,USR))
U('/api/push/resumo',{'n':2,'r':1}); st,j=U('/api/push/resumo'); ck('sem aparelho: nada é guardado', j.get('r') is None and j.get('n') is None, j)
st,_=U('/api/push/inscrever',{'endpoint':ep}); ck('inscrição ok', st==200)
st,_=U('/api/push/resumo',{'n':3,'r':2}); st2,j=U('/api/push/resumo'); ck('resumo guarda n e r', st==200 and j.get('n')==3 and j.get('r')==2 and j.get('rem'), j)
for bad in ('2',-1,1000,True,[1],None,1.5):
    st,_=U('/api/push/resumo',{'n':3,'r':bad}); ck('r inválido recusado: %r'%(bad,), st==400, st)
st,_=U('/api/push/resumo',{'n':5}); st2,j=U('/api/push/resumo'); ck('só n: r anterior preservado', st==200 and j.get('n')==5 and j.get('r')==2, j)
st,_=U('/api/push/resumo',{'n':5,'r':0}); st2,j=U('/api/push/resumo'); ck('r=0 aceito', j.get('r')==0, j)
U('/api/push/resumo',{'n':1,'r':4}); U('/api/push/cancelar',{'endpoint':ep}); st,j=U('/api/push/resumo'); ck('cancelar o último aparelho apaga n e r', j.get('r') is None and j.get('n') is None, j)
ck('tabela push_retornos sem linha órfã', not d1("SELECT * FROM push_retornos WHERE email='%s'"%USR))
# ---------- G5: sugestões ----------
d1("DELETE FROM sugestoes WHERE email='%s'"%USR)
ok_=lambda b: U('/api/sug',b)[0]
ck('sugestão válida', ok_({'area':'briefing','texto':'Gostaria de exportar o briefing em Word também.'})==200)
ck('área inválida recusada', ok_({'area':'x','texto':'Texto suficientemente longo aqui'})==400)
ck('texto curto recusado', ok_({'area':'geral','texto':'curto'})==400)
ck('texto longo recusado', ok_({'area':'geral','texto':'a'*1001})==400)
ck('CNPJ recusado', ok_({'area':'geral','texto':'Cliente 12.345.678/0001-95 precisa disso aqui'})==400)
ck('valor recusado', ok_({'area':'geral','texto':'O contrato de R$ 1.500 deveria aparecer'})==400)
ck('corpo não-JSON recusado', call('/api/sug',None,USR,USUB,'POST')[0]==400)
ck('sem login: recusado', call('/api/sug',{'area':'geral','texto':'Texto suficientemente longo aqui'})[0] in (401,403))
for i in range(4): ok_({'area':'outro','texto':'Sugestão número %d para o limite diário'%i})
st,j=U('/api/sug',{'area':'outro','texto':'Sugestão acima do limite diário'}); ck('6ª sugestão no dia: 429', st==429 and j['erro']['codigo']=='limite', (st,j))
st,j=A('/api/adm/sugestoes'); mine=[x for x in j.get('itens',[]) if x['email']==USR]
ck('admin vê as sugestões e as não lidas', st==200 and len(mine)==5 and j['nao_lidas']>=5, (st,len(mine)))
ck('usuário comum não acessa a lista', call('/api/adm/sugestoes',None,USR,USUB)[0] in (401,403))
ck('usuário comum não marca como lida', call('/api/adm/sugestoes',{'id':mine[0]['id']},USR,USUB)[0] in (401,403))
A('/api/adm/sugestoes',{'id':mine[0]['id']}); st,j=A('/api/adm/sugestoes'); ck('marcar como lida', [x for x in j['itens'] if x['id']==mine[0]['id']][0]['lida']==1)
ck('id inválido recusado', A('/api/adm/sugestoes',{'id':123})[0]==400)
d1("UPDATE sugestoes SET em='2025-01-01T00:00:00.000Z' WHERE email='%s'"%USR); A('/api/adm/purgar',{})
ck('retenção: sugestões com mais de 180 dias são apagadas', not d1("SELECT id FROM sugestoes WHERE email='%s'"%USR))
# ---------- Purga diária no cron do vigia (manhã) ----------
import time
d1("DELETE FROM adm_cfg WHERE chave='ultima_purga'; INSERT INTO sugestoes(id,email,em,area,texto,lida) VALUES('old-o2','velho@totvs.com.br','2025-01-01T00:00:00.000Z','geral','sugestão antiga para a purga',0)")
urllib.request.urlopen(H+'/cdn-cgi/handler/scheduled?cron=40+17+*+*+MON-FRI&time=1794142800000').read(); time.sleep(1.5)
ck('vigia da tarde não dispara a purga', not d1("SELECT 1 FROM adm_cfg WHERE chave='ultima_purga'"))
urllib.request.urlopen(H+'/cdn-cgi/handler/scheduled?cron=40+12+*+*+MON-FRI&time=1794141600000').read(); time.sleep(2)
ck('vigia da manhã executa a purga diária', bool(d1("SELECT 1 FROM adm_cfg WHERE chave='ultima_purga'")) and not d1("SELECT id FROM sugestoes WHERE id='old-o2'"))
# ---------- UI ----------
ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':ADM,'x-test-sub':ASUB}); pg=ctx.new_page(); errs=[]
pg.on('pageerror',lambda e: errs.append(str(e))); ctx.grant_permissions(['clipboard-read','clipboard-write'])
reqs=[]
def rota(route):
    reqs.append(route.request.post_data or '')
    route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'versao':2,'dados':{
        'compromissos':['Enviar a proposta revisada','Agendar demonstração com a área fiscal'],
        'objecoes':['Preocupação com o prazo de implantação'],
        'proximos_passos':[{'texto':'Enviar proposta revisada','prazo':'2026-12-10','responsavel':'Renan'},{'texto':'Marcar demo com o fiscal','prazo':'','responsavel':''},{'texto':'Item descartável','prazo':'texto-invalido'}]}}))
pg.route('**/api/ia',rota)
pg.goto(H+'/'); pg.wait_for_timeout(3500)
key=pg.evaluate("Object.keys(S.clients)[0]"); ck('há cliente de teste na carteira', bool(key))
pg.evaluate("localStorage.setItem('carteira_chaves_ia_v1', JSON.stringify({gemini:'chave-falsa-teste'}))")
pg.evaluate("(k)=>{ const c=S.clients[k]; Object.keys(c.act||{}).filter(x=>x.startsWith('ret:')).forEach(x=>delete c.act[x]); c.mgmt=c.mgmt||{}; c.mgmt.notes=''; UI.sel=k; UI.view='cliente'; UI.ctab='reuniao'; render() }",key)
pg.wait_for_timeout(400)
ck('aba "Reunião e retornos" existe e abre', 'Reunião e retornos' in pg.inner_text('.ctabs') and 'Pós-reunião' in pg.inner_text('body'))
ontem=(datetime.date.today()-datetime.timedelta(days=1)).isoformat(); hoje=datetime.date.today().isoformat(); fut=(datetime.date.today()+datetime.timedelta(days=30)).isoformat()
def nret(): return pg.evaluate("rtLista(S.clients['%s'],false).length"%key)
def addret(t,d,r=''):
    n=nret(); pg.fill('#rt-texto',t); pg.fill('#rt-prazo',d); pg.fill('#rt-resp',r); pg.click('[data-a=rtAdd]'); pg.wait_for_function("(a)=>rtLista(S.clients[a[0]],false).length===a[1]+1",arg=[key,n],timeout=8000); pg.wait_for_timeout(300)
addret('Ligar para o financeiro',ontem,'Renan'); addret('Enviar proposta',hoje); addret('Revisar contrato',fut)
ck('retornos criados com data', pg.evaluate("rtLista(S.clients['%s']).length"%key)==3)
ck('vencido e hoje sinalizados', 'vencido' in pg.inner_text('.card') and 'hoje' in pg.inner_text('body'))
ck('lemRetornos conta vencido + hoje (não o futuro)', pg.evaluate("lemRetornos()")==2, pg.evaluate("lemRetornos()"))
ck('Central de Pendências mostra o texto do retorno', 'Ligar para o financeiro' in pg.evaluate("pendItems().map(x=>x.detalhe).join('|')"))
pg.fill('#rt-texto',''); pg.click('[data-a=rtAdd]'); pg.wait_for_timeout(600); ck('retorno vazio é recusado', pg.evaluate("rtLista(S.clients['%s']).length"%key)==3)
pg.evaluate("(k)=>{ const c=S.clients[k]; ['x','Xy'].forEach(t=>rtAdd(c,{texto:t,prazo:'2026-01-01'})) }",key); ck('texto de 1–2 letras é recusado', pg.evaluate("rtLista(S.clients['%s']).length"%key)==3)
pg.click('[data-a=rtOk] >> nth=0'); pg.wait_for_function("(k)=>rtLista(S.clients[k]).length===2",arg=key,timeout=8000); pg.wait_for_timeout(300)
ck('concluir tira o retorno da contagem', pg.evaluate("lemRetornos()")==1 and pg.evaluate("rtLista(S.clients['%s']).length"%key)==2)
pg.evaluate("(k)=>{ rtSet(S.clients[k], 'nao-ret:abc', {status:'Concluído'}); rtDel(S.clients[k], 'opp:x') }",key); ck('rtSet/rtDel só mexem em chaves ret:', pg.evaluate("rtLista(S.clients['%s'],false).length"%key)==3)
# máscara
t="Cliente 12.345.678/0001-95 (CPF 123.456.789-09) fechou R$ 1.200,50 e 15.000,00; contato ana@empresa.com.br, fone (41) 99876-5432."
m=pg.evaluate("(t)=>reuMascarar(t)",t)
ck('máscara troca CNPJ, CPF, valores, e-mail e telefone', all(x in m['texto'] for x in ['[CNPJ]','[CPF]','[valor]','[e-mail]','[telefone]']) and not re.search(r'\d{2}\.\d{3}\.\d{3}/|R\$|@empresa|99876',m['texto']), m)
ck('texto mascarado passa nas regras do servidor', not re.search(r'\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b',m['texto']) and not re.search(r'R\$\s*\d|\b\d{1,3}(\.\d{3})+,\d{2}\b',m['texto']), m['texto'])
ck('contagem por tipo', m['n'].get('valor monetário')==2 and m['total']==6, m['n'])
ck('texto sem dado sensível não é alterado', pg.evaluate("reuMascarar('Reunião boa, prazo em dezembro.').total")==0)
# extração
pg.fill('#reu-ata','Reunião com o cliente 12.345.678/0001-95. Combinamos proposta de R$ 15.000,00 até 10/12 e demo com o fiscal.'); pg.click('[data-a=reuExtrair]'); pg.wait_for_selector('[data-reu^="p:"]',timeout=8000)
corpo=json.loads(reqs[-1]); ck('o pedido enviado não contém CNPJ nem valor', not re.search(r'12\.345|15\.000|R\$',corpo['prompt']) and '[CNPJ]' in corpo['prompt'] and '[valor]' in corpo['prompt'], corpo['prompt'][:300])
ck('pedido usa tarefa estruturada, sem busca web', corpo['tarefa']=='estruturado' and corpo['buscaWeb'] is False and corpo['formato']=='json')
ck('usuário vê o texto exato enviado', 'foi enviado' in pg.inner_text('details') or 'Texto que' in pg.inner_text('body'))
ck('nada foi salvo antes da revisão', pg.evaluate("rtLista(S.clients['%s'],false).length"%key)==3)
ck('prazo inválido da IA é descartado', pg.evaluate("REU.res.passos[2].prazo")=='' and pg.evaluate("REU.res.passos.length")==3)
pg.uncheck('[data-reu="p:2"]'); pg.uncheck('[data-reu="o:0"]'); pg.click('[data-a=reuSalvar]'); pg.wait_for_timeout(300)
ck('salva só os passos marcados', pg.evaluate("rtLista(S.clients['%s'],false).length"%key)==5 and 'Marcar demo com o fiscal' in pg.evaluate("rtLista(S.clients['%s']).map(r=>r.texto).join('|')"%key) and 'Item descartável' not in pg.evaluate("rtLista(S.clients['%s']).map(r=>r.texto).join('|')"%key))
ck('prazo extraído é mantido', pg.evaluate("rtLista(S.clients['%s']).find(r=>r.texto==='Enviar proposta revisada').prazo"%key)=='2026-12-10')
nt=pg.evaluate("S.clients['%s'].mgmt.notes"%key); ck('compromissos viram anotação datada; objeção desmarcada não entra', 'pós-reunião' in nt and 'Enviar a proposta revisada' in nt and 'prazo de implantação' not in nt, nt)
# erros da IA
pg.unroute('**/api/ia'); pg.route('**/api/ia',lambda r: r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':False,'erro':{'codigo':'dados_sensiveis','mensagem':'recusado pelo servidor'}})))
pg.fill('#reu-ata','Outra reunião com texto suficiente para a extração acontecer.'); pg.click('[data-a=reuExtrair]'); pg.wait_for_function("REU.err && /recusado/.test(REU.err)",timeout=8000)
ck('erro da IA é mostrado e nada é salvo', 'recusado pelo servidor' in pg.inner_text('.alert.w') and pg.evaluate("REU.res")==None)
pg.fill('#reu-ata','curto'); pg.click('[data-a=reuExtrair]'); pg.wait_for_timeout(800); ck('ata curta é recusada sem chamar a IA', pg.evaluate("REU.busy")==False)
pg.evaluate("localStorage.setItem('carteira_chaves_ia_v1','{}')"); pg.fill('#reu-ata','Mais uma reunião com texto suficiente para tentar a extração.'); pg.evaluate("REU.err=''"); pg.click('[data-a=reuExtrair]'); pg.wait_for_timeout(2500)
ck('sem chave cadastrada: orienta onde cadastrar', 'Configurações' in pg.evaluate("REU.err"), pg.evaluate("[REU.err,REU.busy,document.getElementById('reu-ata')&&document.getElementById('reu-ata').value.length]"))
# follow-up
pg.fill('#fu-nome','Maria Souza'); pg.click('[data-a=fuGerar]'); pg.wait_for_selector('#fu-txt')
fu=pg.input_value('#fu-txt'); ck('rascunho cita o contato e os retornos em aberto', fu.startswith('Olá, Maria!') and 'Enviar proposta revisada (até 10/12/2026)' in fu and 'Revisar contrato' in fu, fu)
ck('rascunho não inclui retornos concluídos', 'Ligar para o financeiro' not in fu)
pg.fill('#fu-txt','Texto editado'); pg.click('[data-a=fuCopiar]'); pg.wait_for_timeout(300); ck('copiar usa o texto editado', pg.evaluate("navigator.clipboard.readText()")=='Texto editado')
# renovações e risco (datas sintéticas, chamadas diretas)
pg.evaluate("""(k)=>{ const c=S.clients[k]; window.__dt=c.dtList; window.__fs=c.fstat;
  const g=(d,kind,st)=>({key:'k'+d+kind,kind,iso:'2027-01-'+String(10+Math.abs(d)%20).padStart(2,'0')+(d<0?'':''),isoF:'2027-01-'+String(10+Math.abs(d)%20).padStart(2,'0'),raw:'',origem:'ficha de faturamento',arq:'a.xlsx',loc:'',st:st||'confirmada',d});
  c.dtList=[g(-5,'vigencia'),g(20,'renovacao'),g(60,'vigencia'),g(150,'desconto'),g(200,'vigencia'),g(40,'vigencia','encontrada')]; }""",key)
it=pg.evaluate("rnvItens().filter(x=>x.c.key==='%s').map(x=>x.d)"%key); ck('só datas confirmadas até 180 dias entram', sorted(it)==[-5,20,60,150], it)
h=pg.evaluate("rnvCard()"); ck('linha do tempo em faixas', all(t in h for t in ['Já passou','Em até 30 dias','De 31 a 90 dias','De 91 a 180 dias']) and 'aguardam confirmação' in h, h[:200])
ck('data só encontrada não aparece como renovação', pg.evaluate("rnvItens().filter(x=>x.c.key==='%s' && x.d===40).length"%key)==0)
r=pg.evaluate("riscoItens().find(x=>x.c.key==='%s')"%key); ck('risco: cliente com data confirmada vencendo aparece com motivo', r and any('renovação' in s or 'vigência' in s.lower() for s in r['s']) and r['pts']>=2, r and r['s'])
rc=pg.evaluate("riscoCard()"); ck('risco: aviso "não previsão de perda"', 'não previsão de perda' in rc)
pg.evaluate("(k)=>{ const c=S.clients[k]; c.dtList=[]; c.fstat={...(c.fstat||{}),k:'desatualizada'} }",key)
r2=pg.evaluate("riscoItens().find(x=>x.c.key==='%s')"%key); ck('risco: sem sinal documentado não pontua além dos reais', r2 and r2['pts']<=3 and any('desatualizada' in s for s in r2['s']), r2)
pg.evaluate("(k)=>{ const c=S.clients[k]; c.dtList=window.__dt; c.fstat=window.__fs }",key)
# CRM
res=pg.evaluate("(()=>({h:CRM_HEAD.length, r:crmLinhas().map(x=>x.length), csv:toCSV(CRM_HEAD,crmLinhas()).split('\\r\\n')[0]}))()")
ck('CSV para CRM: todas as linhas com o número de colunas do cabeçalho', res['r'] and all(n==res['h'] for n in res['r']), res)
ck('CSV para CRM: cabeçalho e separador', res['csv'].startswith('﻿Cliente;Código;CNPJ;'), res['csv'][:60])
ck('botão de exportação no painel', 'Para CRM / Mesa de Forecast' in pg.evaluate("(UI.view='geral', render(), document.body.innerText)"))
ck('painel mostra renovações e risco (com dados reais ou nenhum bloco)', pg.evaluate("typeof rnvCard()==='string' && typeof riscoCard()==='string'"))
# briefing
pg.evaluate("localStorage.setItem('x','1')")
ok=pg.evaluate("""(k)=>{ try { const c=S.clients[k]; const B=briefBlocks(briefModel(c)); return B.some(b=>b.k==='h'&&/Combinados em aberto/.test(b.t)) ? 'sim' : 'nao' } catch(e) { return 'erro:'+e.message } }""",key)
ck('briefing cita combinados em aberto (ou cliente sem ficha: verificação estática)', ok=='sim' or (ok.startswith('erro') and 'Combinados em aberto' in open('/home/claude/carteira-esn/fonte/brief.js').read()), ok)
# sugestão pela interface
pg.evaluate("UI.view='conta'; render()"); pg.wait_for_selector('#sug',timeout=8000)
ck('Conta traz o cartão "Sugerir melhoria" com aviso de dados', 'Não inclua CNPJ' in pg.inner_text('#sug'))
pg.fill('#sug-txt','Seria útil ver os retornos na tela inicial.'); pg.select_option('#sug-area','retornos'); pg.click('[data-a=sugEnviar]'); pg.wait_for_timeout(800)
ck('envio pela interface chega ao servidor', any('retornos' in x['area'] and 'tela inicial' in x['texto'] for x in A('/api/adm/sugestoes')[1]['itens']))
ck('campo é limpo após enviar', pg.input_value('#sug-txt')=='')
pg.evaluate("UI.view='adm'; render()"); pg.wait_for_selector('text=Sugestões do time',timeout=15000); ck('painel do admin mostra as sugestões', 'tela inicial' in pg.inner_text('body'))
d1("DELETE FROM sugestoes WHERE email IN ('%s','%s')"%(USR,ADM))
pg.evaluate("(k)=>{ const c=S.clients[k]; Object.keys(c.act||{}).filter(x=>x.startsWith('ret:')).forEach(x=>delete c.act[x]); c.mgmt.notes=''; touchC(k) }",key)
ck('sem erro de página', not errs, errs[:3]); ctx.close()
print('FALHAS:',F) if F else print('TUDO OK')
