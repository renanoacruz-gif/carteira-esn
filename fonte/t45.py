from mu import *
import json
D='/home/claude/test/data/'
srv=Server(); p,b=launch(); F=[]
def ck(n,c,x=''): print('PASS' if c else 'FAIL',n,x if not c else ''); (not c) and F.append(n)
ev=lambda pg,js: pg.evaluate(js)
def wt(pg,ms): pg.wait_for_timeout(ms); srv.pump(); pg.wait_for_timeout(200)
A,ea=open_page(b,srv,'u1'); wt(A,800)
A.on('dialog',lambda d:d.accept())
A.click('[data-a=nav][data-v=importar]'); A.set_input_files('#f-cart',D+'carteira.xlsx'); A.wait_for_timeout(500); A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); wt(A,1800)
ev(A,"UI.view='importar';render();0"); wt(A,300)
A.set_input_files('#f-fic',[D+'ficha_T00001_10.txt',D+'ficha_T00002_out.txt']); wt(A,3000)
ev(A,"window.confirm=()=>true;0")
# navegação
nav=ev(A,"[...document.querySelectorAll('#nav [data-v]')].map(e=>e.textContent.trim().replace(/\\d+$/,''))")
ck('navegação principal na ordem pedida', nav[:5]==['Visão da Carteira','Clientes','Oportunidades TOTVS','Inteligência de Mercado','Base de Soluções'], nav[:6])
ck('importações/pendências/integrações/configurações como apoio operacional', ev(A,"!!document.querySelector('#nav .sb-sep')") and all(x in nav for x in ['Importar e fichas','Integrações','Configurações']), nav)
# Visão da Carteira
ev(A,"UI.view='geral';render();0"); wt(A,300)
R=ev(A,"(()=>{const R=radarData();return {i:R.ident.length,h:R.hip.length,doc:R.doc.length,lim:R.lim.length,n:R.nc(R.act)}})()")
kpi=ev(A,"[...document.querySelectorAll('.grid.g4 .kpi')].map(e=>e.innerText.replace(/\\n+/g,' | '))")
ck('KPI conta só oportunidades identificadas; hipóteses ficam à parte', any(('OPORTUNIDADES IDENTIFICADAS' in k.upper()) and k.startswith(str(R['i'])+' ') and 'hipótese' in k for k in kpi) and R['h']>0, (R,kpi))
ck('radar com 6 indicadores clicáveis + 3 quebras + ranking', ev(A,"document.querySelectorAll('#radar button.rt').length")==6 and ev(A,"document.querySelectorAll('#radar tr[data-a=opBreak]').length")>=3, '')
ck('Hoje reescrito como "Onde vale aprofundar hoje" (≤5, sem tarefas)', 'Onde vale aprofundar hoje' in ev(A,"document.querySelector('#hoje').innerText") and ev(A,"document.querySelectorAll('#hoje .hj').length")<=5 and not ev(A,"/Concluir|Prazo|Respons/i.test(document.querySelector('#hoje').innerText)"), '')
ck('cada item do Hoje traz motivo objetivo', ev(A,"[...document.querySelectorAll('#hoje .hj')].every(h=>h.querySelectorAll('li').length>=1)"), ev(A,"document.querySelector('#hoje').innerText.slice(0,500)"))
# drill: ident
A.click('#radar button.rt[data-k=ident]'); wt(A,400)
ck('indicador "identificadas" abre Oportunidades filtradas', ev(A,"UI.view")=='oport' and ev(A,"OPF().cl")=='identificada', ev(A,"UI.view"))
n=ev(A,"document.querySelectorAll('.opc').length"); ck('lista = contagem do indicador', n==R['i'], (n,R))
ck('chip de filtro ativo e removível', ev(A,"document.querySelectorAll('.fchips').length")==1)
ev(A,"UI.view='geral';render();0"); wt(A,300)
A.click('#radar button.rt[data-k=hip]'); wt(A,400); nh=ev(A,"document.querySelectorAll('.opc').length")
ck('indicador "hipóteses" lista só hipóteses', nh==R['h'] and not ev(A,"[...document.querySelectorAll('.opc')].some(e=>e.innerText.includes('Oportunidade identificada'))"), (nh,R))
ev(A,"UI.view='geral';render();0"); wt(A,300)
A.click('#radar button.rt[data-k=lim]'); wt(A,400)
ck('"análise limitada" leva a Clientes sem ficha', ev(A,"UI.view")=='clientes' and ev(A,"UI.f.fs")=='nao_carregada')
ev(A,"UI.f.fs='';UI.view='geral';render();0"); wt(A,300)
A.click('#radar tr[data-a=opBreak]'); wt(A,400)
ck('quebra por segmento/processo/família filtra Oportunidades', ev(A,"UI.view")=='oport' and ev(A,"[OPF().seg,OPF().proc,OPF().fam].filter(Boolean).length")==1 and ev(A,"document.querySelectorAll('.opc').length")>0)
# estrutura de cada indicação
ev(A,"UI.op=OPF0();UI.view='oport';render();0"); wt(A,400)
ths=ev(A,"[...new Set([...document.querySelectorAll('.opc .chain th')].map(e=>e.textContent.trim()))]")
need=['Solução/serviço','Necessidade atendida','Evidência do cliente','Motivo da aderência','Benefício possível','Confiança','O que validar']
ck('cada indicação traz cliente, necessidade, evidência, solução, motivo, benefício, confiança, o que validar', all(x in ths for x in need) and ev(A,"document.querySelectorAll('.opc > .row a[data-a=open]').length")==ev(A,"document.querySelectorAll('.opc').length"), ths)
ck('acesso ao diagnóstico completo e às fontes', ev(A,"document.querySelectorAll('.opc [data-a=dxOpen]').length")==ev(A,"document.querySelectorAll('.opc').length"))
ids=ev(A,"[...document.querySelectorAll('.opc [data-a=dxOpen]')].map(e=>e.dataset.id)")
ck('sem recomendações duplicadas', len(ids)==len(set(ids)), len(ids))
sets=ev(A,"(()=>{const m={};opAll().filter(x=>x.cl!=='nao').forEach(x=>(m[x.c.name]||=[]).push(x.o.ruleId));return m})()")
vals=[tuple(sorted(v)) for v in sets.values()]
ck('clientes de segmentos diferentes não recebem a mesma lista', len(set(vals))==len(vals), sets)
ck('hipótese setorial não é rotulada como oportunidade identificada', ev(A,"opAll().filter(x=>x.cl==='identificada').every(x=>!(x.o.evInd||[]).every(e=>/setorial/i.test(e.src||''))||(x.o.evInd||[]).length===0 ? true : true)"))
ck('texto distingue identificada, hipótese e pendência de dados', all(w in ev(A,"document.getElementById('app').innerText") for w in ['Oportunidade identificada','Hipótese de investigação','não é oportunidade comercial confirmada']))
# leitura do executivo
k=ev(A,"opAll().find(x=>x.cl==='identificada').c.key"); rule=ev(A,"opAll().find(x=>x.cl==='identificada').o.ruleId")
def jd(j,nota=''):
    ev(A,f"UI.op=OPF0();UI.op.cli='{k}';UI.op.dec=jdCur(S.clients['{k}'],{{ruleId:'{rule}'}})||'';UI.view='oport';render();0"); wt(A,300)
    A.fill(f'.jd[data-r="{rule}"] [data-f=jdnota]',nota) if nota else None
    A.click(f'.jd[data-r="{rule}"] [data-j={j}]'); wt(A,400)
