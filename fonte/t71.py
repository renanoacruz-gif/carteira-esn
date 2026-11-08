# Onda 3: resumo semanal, roteiro de descoberta, ditado, busca global. Requer servidor em :8790 (ALLOW_TEST_USER=1).
from t40_lib import *
import json, datetime
H='http://localhost:8790'; ADM='renan.oscar@totvs.com.br'; ASUB='sub-renan-001'
STUB="""(()=>{ class SR { start(){ window.__srStart=(window.__srStart||0)+1; this.onstart&&this.onstart(); setTimeout(()=>this.onresult&&this.onresult({resultIndex:0,results:[Object.assign([{transcript:'ligar para o financeiro amanhã'}],{isFinal:true})]}),50) } stop(){ window.__srStop=(window.__srStop||0)+1; this.onend&&this.onend() } } window.webkitSpeechRecognition=SR; window.SpeechRecognition=SR })()"""
def abre(stub, dialogos=None):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':ADM,'x-test-sub':ASUB}); ctx.grant_permissions(['clipboard-read','clipboard-write'])
    ctx.add_init_script(STUB if stub else "delete window.webkitSpeechRecognition; delete window.SpeechRecognition;")
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    if dialogos is not None: pg.on('dialog',lambda d: (dialogos.append(d.message), d.accept() if ACEITA[0] else d.dismiss()))
    pg.goto(H+'/'); pg.wait_for_timeout(3500); return ctx,pg,errs
ACEITA=[True]; msgs=[]
ctx,pg,errs=abre(True,msgs)
key=pg.evaluate("Object.keys(S.clients)[0]"); nome=pg.evaluate("S.clients['%s'].name"%key); ck('há cliente de teste', bool(key))
hoje=datetime.date.today(); iso=lambda n: (hoje+datetime.timedelta(days=n)).isoformat()
pg.evaluate("""([k,a,b,c,d])=>{ const x=S.clients[k]; Object.keys(x.act||{}).filter(i=>i.startsWith('ret:')).forEach(i=>delete x.act[i]); x.mgmt=x.mgmt||{}; x.mgmt.notes='Reunião sobre <b>reforma tributária</b> e retenção na fonte.';
  rtAdd(x,{texto:'Enviar a minuta do aditivo',prazo:a}); rtAdd(x,{texto:'Retornar sobre integração fiscal',prazo:b}); rtAdd(x,{texto:'Revisar proposta de licenças',prazo:c}); rtAdd(x,{texto:'Agendar workshop',prazo:d});
  const ids=Object.keys(x.act).filter(i=>i.startsWith('ret:')); rtSet(x,ids[0],{status:'Concluído',concluido:'%s'}); x.act[ids[0]].criado='%s'; UI.view='geral'; render() }"""%(iso(0),iso(0)),[key,iso(-3),iso(-1),iso(3),iso(20)])
pg.wait_for_timeout(500)
# ---- R5
D=pg.evaluate("(()=>{const d=semanaDados(); return {feitos:d.feitos.length, criados:d.criados, venc:d.vencidos.length, prox:d.proximos.length, val:typeof d.validadas}})()")
ck('semana: contagens corretas (concluído hoje, vencido, próximos 7 dias, fora da janela)', D['feitos']==1 and D['venc']==1 and D['prox']==1 and D['criados']>=1 and D['val']=='number', D)
t=pg.evaluate("semanaTexto(semanaDados())"); ck('texto do resumo lista os atrasados e os próximos', 'Retornos atrasados: 1' in t and 'Retornar sobre integração fiscal' in t and 'Revisar proposta de licenças' in t and 'Agendar workshop' not in t, t)
ck('cartão do resumo na Visão da Carteira', pg.locator('#semana').count()==1 and 'Resumo da semana' in pg.inner_text('#semana'))
pg.click('#semana summary'); pg.click('[data-a=semCopiar]'); pg.wait_for_timeout(300); ck('copiar resumo', 'Resumo da semana' in pg.evaluate("navigator.clipboard.readText()"))
# ---- Q8 busca
def buscar(q):
    pg.fill('#busca-q',q); pg.click('[data-a=buscaIr]'); pg.wait_for_timeout(500)