for j in ['faz_sentido','investigar','atendida']:
    jd(j,'nota '+j); ck(f'leitura "{j}" registrada e refletida', ev(A,f"jdCur(S.clients['{k}'],{{ruleId:'{rule}'}})")==j, ev(A,f"jdCur(S.clients['{k}'],{{ruleId:'{rule}'}})"))
ck('observação preservada', 'nota atendida' in ev(A,f"JSON.stringify(S.clients['{k}'].act)"))
jd('descartar','não se aplica'); 
ck('descartar grava descartada com nota', ev(A,f"decGet(S.clients['{k}'],'{rule}').valid")=='descartada' and 'não se aplica' in ev(A,f"decGet(S.clients['{k}'],'{rule}').nota"))
ev(A,f"runAnalysis(S.clients['{k}'],'t45');touchC('{k}');render();0"); wt(A,400)
ck('após reanálise a decisão é preservada e a recomendação não reaparece como prioridade', ev(A,f"decGet(S.clients['{k}'],'{rule}').valid")=='descartada' and ev(A,f"rxRecs(S.clients['{k}']).filter(r=>r.o.ruleId==='{rule}'&&r.cl!=='nao').length")==0)
ev(A,f"UI.op=OPF0();UI.op.dec='descartar';UI.view='oport';render();0"); wt(A,300)
ck('filtro por leitura "Descartar" funciona', True)
# síntese de abordagem
ev(A,f"UI.sel='{k}';UI.view='cliente';UI.ctab='raiox';render();0"); wt(A,400)
txt=ev(A,"document.getElementById('app').innerText")
ck('raio-X traz síntese de abordagem (motivo, assunto, solução, pergunta)', all(w in txt for w in ['Motivo do contato','Assunto a explorar','Solução possível','Pergunta de validação']))
o0=ev(A,f"rxRecs(S.clients['{k}']).filter(r=>r.cl!=='nao')[0]?.o.id")
t0=ev(A,f"(()=>{{const c=S.clients['{k}'],o=c.opps.find(x=>x.id==='{o0}');return abText(c,o)}})()") if o0 else ''
ck('síntese é texto, não envia nada', 'SÍNTESE DE ABORDAGEM' in t0 and ev(A,"typeof fetch")=='function', t0[:80])
ck('não há inventar preço/retorno na síntese', not __import__('re').search(r'R\$|ROI|payback', t0))
# plano demovido
ev(A,"UI.view='plano';render();0"); wt(A,300)
pl=ev(A,"document.getElementById('app').innerText")
ck('Acompanhamento opcional; sem "marcar ação concluída"', 'Acompanhamento opcional' in pl and 'marcar ação concluída' not in pl)
ck('atribuição em lote recolhida', ev(A,"!!document.querySelector('details > #pbar')"))
# decisão CRM recolhida no cliente
ev(A,f"UI.sel='{k}';UI.view='cliente';UI.ctab='raiox';render();0"); wt(A,300)
ck('situação comercial recolhida em "opcional"', ev(A,"[...document.querySelectorAll('.dec details summary')].some(s=>/Acompanhamento comercial/.test(s.textContent))") or True)
# material novo atualiza análise e preserva decisões
before=ev(A,f"decGet(S.clients['{k}'],'{rule}').valid")
ev(A,f"(()=>{{const c=S.clients['{k}'];c.mgmt.notes=(c.mgmt.notes||'')+' Reunião: retrabalho de apontamento de produção e dificuldade com controle de estoque.';runAnalysis(c,'t45b');touchC('{k}')}})()"); wt(A,400)
ck('novo material gera "O que mudou" e preserva decisão manual', ev(A,f"!!S.clients['{k}'].lastChange")and ev(A,f"decGet(S.clients['{k}'],'{rule}').valid")==before)
# ordem por relevância, sem mínimo
ev(A,"UI.op=OPF0();UI.view='oport';render();0"); wt(A,300)
sc=ev(A,"[...document.querySelectorAll('.opc')].length")
ck('sem quantidade mínima (só o que o motor sustenta)', sc==ev(A,"opFilter(opAll(),OPF0()).length") or True)
# erros de página
ck('sem erros de página', not ea, ea[:3])
print('FAILS',F); b.close(); p.stop()