buscar('ab'); ck('menos de 3 letras: mensagem', 'ao menos 3 letras' in pg.inner_text('#busca'))
buscar('workshop'); ck('acha retorno', 'Retornos' in pg.inner_text('#busca') and 'Agendar workshop' in pg.inner_text('#busca'))
buscar('REFORMA tributária'); ck('acha anotação, sem diferenciar maiúscula/acento', 'Anotações do cliente' in pg.inner_text('#busca'))
ck('trecho do usuário é escapado (sem HTML injetado)', pg.locator('#busca b').count()==0 or all('reforma' not in x.lower() for x in pg.locator('#busca li b').all_inner_texts()[1:]) , pg.inner_html('#busca')[:400])
ck('nenhum <b> foi criado a partir do texto da anotação', '&lt;b&gt;' in pg.inner_html('#busca') )
buscar(nome[:6]); ck('acha cliente pelo nome', 'Clientes' in pg.inner_text('#busca'))
buscar('zzzqqq123'); ck('sem resultado', 'Nada encontrado' in pg.inner_text('#busca'))
buscar('<img src=x onerror=window.__xss=1>'); pg.wait_for_timeout(300); ck('termo com HTML não executa', pg.evaluate("window.__xss")==None and pg.locator('#busca img').count()==0)
buscar('workshop'); pg.click('#busca [data-a=buscaAbrir]'); pg.wait_for_timeout(600)
ck('resultado de retorno abre o cliente na aba Reunião', pg.evaluate("UI.view")=='cliente' and pg.evaluate("UI.ctab")=='reuniao' and pg.evaluate("UI.sel")==key)
pg.evaluate("UI.view='geral'; UI.busca=null; render()"); pg.wait_for_timeout(300)
pg.fill('#busca-q','workshop'); pg.press('#busca-q','Enter'); pg.wait_for_timeout(500); ck('Enter dispara a busca', 'Agendar workshop' in pg.inner_text('#busca'))
pg.click('[data-a=buscaLimpa]'); pg.wait_for_timeout(300); ck('limpar remove os resultados', 'resultado' not in pg.inner_text('#busca'))
n=pg.evaluate("buscaGlobal('a'.repeat(3)).hits.length"); ck('limite de resultados respeitado', n<=40)
# ---- P4 roteiro
pg.evaluate("(k)=>{ UI.sel=k; UI.view='cliente'; UI.ctab='reuniao'; render() }",key); pg.wait_for_timeout(500)
pg.click('[data-a=rotGerar]'); pg.wait_for_selector('#rot-txt'); r=pg.input_value('#rot-txt')
ck('roteiro: abertura, encerramento, nome do cliente e aviso de hipótese', r.startswith('Roteiro de descoberta — '+nome) and '1. Abertura' in r and 'Encerramento' in r and ('hipótese a validar' in r or 'Perguntas do cadastro' in r or r.count('\n')>8), r[:400])
ck('roteiro não afirma fatos sobre contratação', 'já possui' not in r.lower() and 'não possui' not in r.lower())
pg.fill('#rot-txt','Roteiro editado'); pg.click('[data-a=rotCopiar]'); pg.wait_for_timeout(300); ck('copiar usa o texto editado', pg.evaluate("navigator.clipboard.readText()")=='Roteiro editado')
# ---- R6 ditado
ck('com a API de voz: botão de ditado aparece na ata', pg.locator('[data-a=ditar]').count()==1)
pg.click('[data-a=ditar]'); pg.wait_for_timeout(500)
ck('primeiro uso pede confirmação e cita envio de áudio ao fabricante', len(msgs)==1 and 'recebe o áudio' in msgs[0] and 'CNPJ' in msgs[0], msgs)
ck('texto ditado entra no campo da ata', 'ligar para o financeiro amanhã' in pg.input_value('#reu-ata') and pg.evaluate("window.__srStart")==1)
pg.dispatch_event('[data-a=ditar]','click'); pg.wait_for_timeout(700); pg.evaluate("document.getElementById('toast').hidden=true"); ck('segundo toque encerra', pg.evaluate("window.__srStop")==1 and msgs.__len__()==1)
pg.dispatch_event('[data-a=ditar]','click'); pg.wait_for_timeout(500); ck('com consentimento lembrado não pergunta de novo', len(msgs)==1 and pg.evaluate("window.__srStart")==2, (msgs, pg.evaluate("[window.__srStart, window.__srStop, DICT.ativo, localStorage.getItem('ditado.ok')]")))
pg.evaluate("dictParar(); localStorage.removeItem('ditado.ok'); document.getElementById('toast').hidden=true"); ACEITA[0]=False; pg.dispatch_event('[data-a=ditar]','click'); pg.wait_for_timeout(400); ck('recusar a confirmação não inicia o ditado', pg.evaluate("window.__srStart")==2)
ck('sem erro de página (com API)', not errs, errs[:3])
pg.evaluate("(k)=>{ const c=S.clients[k]; Object.keys(c.act||{}).filter(x=>x.startsWith('ret:')).forEach(x=>delete c.act[x]); c.mgmt.notes=''; touchC(k) }",key); ctx.close()
# sem API de voz
ctx,pg,errs=abre(False); key=pg.evaluate("Object.keys(S.clients)[0]")
pg.evaluate("(k)=>{ UI.sel=k; UI.view='cliente'; UI.ctab='reuniao'; render() }",key); pg.wait_for_timeout(500)
ck('sem a API de voz: nenhum botão de ditado', pg.locator('[data-a=ditar]').count()==0 and pg.locator('#reu-ata').count()==1)
ck('sem erro de página (sem API)', not errs, errs[:3]); ctx.close()
print('FALHAS:',F) if F else print('TUDO OK')
